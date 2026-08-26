/**
 * O app OAuth do Google desta INSTALAÇÃO — e o único lugar que monta o
 * endereço de retorno.
 *
 * ─── Por que "opcional" aqui é requisito, e não descuido ──────────────────
 *
 * DECISÃO 3.1: sem `GOOGLE_CALENDAR_CLIENT_ID` e `GOOGLE_CALENDAR_CLIENT_SECRET`
 * o módulo de Agenda funciona INTEIRO — some o botão "Conectar Google" e a tela
 * explica em uma linha o que falta e onde obter. Esse é o estado real de um
 * primeiro deploy self-host, e é onde moram os piores defeitos de primeira
 * impressão: um módulo que se recusa a abrir porque falta uma chave que o
 * operador nem sabia que existia.
 *
 * Por isso `configuracaoDoGoogle()` devolve `null` em vez de lançar. Quem chama
 * decide: a tela mostra o cartão de "não configurado", a rota responde
 * `not_configured`. É o mesmo contrato do `getConfig()` da Nuvemshop, que é o
 * precedente desta casa.
 *
 * ─── UMA fonte para o `redirect_uri`, e a razão é medida ──────────────────
 *
 * O Google compara o `redirect_uri` do consentimento com o da troca do código
 * **byte a byte**. No cal.com esse valor sai de DOIS lugares — `redirect_uris[0]`
 * das chaves do app na renovação, e a URL da aplicação em `add`/`callback` — e
 * quando os dois divergem o fluxo quebra com `redirect_uri_mismatch`, que é um
 * erro que aponta para o Google e não para a divergência.
 *
 * Aqui existe **um** `enderecoDeRetorno()`, e tanto a URL de consentimento
 * quanto a troca do código usam ele. Se um dia precisar mudar, muda num lugar
 * só — que é o que impede a classe inteira.
 */

import { env } from "@/lib/env";

/** O caminho da rota de callback. Tem de estar registrado no console do Google. */
export const CAMINHO_DO_CALLBACK = "/api/v1/agenda/google/callback";

/** Os nomes das variáveis, para a tela poder dizer exatamente o que falta. */
export const VARIAVEIS_DO_GOOGLE = ["GOOGLE_CALENDAR_CLIENT_ID", "GOOGLE_CALENDAR_CLIENT_SECRET"] as const;

export interface AppDoGoogleConfigurado {
  clientId: string;
  clientSecret: string;
  /** Absoluto, e idêntico nos dois lados do fluxo. */
  redirectUri: string;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * O endereço de retorno, derivado da URL pública da instalação.
 *
 * Sem barra dupla e sem barra final: o Google compara a string exata, e
 * `https://crm.exemplo//api/...` é um endereço diferente de
 * `https://crm.exemplo/api/...` para ele.
 */
export function enderecoDeRetorno(urlDaAplicacao: string = env.NEXT_PUBLIC_APP_URL): string {
  const base = texto(urlDaAplicacao).replace(/\/+$/, "");
  return `${base}${CAMINHO_DO_CALLBACK}`;
}

/**
 * A configuração, ou `null` quando a instalação não tem app OAuth.
 *
 * Nunca lança — ver o cabeçalho.
 */
export function configuracaoDoGoogle(): AppDoGoogleConfigurado | null {
  const clientId = texto(env.GOOGLE_CALENDAR_CLIENT_ID);
  const clientSecret = texto(env.GOOGLE_CALENDAR_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;

  // ⚠️ NÃO há guarda para `NEXT_PUBLIC_APP_URL` vazia aqui, e a ausência é
  // deliberada: `lib/env.ts:308-311` a declara `.url()` com default
  // `http://localhost:3000`, então ela nunca chega vazia — string vazia reprova
  // no `.url()` e o processo nem sobe. A guarda que eu tinha escrito era código
  // morto, e o teste que a exercitava não conseguia sequer montar o cenário: o
  // próprio `env.ts` lançava antes. Guarda inalcançável é pior que guarda
  // ausente — ela dá a sensação de defesa e não pode ser testada.
  return { clientId, clientSecret, redirectUri: enderecoDeRetorno() };
}

/** Conectar o Google está disponível nesta instalação? */
export function googleEstaConfigurado(): boolean {
  return configuracaoDoGoogle() !== null;
}

/**
 * O que falta, pelo nome — para a tela dizer em vez de só desabilitar o botão.
 *
 * Controle desabilitado sem explicação é o mesmo defeito que controle
 * decorativo, virado do avesso: o operador vê que não pode e não descobre por
 * quê.
 */
export function faltaParaConectarOGoogle(): string[] {
  const faltando: string[] = [];
  if (!texto(env.GOOGLE_CALENDAR_CLIENT_ID)) faltando.push("GOOGLE_CALENDAR_CLIENT_ID");
  if (!texto(env.GOOGLE_CALENDAR_CLIENT_SECRET)) faltando.push("GOOGLE_CALENDAR_CLIENT_SECRET");
  // `NEXT_PUBLIC_APP_URL` não entra: ela tem default e validação de URL em
  // `lib/env.ts`, então nunca falta. Listá-la mandaria o operador procurar algo
  // que está lá.
  return faltando;
}
