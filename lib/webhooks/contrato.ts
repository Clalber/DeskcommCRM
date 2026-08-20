/**
 * A leitura de um corpo de webhook contra o CONTRATO do canal.
 *
 * O schema é de cada canal — o formato do fio muda por provider e não há
 * contrato comum a inventar. O que é comum é o RITUAL: transformar texto em
 * objeto, conferir contra o schema, e devolver uma recusa que quem responde a
 * requisição saiba traduzir. Isso mora aqui para os três canais falharem do
 * mesmo jeito, em vez de cada rota inventar o seu.
 *
 * ─── Por que a recusa carrega CAMPOS e não a mensagem do Zod ────────────────
 *
 * `error.message` do Zod embute o VALOR recebido. Num webhook de WhatsApp o
 * valor é dado do cliente — telefone, texto de mensagem — e pode ter megabytes.
 * O caminho (`payload.from`) responde "o que mudou no fio?", que é a pergunta de
 * quem depura, sem levar nada de pessoal para o log nem para o corpo da
 * resposta.
 */
import type { z } from "zod";

export type LeituraDeEnvelope<T> =
  | { ok: true; envelope: T }
  /**
   * Duas causas, separadas de propósito: JSON quebrado é o CORPO, contrato
   * violado é o FORMATO. Quem investiga procura em lugares diferentes, e a rota
   * responde diferente.
   */
  | { ok: false; motivo: "json_invalido" | "contrato_violado"; campos: string[] };

/**
 * Os caminhos dos campos recusados, sem repetição e sem valor.
 *
 * Só nomeia chave DECLARADA no schema: objeto `loose` não valida o que não
 * conhece, então nada vindo de fora entra nesta lista.
 */
export function camposForaDoContrato(erro: z.ZodError): string[] {
  const vistos = new Set(erro.issues.map((i) => (i.path.length > 0 ? i.path.join(".") : "(raiz)")));
  return [...vistos];
}

/**
 * Confere um valor JÁ desserializado.
 *
 * Existe separado de `lerEnvelope` porque uma rota pode precisar conferir o
 * contrato em DOIS momentos: o mínimo para saber de quem é o payload (antes de
 * resolver o tenant) e o resto depois de arquivar o corpo cru. O webhook do
 * canal por QR faz exatamente isso — ver o AC de `docs/prd/03-prd-whatsapp-waha.md`
 * §3.3: "grava raw em `webhook_events_log` mesmo se o parse falhar depois".
 */
export function conferirEnvelope<T>(valor: unknown, schema: z.ZodType<T>): LeituraDeEnvelope<T> {
  const r = schema.safeParse(valor);
  if (!r.success) {
    return { ok: false, motivo: "contrato_violado", campos: camposForaDoContrato(r.error) };
  }
  return { ok: true, envelope: r.data };
}

export function lerEnvelope<T>(rawBody: string, schema: z.ZodType<T>): LeituraDeEnvelope<T> {
  let cru: unknown;
  try {
    cru = JSON.parse(rawBody);
  } catch {
    return { ok: false, motivo: "json_invalido", campos: [] };
  }
  return conferirEnvelope(cru, schema);
}
