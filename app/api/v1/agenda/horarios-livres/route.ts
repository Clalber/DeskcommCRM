/**
 * GET /api/v1/agenda/horarios-livres — os horários que dá para oferecer.
 *
 * A rota é fina de propósito: ela busca, monta e devolve. Toda a REGRA mora em
 * função pura e testável — `lerJornadaDoBanco` (a travessia do jsonb),
 * `ocupadosDoDono` (o que ocupa) e `horariosLivres` (o motor). Rota que decide
 * regra é rota que ninguém consegue testar sem subir um banco.
 *
 * ─── Os dois fusos, e por que não podem se encostar ───────────────────────
 *
 * A REGRA vale no fuso da jornada (`attendant_availability.schedule.timezone`);
 * a APRESENTAÇÃO é escolha de quem exibe (`user_metadata.timezone`, DECISÃO 4).
 * Esta rota devolve **instantes** e o fuso da regra ao lado — nunca hora de
 * parede. Formatar aqui obrigaria a escolher um fuso, e a escolha erraria por
 * uma hora para quem está em Manaus, num jeito que passa em todo teste.
 *
 * ─── Escopo ───────────────────────────────────────────────────────────────
 *
 * Client user-scoped (cookie session), e MESMO ASSIM toda query filtra
 * `organization_id` explicitamente. Não é redundância à toa: a RLS é a defesa
 * que vale, e o filtro é a que sobra se uma policy for afrouxada — as cinco
 * tabelas são tenant-aware, e o `CLAUDE.md` cobra o filtro explícito em toda
 * query que as cruza. O `organization_id` vem do cookie validado, NUNCA da
 * query string.
 *
 * O caso concreto que isso cobre: `attendant_availability` seria buscada só por
 * `user_id`, e `user_id` chega pela query (`owner_user_id`). Sem o filtro de
 * org, uma policy frouxa deixaria consultar a agenda de alguém de outro tenant.
 *
 * Read-only ⇒ sem audit (invariante 3 cobra audit em MUTAÇÃO).
 *
 * Piso `viewer`: consultar horário livre é o menor privilégio que existe nesta
 * feature — quem só olha a agenda precisa ver o que está livre.
 */
import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { horariosLivres, type ExcecaoDeData } from "@/lib/agenda/horarios-livres";
import { lerJornadaDoBanco } from "@/lib/agenda/jornada";
import {
  ocupadosDoDono,
  type LinhaDeAgendamento,
  type LinhaDeEventoExterno,
} from "@/lib/agenda/ocupados";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

/** Teto de dias por consulta: uma varredura de ano inteiro é erro de chamada, não pedido. */
const MAXIMO_DE_DIAS = 62;

const querySchema = z.object({
  event_type_id: z.string().uuid(),
  owner_user_id: z.string().uuid().optional(),
  de: z.string().datetime({ offset: true }),
  ate: z.string().datetime({ offset: true }),
});

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("viewer", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg } = authz;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse({
    event_type_id: url.searchParams.get("event_type_id") ?? undefined,
    owner_user_id: url.searchParams.get("owner_user_id") ?? undefined,
    de: url.searchParams.get("de") ?? undefined,
    ate: url.searchParams.get("ate") ?? undefined,
  });
  if (!parsed.success) {
    return fail("validation_failed", "Consulta inválida.", 422, {
      details: parsed.error.flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const de = new Date(parsed.data.de);
  const ate = new Date(parsed.data.ate);
  if (ate.getTime() <= de.getTime()) {
    return fail("validation_failed", "O fim do período precisa ser depois do começo.", 422, {
      requestId,
    });
  }
  if (ate.getTime() - de.getTime() > MAXIMO_DE_DIAS * 86_400_000) {
    return fail("validation_failed", `O período não pode passar de ${MAXIMO_DE_DIAS} dias.`, 422, {
      requestId,
    });
  }

  const supabase = await createClient();

  const { data: tipo, error: erroTipo } = await supabase
    .from("calendar_event_types")
    .select(
      "id, name, is_active, duration_minutes, buffer_before_minutes, buffer_after_minutes, minimum_notice_minutes, slot_interval_minutes, booking_window_days, default_owner_user_id",
    )
    .eq("organization_id", activeOrg.orgId)
    .eq("id", parsed.data.event_type_id)
    .maybeSingle();
  if (erroTipo) return fail("internal_error", erroTipo.message, 500, { requestId });
  if (!tipo) return fail("not_found", "Tipo de agendamento não encontrado.", 404, { requestId });
  if (!tipo.is_active) {
    return fail("validation_failed", `"${tipo.name}" está desativado.`, 422, { requestId });
  }

  const donoId = parsed.data.owner_user_id ?? tipo.default_owner_user_id;
  if (!donoId) {
    // Sem dono não há jornada, e sem jornada não há horário. Devolver lista
    // vazia aqui faria a tela dizer "nenhum horário disponível" para uma
    // configuração incompleta — o erro nomeado é o que leva alguém a corrigir.
    return fail(
      "validation_failed",
      `"${tipo.name}" não tem responsável definido, e sem responsável não há agenda para consultar.`,
      422,
      { requestId },
    );
  }

  const { data: disponibilidade, error: erroDisp } = await supabase
    .from("attendant_availability")
    .select("schedule")
    .eq("organization_id", activeOrg.orgId)
    .eq("user_id", donoId)
    .maybeSingle();
  if (erroDisp) return fail("internal_error", erroDisp.message, 500, { requestId });

  const leitura = lerJornadaDoBanco(disponibilidade?.schedule);
  if (!leitura.ok) {
    // Falha fechada na AÇÃO, aberta na INFORMAÇÃO: schedule corrompido não pode
    // virar lista vazia, senão o dono conclui que está sem vaga e essa conclusão
    // errada não gera chamado nenhum.
    return fail(
      "validation_failed",
      // O consumidor desta rota é a TELA DO OPERADOR, então vai o motivo com o
      // nome do campo. Quem fala com o cliente final (as ferramentas MCP) usa
      // `motivoParaCliente` — dois campos para a escolha ser explícita.
      `A disponibilidade deste responsável está mal configurada: ${leitura.motivoParaOperador}`,
      422,
      { requestId },
    );
  }

  const [{ data: excecoesRaw, error: erroExc }, { data: agendaRaw, error: erroAg }] =
    await Promise.all([
      supabase
        .from("calendar_availability_exceptions")
        .select("exception_date, is_unavailable, start_minute, end_minute")
        .eq("organization_id", activeOrg.orgId)
        .eq("user_id", donoId)
        .gte("exception_date", diaISO(de))
        .lte("exception_date", diaISO(ate)),
      supabase
        .from("calendar_appointments")
        .select("starts_at, ends_at, status")
        .eq("organization_id", activeOrg.orgId)
        .eq("owner_user_id", donoId)
        .lt("starts_at", ate.toISOString())
        .gt("ends_at", de.toISOString()),
    ]);
  if (erroExc) return fail("internal_error", erroExc.message, 500, { requestId });
  if (erroAg) return fail("internal_error", erroAg.message, 500, { requestId });

  // `calendar_external_events` NÃO tem `user_id`: o dono vem por
  // `connection_id → calendar_connections.user_id`. O join traz de carona a
  // situação da conexão, que decide se o horário sai com aviso de defasagem.
  const { data: externosRaw, error: erroExt } = await supabase
    .from("calendar_external_events")
    .select("starts_at, ends_at, transparency, status, calendar_connections!inner(user_id, status)")
    .eq("organization_id", activeOrg.orgId)
    .eq("calendar_connections.user_id", donoId)
    .lt("starts_at", ate.toISOString())
    .gt("ends_at", de.toISOString());
  if (erroExt) return fail("internal_error", erroExt.message, 500, { requestId });

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
    de,
    ate,
    agora: new Date(),
  });

  return ok(
    {
      slots: slots.map((s) => ({ inicio: s.inicio.toISOString(), fim: s.fim.toISOString() })),
      fuso_da_regra: leitura.jornada.timezone,
      // "Não publiquei meus horários" e "não tenho vaga" chegam como a mesma
      // lista vazia se a tela não puder distingui-los (DECISÃO 1.1).
      publicou_horarios: leitura.publicouHorarios,
      // O fuso não foi escolhido por ninguém: veio do default. A tela precisa
      // poder pedir que a pessoa confirme, porque a IA oferece horário com ele.
      fuso_suposto: leitura.fusoSuposto,
      // Fechado na ação, aberto na informação: o horário fica bloqueado, e a
      // tela pode dizer desde quando a agenda conectada parou de atualizar.
      fontes_defasadas: fontesDefasadas,
    },
    { requestId },
  );
}

/** `YYYY-MM-DD` de um instante, em UTC — a régua que a coluna `date` usa. */
function diaISO(instante: Date): string {
  return instante.toISOString().slice(0, 10);
}
