/**
 * O ÚNICO lugar do sistema que pode conhecer a diferença entre os canais.
 *
 * Feature nenhuma pergunta *com quem* falamos — pergunta *o que o canal permite*
 * (invariante 1 de `docs/doctrine/restricao-de-canal.md`). Cada capability abaixo
 * nasce de uma diferença real e medida entre WAHA e Meta Cloud; capability que
 * ninguém consome é código morto, e o teste de matriz reprova.
 */
import type { ChannelCapabilities, ChannelProvider } from "./types";

export type { ChannelProvider, ChannelCapabilities };

export const CHANNEL_CAPABILITIES: Record<ChannelProvider, ChannelCapabilities> = {
  // Auto-restrição: falo quando quiser, mas o WhatsApp me bane se eu abusar.
  waha: {
    freeformOutsideWindow: true,
    requiresTemplates: false,
    banRisk: true,
    minIntervalMs: null,
    voiceNote: "server-convert",
    groups: "full",
    costPerMessage: false,
  },
  // Hetero-restrição: não me banem, mas a Meta me proíbe e me cobra.
  meta_cloud: {
    freeformOutsideWindow: false,
    requiresTemplates: true,
    banRisk: false,
    minIntervalMs: 6000,
    voiceNote: "opus-only",
    groups: "limited",
    costPerMessage: true,
  },
};

export function capabilitiesOf(provider: ChannelProvider): ChannelCapabilities {
  const caps = CHANNEL_CAPABILITIES[provider];
  // Fail-closed: provider fora da matriz não herda o default do WAHA. O tipo
  // barra em compilação; isto barra o que vem do banco em runtime.
  if (!caps) throw new Error(`unknown_channel_provider: ${provider}`);
  return caps;
}
