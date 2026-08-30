/**
 * O endereço público desta instalação, e a URL de volta da autorização.
 *
 * Mora num módulo à parte porque TRÊS rotas precisam da mesma resposta e um
 * caractere de diferença entre elas quebra a autorização: a Meta compara o
 * `redirect_uri` da ida com o da volta byte a byte, e recusa a troca do código
 * com uma mensagem que não diz qual URL ela esperava. Duas cópias divergem na
 * primeira que alguém editar.
 */
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";

/**
 * A base pública — a mesma lógica do canal oficial, pelo mesmo motivo.
 *
 * `env.*` e NÃO `process.env.NEXT_PUBLIC_APP_URL` direto: variáveis
 * `NEXT_PUBLIC_` são substituídas no BUILD, e a imagem genérica do self-host é
 * construída com `https://placeholder.invalid`. Lida do `process.env`, a tela
 * mostraria essa URL — e quem a cadastrasse na Meta apontaria a autorização para
 * o nada, sem erro em lugar nenhum.
 */
export function baseParaCallback(req: NextRequest): string {
  const configurada = env.NEXT_PUBLIC_APP_URL;
  const usavel = configurada && !configurada.includes("placeholder.invalid") ? configurada : null;
  return usavel ?? req.headers.get("origin") ?? `${req.nextUrl.protocol}//${req.nextUrl.host}`;
}

/** Para onde a Meta devolve o navegador depois do consentimento. */
export function urlDeCallbackDoInstagram(base: string): string {
  return `${base.replace(/\/+$/, "")}/api/v1/channels/instagram/callback`;
}

/** A tela de conexões, para onde a pessoa volta com o desfecho. */
export function urlDaTelaDeConexoes(base: string, desfecho: string): string {
  const u = new URL("/conexoes", base);
  u.searchParams.set("canal", "instagram");
  u.searchParams.set("autorizacao", desfecho);
  return u.toString();
}
