/**
 * O CONTRATO do que chega no webhook deste canal — declarado, e não presumido.
 *
 * Antes daqui o corpo entrava por `JSON.parse(rawBody) as WahaEnvelope`: um
 * **cast**, que é uma promessa do autor ao compilador e nada mais. Em tempo de
 * execução o campo podia ser o que quisesse, e a rota não tinha como saber.
 *
 * ─── O que o cast custava, medido ───────────────────────────────────────────
 *
 * `payload.from` vai direto para `parseChatId`, que chama `.endsWith`. Com um
 * `from` não-string a chamada LANÇA, o `try/catch` da rota engole, e a
 * requisição devolve **200** — o provider risca o evento da fila achando que
 * entregou. Descarte mudo com carimbo de sucesso, no caminho que ingere
 * mensagem de cliente. E `WAHA_WEBHOOK_REQUIRE_SIGNATURE` é `false` por padrão,
 * então esse caminho é alcançável sem segredo nenhum.
 *
 * ─── A REGRA deste arquivo (leia antes de acrescentar campo) ────────────────
 *
 * Um campo ganha tipo quando o código o consome **sem guarda própria** — é aí
 * que o tipo errado vira exceção engolida ou descarte mudo. Campo que o código
 * já trata em qualquer forma (`Array.isArray`, `typeof x === "object"`) fica
 * `z.unknown()`, e campo que ninguém lê não entra: o objeto é **loose**, então
 * o desconhecido passa intacto.
 *
 * Apertar além disso é a regressão que este arquivo existe para não causar. Um
 * webhook de WhatsApp real traz campos que ninguém catalogou; um `.strict()` ou
 * um obrigatório a mais transforma "mensagem entra no CRM" em "mensagem
 * descartada", que é pior que o defeito consertado aqui.
 *
 * `.nullish()` em tudo pelo mesmo motivo: `null` é como todo provider escreve
 * "não tenho este campo", e recusá-lo seria inventar uma exigência que o fio
 * nunca teve.
 */
import { z } from "zod";

import { lerEnvelope, type LeituraDeEnvelope } from "@/lib/webhooks/contrato";

/** Texto do fio: string, ausente ou `null`. Nunca outro tipo. */
const texto = z.string().nullish();
const numero = z.number().nullish();
const booleano = z.boolean().nullish();

/** WAHA >= 2026.x (NOWEB): a mídia vem aninhada aqui. */
const wahaMediaSchema = z.looseObject({
  url: texto,
  mimetype: texto,
});

/**
 * A chave do Baileys. Só `remoteJidAlt`/`participantAlt` ganham tipo: são os
 * dois que `telefoneAlternativoDe` mede com `.length` e `.endsWith` sem guarda.
 * `remoteJid`, `participant`, `addressingMode`, `fromMe` e `id` chegam nos
 * payloads reais e seguem intactos pelo loose — ninguém os lê.
 */
const wahaKeySchema = z.looseObject({
  remoteJidAlt: texto,
  participantAlt: texto,
});

export const wahaPayloadSchema = z.looseObject({
  id: texto,
  from: texto,
  to: texto,
  fromMe: booleano,
  body: texto,
  type: texto,
  hasMedia: booleano,
  ack: numero,
  ackName: texto,
  status: texto,
  timestamp: numero,
  mediaUrl: texto,
  mimetype: texto,
  media: wahaMediaSchema.nullish(),
  /** Id da mensagem ORIGINAL nos eventos `message.edited` / `message.revoked`. */
  editedMessageId: texto,
  revokedMessageId: texto,
  _data: z.looseObject({
    notifyName: texto,
    pushName: texto,
    /**
     * O conteúdo NOWEB (`imageMessage`, `stickerMessage`, …). Fica sem tipo de
     * propósito: `resolveMessageType` já checa `typeof msg === "object"` antes
     * de olhar as chaves, então exigir objeto aqui só criaria uma forma nova de
     * descartar a mensagem inteira.
     *
     * ⚠️ O `.optional()` NÃO é enfeite: no Zod 4 um `z.unknown()` solto dentro de
     * um objeto é OBRIGATÓRIO (a chave ausente reprova com
     * `expected nonoptional`). Sem ele, TODO payload sem `_data.message` — que
     * inclui o ack, 95 dos 438 eventos medidos — seria recusado. Medido ao
     * escrever `contrato-do-webhook-waha.test.ts`, que reprovou por isso.
     */
    message: z.unknown().optional(),
    key: wahaKeySchema.nullish(),
  }).nullish(),
});

export const wahaEnvelopeSchema = z.looseObject({
  event: texto,
  session: texto,
  payload: wahaPayloadSchema.nullish(),
});

export type WahaPayload = z.infer<typeof wahaPayloadSchema>;
export type WahaEnvelope = z.infer<typeof wahaEnvelopeSchema>;

export function lerEnvelopeWaha(rawBody: string): LeituraDeEnvelope<WahaEnvelope> {
  return lerEnvelope(rawBody, wahaEnvelopeSchema);
}
