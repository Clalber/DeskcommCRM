/**
 * Avisar um número NOSSO quando o lead chega a uma etapa escolhida.
 *
 * ⚠️ O PEDIDO, e por que ele não é "mandar mensagem"
 *
 * "Não vou ficar com a plataforma aberta 24h — isso não vai acontecer."
 * Notificação que só existe dentro da tela não é notificação. O destinatário
 * aqui é a NOSSA equipe: o atendente que vai assumir, o dono que quer saber que
 * alguém marcou. Não é cliente, e é isso que muda todas as guardas.
 *
 * Por isso ela não é um campo em `send_whatsapp_message`: aquela ação passa por
 * `checarGuardasDeContato` — existe · não bloqueado · tem telefone ·
 * consentimento —, e as quatro falam de CLIENTE. Enfiar um `to_number` lá
 * viraria `if (numero) pula todas as guardas`, que é a forma que produz
 * acidente.
 *
 * ─── AS QUATRO COISAS QUE ESTE ARQUIVO IMPEDE ──────────────────────────────
 *
 * 1. **Aviso em dobro no celular.** O `event-log/drain` devolve à fila evento
 *    preso em `processing` há mais de 10 minutos, e `consumed_by` só é gravado
 *    depois do handler INTEIRO. Um crash entre o envio e o registro reexecuta
 *    todas as ações. Por isso a RESERVA vem antes do envio, e `23505` significa
 *    "já avisei" — não "erro".
 *
 * 2. **O número virar um lead.** Todo envio volta pelo webhook como
 *    `fromMe=true`, e a ingestão cria contato e conversa para o destinatário.
 *    A reserva é o que a ingestão consulta para reconhecer o próprio eco.
 *
 * 3. **Tempestade.** Uma enxurrada de mudança de etapa vira uma enxurrada de
 *    WhatsApp, e o primeiro dia de uso real termina com a pessoa silenciando a
 *    conversa — o que desliga a notificação para sempre. O teto por hora usa
 *    upsert atômico: `count(*)` seguido de envio deixa dois workers passarem
 *    com 19, e o teto vira 21.
 *
 * 4. **Queimar o número da empresa.** O aviso sai pelo MESMO número que atende
 *    cliente. `espacarEnvio` dá o intervalo, e `recordSend` faz o envio contar
 *    no orçamento anti-banimento — que hoje NENHUMA ação de automação alimenta
 *    (`checkDailyLimit` lê `channel_session_warmup`, tabela sem escritor no
 *    produto; quem conta é `pacing_ledger`, escrito só pelo agent-engine).
 *    Este arquivo não herda essa falha; consertá-la nas outras ações é issue
 *    separada.
 */
import { registerAction } from "@/lib/automation/actions";
import type { ActionCtx, ActionResultDetail } from "@/lib/automation/types";
import { renderTemplate } from "@/lib/automation/template";
import { espacarEnvio } from "@/lib/automation/throttle";
import { CHANNEL_SESSION_REF_COLUMNS, getAdapter, resolveSessionRef } from "@/lib/channels";
import { capabilitiesOf } from "@/lib/channels/capabilities";
import type { ChannelProvider } from "@/lib/channels/capabilities";
import { ARCHIVED_AT } from "@/lib/channels/archived";
import { audit } from "@/lib/audit";

/** Teto por (regra, número, hora). Ver a coisa nº 3 do cabeçalho. */
export const TETO_POR_HORA = 20;

/** Tentativas dentro do próprio turno, antes de desistir. */
const TENTATIVAS = 2;

const TIPO = "notify_number";

function recusa(motivo: string, detalhe?: Record<string, unknown>): ActionResultDetail {
  return { type: TIPO, status: "skipped", detail: { reason: motivo, ...detalhe } };
}

async function execute(ctx: ActionCtx, config: Record<string, unknown>): Promise<ActionResultDetail> {
  const numeroId = typeof config.notify_number_id === "string" ? config.notify_number_id : null;
  const sessionId = typeof config.channel_session_id === "string" ? config.channel_session_id : null;
  const template = typeof config.template === "string" ? config.template : null;
  if (!numeroId || !sessionId || !template) {
    return { type: TIPO, status: "failed", error: "missing_config" };
  }

  // ─── O destino, SEMPRE da tabela e SEMPRE escopado à org do contexto ──────
  //
  // `organizationId` vem do ctx (fonte confiável), nunca do config: o admin
  // client bypassa RLS, e um id de número de outra organização viraria envio
  // cross-tenant pelo número desta.
  const { data: numero, error: erroNumero } = await ctx.admin
    .from("org_notify_numbers")
    .select("id, phone_e164, label")
    .eq("id", numeroId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (erroNumero) return { type: TIPO, status: "failed", error: erroNumero.message };
  if (!numero) return recusa("numero_nao_registrado");

  // ─── Pré-voo do canal ─────────────────────────────────────────────────────
  //
  // Sem isto o envio "funciona" e não sai: há adapter que devolve
  // `{ externalId: null }` SEM lançar quando não há configuração, e o ledger
  // registraria sucesso de um aviso que nunca chegou.
  const { data: sessao, error: erroSessao } = await ctx.admin
    .from("channel_sessions")
    // `CHANNEL_SESSION_REF_COLUMNS` em vez de nomear as colunas uma a uma: a
    // doutrina de restrição de canal proíbe escrever nome de provider fora de
    // `lib/channels`, e os nomes das colunas de referência os carregam. Quem
    // sabe de qual coluna cada canal precisa é o `resolveSessionRef`.
    .select(`id, status, ${CHANNEL_SESSION_REF_COLUMNS}, ${ARCHIVED_AT}`)
    .eq("id", sessionId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (erroSessao) return { type: TIPO, status: "failed", error: erroSessao.message };
  if (!sessao) return recusa("canal_nao_encontrado");
  if ((sessao as Record<string, unknown>)[ARCHIVED_AT] != null) return recusa("canal_arquivado");
  if (sessao.status !== "WORKING") return recusa("canal_fora_do_ar", { status: sessao.status });

  // O gate é por CAPACIDADE, não por nome de provider. O atendente nunca
  // escreveu para o número da empresa, então não há janela de 24h aberta —
  // num canal sem texto livre fora da janela o aviso falharia sempre.
  const provider = sessao.provider as ChannelProvider;
  if (!capabilitiesOf(provider).freeformOutsideWindow) {
    return recusa("canal_sem_texto_livre", { provider });
  }

  const adapter = getAdapter(provider);
  if (!adapter.isConfigured()) return recusa("canal_sem_configuracao");

  // ─── A RESERVA, antes do envio ────────────────────────────────────────────
  const { data: reserva, error: erroReserva } = await ctx.admin
    .from("org_notify_sends")
    .insert({
      organization_id: ctx.organizationId,
      rule_id: ctx.ruleId,
      event_id: ctx.event.id,
      notify_number_id: numero.id,
      channel_session_id: sessionId,
      phone_e164: numero.phone_e164,
      status: "reserved",
    })
    .select("id")
    .maybeSingle();

  if (erroReserva) {
    // `23505` é o retry do drain chegando de novo. Não é erro: é a reserva
    // fazendo o trabalho dela — o aviso já saiu, e não sai duas vezes.
    if (erroReserva.code === "23505") return recusa("ja_notificado");
    return { type: TIPO, status: "failed", error: erroReserva.message };
  }
  const reservaId = reserva?.id as string | undefined;
  if (!reservaId) return { type: TIPO, status: "failed", error: "reserva_sem_id" };

  // ─── O teto, por upsert atômico ───────────────────────────────────────────
  //
  // ⚠️ DEPOIS da reserva, de propósito. Antes dela, cada reentrega do evento
  // (que morre no 23505) e cada falha de envio consumiriam uma vaga: uma tarde
  // de eventos represados comeria o teto de 20 sem UM aviso ter saído, e o
  // primeiro aviso legítimo seguinte seria recusado por `teto_atingido`.
  const { data: quota, error: erroQuota } = await ctx.admin.rpc("fn_notify_quota_incr", {
    p_org: ctx.organizationId,
    p_rule: ctx.ruleId,
    p_numero: numero.id,
  });
  if (erroQuota) return { type: TIPO, status: "failed", error: erroQuota.message };
  const usados = typeof quota === "number" ? quota : Number(quota ?? 0);
  if (usados > TETO_POR_HORA) {
    return recusa("teto_atingido", { por_hora: TETO_POR_HORA });
  }

  const corpo = renderTemplate(template, ctx.context);

  let externalId: string | null = null;
  let ultimoErro: string | null = null;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa += 1) {
    // O espaçamento é do NÚMERO que envia, e é compartilhado com as mensagens
    // de cliente — o WhatsApp não distingue quem recebe.
    await espacarEnvio(sessionId);
    try {
      const r = await adapter.send({
        organizationId: ctx.organizationId,
        sessionRef: resolveSessionRef(sessao),
        to: adapter.resolveRecipient({
          isGroup: false,
          groupChatId: null,
          phoneNumber: numero.phone_e164,
          waIdentity: null,
          waLid: null,
        }) as string,
        // `sentVia` só distingue IA de pessoa, e existe para canal cuja
        // permissão de reengajamento é exclusiva de atendimento humano. Um
        // aviso interno não é nem um nem outro; `user` é o valor honesto aqui
        // — quem pediu o aviso foi uma pessoa, ao criar a regra.
        sentVia: "user",
        providerConversationId: null,
        kind: "text",
        body: corpo,
      });
      externalId = r.externalId;
      // `null` é FALHA, nunca sucesso: o adapter não lança quando o canal não
      // está configurado, e registrar `sent` aqui seria mentir para quem confia
      // que seria avisado.
      if (externalId !== null) break;
      ultimoErro = "adapter_devolveu_null";
    } catch (err) {
      ultimoErro = err instanceof Error ? err.message : String(err);
    }
  }

  const agora = new Date().toISOString();
  const { error: erroDesfecho } = await ctx.admin
    .from("org_notify_sends")
    .update({
      status: externalId !== null ? "sent" : "failed",
      external_id: externalId,
      attempts: TENTATIVAS,
      sent_at: externalId !== null ? agora : null,
    })
    .eq("id", reservaId)
    .eq("organization_id", ctx.organizationId);

  // ⚠️ Este erro NÃO pode ser engolido. A reserva fica `reserved`, e enquanto
  // ela estiver assim a ingestão trata como ECO toda mensagem `fromMe` para
  // aquele número — inclusive a que uma pessoa digitou no celular para um
  // cliente de verdade, que sumiria do CRM em silêncio. O varredor só fecha
  // depois de 10 minutos; até lá, quem lê o log é a única chance de saber.
  if (erroDesfecho) {
    console.error("[notify_number] desfecho não gravado — reserva segue em voo", {
      notify_send_id: reservaId,
      organization_id: ctx.organizationId,
      erro: erroDesfecho.message,
    });
  }

  if (externalId === null) {
    // Aviso que não chega e não avisa ninguém é pior que não existir: quem
    // configurou CONFIA que seria avisado. O varredor abre o item na Central.
    return { type: TIPO, status: "failed", error: ultimoErro ?? "envio_falhou" };
  }

  // O envio conta no orçamento anti-banimento do número. Ver a coisa nº 4.
  await registrarNoPacing(ctx, sessionId);

  await audit({
    action: "automation.number_notified",
    actorUserId: null,
    organizationId: ctx.organizationId,
    resourceType: "automation_rule",
    resourceId: ctx.ruleId,
    requestId: ctx.requestId,
    // ⚠️ Referencia o CADASTRO, nunca o telefone: o número da equipe é dado
    // pessoal, e registro operacional não é cópia de dado de contato.
    metadata: {
      actor_type: "automation",
      notify_number_id: numero.id,
      notify_send_id: reservaId,
      rule_name: ctx.ruleName,
    },
  }).catch(() => undefined);

  return {
    type: TIPO,
    status: "success",
    detail: { notify_send_id: reservaId, notify_number_id: numero.id, external_id: externalId },
  };
}

/**
 * O contador que vale (`pacing_ledger`) vive no schema do agent-engine e é
 * escrito por `recordSend`, que fala `pg.Pool`. Aqui temos o client do
 * Supabase, então o insert é direto — mesma linha, mesma tabela.
 */
async function registrarNoPacing(ctx: ActionCtx, sessionId: string): Promise<void> {
  const { error } = await ctx.admin.from("pacing_ledger").insert({
    organization_id: ctx.organizationId,
    channel_session_id: sessionId,
    sent_at: new Date().toISOString(),
  });
  if (error) {
    console.warn("[notify_number] não contabilizou no pacing_ledger", { erro: error.message });
  }
}

registerAction({ type: TIPO, execute });
