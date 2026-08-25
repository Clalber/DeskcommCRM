/**
 * As guardas COMPARTILHADAS por toda ação que manda mensagem para um contato:
 * existe, não está bloqueado, tem telefone, tem consentimento.
 *
 * Nasceu porque a mesma sequência de 3 `if`s vivia em `send-whatsapp.ts` e em
 * `send-ai-message.ts` — irmãs de propósito (mesmo comentário de cabeçalho:
 * "MESMAS guardas... reescrevê-las aqui faria a ação nova nascer sem o
 * conserto que a antiga acabou de receber"). O gate de consentimento nasceu
 * SÓ na primeira (achado 2026-08-25) e ficaria esquecido na segunda até
 * alguém notar — exatamente o "conserto por instância" que este repo já
 * pagou (ver `desfecho-do-envio.ts`, mesmo raciocínio para o desfecho do
 * envio). Um módulo só, as duas ações chamam.
 *
 * ═══ Por que o gate de consentimento é FIXO, não uma `condition` declarável ═══
 *
 * Ausência de consentimento e recusa explícita são o MESMO estado no schema
 * (`consent.marketing.granted_at` null nos dois casos — não existe coluna
 * separada de "recusou"), e as duas precisam bloquear TODO envio automático,
 * sem exceção por regra mal configurada. Não vive em `conditions`
 * declarativas de propósito: o motor de `conditions` (`lib/automation/
 * conditions.ts`) trata campo ausente + operador `neq` como sempre-
 * verdadeiro, o que deixaria passar exatamente o caso mais perigoso — sem
 * consentimento — se alguém configurasse a condição errada. Invariante de
 * segurança fica em código, não em configuração que um admin possa desligar
 * sem querer.
 */
import type { ActionCtx } from "@/lib/automation/types";

export type MotivoDeBloqueio = "no_contact" | "contact_blocked" | "no_phone" | "no_consent";

export interface ContatoLiberadoParaEnvio {
  id: string;
  phone_number: string;
}

interface ContatoDoContexto {
  id: string;
  is_blocked?: boolean;
  phone_number?: string | null;
  consent?: { marketing?: { granted_at?: string | null } | null } | null;
}

export type ResultadoDaGuarda =
  | { ok: true; contact: ContatoLiberadoParaEnvio }
  | { ok: false; reason: MotivoDeBloqueio };

/**
 * Corre as 4 guardas, na ordem que mais barato falha primeiro (nenhum dado
 * lido antes de saber que há contato). Devolve o contato tipado e estreito
 * (só o que o chamador precisa) quando passa; a razão do bloqueio quando não.
 */
export function checarGuardasDeContato(ctx: ActionCtx): ResultadoDaGuarda {
  const contact = ctx.context.contact as ContatoDoContexto | undefined;
  if (!contact) return { ok: false, reason: "no_contact" };
  if (contact.is_blocked) return { ok: false, reason: "contact_blocked" };
  if (!contact.phone_number) return { ok: false, reason: "no_phone" };
  if (!contact.consent?.marketing?.granted_at) return { ok: false, reason: "no_consent" };
  return { ok: true, contact: { id: contact.id, phone_number: contact.phone_number } };
}
