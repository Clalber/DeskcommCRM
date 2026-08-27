/**
 * As ferramentas de AGENDA — a IA consulta horário e (adiante) marca compromisso.
 *
 * ⚠️ FACHADA FINA. Nenhuma regra nasce aqui: o cálculo é de
 * `lib/agenda/horarios-livres.ts` e a coleta é de `lib/agenda/consulta.ts` — a
 * MESMA que `GET /api/v1/agenda/horarios-livres` usa. Duas coletas dariam à IA e
 * à tela respostas diferentes sobre o mesmo horário, e o sintoma seria a IA
 * oferecendo um horário que a tela não mostra.
 *
 * ⚠️ COMPROMISSO NÃO É RETORNO, e o catálogo tem as duas famílias com os MESMOS
 * verbos (`crm_schedule_followup` × marcar consulta). A `description` de cada
 * lado abre pelo discriminante — *a outra pessoa combinou e sabe?* e *isso ocupa
 * o tempo de alguém?* — antes de dizer o que a ferramenta faz. Contrato inteiro
 * em `cal-briefings/CONTRATO-MCP-agenda.md`.
 *
 * ⚠️ `ctx.supabase` É SERVICE ROLE e bypassa a RLS: `horariosLivresDaOrg` recebe
 * `ctx.organizationId` e filtra `organization_id` em toda query. Está escrito lá
 * dentro, e é o que separa esta chamada de um vazamento entre organizações.
 */
import { z } from "zod";

import { horariosLivresDaOrg, listaAgendamentos, MAXIMO_DE_DIAS } from "@/lib/agenda/consulta";
import { SITUACOES_DO_AGENDAMENTO } from "@/lib/agenda/tipos";
import type { McpToolDefinition } from "@/lib/mcp/types";

/** Teto do horizonte pedido — espelha o da rota, e o excesso é erro de chamada. */
const DIAS_PADRAO = 14;

const horariosLivresShape = {
  event_type_slug: z
    .string()
    .min(1)
    .describe("o identificador legível do tipo de atendimento (ex.: 'consulta-inicial')"),
  /**
   * ⚠️ O MODELO NÃO SABE QUE DIA É HOJE — medido neste repo, num turno real: pedido
   * "daqui a três dias", ele mandou a data do treino dele. Por isso o caminho
   * PADRÃO é relativo, e a data absoluta é a exceção de quem realmente a conhece.
   * Mesma decisão de `crm_schedule_followup` (`lib/mcp/tools/retencao.ts`).
   */
  dias_a_frente: z
    .number()
    .int()
    .min(1)
    .max(MAXIMO_DE_DIAS)
    .optional()
    .describe(`quantos dias olhar a partir de agora (padrão ${DIAS_PADRAO}). Use ESTE campo se você não sabe a data de hoje.`),
  de: z.string().datetime({ offset: true }).optional(),
  ate: z.string().datetime({ offset: true }).optional(),
  owner_user_id: z.string().uuid().optional(),
};

export const crmFindFreeSlots: McpToolDefinition<typeof horariosLivresShape> = {
  name: "crm_find_free_slots",
  description:
    "Mostra os horários livres de um tipo de atendimento, já considerando a jornada de trabalho " +
    "do atendente, folgas, o que ele já tem marcado e a agenda externa dele. " +
    "Use ANTES de oferecer horário ao cliente: oferecer um horário que não existe e depois voltar " +
    "atrás é pior do que demorar um instante a mais para responder. " +
    "QUANDO: informe `dias_a_frente` (a partir de agora — ex.: 7 para a próxima semana). " +
    "SE VOCÊ NÃO SABE QUE DIA É HOJE, USE `dias_a_frente` — não tente montar `de`/`ate`. " +
    "Lista vazia NÃO é erro e NÃO significa que a agenda está cheia: leia `publicou_horarios`. " +
    "Se ele for false, o atendente ainda não publicou os horários dele — não invente horários e " +
    "não diga que está lotado; avise que alguém da equipe confirma. " +
    "Se `fuso_suposto` for true, o fuso da agenda não foi escolhido por ninguém, veio do padrão: " +
    "ofereça o horário pedindo confirmação em vez de afirmar.",
  inputSchema: horariosLivresShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const agora = new Date();
    const de = input.de ? new Date(input.de) : agora;
    const ate = input.ate
      ? new Date(input.ate)
      : new Date(de.getTime() + (input.dias_a_frente ?? DIAS_PADRAO) * 86_400_000);

    if (ate.getTime() <= de.getTime()) {
      return {
        horarios: [],
        motivo: "periodo_invalido",
        mensagem: "o fim do período precisa ser depois do começo. Use `dias_a_frente` se não souber a data de hoje.",
      };
    }
    if (ate.getTime() - de.getTime() > MAXIMO_DE_DIAS * 86_400_000) {
      return {
        horarios: [],
        motivo: "periodo_longo_demais",
        mensagem: `o período não pode passar de ${MAXIMO_DE_DIAS} dias. Peça um intervalo menor.`,
      };
    }

    const consulta = await horariosLivresDaOrg(ctx.supabase, ctx.organizationId, {
      eventTypeSlug: input.event_type_slug,
      ownerUserId: input.owner_user_id ?? null,
      de,
      ate,
      agora,
    });

    // Recusa de NEGÓCIO volta como RESPOSTA, nunca exceção: exceção mata o turno
    // e o assistente emudece na frente do cliente (`repo-mcp.md` §7.5).
    if (!consulta.ok) {
      return {
        horarios: [],
        motivo: consulta.codigo,
        // A face do CLIENTE, nunca a do operador: `motivoParaOperador` nomeia
        // campo e pessoa, e o modelo repassa o que recebe (DECISÃO 20).
        mensagem: consulta.motivoParaCliente,
      };
    }

    return {
      horarios: consulta.slots.map((s) => ({
        inicio: s.inicio.toISOString(),
        fim: s.fim.toISOString(),
      })),
      fuso_da_regra: consulta.fusoDaRegra,
      /** false = o atendente NÃO publicou jornada. Diferente de "sem vaga" (DECISÃO 1.1). */
      publicou_horarios: consulta.publicouHorarios,
      /** true = o fuso veio do padrão, ninguém escolheu (DECISÃO 20.2). */
      fuso_suposto: consulta.fusoSuposto,
      /** Agendas externas que não estão saudáveis: o horário pode estar defasado. */
      fontes_defasadas: consulta.fontesDefasadas,
    };
  },
};


const listarShape = {
  contact_id: z.string().uuid().optional(),
  lead_id: z.string().uuid().optional(),
  dia: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("um dia específico, no formato AAAA-MM-DD"),
  owner_user_id: z.string().uuid().optional(),
  /**
   * ⚠️ A constante, NUNCA os literais. `SITUACOES_DO_AGENDAMENTO` é a fonte
   * (`lib/agenda/tipos.ts`), e o invariante `vocabulario-banco-x-typescript` existe
   * para impedir a terceira lista. Escrevi `scheduled|done|cancelled` no contrato antes
   * de ler a fonte, e estava errado nos três.
   */
  situacao: z.enum(SITUACOES_DO_AGENDAMENTO).optional(),
  limite: z.number().int().min(1).max(50).optional(),
};

export const crmListAppointments: McpToolDefinition<typeof listarShape> = {
  name: "crm_list_appointments",
  description:
    "Lista os compromissos com HORA MARCADA de um cliente, ou de um dia da equipe, com a " +
    "situação de cada um. Informe pelo menos um recorte: contact_id, lead_id, dia ou " +
    "owner_user_id — sem recorte a chamada é recusada, porque varrer a agenda inteira não " +
    "responde pergunta nenhuma. " +
    "NÃO CONFUNDA COM `crm_list_followups`, que lista os RETORNOS — as vezes em que nós " +
    "decidimos voltar a falar, sem nada combinado com o cliente. Aqui é o que foi combinado " +
    "COM ele e ocupa o tempo de um atendente. O mesmo cliente pode ter os dois. " +
    "USE ANTES DE MARCAR e antes de cobrar: cliente que já tem consulta marcada não deve " +
    "receber oferta de horário como se não tivesse, nem ser cobrado como se estivesse parado.",
  inputSchema: listarShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const r = await listaAgendamentos(ctx.supabase, ctx.organizationId, {
      contactId: input.contact_id ?? null,
      leadId: input.lead_id ?? null,
      dia: input.dia ?? null,
      ownerUserId: input.owner_user_id ?? null,
      situacao: input.situacao ?? null,
      limite: input.limite ?? 20,
    });

    // Recusa de negócio é RESPOSTA, e a face que sai é a do CLIENTE (DECISÃO 20).
    if (!r.ok) {
      return { compromissos: [], motivo: r.codigo, mensagem: r.motivoParaCliente };
    }

    return {
      compromissos: r.agendamentos.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        inicio: a.iniciaEm,
        fim: a.terminaEm,
        fuso: a.fuso,
        situacao: a.situacao,
        contato_id: a.contatoId,
        atendente_id: a.donoId,
      })),
    };
  },
};
