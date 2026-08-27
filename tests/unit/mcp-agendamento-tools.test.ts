import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResultadoDaConsulta } from "@/lib/agenda/consulta";
import type { McpContext } from "@/lib/mcp/types";

/**
 * `crm_find_free_slots` — o COMPORTAMENTO, não a declaração.
 *
 * ## Por que este arquivo existe
 *
 * Dez gates provam que esta ferramenta está bem DECLARADA: bijeção handler↔catálogo,
 * jargão de leigo, coerência category↔risco, alcance pelo papel, teto do pacote. Nenhum
 * deles prova que ela FUNCIONA quando a IA a chama — são coisas diferentes, e por um
 * tempo eu tratei a primeira como se fosse a segunda.
 *
 * ## O que é da TOOL e o que é da COLETA
 *
 * A coleta (`horariosLivresDaOrg`) tem teste próprio, de outro dono. Aqui a fronteira é
 * deliberada: este arquivo cobre a camada que a tool acrescenta — a tradução do pedido
 * do modelo em janela de tempo, os limites, e **qual das duas faces da recusa sai**.
 * Mockar a coleta não é atalho: é o que mantém as duas suítes medindo coisas diferentes.
 */
vi.mock("@/lib/agenda/consulta", async (original) => {
  const real = await original<typeof import("@/lib/agenda/consulta")>();
  return { ...real, horariosLivresDaOrg: vi.fn() };
});

const { horariosLivresDaOrg } = await import("@/lib/agenda/consulta");
const { crmFindFreeSlots } = await import("@/lib/mcp/tools/agendamento");

// O dublê do client existe só para satisfazer o contrato: `horariosLivresDaOrg` está
// mockada, então nada aqui toca banco. `as never` NÃO servia — `never` não é atribuível
// a `SupabaseClient`, e esse erro ficou ESCONDIDO atrás do erro de input enquanto o
// primeiro parâmetro não compilava. Dois defeitos, um mascarando o outro.
const ctx: McpContext = {
  organizationId: "org-1",
  role: "agent",
  // `role` é obrigatório na variante `ai_agent` do `Actor` — foi o TERCEIRO defeito
  // desta constante, e cada um só apareceu depois de o anterior ser corrigido.
  actor: { type: "ai_agent", id: "ag-1", role: "ai_operator" },
  apiTokenId: "tok-1",
  requestId: "req-1",
  supabase: {} as unknown as SupabaseClient,
};

function respondeCom(r: ResultadoDaConsulta) {
  vi.mocked(horariosLivresDaOrg).mockResolvedValue(r);
}

const SUCESSO: ResultadoDaConsulta = {
  ok: true,
  slots: [{ inicio: new Date("2026-09-01T14:00:00Z"), fim: new Date("2026-09-01T14:30:00Z") }],
  fusoDaRegra: "America/Sao_Paulo",
  publicouHorarios: true,
  fusoSuposto: false,
  fontesDefasadas: [],
  agendaExternaNuncaLida: false,
};

describe("crm_find_free_slots", () => {
  // Sem isto, `mock.calls[0]` é sempre a chamada do PRIMEIRO teste que rodou — e os
  // casos seguintes passariam a medir um argumento que não é o deles. Foi o que
  // aconteceu ao escrever este arquivo: dois testes leram a janela de 7 dias do caso
  // anterior e acusaram o código de estar errado.
  beforeEach(() => vi.clearAllMocks());

  it("o caminho PADRÃO é relativo — o modelo não sabe que dia é hoje", async () => {
    // A lição está medida em `lib/mcp/tools/retencao.ts`: num turno real o modelo
    // mandou a data do TREINO dele quando pedimos um instante absoluto. Por isso
    // `dias_a_frente` existe e é o caminho que a `description` manda usar.
    respondeCom(SUCESSO);
    await crmFindFreeSlots.handler({ event_type_slug: "consulta", dias_a_frente: 7 }, ctx);

    const params = vi.mocked(horariosLivresDaOrg).mock.calls[0]![2];
    const dias = (params.ate.getTime() - params.de.getTime()) / 86_400_000;
    expect(Math.round(dias)).toBe(7);
    // E o relógio é INJETADO na coleta, não lido lá dentro.
    expect(params.agora).toBeInstanceOf(Date);
  });

  it("sem período nenhum, assume 14 dias — não estoura nem devolve vazio", async () => {
    respondeCom(SUCESSO);
    await crmFindFreeSlots.handler({ event_type_slug: "consulta" }, ctx);
    const params = vi.mocked(horariosLivresDaOrg).mock.calls[0]![2];
    expect(Math.round((params.ate.getTime() - params.de.getTime()) / 86_400_000)).toBe(14);
  });

  it("a ferramenta fala SLUG, não uuid — o modelo não inventa slug", async () => {
    // `calendar_event_types.slug` existe, nas palavras do próprio schema, para "dar à
    // IA um handle que ela não alucina, ao contrário de um uuid".
    respondeCom(SUCESSO);
    await crmFindFreeSlots.handler({ event_type_slug: "consulta-inicial" }, ctx);
    expect(vi.mocked(horariosLivresDaOrg).mock.calls[0]![2].eventTypeSlug).toBe("consulta-inicial");
  });

  it("período invertido é RESPOSTA, não exceção", async () => {
    // Exceção mata o turno e o assistente emudece na frente do cliente
    // (`pesquisa/repo-mcp.md` §7.5). Limite de negócio volta como texto de ensino.
    const r = (await crmFindFreeSlots.handler(
      { event_type_slug: "c", de: "2026-09-10T00:00:00Z", ate: "2026-09-01T00:00:00Z" },
      ctx,
    )) as { motivo: string; mensagem: string };
    expect(r.motivo).toBe("periodo_invalido");
    expect(r.mensagem).toMatch(/dias_a_frente/);
  });

  it("período longo demais é recusado com o número, não com um 'não'", async () => {
    const r = (await crmFindFreeSlots.handler(
      { event_type_slug: "c", de: "2026-09-01T00:00:00Z", ate: "2027-09-01T00:00:00Z" },
      ctx,
    )) as { motivo: string; mensagem: string };
    expect(r.motivo).toBe("periodo_longo_demais");
    expect(r.mensagem).toMatch(/62/);
  });

  it("⚠️ a recusa que sai é a do CLIENTE, nunca a do OPERADOR", async () => {
    // DECISÃO 20, e é o teste mais importante deste arquivo. `motivoParaOperador`
    // nomeia CAMPO e PESSOA; o modelo repassa o que recebe, e quem ouve é o paciente.
    // Foi o defeito que gerou `lib/mcp/recusa-para-o-modelo.ts`, cujo cabeçalho conta
    // o caso do "seu perfil atual é agent" chegando ao cliente final.
    respondeCom({
      ok: false,
      codigo: "jornada_mal_configurada",
      motivoParaOperador: "fuso horário inválido (em `timezone`) — agenda de Marina Alves",
      motivoParaCliente: "Os horários ainda não estão disponíveis. Avise que a equipe confirma.",
    });
    const r = (await crmFindFreeSlots.handler({ event_type_slug: "c" }, ctx)) as {
      motivo: string;
      mensagem: string;
    };
    expect(r.motivo).toBe("jornada_mal_configurada");
    expect(r.mensagem).toBe("Os horários ainda não estão disponíveis. Avise que a equipe confirma.");
    expect(r.mensagem).not.toMatch(/timezone|Marina|campo/i);
  });

  it("os dois sinais que a lista vazia esconde chegam ao MODELO", async () => {
    // `publicou_horarios` distingue "não publiquei" de "não tenho vaga" (DECISÃO 1.1);
    // `fuso_suposto` avisa que ninguém escolheu o fuso (DECISÃO 20.2). A IA OFERECE
    // horário — se a marca ficasse só na tela, ela afirmaria com confiança um horário
    // que ninguém confirmou.
    respondeCom({ ...SUCESSO, slots: [], publicouHorarios: false, fusoSuposto: true });
    const r = (await crmFindFreeSlots.handler({ event_type_slug: "c" }, ctx)) as {
      horarios: unknown[];
      publicou_horarios: boolean;
      fuso_suposto: boolean;
    };
    expect(r.horarios).toEqual([]);
    expect(r.publicou_horarios).toBe(false);
    expect(r.fuso_suposto).toBe(true);
  });

  it("CONTROLE: o sucesso devolve os horários em ISO — senão os casos acima passariam por vazio", async () => {
    respondeCom(SUCESSO);
    const r = (await crmFindFreeSlots.handler({ event_type_slug: "c" }, ctx)) as {
      horarios: { inicio: string; fim: string }[];
    };
    expect(r.horarios).toHaveLength(1);
    expect(r.horarios[0]!.inicio).toBe("2026-09-01T14:00:00.000Z");
  });
});
