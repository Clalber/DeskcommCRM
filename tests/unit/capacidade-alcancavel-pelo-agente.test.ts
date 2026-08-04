/**
 * GATE DO PILAR 1 — capacidade que o humano liga, o agente tem que alcançar.
 *
 * O épico IA 360 promete "a IA tem mãos". Uma capacidade declarada no catálogo,
 * oferecida na tela e ligada pelo dono do negócio, mas recusada em tempo de
 * execução por papel insuficiente, é uma promessa quebrada — e quebrada do pior
 * jeito possível: o modelo recebe `{ error: "Role 'agent' insufficient" }` de
 * volta (`lib/ai/runtime/tools.ts` devolve o erro ao modelo em vez de estourar),
 * segue conversando, e NADA aparece na tela do humano dizendo que a ferramenta
 * que ele ligou não existe na prática.
 *
 * ⚠️ O PAPEL DO AGENTE PUBLICADO É `agent`, LITERAL E FIXO, nos dois caminhos
 * que montam o contexto MCP de um agente:
 *   - `lib/ai/runtime/agent.ts` — `auth.role = "agent"`, `scopes: [... "role:agent"]`
 *   - `lib/agent-engine/edge/crm/mcp-tools.ts` — `role: 'agent'`
 * e `lib/ai/runtime/mcp_token.ts` grava `"role:agent"` no token efêmero sem
 * parâmetro para variar. `ensureRole` compara por `ROLE_RANK`, então toda tool
 * com `requiresRole: "manager"` é inalcançável para QUALQUER agente publicado.
 *
 * Este teste é a medição dessa afirmação, não a opinião sobre ela.
 */
import { describe, expect, it } from "vitest";

import { allTools } from "@/lib/mcp/tools";
import { catalogEntry } from "@/lib/mcp/tools/catalog";
import { ROLE_RANK, type Role } from "@/lib/auth/types";

/**
 * O papel que um agente publicado de fato recebe. Constante local de propósito:
 * se algum dia o mint passar a variar o papel, este número deixa de descrever a
 * realidade e o teste tem que ser reescrito com a medição nova — em vez de
 * importar um valor que mudaria em silêncio e faria o gate passar sozinho.
 */
const PAPEL_DO_AGENTE_PUBLICADO: Role = "agent";

/**
 * DÍVIDA MEDIDA em `99cd0fc` e PAGA em seguida: quatro capacidades de escrita
 * (`crm_create_lead`, `crm_update_lead`, `crm_move_lead_stage`,
 * `crm_send_whatsapp_message`) exigiam `manager` e nenhum agente as alcançava.
 *
 * O que decidiu o conserto não foi política de segurança — foi DIVERGÊNCIA. As
 * rotas HTTP equivalentes (`app/api/v1/leads/`, `.../[id]/`, `.../[id]/move/`,
 * `app/api/v1/messages/`) exigem `agent`, todas as quatro. Um atendente humano
 * com papel `agent` cria lead, move etapa e manda mensagem pela tela; a IA, com
 * o mesmo papel `agent`, não podia fazer nenhuma delas. Alinhar não afrouxa
 * nada: restaura a paridade que o produto já pratica.
 *
 * Ao consertar, REMOVA daqui. A segunda asserção cobra que esta lista não
 * envelheça: deixar um nome aqui depois de resolvido mentiria para quem vier.
 */
const INALCANCAVEIS_CONHECIDAS: ReadonlyArray<string> = [];

function alcancavel(requiresRole: Role): boolean {
  return ROLE_RANK[PAPEL_DO_AGENTE_PUBLICADO] >= ROLE_RANK[requiresRole];
}

describe("catálogo de tools — o que o agente publicado consegue de fato usar", () => {
  it("tem pelo menos uma tool (guarda de vacuidade)", () => {
    // Sem isto, um catálogo vazio faria as asserções abaixo passarem por
    // ausência de dado — o falso verde mais barato que existe.
    expect(allTools.length).toBeGreaterThan(0);
  });

  it("nenhuma capacidade nasce inalcançável POR ACIDENTE", () => {
    // A regra não é "toda tool tem que ser alcançável pelo agente" — algumas
    // NÃO devem estar ao alcance dele. `crm_resume_ai_attendance` é o caso que
    // originou esta distinção: `inbound-turn.ts` registra a regra dura de que
    // só o humano/CRM libera um handoff, então um agente capaz de chamá-la se
    // auto-liberaria. Restringir ali é acerto, não defeito.
    //
    // O que este gate caça é a restrição NÃO DECLARADA: a tool que ficou fora
    // do alcance do agente por descuido de `requiresRole` e falha em silêncio
    // (a ponte devolve o erro ao modelo, e o humano que ligou não fica sabendo).
    const acidentais = allTools
      .filter((t) => !alcancavel(t.requiresRole))
      .filter((t) => !catalogEntry(t.name)?.apenasHumano)
      .map((t) => t.name)
      .sort();
    expect(acidentais).toEqual([...INALCANCAVEIS_CONHECIDAS].sort());
  });

  it("capacidade marcada como operada por pessoa está mesmo fora do alcance do agente", () => {
    // A marca é declaração, não trava — quem trava é `requiresRole`. Uma tool
    // marcada `apenasHumano` mas alcançável pelo agente é a pior combinação:
    // diz na tela que só gente opera, e o agente opera assim mesmo.
    const mentirosas = allTools
      .filter((t) => catalogEntry(t.name)?.apenasHumano)
      .filter((t) => alcancavel(t.requiresRole))
      .map((t) => t.name);
    expect(mentirosas).toEqual([]);
  });

  it("dívida declarada não esconde capacidade já consertada", () => {
    const porNome = new Map(allTools.map((t) => [t.name, t]));
    const jaResolvidas = INALCANCAVEIS_CONHECIDAS.filter((nome) => {
      const t = porNome.get(nome);
      // Tool removida do catálogo também sai da dívida — senão a lista
      // sobreviveria à própria capacidade.
      return t === undefined || alcancavel(t.requiresRole);
    });
    expect(jaResolvidas).toEqual([]);
  });
});
