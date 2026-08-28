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
  // O schema e a matriz já conhecem o canal (migration 0203); o TRANSPORTE
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
 * Este canal já tem TRANSPORTE?
 *
 * Existe porque o projeto declara o vocabulário de um canal ANTES do adapter —
 * é o que a migration 0131 fez com o canal intermediado, e o motivo está escrita
 * lá: tipo, matriz e coluna de ref nascem juntos, e o adapter chega depois
 * encontrando o schema pronto; o caminho inverso obriga migration de correção
 * sobre dados existentes, que é onde clone quebra.
 *
 * Nessa janela, `getAdapter` LANÇA — e deve mesmo lançar, porque quem tenta
 * enviar precisa falhar alto em vez de sair pelo canal errado. Mas quem só quer
 * SABER não deveria precisar de `try/catch`: perguntar com exceção transforma
 * um estado declarado em acidente, e é o tipo de coisa que alguém "resolve"
 * engolindo o erro.
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
