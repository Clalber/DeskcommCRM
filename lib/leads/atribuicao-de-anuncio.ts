/**
 * Atribuição de anúncio — de qual campanha um contato do WhatsApp veio.
 *
 * Meta Ads tem dois caminhos de entrada, e o dado do anúncio chega diferente
 * em cada um:
 *
 *  - **API oficial** (canal `zernio`): o webhook de mensagem inclui um objeto
 *    `referral` no PRÓPRIO evento — documentado pela plataforma, com
 *    `source_id`/`ctwa_clid`, `headline`, `body`. É o caminho confiável, e o
 *    que a instalação de referência (a clínica já usa API oficial noutro
 *    sistema) prova que funciona.
 *  - **WAHA** (Baileys, protocolo do WhatsApp Web): o MESMO dado do anúncio
 *    vai embutido na própria mensagem que o app do cliente manda ao apertar
 *    "Enviar" — em `contextInfo.externalAdReplyInfo`, no nível do protocolo,
 *    não só na API oficial. Mas o WAHA nunca documentou isto, e esta
 *    instalação nunca recebeu um clique real de anúncio para confirmar o
 *    formato exato. Best-effort: se a forma divergir, simplesmente não
 *    atribui (silencioso, não derruba o inbound) — e o `bruto` gravado é o
 *    que permite ajustar o parser quando um clique real acontecer, em vez de
 *    adivinhar de novo.
 *
 * Google Ads não tem mecanismo nativo equivalente pro WhatsApp — a
 * atribuição depende de uma landing page que capture `gclid` e embuta um
 * código de rastreio na mensagem pré-preenchida. Esse caminho ainda não
 * existe (aguardando a LP), e por isso não há extrator aqui ainda.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PlataformaDeAnuncio = "meta_ads" | "google_ads";

export interface AtribuicaoDeAnuncio {
  plataforma: PlataformaDeAnuncio;
  /** `ctwa_clid` (Meta) — identifica o clique específico que abriu a conversa. */
  sourceId: string | null;
  /** Título/headline do anúncio, quando o provider manda. */
  titulo: string | null;
  corpo: string | null;
  sourceUrl: string | null;
  /** Payload de onde isto foi extraído — nunca descartado, é a prova. */
  bruto: Record<string, unknown>;
}

type Bruto = Record<string, unknown>;
const obj = (v: unknown): Bruto | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Bruto) : null;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

/**
 * O objeto `referral` do webhook oficial da Meta (Cloud API, ou um BSP que
 * repassa o payload original). Campos documentados pela plataforma:
 * `source_id`, `source_url`, `source_type` (`"ad"` | `"post"`), `headline`,
 * `body`, `ctwa_clid`.
 *
 * NÃO VERIFICADO contra o BSP real desta instalação (canal `zernio`) — o
 * parser aceita tanto snake_case (forma documentada da Cloud API) quanto
 * camelCase (caso o agregador normalize), e ignora silenciosamente o que não
 * reconhece em vez de lançar. `"post"` é orgânico compartilhado, não anúncio
 * pago — só `"ad"` (ou ausência do campo) conta como atribuição.
 */
export function extrairAtribuicaoMeta(referral: unknown): AtribuicaoDeAnuncio | null {
  const r = obj(referral);
  if (!r) return null;
  const tipo = str(r.source_type) ?? str(r.sourceType);
  if (tipo && tipo !== "ad") return null;

  const sourceId =
    str(r.ctwa_clid) ?? str(r.ctwaClid) ?? str(r.source_id) ?? str(r.sourceId);
  const titulo = str(r.headline);
  const sourceUrl = str(r.source_url) ?? str(r.sourceUrl);
  // Sem NENHUM campo que identifique o anúncio, não há o que atribuir — um
  // `referral` vazio (ou só com `body`) não distingue "veio de anúncio" de
  // "o provider mandou um objeto vazio por engano".
  if (!sourceId && !titulo && !sourceUrl) return null;

  return {
    plataforma: "meta_ads",
    sourceId,
    titulo,
    corpo: str(r.body),
    sourceUrl,
    bruto: r,
  };
}

/**
 * `contextInfo.externalAdReplyInfo` do Baileys — o mesmo dado do anúncio,
 * embutido na PRÓPRIA mensagem que o app do cliente manda ao clicar num
 * anúncio "Clique para o WhatsApp". `messageRaw` é `_data.message` do payload
 * do WAHA (NOWEB) — a forma bruta do Baileys, sem normalização.
 *
 * O ad-reply pode chegar em qualquer tipo de mensagem com `contextInfo`
 * (o clique manda texto na maioria dos casos, daí `extendedTextMessage` vir
 * primeiro na lista de candidatos), então a busca varre os tipos comuns em
 * vez de assumir um só.
 */
export function extrairAtribuicaoWaha(messageRaw: unknown): AtribuicaoDeAnuncio | null {
  const m = obj(messageRaw);
  if (!m) return null;

  const candidatos = [
    obj(m.extendedTextMessage)?.contextInfo,
    obj(m.imageMessage)?.contextInfo,
    obj(m.videoMessage)?.contextInfo,
    obj(m.conversation) ? null : m.contextInfo,
  ];
  const contextInfo = candidatos.map(obj).find((c): c is Bruto => c !== null);
  const ad = obj(contextInfo?.externalAdReplyInfo);
  if (!ad) return null;

  const sourceId = str(ad.ctwaClid) ?? str(ad.sourceId);
  const titulo = str(ad.title);
  const sourceUrl = str(ad.sourceUrl);
  if (!sourceId && !titulo && !sourceUrl) return null;

  return {
    plataforma: "meta_ads",
    sourceId,
    titulo,
    corpo: str(ad.body),
    sourceUrl,
    bruto: ad,
  };
}

/**
 * Grava a atribuição no CONTATO — só na primeira vez.
 *
 * Primeiro toque: uma vez gravada, não muda. A pessoa pode clicar em outro
 * anúncio meses depois, numa conversa já aberta — isso não deveria reescrever
 * de onde ela veio ORIGINALMENTE, que é o dado que explica a existência do
 * relacionamento. `fn_estampar_atribuicao_de_anuncio` faz a guarda e o merge
 * de `source_metadata` ATOMICAMENTE no banco (não aqui): duas mensagens quase
 * simultâneas do mesmo contato novo não podem correr a corrida de leitura e
 * escrita em JS e uma pisar na outra.
 */
export async function estamparAtribuicaoDoContato(
  admin: SupabaseClient,
  contactId: string,
  atribuicao: AtribuicaoDeAnuncio,
): Promise<void> {
  const { error } = await admin.rpc("fn_estampar_atribuicao_de_anuncio" as never, {
    p_contact: contactId,
    p_platform: atribuicao.plataforma,
    p_metadata: {
      ad_platform: atribuicao.plataforma,
      ad_source_id: atribuicao.sourceId,
      ad_title: atribuicao.titulo,
      ad_body: atribuicao.corpo,
      ad_source_url: atribuicao.sourceUrl,
      ad_raw: atribuicao.bruto,
      ad_captured_at: new Date().toISOString(),
    },
  } as never);

  if (error) {
    console.error("[atribuicao-de-anuncio] falha ao estampar contato", error.message);
  }
}
