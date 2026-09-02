/**
 * O agente não pode NEGAR uma reunião que está marcada.
 *
 * ─── O defeito, medido em produção com um cliente do outro lado ──────────────
 *
 * 2026-09-02. O agente marcou a reunião, confirmou ("Marcado: quinta, dia 3, às
 * 10h com o Thiago"), e minutos depois, com a conversa ainda aberta:
 *
 *     cliente: qual horário você marcou para mim?
 *     agente : Neste momento, nenhum horário ficou marcado para você.
 *
 * A linha estava em `calendar_appointments`, `status=confirmed`, o tempo todo.
 * O cliente insistiu, apontando a reunião, e ouviu um pedido de desculpas por
 * uma marcação que tinha acontecido de verdade.
 *
 * ─── A causa: um identificador entregue com o nome de outro ─────────────────
 *
 * O contexto que o modelo recebe (`LeadContext`) traz o id do CONTATO num campo
 * chamado `lead_id` — o turno o preenche com `job.contact_id`. Já a consulta de
 * compromissos tem DOIS parâmetros com esses nomes, e eles apontam para coisas
 * diferentes: `lead_id` é `crm_leads.id`, `contact_id` é `contacts.id`.
 *
 * O modelo usou o nome que recebeu. A busca procurou vínculos de um negócio com
 * o id de uma pessoa, não achou nenhum — e devolvia `ok: true` com lista vazia,
 * que é indistinguível de "não há nada marcado".
 *
 * ─── Por que ESTE arquivo, e não só o campo novo ────────────────────────────
 *
 * O primeiro conserto foi dar ao modelo um campo `contact_id` com o nome
 * verdadeiro. Uma revisão adversarial demonstrou que aquilo sozinho é APOSTA,
 * não conserto: o `lead_id` mentiroso continua no payload, e se o modelo mandar
 * os dois parâmetros — plausível, já que os dois valores são idênticos — o
 * caminho do `lead_id` vence e devolve vazio antes de o filtro de contato ser
 * aplicado. O sintoma de produção voltaria com o conserto aplicado.
 *
 * A mesma revisão mediu que apagar a linha do conserto deixava 63 testes verdes:
 * só o compilador reclamava, e só da EXISTÊNCIA do campo — nunca do valor.
 *
 * Daí os dois eixos aqui: o valor que o contexto carrega, e a recusa que a
 * consulta passou a dar. Zero vínculos tem duas causas — "o negócio não tem
 * nada" e "isto não é um negócio" — e responder as duas com a mesma lista vazia
 * é o que permitiu ao sistema negar, com sinceridade, um compromisso gravado.
 */
import { describe, expect, it } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "9a241afd-f2f2-45b6-84e0-dc922ce037a1";
const LEAD = "f17eb160-3621-445a-abeb-bb4d17b016df";

/**
 * Um cliente encadeável mínimo. `crm_lead_links` devolve o que o caso mandar, e
 * `crm_leads` responde se AQUELE id é mesmo um negócio — que é a distinção nova.
 */
function clienteFalso(opcoes: { vinculos: string[]; leadsExistentes: string[] }) {
  return {
    from(tabela: string) {
      const ctx: Record<string, unknown> = {};
      const filtros: Record<string, unknown> = {};
      const encadear = (col?: string, val?: unknown) => {
        if (col !== undefined) filtros[col] = val;
        return ctx;
      };
      Object.assign(ctx, {
        select: () => ctx,
        eq: (col: string, val: unknown) => encadear(col, val),
        in: () => ctx,
        gte: () => ctx,
        lt: () => ctx,
        lte: () => ctx,
        order: () => ctx,
        limit: () => ctx,
        maybeSingle: async () =>
          tabela === "crm_leads"
            ? {
                data: opcoes.leadsExistentes.includes(String(filtros.id)) ? { id: filtros.id } : null,
                error: null,
              }
            : { data: null, error: null },
        then: (aceitar: (v: unknown) => unknown) =>
          Promise.resolve(
            tabela === "crm_lead_links"
              ? { data: opcoes.vinculos.map((id) => ({ target_id: id })), error: null }
              : { data: [], error: null },
          ).then(aceitar),
      });
      return ctx;
    },
  };
}


describe("zero vínculos: 'não tem nada' e 'não é um negócio' são respostas DIFERENTES", () => {
  it("⚠️ id que NÃO é de um negócio é RECUSADO, e o motivo diz o que fazer", async () => {
    // O caso de produção. Antes, esta chamada devolvia `ok: true, agendamentos: []`
    // — e o agente lia isso como "o cliente não tem nada marcado".
    const { listaAgendamentos } = await import("@/lib/agenda/consulta");
    const db = clienteFalso({ vinculos: [], leadsExistentes: [LEAD] });

    // O uuid do CONTATO chegando no parâmetro `lead_id` — o engano exato.
    const r = await listaAgendamentos(db as never, ORG, { leadId: CONTATO, limite: 20 });

    expect(r.ok, "vazio mudo de novo — o agente vai negar a reunião outra vez").toBe(false);
    if (r.ok) return;
    expect(r.codigo).toBe("lead_inexistente");
    // O motivo tem de ENSINAR: sem nomear o parâmetro certo, o modelo repete o erro.
    expect(r.motivoParaOperador).toContain("contact_id");
  });

  it("negócio que EXISTE e não tem nada marcado devolve lista vazia, como antes", async () => {
    // O controle na direção oposta. Sem ele, a correção poderia ter virado
    // "recusa sempre", trocando um defeito mudo por um barulhento.
    const { listaAgendamentos } = await import("@/lib/agenda/consulta");
    const db = clienteFalso({ vinculos: [], leadsExistentes: [LEAD] });

    const r = await listaAgendamentos(db as never, ORG, { leadId: LEAD, limite: 20 });

    expect(r.ok, "recusou um negócio legítimo que só não tem compromisso").toBe(true);
    if (!r.ok) return;
    expect(r.agendamentos).toEqual([]);
  });
});

describe("o contexto entrega o id do contato com um nome que não mente", () => {
  it("⚠️ `contact_id` existe E carrega o VALOR do contato, não só a chave", async () => {
    // A revisão adversarial mediu que apagar a linha do conserto deixava 63
    // testes verdes: só o `tsc` reclamava, e só da EXISTÊNCIA da chave. Presença
    // provada, valor não — `contact_id: ""` passaria em tudo. Por isso este caso
    // exercita `getLeadContext` de verdade, e cobra o valor.
    const { getLeadContext } = await import("@/lib/agent-engine/edge/crm/get-lead-context");

    // `Queryable` é injetado: um banco de mentira basta, e mantém o caso rápido.
    const db = {
      query: async (sql: string) => {
        if (/from contacts/.test(sql)) {
          return {
            rows: [
              {
                name: "Clalber",
                display_name: null,
                email: null,
                phone_number: "+5519974034731",
                tags: [],
                is_blocked: false,
                source: null,
                consent: null,
                is_anonymized: false,
              },
            ],
          };
        }
        return { rows: [] };
      },
    };

    const r = await getLeadContext(
      db as never,
      {} as never,
      { tenantId: ORG, leadId: CONTATO },
      { historyLimit: 20, maxTokens: 8000 } as never,
    );

    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.context.contact_id, "o contexto não entrega `contact_id`").toBeDefined();
    expect(
      r.context.contact_id,
      "`contact_id` não carrega o id do contato — o nome novo mentiria igual ao velho",
    ).toBe(CONTATO);
    // E os dois têm de coincidir: é o que torna o campo novo utilizável no lugar
    // do antigo sem mudar o valor que já circula.
    expect(r.context.contact_id).toBe(r.context.lead_id);
  });
});
