export type ChannelProvider = "waha" | "meta_cloud";

export interface ChannelCapabilities {
  /** Pode enviar texto livre a qualquer momento? false = exige template fora da janela. */
  freeformOutsideWindow: boolean;
  /** A plataforma hospeda definições de mensagem que precisam de aprovação prévia. */
  requiresTemplates: boolean;
  /** Há risco de banimento por volume/padrão → arma throttle, warm-up e cap. */
  banRisk: boolean;
  /** Intervalo mínimo imposto PELA PLATAFORMA entre msgs ao mesmo destinatário (ms). */
  minIntervalMs: number | null;
  /** 'server-convert' = o canal converte áudio; 'opus-only' = precisamos entregar ogg/opus. */
  voiceNote: "server-convert" | "opus-only";
  groups: "full" | "limited" | "none";
  /** Mensagem entregue gera custo → decisões de envio precisam considerar orçamento. */
  costPerMessage: boolean;
}
