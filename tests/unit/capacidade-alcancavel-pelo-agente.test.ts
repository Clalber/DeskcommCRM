/**
 * GATE DO PILAR 1 — o papel exigido por uma capacidade é decisão, não descuido.
 *
 * O épico IA 360 promete "a IA tem mãos". Medindo o catálogo, a promessa hoje
 * tem um buraco estrutural: **nenhum agente publicado alcança capacidade de
 * escrita que exija `manager`** — e a maioria das escritas exige, porque espelha
 * o papel que a rota REST equivalente cobra.
 *
 * ⚠️ O PAPEL DO AGENTE PUBLICADO É `agent`, LITERAL E FIXO, nos dois caminhos
 * que montam o contexto MCP de um agente:
 *   - `lib/ai/runtime/agent.ts` — `auth.role = "agent"`, `scopes: [… "role:agent"]`
 *   - `lib/agent-engine/edge/crm/mcp-tools.ts` — `role: 'agent'`
 * e `lib/ai/runtime/mcp_token.ts` grava `"role:agent"` no token efêmero sem
 * parâmetro para variar. `ensureRole` compara por `ROLE_RANK` → 403.
 *
 * ⚠️ E O 403 NÃO APARECE EM LUGAR NENHUM. `lib/ai/runtime/tools.ts` devolve o
 * erro **ao modelo** em vez de estourar ("keeps the loop alive"): o agente lê
 * `{ error: "Role 'agent' insufficient" }`, segue conversando, e nada na tela
 * diz ao humano que a ferramenta que ele ligou não existe na prática.
 *
 * ESTE TESTE NÃO CONSERTA ISSO — o conserto mexe no modelo de permissão e é
 * decisão do épico (BUG-02 no `HANDOFF-ia-360.md`). O que ele impede é a saída
 * fácil: baixar o papel das tools para `agent` "porque senão não funciona",
 * concedendo em silêncio poder de configuração a quem só devia atender.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { allTools } from "@/lib/mcp/tools";
import { ROLE_RANK, type Role } from "@/lib/auth/types";

const RAIZ = join(__dirname, "..", "..");

/**
 * O papel que um agente publicado de fato recebe. Constante local de propósito —
 * ver o controle positivo abaixo, que confere que ela ainda descreve o código.
 */
const PAPEL_DO_AGENTE_PUBLICADO: Role = "agent";

/**
 * As escritas que são TRABALHO DE ATENDENTE, e por isso exigem só `agent`.
 *
 * Direcionar uma conversa e marcar uma conversa é o que um atendente humano faz
 * o dia inteiro; cobrar `manager` para isso tornaria o agente incapaz de fazer o
 * próprio trabalho. Tudo que MUDA A CASA (etapa do funil, entrada automática de
 * contatos, regra que roda sozinha, negócio no funil, mensagem ao cliente) fica
 * de fora desta lista de propósito.
 *
 * Acrescentar um nome aqui é conceder poder — faça olhando para a rota REST
 * equivalente, e diga por quê.
 */
const ESCRITA_QUE_E_TRABALHO_DE_ATENDENTE: ReadonlyArray<string> = [
  // `/api/v1/conversations/[id]/assign` cobra `agent`: é a fila do dia a dia.
  "crm_assign_conversation",
  // `/api/v1/conversation-tags` é leitura para `viewer`; marcar conversa é
  // trabalho de atendente, e o dano máximo é um filtro sujo — reversível na tela.
  "crm_manage_tags",
];

function alcancavelPeloAgente(requiresRole: Role): boolean {
  return ROLE_RANK[PAPEL_DO_AGENTE_PUBLICADO] >= ROLE_RANK[requiresRole];
}

describe("catálogo de tools — papel exigido e alcance real do agente", () => {
  it("tem pelo menos uma tool (guarda de vacuidade)", () => {
    // Sem isto, um catálogo vazio faria as asserções abaixo passarem por
    // ausência de dado — o falso verde mais barato que existe.
    expect(allTools.length).toBeGreaterThan(0);
  });

  it("escrita que muda a casa exige manager, não o papel de atendente", () => {
    const frouxas = allTools
      .filter((t) => t.category === "write")
      .filter((t) => !ESCRITA_QUE_E_TRABALHO_DE_ATENDENTE.includes(t.name))
      .filter((t) => ROLE_RANK[t.requiresRole] < ROLE_RANK.manager)
      .map((t) => `${t.name} exige apenas '${t.requiresRole}'`);
    expect(frouxas).toEqual([]);
  });

  it("a lista de exceções não guarda nome que já saiu do catálogo", () => {
    // Sem esta guarda, uma exceção sobreviveria à tool que a justificava e
    // passaria a autorizar, em silêncio, a próxima que reusasse o nome.
    const nomes = new Set(allTools.map((t) => t.name));
    const orfas = ESCRITA_QUE_E_TRABALHO_DE_ATENDENTE.filter((n) => !nomes.has(n));
    expect(orfas).toEqual([]);
  });

  /**
   * A LACUNA MEDIDA. Não é aspiração: é o estado de hoje, e está aqui para que o
   * relatório de qualquer wave possa citá-lo sem remedir.
   */
  it("BUG-02: hoje o agente publicado não alcança NENHUMA escrita que exija manager", () => {
    const inalcancaveis = allTools
      .filter((t) => !alcancavelPeloAgente(t.requiresRole))
      .map((t) => t.name);

    // Guarda de vacuidade ao contrário: se um dia isto zerar, o BUG-02 foi
    // resolvido (ou alguém afrouxou os papéis) e este teste TEM que ser
    // reescrito com a realidade nova — em vez de continuar verde sem medir nada.
    expect(inalcancaveis.length).toBeGreaterThan(0);

    // Toda a lacuna é do MESMO motivo. Se aparecer uma inalcançável que não
    // exige manager, é outra causa e o diagnóstico do BUG-02 não a cobre.
    const porOutroMotivo = allTools
      .filter((t) => !alcancavelPeloAgente(t.requiresRole))
      .filter((t) => t.requiresRole !== "manager")
      .map((t) => `${t.name} exige '${t.requiresRole}'`);
    expect(porOutroMotivo).toEqual([]);
  });

  /**
   * CONTROLE POSITIVO — a constante lá em cima ainda descreve o código?
   *
   * ⚠️ SEM ISTO O TESTE PASSA SOZINHO DEPOIS DO CONSERTO. `PAPEL_DO_AGENTE_PUBLICADO`
   * é um literal escrito à mão: no dia em que alguém fizer o token efêmero mintar
   * `role:manager`, tudo aqui continuaria verde descrevendo um mundo que deixou
   * de existir — e a dívida do BUG-02 seguiria registrada como aberta depois de
   * resolvida. Ler o fonte é feio e é o único jeito de a afirmação envelhecer com
   * barulho.
   */
  it("o mint do token efêmero ainda grava o papel que este teste assume", () => {
    const fonte = readFileSync(join(RAIZ, "lib/ai/runtime/mcp_token.ts"), "utf8");
    expect(fonte).toContain(`"role:${PAPEL_DO_AGENTE_PUBLICADO}"`);

    const runtime = readFileSync(join(RAIZ, "lib/ai/runtime/agent.ts"), "utf8");
    expect(runtime).toContain(`\`agent_run:\${run.id}\``);
    expect(runtime).toContain(`"role:${PAPEL_DO_AGENTE_PUBLICADO}"`);
  });
});
