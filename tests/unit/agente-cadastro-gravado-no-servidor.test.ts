/**
 * O LADO SERVIDOR do cadastro do agente — nome, descrição e prioridade.
 *
 * ─── Por que este arquivo existe ────────────────────────────────────────────
 *
 * O teste irmão (`agente-salva-o-nome-editado.test.tsx`) prova que o nome SAI da
 * tela. Ele dubla a server action inteira, então tudo o que acontece depois —
 * a comparação com o valor atual, o UPDATE, a auditoria, a ordem entre validar
 * e escrever — ficava sem nenhuma cobertura.
 *
 * Duas revisões adversariais independentes apontaram o mesmo buraco, e uma delas
 * nomeou a ironia: o instrumento que DIAGNOSTICOU o defeito em produção foi a
 * auditoria (`ai_agent.updated`, zero linhas contra 8 publicações), e a emissão
 * dela era justamente a parte sem teste. Uma regressão na comparação devolveria
 * o sintoma de produção idêntico, com a suíte verde.
 *
 * ─── A propriedade mais cara daqui ──────────────────────────────────────────
 *
 * "Validar tudo antes de escrever qualquer coisa." A primeira versão do conserto
 * gravava o cadastro ANTES de `validarEscopoDaVersao`, que é leitura pura.
 * Bastava o rascunho apontar para um material apagado noutra aba para o nome ser
 * gravado, a auditoria emitida — e a ação devolver erro. A pessoa lia "não foi
 * salvo" com o nome já trocado: a lista mostrando o novo, o editor o velho.
 *
 * Não é o defeito original; é o espelho dele. Fracasso aparente escondendo
 * sucesso parcial. O caso "escopo inválido não grava NADA" é o que trava isso.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const AGENTE = "33333333-3333-4333-8333-333333333333";
const CANAL = "22222222-2222-4222-8222-222222222222";

/** Toda escrita que chegou ao banco, na ordem. É a medida central do arquivo. */
let escritas: { tabela: string; op: "update" | "insert"; dados: Record<string, unknown> }[] = [];
/** Toda linha de auditoria emitida. */
let auditorias: { action: string; metadata?: Record<string, unknown> }[] = [];
/** O agente como está no banco antes do salvamento. */
let agenteNoBanco: Record<string, unknown>;
/** Se a validação de escopo aprova — é o gatilho do caso do sucesso parcial. */
let escopoAprova = true;

vi.mock("@/lib/auth/server", () => ({
  loadAuthUser: async () => ({ id: "user-1" }),
  resolveActiveOrg: async () => ({ orgId: ORG, role: "admin" }),
}));

vi.mock("@/lib/audit", () => ({
  audit: async (linha: { action: string; metadata?: Record<string, unknown> }) => {
    auditorias.push(linha);
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

vi.mock("@/lib/ai/agents/escopo", () => ({
  validarEscopoDaVersao: async () =>
    escopoAprova ? { ok: true } : { ok: false, faltando: "material" },
  mensagemDoEscopo: () => "Material não encontrado.",
}));

/**
 * Um cliente encadeável mínimo. Cada `from()` devolve um contexto que aceita a
 * cadeia inteira do supabase-js e resolve conforme a tabela e a operação — e,
 * de passagem, ANOTA toda escrita, que é o que os casos medem.
 */
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(tabela: string) {
      let op: "select" | "update" | "insert" = "select";
      const ctx: Record<string, unknown> = {};
      const encadear = () => ctx;

      const resolver = () => {
        if (tabela === "ai_agents") {
          return op === "select" ? { data: agenteNoBanco, error: null } : { data: null, error: null };
        }
        // ai_agent_versions: a busca acha um rascunho vigente, e o PATCH nele
        // devolve a mesma versão. É o caminho mais comum do editor.
        return { data: { id: "draft-1", version_number: 8 }, error: null };
      };

      Object.assign(ctx, {
        select: encadear,
        eq: encadear,
        is: encadear,
        order: encadear,
        limit: encadear,
        update: (dados: Record<string, unknown>) => {
          op = "update";
          escritas.push({ tabela, op: "update", dados });
          return ctx;
        },
        insert: (dados: Record<string, unknown>) => {
          op = "insert";
          escritas.push({ tabela, op: "insert", dados });
          return ctx;
        },
        maybeSingle: async () => resolver(),
        single: async () => resolver(),
        // O UPDATE de `ai_agents` é aguardado sem terminal — o builder do
        // supabase-js é "thenable", e sem isto a cadeia trava para sempre.
        then: (aceitar: (v: unknown) => unknown) => Promise.resolve(resolver()).then(aceitar),
      });
      return ctx;
    },
  }),
}));

import { saveAgentDraftAction } from "@/app/app/ai/agents/[id]/_actions";

const VERSAO_VALIDA = {
  system_prompt: "Você é um atendente educado e claro, em pt-BR.",
  provider: "anthropic",
  model: "claude-sonnet-5",
  credential_id: null,
  channel_session_id: CANAL,
  followup: { enabled: false, flow_pointer_ids: [] },
};

const salvar = (identidade: unknown) =>
  saveAgentDraftAction(AGENTE, { ...VERSAO_VALIDA }, identidade);

const escritasEm = (tabela: string) => escritas.filter((e) => e.tabela === tabela);

beforeEach(() => {
  escritas = [];
  auditorias = [];
  escopoAprova = true;
  agenteNoBanco = {
    id: AGENTE,
    kind: "mcp_agent",
    archived_at: null,
    name: "Cloe",
    description: null,
    priority: 0,
  };
});

describe("o cadastro chega ao banco", () => {
  it("nome novo é GRAVADO, e a auditoria diz para quê", async () => {
    const r = await salvar({ name: "Cloe Instagram", description: null, priority: 0 });
    expect(r.ok, JSON.stringify(r)).toBe(true);

    const cadastro = escritasEm("ai_agents");
    expect(cadastro, "o nome não chegou ao banco").toHaveLength(1);
    expect(cadastro[0]!.dados.name).toBe("Cloe Instagram");

    // A auditoria é o instrumento que diagnosticou o defeito original. Sem esta
    // linha, um retorno ao silêncio seria invisível na próxima investigação.
    const linha = auditorias.find((a) => a.action === "ai_agent.updated");
    expect(linha, "nenhuma linha `ai_agent.updated` emitida").toBeDefined();
    expect(linha!.metadata?.renamed_to).toBe("Cloe Instagram");
  });

  it("descrição é LIMPA de verdade — vira null, não some do update", async () => {
    agenteNoBanco.description = "Atende o WhatsApp";
    await salvar({ name: "Cloe", description: null, priority: 0 });

    const cadastro = escritasEm("ai_agents");
    expect(cadastro).toHaveLength(1);
    expect(cadastro[0]!.dados).toHaveProperty("description", null);
  });

  it("a ordem de preferência é gravada com o número escolhido", async () => {
    await salvar({ name: "Cloe", description: null, priority: 7 });
    expect(escritasEm("ai_agents")[0]!.dados.priority).toBe(7);
  });
});

describe("o que NÃO deve virar escrita", () => {
  it("nada mudou: nenhum UPDATE e nenhuma auditoria", async () => {
    // Salvar rascunho é ato frequente. Gravar e auditar o cadastro a cada um
    // encheria a auditoria de linhas dizendo que o agente mudou quando não
    // mudou — a doutrina do repo manda auditar quando houve EFEITO.
    const r = await salvar({ name: "Cloe", description: null, priority: 0 });
    expect(r.ok).toBe(true);

    expect(escritasEm("ai_agents"), "gravou sem ter o que gravar").toHaveLength(0);
    expect(auditorias.filter((a) => a.action === "ai_agent.updated")).toHaveLength(0);
    // E o rascunho foi salvo assim mesmo — este caso não pode virar "não salva".
    expect(escritasEm("ai_agent_versions").length).toBeGreaterThan(0);
  });

  it("⚠️ escopo inválido não grava NADA — nem o cadastro", async () => {
    // A guarda do sucesso parcial. A primeira versão do conserto gravava o nome
    // antes desta validação: a ação devolvia erro e o nome ficava trocado.
    escopoAprova = false;
    const r = await salvar({ name: "Cloe Instagram", description: null, priority: 0 });

    expect(r.ok).toBe(false);
    expect(
      escritas,
      "escreveu apesar de a validação ter reprovado — sucesso parcial escondido atrás de um erro",
    ).toHaveLength(0);
    expect(auditorias).toHaveLength(0);
  });

  it("cadastro AUSENTE é recusado, em vez de virar salvamento mudo", async () => {
    // Tolerar a omissão do argumento guardaria viva a forma exata do defeito:
    // um salvamento que devolve ok e não grava o que a pessoa digitou.
    const r = await salvar(undefined);
    expect(r.ok).toBe(false);
    expect(escritas).toHaveLength(0);
  });

  it("nome vazio é recusado pelo SERVIDOR, não só pela tela", async () => {
    const r = await salvar({ name: "   ", description: null, priority: 0 });
    expect(r.ok).toBe(false);
    expect(escritas).toHaveLength(0);
  });
});
