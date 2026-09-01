/**
 * O nome digitado no editor tem de CHEGAR ao servidor.
 *
 * ─── O defeito, medido em produção ──────────────────────────────────────────
 *
 * A pessoa editava o nome do agente, clicava em publicar, e o nome nunca
 * mudava. Nada falhava: o campo validava, o formulário ficava sujo, o botão
 * salvava com toast verde ("Rascunho v8 salvo."), a publicação respondia ok, o
 * selo passava para "Publicado". Só o nome ficava igual, em toda tela.
 *
 * A causa é estrutural, não de validação. `toVersionPayload` era o ÚNICO
 * construtor do envio em modo edição, e `ai_agent_versions` não tem coluna de
 * nome — nem de descrição, nem de prioridade. Os três campos existiam na tela,
 * tinham estado, tinham validação, e não tinham para onde ir.
 *
 * A medição que fechou o diagnóstico foi a auditoria de produção:
 *
 *     ai_agent.published    -> 8   | ultima=2026-08-31 19:41:04
 *     ai_agent.version_created -> 7
 *     ai_agent.updated      -> (nenhuma linha)
 *
 * Oito publicações, e a ação que grava o cadastro nunca registrada uma única
 * vez — porque o único caminho que a emitia era o "Renomear" do menu do cartão,
 * que fica noutra tela.
 *
 * ─── Por que DOIS casos, e não um ───────────────────────────────────────────
 *
 * O primeiro prova o conserto: o nome sai da tela. O segundo protege contra a
 * repetição — ele compara as CHAVES de `FormState` com a união dos dois
 * payloads, então o próximo campo que alguém acrescentar à tela e esquecer de
 * mandar fica vermelho aqui, em vez de virar outro salvamento que mente.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/app/ai/agents/a1",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() } }));

// A server action é dublada para MEDIR o que a tela manda. É o único ponto que
// interessa: o defeito era o argumento que nunca existia.
const salvou = vi.fn(async () => ({
  ok: true as const,
  data: { version_id: "v9", version_number: 9 },
}));
vi.mock("@/app/app/ai/agents/[id]/_actions", () => ({
  saveAgentDraftAction: (...args: unknown[]) => salvou(...(args as [])),
  publishAgentAction: vi.fn(),
  createMcpAgentAction: vi.fn(),
}));

import {
  AgentForm,
  buildState,
  toIdentityPayload,
  toVersionPayload,
} from "@/app/app/ai/agents/[id]/_components/AgentForm";

const CREDENCIAL = {
  id: "11111111-1111-4111-8111-111111111111",
  provider: "anthropic",
  label: "chave",
  is_active: true,
};
const SESSAO = { id: "22222222-2222-4222-8222-222222222222", label: "WhatsApp", status: "WORKING" };

const AGENTE = {
  id: "a1",
  organization_id: "org-1",
  name: "Cloe",
  description: null,
  priority: 0,
  model: "claude-sonnet-5",
  system_prompt: "Você é um atendente.",
  is_active: true,
  is_default: false,
  config: {},
  guardrails: [],
  active_kb_version_id: null,
  kind: "mcp_agent",
  published_version_id: "v8",
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const VERSAO = {
  id: "v8",
  organization_id: "org-1",
  agent_id: "a1",
  version_number: 8,
  status: "draft",
  system_prompt: "Você é um atendente.",
  provider: "anthropic",
  model: "claude-sonnet-5",
  credential_id: CREDENCIAL.id,
  tool_ids: [],
  channel_session_id: SESSAO.id,
  max_steps: 10,
  token_budget: 50000,
  cost_budget_cents: 50,
  history_message_window: 20,
  history_token_window: 8000,
  handoff_keywords: [],
  handoff_tool_enabled: true,
  cases_enabled: false,
  split_messages: false,
  split_max_chars: 600,
  followup: { enabled: false, flow_pointer_ids: [] },
  operator_enabled: false,
  operator_model: null,
  operator_tool_ids: [],
  pipeline_ids: [],
  knowledge_source_ids: [],
  trigger_config: null,
  published_at: null,
  superseded_at: null,
  created_at: "2026-01-01T00:00:00Z",
  created_by: null,
};

function abrirEditor() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <AgentForm
        mode="edit"
        agent={AGENTE as never}
        credentials={[CREDENCIAL] as never}
        channelSessions={[SESSAO] as never}
        draft={VERSAO as never}
        published={null as never}
        base={VERSAO as never}
        draftObsoleto={null as never}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => salvou.mockClear());

describe("o nome sai da tela", () => {
  it("digitar outro nome e salvar MANDA o nome novo", async () => {
    abrirEditor();

    const campo = document.querySelector<HTMLInputElement>("#name");
    expect(campo, "o editor não tem campo de nome").not.toBeNull();
    fireEvent.change(campo!, { target: { value: "Cloe Instagram" } });

    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));

    await waitFor(() => expect(salvou).toHaveBeenCalledTimes(1));

    // O terceiro argumento é o cadastro. Antes do conserto ele NÃO EXISTIA — a
    // chamada tinha dois argumentos e o nome ficava na tela.
    const [, , cadastro] = salvou.mock.calls[0] as unknown as [string, unknown, { name: string }];
    expect(cadastro, "a tela salvou sem mandar o cadastro do agente").toBeDefined();
    expect(cadastro.name).toBe("Cloe Instagram");
  });

  it("descrição vazia vira null, não string vazia", () => {
    // `""` é invisível na tela e um valor para o banco. A coluna é anulável e
    // `null` é o que ela guarda para "sem descrição".
    const estado = buildState({ agent: AGENTE as never, version: VERSAO as never });
    expect(toIdentityPayload({ ...estado, description: "   " }).description).toBeNull();
    expect(toIdentityPayload({ ...estado, description: " Atende o Direct " }).description).toBe(
      "Atende o Direct",
    );
  });

  it("o nome vai sem espaço sobrando nas pontas", () => {
    const estado = buildState({ agent: AGENTE as never, version: VERSAO as never });
    expect(toIdentityPayload({ ...estado, name: "  Cloe Instagram  " }).name).toBe(
      "Cloe Instagram",
    );
  });

  it("a ordem de preferência escolhida é a que viaja", () => {
    // Este caso existe porque a revisão adversarial demonstrou um FALSO VERDE:
    // trocar `priority: s.priority` por `priority: 0` mantinha os cinco casos
    // verdes. A fixture tem prioridade 0, o caso do nome só olhava o nome, e a
    // guarda de cobertura só vê a CHAVE — presença provada, valor não. Foi
    // sabotado e reproduzido antes de esta linha ser escrita.
    const estado = buildState({ agent: AGENTE as never, version: VERSAO as never });
    expect(toIdentityPayload({ ...estado, priority: 7 }).priority).toBe(7);
  });
});

describe("nenhum campo da tela fica sem caminho de volta", () => {
  it("TODO campo do formulário está num dos dois payloads", () => {
    // Esta é a guarda que impede o defeito de voltar com outro nome de campo.
    // Ela compara chaves de objetos REAIS — não procura texto no arquivo — e é
    // por isso que ela enxerga um campo novo no dia em que ele é criado.
    const estado = buildState({ agent: AGENTE as never, version: VERSAO as never });

    const naTela = Object.keys(estado);
    const enviados = new Set([
      ...Object.keys(toVersionPayload(estado)),
      ...Object.keys(toIdentityPayload(estado)),
    ]);

    const orfaos = naTela.filter((campo) => !enviados.has(campo));
    expect(
      orfaos,
      `campos editáveis que nunca chegam ao servidor: ${orfaos.join(", ")}`,
    ).toEqual([]);
  });

  it("os três campos do cadastro NÃO viajam no payload da versão", () => {
    // O controle na direção oposta. `versionShapeSchema` é `.strict()`: se o
    // nome entrasse ali, o salvamento passaria a falhar com `validation_failed`
    // em vez de gravar — trocaria um defeito silencioso por um barulhento.
    const estado = buildState({ agent: AGENTE as never, version: VERSAO as never });
    const versao = Object.keys(toVersionPayload(estado));

    expect(versao).not.toContain("name");
    expect(versao).not.toContain("description");
    expect(versao).not.toContain("priority");
  });
});
