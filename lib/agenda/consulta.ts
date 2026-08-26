/**
 * OS HORÁRIOS LIVRES DE UMA ORGANIZAÇÃO — a coleta, num lugar só.
 *
 * ─── Por que este módulo existe ──────────────────────────────────────────────
 *
 * `horariosLivres` (`./horarios-livres`) é função PURA: recebe jornada, exceções,
 * ocupados e tipo já prontos. Alguém precisa buscar isso no banco, e essa coleta
 * nasceu inline no `GET` de `app/api/v1/agenda/horarios-livres/route.ts`.
 *
 * Só que a rota não é o único consumidor. As ferramentas MCP oferecem horário ao
 * cliente pela conversa, e elas não têm `NextRequest`, nem cookie, nem
 * `requireRole` — têm `organizationId` já resolvido e um client de service role.
 * Copiar a coleta para dentro da tool faria a IA e a tela responderem por regras
 * diferentes sobre o MESMO horário, que é o defeito que o cabeçalho de
 * `lib/mcp/tools/retencao.ts` descreve em voz alta: *"o sistema mentiria para um
 * dos dois"*. O sintoma seria a IA oferecendo um horário que a tela não mostra.
 *
 * Então a coleta mora aqui, e a rota passou a chamá-la. Mesmo caminho para os
 * dois, e o dia em que a regra mudar ela muda uma vez.
 *
 * ─── ⚠️ O CLIENT VEM DE FORA, E ISSO TEM PREÇO ───────────────────────────────
 *
 * A rota passa o client de SESSÃO (a RLS filtra sozinha). A ferramenta MCP passa
 * o ADMIN, que **bypassa a RLS**. Por isso TODA query aqui filtra
 * `organization_id` explicitamente — não é redundância com a RLS, é a única
 * proteção que existe no caminho do service role (anti-pattern nº 10 do
 * `CLAUDE.md`). Quem acrescentar query neste arquivo filtra também, sempre.
 *
 * ─── Recusa: dois textos, duas plateias ──────────────────────────────────────
 *
 * `motivoParaOperador` pode nomear campo e pessoa — quem lê é quem configura.
 * `motivoParaCliente` vai para o modelo e pode chegar ao cliente final: nada de
 * nome de campo, e ele diz o que fazer em seguida em vez de só negar. É a mesma
 * separação que `lerJornadaDoBanco` já faz, e pela mesma razão (DECISÃO 20).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { horariosLivres, type ExcecaoDeData, type Slot } from "./horarios-livres";
import { lerJornadaDoBanco } from "./jornada";
import {
  ocupadosDoDono,
  type LinhaDeAgendamento,
  type LinhaDeEventoExterno,
} from "./ocupados";
import type { SituacaoDaConexao } from "./tipos";

/** Teto de dias por consulta: uma varredura de ano inteiro é erro de chamada, não pedido. */
export const MAXIMO_DE_DIAS = 62;

export type CodigoDeRecusaDaConsulta =
  | "tipo_desconhecido"
  | "tipo_desativado"
  | "sem_responsavel"
  | "jornada_mal_configurada"
  | "erro_interno";

export interface ParametrosDaConsulta {
  eventTypeId: string;
  /** Ausente = o responsável padrão do tipo. */
  ownerUserId?: string | null;
  de: Date;
  ate: Date;
  /** INJETADO, como em `horariosLivres`. Relógio lido aqui dentro é o defeito que `janela-do-canal.ts` documenta. */
  agora: Date;
}

export type ResultadoDaConsulta =
  | {
      ok: true;
      slots: Slot[];
      fusoDaRegra: string;
      /** DECISÃO 1.1: "não publiquei" e "não tenho vaga" não podem chegar como a mesma lista vazia. */
      publicouHorarios: boolean;
      /** DECISÃO 20.2: o fuso veio do default, ninguém escolheu — e a IA oferece horário com ele. */
      fusoSuposto: boolean;
      fontesDefasadas: SituacaoDaConexao[];
    }
  | {
      ok: false;
      codigo: CodigoDeRecusaDaConsulta;
      /** Nomeia campo e pessoa. Plateia: quem configura. */
      motivoParaOperador: string;
      /** Sem nome de campo, e diz o que fazer. Plateia: o modelo, e por tabela o cliente. */
      motivoParaCliente: string;
    };

/** `YYYY-MM-DD` de um instante, em UTC — a régua que a coluna `date` usa. */
function diaISO(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}

const NAO_OFERECA =
  "Não ofereça horários e não diga que está sem vaga — avise que alguém da equipe confirma o horário.";

export async function horariosLivresDaOrg(
  supabase: SupabaseClient,
  organizationId: string,
  params: ParametrosDaConsulta,
): Promise<ResultadoDaConsulta> {
  const { data: tipo, error: erroTipo } = await supabase
    .from("calendar_event_types")
    .select(
      "id, name, is_active, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, slot_interval_minutes, booking_window_days, default_owner_user_id",
    )
    .eq("organization_id", organizationId)
    .eq("id", params.eventTypeId)
    .maybeSingle();

  if (erroTipo) {
    return {
      ok: false,
      codigo: "erro_interno",
      motivoParaOperador: erroTipo.message,
      motivoParaCliente: `Não consegui consultar a agenda agora. ${NAO_OFERECA}`,
    };
  }
  if (!tipo) {
    return {
      ok: false,
      codigo: "tipo_desconhecido",
      motivoParaOperador: "Tipo de agendamento não encontrado.",
      motivoParaCliente: "Esse tipo de atendimento não existe. Pergunte qual atendimento a pessoa quer.",
    };
  }
  if (!tipo.is_active) {
    return {
      ok: false,
      codigo: "tipo_desativado",
      motivoParaOperador: `"${tipo.name}" está desativado.`,
      motivoParaCliente: `"${tipo.name}" não está sendo agendado no momento. ${NAO_OFERECA}`,
    };
  }

  const donoId = params.ownerUserId ?? tipo.default_owner_user_id;
  if (!donoId) {
    // Sem dono não há jornada, e sem jornada não há horário. Lista vazia aqui
    // faria a tela dizer "nenhum horário disponível" para uma configuração
    // incompleta — o erro nomeado é o que leva alguém a corrigir.
    return {
      ok: false,
      codigo: "sem_responsavel",
      motivoParaOperador: `"${tipo.name}" não tem responsável definido, e sem responsável não há agenda para consultar.`,
      motivoParaCliente: `Ainda não há um responsável definido para "${tipo.name}". ${NAO_OFERECA}`,
    };
  }

  const { data: disponibilidade, error: erroDisp } = await supabase
    .from("attendant_availability")
    .select("schedule")
    .eq("organization_id", organizationId)
    .eq("user_id", donoId)
    .maybeSingle();
  if (erroDisp) {
    return {
      ok: false,
      codigo: "erro_interno",
      motivoParaOperador: erroDisp.message,
      motivoParaCliente: `Não consegui consultar a agenda agora. ${NAO_OFERECA}`,
    };
  }

  const leitura = lerJornadaDoBanco(disponibilidade?.schedule);
  if (!leitura.ok) {
    // Falha fechada na AÇÃO, aberta na INFORMAÇÃO: schedule corrompido não pode
    // virar lista vazia, senão o dono conclui que está sem vaga e essa conclusão
    // errada não gera chamado nenhum.
    return {
      ok: false,
      codigo: "jornada_mal_configurada",
      motivoParaOperador: `A disponibilidade deste responsável está mal configurada: ${leitura.motivoParaOperador}`,
      motivoParaCliente: `${leitura.motivoParaCliente} ${NAO_OFERECA}`,
    };
  }

  const [{ data: excecoesRaw, error: erroExc }, { data: agendaRaw, error: erroAg }] =
    await Promise.all([
      supabase
        .from("calendar_availability_exceptions")
        .select("exception_date, is_unavailable, start_minute, end_minute")
        .eq("organization_id", organizationId)
        .eq("user_id", donoId)
        .gte("exception_date", diaISO(params.de))
        .lte("exception_date", diaISO(params.ate)),
      supabase
        .from("calendar_appointments")
        .select("starts_at, ends_at, status")
        .eq("organization_id", organizationId)
        .eq("owner_user_id", donoId)
        .lt("starts_at", params.ate.toISOString())
        .gt("ends_at", params.de.toISOString()),
    ]);

  const erroDeColeta = erroExc ?? erroAg;
  if (erroDeColeta) {
    return {
      ok: false,
      codigo: "erro_interno",
      motivoParaOperador: erroDeColeta.message,
      motivoParaCliente: `Não consegui consultar a agenda agora. ${NAO_OFERECA}`,
    };
  }

  // `calendar_external_events` NÃO tem `user_id`: o dono vem por
  // `connection_id → calendar_connections.user_id`. O join traz de carona a
  // situação da conexão, que decide se o horário sai com aviso de defasagem.
  const { data: externosRaw, error: erroExt } = await supabase
    .from("calendar_external_events")
    .select("starts_at, ends_at, transparency, status, calendar_connections!inner(user_id, status)")
    .eq("organization_id", organizationId)
    .eq("calendar_connections.user_id", donoId)
    .lt("starts_at", params.ate.toISOString())
    .gt("ends_at", params.de.toISOString());
  if (erroExt) {
    return {
      ok: false,
      codigo: "erro_interno",
      motivoParaOperador: erroExt.message,
      motivoParaCliente: `Não consegui consultar a agenda agora. ${NAO_OFERECA}`,
    };
  }

  const excecoes: ExcecaoDeData[] = (excecoesRaw ?? []).map((linha) => ({
    // ⚠️ `exception_date` é `date` no Postgres e chega como "YYYY-MM-DD" pelo
    // PostgREST. `diaLocalISO` compara STRING — um `Date` aqui não casaria com
    // dia nenhum, e o bloqueio sumiria em silêncio.
    data: String(linha.exception_date).slice(0, 10),
    indisponivel: linha.is_unavailable,
    inicioMinuto: linha.start_minute,
    fimMinuto: linha.end_minute,
  }));

  const { ocupados, fontesDefasadas } = ocupadosDoDono(
    (agendaRaw ?? []) as LinhaDeAgendamento[],
    (externosRaw ?? []).map((linha) => {
      const conexao = linha.calendar_connections as unknown as { status?: string } | null;
      return {
        starts_at: linha.starts_at,
        ends_at: linha.ends_at,
        transparency: linha.transparency,
        status: linha.status,
        situacaoDaConexao: conexao?.status ?? "error",
      } satisfies LinhaDeEventoExterno;
    }),
  );

  const slots = horariosLivres({
    jornada: leitura.jornada,
    excecoes,
    ocupados,
    tipo: {
      duracaoMin: tipo.duration_minutes,
      bufferAntesMin: tipo.buffer_before_minutes,
      bufferDepoisMin: tipo.buffer_after_minutes,
      avisoMinimoMin: tipo.minimum_notice_minutes,
      intervaloMin: tipo.slot_interval_minutes,
      janelaDias: tipo.booking_window_days,
    },
    de: params.de,
    ate: params.ate,
    agora: params.agora,
  });

  return {
    ok: true,
    slots,
    fusoDaRegra: leitura.jornada.timezone,
    publicouHorarios: leitura.publicouHorarios,
    fusoSuposto: leitura.fusoSuposto,
    fontesDefasadas,
  };
}
