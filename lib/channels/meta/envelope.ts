/**
 * O CONTRATO do que a Cloud API manda — declarado, e não presumido.
 *
 * A rota entregava `JSON.parse(rawBody)` a `parseMetaWebhook` com um
 * `as Parameters<typeof parseMetaWebhook>[0]`: cast puro, zero verificação em
 * tempo de execução. O parser então faz `for (const entry of envelope.entry ?? [])`
 * — e `for...of` sobre um número **lança**. Sem `try/catch` em volta, um corpo
 * bem assinado com `entry: 3` derruba a requisição em 500, e a Meta reentrega o
 * mesmo payload em backoff, para sempre.
 *
 * ─── A REGRA deste arquivo (leia antes de acrescentar campo) ────────────────
 *
 * Um campo ganha tipo quando o código o consome **sem guarda própria**. O miolo
 * de `value` NÃO ganha: o parser lê tudo por `str()`/`Array.isArray`, que já
 * tratam qualquer forma, e apertar ali trocaria "campo ignorado" por "webhook
 * inteiro recusado" — regressão pior que o defeito. Por isso `value` é só
 * "um objeto", com as chaves passando intactas.
 *
 * O que se ganha, então: `entry` e `changes` passam a ser **arrays de verdade**
 * antes do `for...of`, que é exatamente o 500 descrito acima.
 */
import { z } from "zod";

import { lerEnvelope, type LeituraDeEnvelope } from "@/lib/webhooks/contrato";

const texto = z.string().nullish();

const metaChangeSchema = z.looseObject({
  field: texto,
  /**
   * O corpo do evento. Objeto, e nada além disso: quem o lê (`parseMetaWebhook`)
   * já checa tipo campo a campo — ver o cabeçalho.
   */
  value: z.looseObject({}).nullish(),
});

const metaEntrySchema = z.looseObject({
  id: texto,
  changes: z.array(metaChangeSchema).nullish(),
});

export const metaWebhookEnvelopeSchema = z.looseObject({
  object: texto,
  entry: z.array(metaEntrySchema).nullish(),
});

export type MetaWebhookEnvelope = z.infer<typeof metaWebhookEnvelopeSchema>;

export function lerEnvelopeMeta(rawBody: string): LeituraDeEnvelope<MetaWebhookEnvelope> {
  return lerEnvelope(rawBody, metaWebhookEnvelopeSchema);
}
