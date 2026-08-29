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
  /**
   * Veio do lote `standby`: OUTRO aplicativo tem a linha desta conversa.
   *
   * No protocolo de handover da Meta, uma conta pode ter mais de um aplicativo
   * ligado, e só um deles é o dono da thread num dado momento. Quem está em
   * espera RECEBE cópia de tudo — para não perder histórico — e não pode
   * responder. Gravar é certo; responder é falar por cima de quem está
   * atendendo, e o cliente vê duas empresas respondendo a mesma pergunta.
   */
  emEspera: boolean;
  /**
   * De onde a pessoa veio, quando a Meta diz.
   *
   * É a atribuição de anúncio: quem clicou num anúncio para abrir a conversa
   * chega com isto preenchido. Os dois canais irmãos gravam o equivalente, e
   * aqui se perdia — junto com a resposta para "esta campanha trouxe venda?".
   */
  referencia: ReferenciaDeOrigem | null;
  /**
   * A pessoa TOCOU num botão (quebra-gelo, resposta rápida, menu).
   *
   * É mensagem de verdade: ela agiu e espera resposta. Descartar fazia o toque
   * não virar nem conversa — a pessoa acha que falou e ninguém apareceu.
   */
  ehToqueEmBotao: boolean;
  /** O valor por trás do botão. Só existe quando `ehToqueEmBotao`. */
  cargaDoBotao: string | null;
}

export interface ReferenciaDeOrigem {
  ref: string | null;
  origem: string | null;
  tipo: string | null;
  anuncioId: string | null;
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
    referral?: Referral;
  };
  /** Toque em quebra-gelo, resposta rápida ou menu. */
  postback?: {
    mid?: unknown;
    title?: unknown;
    payload?: unknown;
    referral?: Referral;
  };
  /** Clique em anúncio que abriu a conversa, sem mensagem junto. */
  referral?: Referral;
}

interface Referral {
  ref?: unknown;
  source?: unknown;
  type?: unknown;
  ad_id?: unknown;
}

function lerReferencia(r: Referral | undefined): ReferenciaDeOrigem | null {
  if (!r || typeof r !== "object") return null;
  const lida = {
    ref: texto(r.ref),
    origem: texto(r.source),
    tipo: texto(r.type),
    anuncioId: texto(r.ad_id),
  };
  // Objeto com todos os campos vazios não é atribuição — é ruído, e gravá-lo
  // encheria o metadata de nada.
  return Object.values(lida).some(Boolean) ? lida : null;
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
    // linha. Ler os dois evita perder mensagem numa conta com dois integradores
    // — mas de que lote veio IMPORTA, e a primeira versão jogava os dois no
    // mesmo balde. Quem está em espera grava e NÃO responde.
    const lotes: Array<{ itens: Messaging[]; emEspera: boolean }> = [];
    if (Array.isArray(entrada.messaging)) {
      lotes.push({ itens: entrada.messaging as Messaging[], emEspera: false });
    }
    if (Array.isArray(entrada.standby)) {
      lotes.push({ itens: entrada.standby as Messaging[], emEspera: true });
    }

    for (const { itens, emEspera } of lotes) {
      for (const m of itens) {
        // ─── O TOQUE EM BOTÃO é mensagem, e vinha sendo descartado ──────────
        //
        // Quebra-gelo, resposta rápida e menu chegam como `postback`, sem
        // `message`. A pessoa AGIU e espera resposta; o toque não virava nem
        // conversa, e para ela parecia que o CRM ignorou.
        const toque = m.postback;
        if (!m.message && toque) {
          const mid = texto(toque.mid);
          const quem = texto(m.sender?.id);
          const conta = texto(m.recipient?.id);
          const rotulo = texto(toque.title);
          if (!mid || !quem || !conta) {
            ignorados += 1;
            continue;
          }
          eventos.push({
            externalId: mid,
            providerUserId: quem,
            contaId: conta,
            // O RÓTULO do botão vira o texto: é o que a pessoa viu e tocou, e é
            // o que faz sentido na conversa. A carga técnica vai à parte.
            texto: rotulo,
            midias: [],
            timestamp: typeof m.timestamp === "number" ? m.timestamp : Date.now(),
            ehEco: false,
            ehApagada: false,
            respostaA: null,
            emEspera,
            referencia: lerReferencia(toque.referral) ?? lerReferencia(m.referral),
            ehToqueEmBotao: true,
            cargaDoBotao: texto(toque.payload),
          });
          continue;
        }

        const msg = m.message;
        if (!msg) {
          // `read`, `reaction`, entrega e afins caem aqui — inclusive a
          // atribuição de anúncio que chega SOZINHA, sem mensagem: sem
          // conversa aberta não há onde gravá-la, e inventar uma linha para um
          // clique que ninguém seguiu poluiria o inbox.
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
          emEspera,
          referencia: lerReferencia(msg.referral) ?? lerReferencia(m.referral),
          ehToqueEmBotao: false,
          cargaDoBotao: null,
        });
      }
    }
  }

  return { eventos, ignorados };
}
