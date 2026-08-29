/**
 * O que a Meta manda quando alguém escreve no Direct — e o que dele é confiável.
 *
 * ─── As duas metades do segredo ─────────────────────────────────────────────
 *
 * `verify_token` prova que a URL é nossa (handshake do cadastro, uma vez);
 * `app_secret` prova que CADA requisição veio da Meta (HMAC do corpo cru). São
 * segredos diferentes com funções diferentes, e ter um sem o outro é ter
 * webhook aberto: quem descobrir a URL manda o que quiser.
 *
 * ─── Puro de propósito ──────────────────────────────────────────────────────
 *
 * Este arquivo não toca banco nem rede. O parser recebe o envelope já lido e
 * devolve eventos; quem grava é a ingestão. Isso é o que permite testar payload
 * torto sem subir nada — e payload torto é a regra, não a exceção: a Meta
 * acrescenta campo sem avisar, e um parser que lança derruba o webhook inteiro
 * por causa de um evento que a gente nem queria.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** Assinatura que a Meta manda em toda requisição de webhook. */
export const INSTAGRAM_SIGNATURE_HEADER = "x-hub-signature-256";

/**
 * A requisição veio mesmo da Meta?
 *
 * HMAC SHA-256 sobre o corpo CRU — não sobre o JSON reserializado. Reserializar
 * muda espaços e ordem de chave, e a assinatura deixa de bater por um motivo
 * que ninguém encontra olhando o payload.
 */
export function verifyInstagramSignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header || !appSecret) return false;
  const prefixo = "sha256=";
  if (!header.startsWith(prefixo)) return false;

  const esperado = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const recebido = header.slice(prefixo.length);

  // Comparação de tempo constante, com guarda de tamanho: `timingSafeEqual`
  // LANÇA quando os buffers têm comprimentos diferentes, e um throw aqui viraria
  // 500 num caminho que deve responder 401.
  const a = Buffer.from(esperado, "hex");
  const b = Buffer.from(recebido, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * O handshake do cadastro (GET). Devolve o desafio a ecoar, ou `null`.
 *
 * A resposta tem de ser o desafio em TEXTO PURO. Envelopar em `{data: ...}` —
 * o que todo o resto da API faz — faz a Meta recusar a URL sem dizer por quê.
 */
export function instagramVerificationChallenge(
  params: URLSearchParams,
  verifyTokenEsperado: string,
): string | null {
  if (params.get("hub.mode") !== "subscribe") return null;
  const recebido = params.get("hub.verify_token");
  if (!recebido || !verifyTokenEsperado) return null;
  if (recebido !== verifyTokenEsperado) return null;
  return params.get("hub.challenge");
}

/** Uma mensagem recebida, já traduzida para o vocabulário do CRM. */
export interface EventoDeEntrada {
  /** `mid` da Meta — a chave de idempotência. */
  externalId: string;
  /** IGSID de quem escreveu, escopado à CONTA que recebeu. */
  providerUserId: string;
  /** A conta que recebeu (`instagram_user_id` da sessão). */
  contaId: string;
  texto: string | null;
  /** Anexos por URL pública. A Meta expira essas URLs — baixar é urgente. */
  midias: Array<{ tipo: string; url: string }>;
  /** Milissegundos. */
  timestamp: number;
  /**
   * A conta ENVIOU esta mensagem (eco). Não é entrada: é a nossa própria
   * resposta, ou uma resposta que alguém deu pelo aplicativo do Instagram.
   */
  ehEco: boolean;
  /** A pessoa apagou a mensagem. */
  ehApagada: boolean;
  /** `mid` da mensagem respondida, quando é resposta. */
  respostaA: string | null;
}

export interface LeituraDoWebhook {
  eventos: EventoDeEntrada[];
  /** Eventos que reconhecemos mas não tratamos — para log, nunca para erro. */
  ignorados: number;
}

interface Messaging {
  sender?: { id?: unknown };
  recipient?: { id?: unknown };
  timestamp?: unknown;
  message?: {
    mid?: unknown;
    text?: unknown;
    is_echo?: unknown;
    is_deleted?: unknown;
    is_unsupported?: unknown;
    reply_to?: { mid?: unknown; story?: unknown };
    attachments?: Array<{ type?: unknown; payload?: { url?: unknown } }>;
  };
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

/**
 * Traduz o envelope da Meta em eventos.
 *
 * NUNCA lança. Evento que não entendemos é contado e descartado — a Meta
 * acrescenta tipo novo sem avisar, e derrubar o webhook por causa de um evento
 * indesejado faria perder as mensagens que vieram no MESMO lote.
 *
 * ⚠️ **Ecos entram com `ehEco: true` em vez de serem descartados aqui.** Quem
 * decide o que fazer com a própria voz é a ingestão: um eco pode ser a resposta
 * que um humano deu pelo aplicativo do Instagram, e essa precisa aparecer na
 * conversa — descartá-la faria o CRM mostrar um atendimento pela metade.
 */
export function parseInstagramWebhook(envelope: unknown): LeituraDoWebhook {
  const eventos: EventoDeEntrada[] = [];
  let ignorados = 0;

  const raiz = envelope as { object?: unknown; entry?: unknown } | null;
  if (!raiz || raiz.object !== "instagram" || !Array.isArray(raiz.entry)) {
    return { eventos, ignorados: 0 };
  }

  for (const entrada of raiz.entry as Array<Record<string, unknown>>) {
    // `standby` é o mesmo formato de `messaging`, para quando outro app tem a
    // linha. Ler os dois evita perder mensagem numa conta com dois integradores.
    const lotes = [entrada.messaging, entrada.standby].filter(Array.isArray) as Messaging[][];

    for (const lote of lotes) {
      for (const m of lote) {
        const msg = m.message;
        if (!msg) {
          // `read`, `reaction`, `postback` e afins caem aqui. Contamos e
          // seguimos: o dia em que forem tratados, o número já mostra o volume.
          ignorados += 1;
          continue;
        }

        const mid = texto(msg.mid);
        const ehEco = msg.is_echo === true;
        // No eco quem fala é a CONTA, então os papéis se invertem: o
        // interlocutor é o destinatário, não o remetente. Ler `sender` nos dois
        // casos amarraria a conversa ao id da própria conta.
        const outroLado = ehEco ? texto(m.recipient?.id) : texto(m.sender?.id);
        const conta = ehEco ? texto(m.sender?.id) : texto(m.recipient?.id);

        if (!mid || !outroLado || !conta) {
          ignorados += 1;
          continue;
        }

        const midias: Array<{ tipo: string; url: string }> = [];
        for (const a of msg.attachments ?? []) {
          const url = texto(a?.payload?.url);
          const tipo = texto(a?.type) ?? "file";
          if (url) midias.push({ tipo, url });
        }

        const corpo = texto(msg.text);
        // Sem texto e sem mídia não há o que mostrar na conversa. `is_unsupported`
        // (figurinha de tipo novo, por exemplo) cai aqui e é contado, não perdido
        // de vista.
        if (!corpo && midias.length === 0 && msg.is_deleted !== true) {
          ignorados += 1;
          continue;
        }

        eventos.push({
          externalId: mid,
          providerUserId: outroLado,
          contaId: conta,
          texto: corpo,
          midias,
          timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
          ehEco,
          ehApagada: msg.is_deleted === true,
          respostaA: texto(msg.reply_to?.mid),
        });
      }
    }
  }

  return { eventos, ignorados };
}
