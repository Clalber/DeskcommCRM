/**
 * O "digitando…" na conversa do cliente, resolvido a partir de uma conversa do
 * CRM.
 *
 * É o irmão pequeno de `sendMessageHandler` (`app/api/v1/messages/_handler.ts`):
 * mesma resolução de conversa → sessão → destinatário, mesmo seam de canal
 * (`getAdapter`), e nenhuma linha de banco escrita. O agente chama isto enquanto
 * o modelo pensa, pelo adapter do agent-engine — quem quiser usar em outro ponto
 * (composer do atendente, por exemplo) chama a mesma função.
 *
 * ─── NUNCA LANÇA, e isso é o contrato inteiro ──────────────────────────────
 *
 * Todo desfecho vira um valor de `SinalDeDigitacao`. A razão é a mesma do
 * `setTyping` do adapter: esta função roda no caminho de quem vai responder um
 * cliente, e nenhuma falha decorativa pode encostar nesse caminho. O pior caso
 * aceitável é o balãozinho não aparecer.
 *
 * ─── O que NÃO é conferido aqui, e por quê ─────────────────────────────────
 *
 * O envio confere canal arquivado com uma consulta tolerante a schema antigo
 * (`lib/channels/archived`), porque lá o desfecho decide se a mensagem sai. Aqui
 * o custo de errar é uma chamada HTTP que o canal recusa — então a conferência
 * fica no que é barato e decisivo: contato bloqueado (que é veto de negócio, e
 * sinalizar para quem pediu para não ser incomodado seria contradizê-lo) e
 * sessão fora do ar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHANNEL_SESSION_REF_COLUMNS,
  DEFAULT_CHANNEL_PROVIDER,
  getAdapter,
  resolveSessionRef,
  type ChannelSessionRef,
} from "@/lib/channels";

/**
 * O desfecho, em vocabulário que serve para LOG — não para decisão.
 *
 * Quem chama não deve ramificar comportamento nisto (o comportamento é sempre o
 * mesmo: seguir em frente); o valor existe para que uma instalação sem
 * indicador tenha COMO ser diagnosticada, em vez de o recurso simplesmente não
 * aparecer e ninguém saber onde olhar.
 */
export type SinalDeDigitacao =
  /** O canal aceitou o sinal. */
  | "sinalizado"
  /** O canal existe e sabe sinalizar, mas recusou (versão antiga, sessão sem presença). */
  | "recusado"
  /** Este canal não implementa indicador de digitação — nada a fazer, nunca. */
  | "sem_suporte"
  /** Conversa/contato sem endereço possível neste canal, ou contato bloqueado. */
  | "sem_destino"
  /** A conexão não está no ar — sinalizar seria mentir sobre um canal parado. */
  | "canal_fora"
  /** Falha de leitura ou transporte. Já registrada; quem chama segue. */
  | "erro";

interface ConversaParaSinal {
  organization_id: string;
  is_group: boolean;
  group_chat_id: string | null;
  contacts: {
    phone_number: string | null;
    wa_identity: string | null;
    wa_lid: string | null;
    is_blocked: boolean;
  } | null;
  channel_sessions: (ChannelSessionRef & { status: string }) | null;
}

export interface SinalizarDigitandoInput {
  /**
   * De FONTE CONFIÁVEL (linha já escopada, sessão do cookie), nunca do corpo de
   * um payload externo: este módulo é chamado com client de service role, que
   * bypassa RLS — o filtro abaixo é a única coisa entre esta leitura e outro
   * tenant (anti-pattern nº 10 do CLAUDE.md).
   */
  organizationId: string;
  conversationId: string;
  /** true = mostra "digitando…"; false = tira. */
  ligado: boolean;
}

export async function sinalizarDigitando(
  supabase: SupabaseClient,
  input: SinalizarDigitandoInput,
): Promise<SinalDeDigitacao> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select(
        `organization_id, is_group, group_chat_id,
         contacts:contact_id(phone_number, wa_identity, wa_lid, is_blocked),
         channel_sessions:channel_session_id(${CHANNEL_SESSION_REF_COLUMNS}, status)`,
      )
      .eq("id", input.conversationId)
      .eq("organization_id", input.organizationId)
      .maybeSingle();

    if (error || !data) return "erro";
    const conversa = data as unknown as ConversaParaSinal;

    // Veto de negócio, e ele vale para o enfeite também: quem pediu para não ser
    // incomodado não deve ver sinal de vida de quem foi mandado calar.
    if (conversa.contacts?.is_blocked) return "sem_destino";
    if (!conversa.channel_sessions) return "canal_fora";
    if (conversa.channel_sessions.status !== "WORKING") return "canal_fora";

    const adapter = getAdapter(conversa.channel_sessions.provider ?? DEFAULT_CHANNEL_PROVIDER);
    if (!adapter.setTyping) return "sem_suporte";
    if (!adapter.isConfigured()) return "canal_fora";

    const recipient = adapter.resolveRecipient({
      isGroup: conversa.is_group,
      groupChatId: conversa.group_chat_id,
      phoneNumber: conversa.contacts?.phone_number,
      waIdentity: conversa.contacts?.wa_identity,
      waLid: conversa.contacts?.wa_lid,
    });
    if (!recipient) return "sem_destino";

    const aceito = await adapter.setTyping({
      organizationId: input.organizationId,
      sessionRef: resolveSessionRef(conversa.channel_sessions),
      recipient,
      typing: input.ligado,
    });
    return aceito ? "sinalizado" : "recusado";
  } catch {
    // Blindagem final. O contrato promete que nada sai daqui — e é essa promessa
    // que permite chamar isto no meio do caminho de resposta sem `try` em volta.
    return "erro";
  }
}
