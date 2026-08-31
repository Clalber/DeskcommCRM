/**
 * A porta de entrada do seam. Feature nenhuma importa `lib/waha/*` direto —
 * pede o adapter do provider da conversa e o descritor de capabilities.
 */
import { metaCloudAdapter } from "./adapters/meta-cloud";
import { wahaAdapter } from "./adapters/waha";
import { metaInstagramAdapter } from "./adapters/meta-instagram";
import { zernioAdapter } from "./adapters/zernio";
import type { ChannelAdapter, ChannelProvider } from "./types";

const ADAPTERS: Record<ChannelProvider, ChannelAdapter | null> = {
  waha: wahaAdapter,
  meta_cloud: metaCloudAdapter,
  zernio: zernioAdapter,
  meta_instagram: metaInstagramAdapter,
};

/**
 * Fail-closed: provider sem adapter (ou fora da matriz) lança em vez de cair no
 * WAHA por default. Enviar pelo canal errado é pior que não enviar.
 */
export function getAdapter(provider: ChannelProvider): ChannelAdapter {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error(`unknown_channel_provider: ${provider}`);
  return adapter;
}

/**
 * Este canal já tem TRANSPORTE? `getAdapter` LANÇA nesse caso, e deve mesmo —
 * quem envia precisa falhar alto. Quem só quer SABER não deveria precisar de
 * `try/catch`.
 */
export function temAdapter(provider: ChannelProvider): boolean {
  return ADAPTERS[provider] != null;
}

export { capabilitiesOf, CHANNEL_CAPABILITIES, DEFAULT_CHANNEL_PROVIDER } from "./capabilities";
export { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef } from "./session-ref";
// A identidade de quem é endereçado por id OPACO em vez de telefone. Sai pelo
// índice, e não do módulo do canal, porque quem monta o envelope de envio não
// pode saber de qual canal ela é — a tabela é genérica de propósito.
export { identidadePorContato } from "./instagram/identidade";
export type { ChannelSessionRef } from "./session-ref";
export type {
  ChannelAdapter,
  ChannelCapabilities,
  ChannelProvider,
  OutboundEnvelope,
  OutboundKind,
  OutboundMedia,
  RecipientInput,
} from "./types";
