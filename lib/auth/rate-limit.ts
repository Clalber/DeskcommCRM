/**
 * Rate limit da superfície de autenticação (issue #64).
 *
 * O `checkRateLimit` já existia e era usado em dois pontos (webhook de captação
 * e dispatcher de IA); login, signup, recuperação de senha e aceite de convite
 * ficaram sem nenhum limite — força bruta de senha e enumeração de token saíam
 * de graça. Aqui só se aplica o que já existe.
 *
 * Duas contagens por tentativa, quando há identificador:
 *  - por IP: barra o atacante que varre muitas contas de um lugar só;
 *  - por identificador (hash do e-mail, token): barra o ataque distribuído
 *    contra UMA conta, que a contagem por IP não vê.
 *
 * O identificador entra SEMPRE hasheado — chave de Redis é lugar de dado
 * opaco, não de e-mail de cliente.
 *
 * Janela FIXA (é o que `checkRateLimit` implementa: `INCR` + `EXPIRE`), então
 * uma rajada na virada da janela passa em dobro. É limite de abuso, não de
 * precisão — e sem Upstash configurado o contador cai para memória do processo,
 * o que degrada em instalação de nó único mas não deixa a porta escancarada.
 */
import { createHash } from "node:crypto";
import { headers } from "next/headers";

import { checkRateLimit, peekRateLimit } from "@/lib/ai/dispatcher/rate-limit";

export interface AuthRateLimits {
  /** Tentativas por IP na janela. */
  ip: number;
  /** Tentativas por identificador na janela (omita para não contar por ele). */
  id?: number;
  windowSec: number;
}

function opaque(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex").slice(0, 32);
}

/**
 * `true` = barre a tentativa.
 *
 * @param action rótulo do bucket (`login`, `signup`, `reset`, `invite_accept`)
 * @param identifier e-mail ou token da tentativa; hasheado antes de virar chave
 */
export async function authRateLimited(
  action: string,
  identifier: string | null,
  limits: AuthRateLimits,
): Promise<boolean> {
  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || "sem-ip";

  const byIp = await checkRateLimit(`auth:${action}:ip:${opaque(ip)}`, limits.ip, limits.windowSec);
  if (!byIp.allowed) return true;

  if (identifier && limits.id !== undefined) {
    const byId = await checkRateLimit(
      `auth:${action}:id:${opaque(identifier)}`,
      limits.id,
      limits.windowSec,
    );
    if (!byId.allowed) return true;
  }

  return false;
}

/**
 * Limites por superfície. Números escolhidos para não estorvar uso humano
 * normal e ainda assim tirar o custo-zero do ataque:
 *  - login: quem erra a senha 5 vezes na mesma conta em 5 min quase sempre é
 *    script; o teto por IP é mais folgado por causa de NAT corporativo.
 *  - signup e convite: fluxos raros por pessoa, teto baixo.
 */
export const AUTH_LIMITS = {
  login: { ip: 60, id: 5, windowSec: 300 },
  signup: { ip: 20, windowSec: 3600 },
  reset: { ip: 30, id: 3, windowSec: 3600 },
  invite_accept: { ip: 60, windowSec: 3600 },
} as const satisfies Record<string, AuthRateLimits>;

/**
 * Bloqueio por FALHA, para o login.
 *
 * `authRateLimited` conta toda tentativa — certo para IP, errado para conta:
 * quem digita a senha certa não pode gastar o próprio orçamento de bloqueio.
 * Aqui a consulta vem antes do provedor (só assim o ataque é barrado *antes*
 * de acontecer) e o incremento vem depois, apenas quando a senha errou.
 *
 * Efeito: N senhas erradas trancam a conta pela janela, inclusive contra quem
 * distribui as tentativas por muitos IPs. Acertar na 3ª não custa nada.
 */
export async function contaBloqueadaPorFalhas(email: string, limits: AuthRateLimits): Promise<boolean> {
  if (limits.id === undefined) return false;
  const atual = await peekRateLimit(`auth:login_fail:id:${opaque(email)}`, limits.windowSec);
  return atual >= limits.id;
}

/** Registra uma senha errada no contador da conta. */
export async function registrarFalhaDeLogin(email: string, limits: AuthRateLimits): Promise<void> {
  if (limits.id === undefined) return;
  await checkRateLimit(`auth:login_fail:id:${opaque(email)}`, limits.id, limits.windowSec);
}
