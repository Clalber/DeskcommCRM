/**
 * A porta de entrada do seam. Feature nenhuma importa `lib/waha/*` direto —
 * pede o adapter do provider da conversa e o descritor de capabilities.
 */
import { metaCloudAdapter } from "./adapters/meta-cloud";
import { wahaAdapter } from "./adapters/waha";
import { zernioAdapter } from "./adapters/zernio";
import type { ChannelAdapter, ChannelProvider } from "./types";

const ADAPTERS: Record<ChannelProvider, ChannelAdapter | null> = {
  waha: wahaAdapter,
  meta_cloud: metaCloudAdapter,
  zernio: zernioAdapter,
  // O schema e a matriz já conhecem o canal (migration 0202); o TRANSPORTE
  // ainda não existe. `null` é a declaração honesta disso, e o `getAdapter`
  // abaixo faz o resto: quem tentar enviar recebe `unknown_channel_provider` na
  // cara, em vez de a mensagem sair calada pelo canal errado.
  meta_instagram: null,
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
