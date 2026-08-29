/**
 * A autorização da conta de Instagram — o que acontece antes de existir token.
 *
 * ─── Três trocas, e cada uma fala com um host diferente ─────────────────────
 *
 *   1. consentimento  →  `www.instagram.com/oauth/authorize`   (o navegador vai)
 *   2. código → token curto  →  `api.instagram.com/oauth/access_token`  (POST)
 *   3. curto → longo  →  `graph.instagram.com/access_token`             (GET)
 *
 * Os hosts são MESMO diferentes, e trocar um pelo outro devolve 404 com um corpo
 * que não parece erro de host. É o tipo de detalhe que só se descobre depurando
 * com a conta de um cliente na linha.
 *
 * ─── O token curto dura UMA hora, e é por isso que o passo 3 não é opcional ──
 *
 * A troca para o token de longa duração precisa acontecer dentro dessa hora, no
 * mesmo fluxo. Guardar o token curto e "trocar depois" é uma conexão que morre
 * sozinha antes do primeiro almoço.
 *
 * ─── Por que nada aqui lança ────────────────────────────────────────────────
 *
 * Toda função de rede devolve um resultado discriminado, nunca exceção. Quem
 * chama é uma rota de navegador: uma exceção vira página de erro genérica, e a
 * pessoa que estava conectando a conta fica sem saber se foi a credencial, a
 * permissão ou a rede. O motivo tem que chegar à tela em palavras.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * As permissões pedidas na mesma submissão.
 *
 * `human_agent` NÃO entra aqui de propósito: ela é aprovada à parte pela Meta e,
 * pedida junto sem aprovação, faz a tela de consentimento inteira falhar — a
 * pessoa vê um erro da Meta e não consegue conectar nem o que já estava
 * aprovado. Ela amplia a janela de resposta humana para 7 dias e não muda nada
 * para o agente de IA, então o custo de deixá-la fora é pequeno e o de incluí-la
 * cedo demais é o fluxo não funcionar.
 */
export const ESCOPOS_DO_INSTAGRAM = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
] as const;

/** Onde mora a tela de consentimento. Sobrescrevível para o teste. */
export function instagramAuthorizeBaseUrl(): string {
  return process.env.INSTAGRAM_AUTHORIZE_BASE_URL ?? "https://www.instagram.com";
}

/** Onde o código vira token curto. NÃO é o mesmo host do resto. */
export function instagramApiBaseUrl(): string {
  return process.env.INSTAGRAM_API_BASE_URL ?? "https://api.instagram.com";
}

export interface EstadoDaAutorizacao {
  /** De fonte confiável — nunca do que a Meta devolveu. */
  organizationId: string;
  channelSessionId: string;
  /** Instante de expiração, em milissegundos. */
  expiraEm: number;
}

export type ResultadoDeToken =
  | { ok: true; token: string; expiraEm: string | null }
  | { ok: false; motivo: string };

export type ResultadoDaConta =
  | { ok: true; instagramUserId: string; username: string | null }
  | { ok: false; motivo: string };

/** Quanto tempo o `state` vale. Uma tela de consentimento não demora mais. */
export const VALIDADE_DO_ESTADO_MS = 10 * 60 * 1000;

function base64url(b: Buffer): string {
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/**
 * Assina o `state` que atravessa o navegador da pessoa.
 *
 * ⚠️ O `state` é a ÚNICA coisa nossa que sobrevive à ida à Meta, e ele volta
 * pela URL — quer dizer, por um canal que quem está conectando controla. Sem
 * assinatura, alguém edita `organizationId` na barra de endereço e a conta de
 * Instagram dele é gravada na organização de outra pessoa; a partir daí as
 * mensagens de uma empresa entram no CRM de outra. Por isso o conteúdo é
 * assinado, e não apenas opaco.
 */
export function assinarEstado(
  estado: EstadoDaAutorizacao,
  segredo: string,
): string {
  const corpo = base64url(Buffer.from(JSON.stringify(estado), "utf8"));
  const assinatura = base64url(createHmac("sha256", segredo).update(corpo).digest());
  return `${corpo}.${assinatura}`;
}

/**
 * Confere e devolve o `state`, ou `null` — e `null` é sempre recusa.
 *
 * Não distingue "assinatura errada" de "vencido" para quem chama: as duas viram
 * a mesma recusa na tela. A distinção só serviria para quem estivesse tentando
 * forjar um.
 */
export function conferirEstado(
  bruto: string | null,
  segredo: string,
  agora: Date,
): EstadoDaAutorizacao | null {
  if (!bruto || !segredo) return null;
  const partes = bruto.split(".");
  if (partes.length !== 2) return null;
  const [corpo, assinatura] = partes as [string, string];

  const esperada = base64url(createHmac("sha256", segredo).update(corpo).digest());
  const a = Buffer.from(assinatura, "utf8");
  const b = Buffer.from(esperada, "utf8");
  // Tamanho conferido ANTES: `timingSafeEqual` LANÇA com buffers de tamanhos
  // diferentes, e uma exceção aqui viraria 500 em vez de recusa.
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const lido = JSON.parse(deBase64url(corpo).toString("utf8")) as EstadoDaAutorizacao;
    if (!lido?.organizationId || !lido?.channelSessionId) return null;
    if (typeof lido.expiraEm !== "number" || lido.expiraEm <= agora.getTime()) return null;
    return lido;
  } catch {
    return null;
  }
}

/** A URL para onde o navegador da pessoa é mandado. */
export function montarUrlDeAutorizacao(entrada: {
  appId: string;
  redirectUri: string;
  state: string;
}): string {
  const u = new URL("/oauth/authorize", instagramAuthorizeBaseUrl());
  u.searchParams.set("client_id", entrada.appId);
  u.searchParams.set("redirect_uri", entrada.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", ESCOPOS_DO_INSTAGRAM.join(","));
  u.searchParams.set("state", entrada.state);
  return u.toString();
}

/**
 * O código que a Meta devolve vem com `#_` grudado no fim.
 *
 * Navegador não manda fragmento ao servidor, então na maior parte das vezes ele
 * não chega até aqui — mas a documentação da Meta diz explicitamente que o
 * sufixo existe, e um código com dois caracteres a mais é recusado na troca com
 * uma mensagem que não menciona sufixo nenhum. Limpar custa uma linha; depurar
 * isso custa uma tarde.
 */
export function limparCodigo(code: string): string {
  return code.replace(/#_$/, "");
}

/**
 * Lê um id numérico GRANDE sem perder dígito.
 *
 * ⚠️ O IGSID tem 17 dígitos — `17841400000000001` — e o maior inteiro que o
 * JavaScript representa exatamente tem 16. `JSON.parse` de um número desses
 * devolve um valor PRÓXIMO, não o mesmo: o último dígito muda em silêncio.
 *
 * O estrago é o pior tipo, porque nada falha na hora: a conexão grava um id de
 * conta parecido, a tela mostra "conectada", e TODA chamada de envio depois
 * responde 404 para uma conta que existe. Por isso o id é extraído do texto
 * CRU, antes de qualquer `JSON.parse` encostar nele.
 *
 * Aceita as duas formas, porque a Meta não é consistente entre endpoints:
 * `"user_id": 178414…` e `"user_id": "178414…"`.
 */
export function lerIdGrande(textoCru: string, campo: string): string | null {
  const padrao = new RegExp(`"${campo}"\\s*:\\s*"?(\\d+)"?`);
  return padrao.exec(textoCru)?.[1] ?? null;
}

async function lerErro(resposta: Response): Promise<string> {
  const corpo = (await resposta.json().catch(() => null)) as {
    error_message?: string;
    error?: { message?: string } | string;
    error_description?: string;
  } | null;

  if (typeof corpo?.error === "string") return corpo.error_description ?? corpo.error;
  return (
    corpo?.error_message ??
    corpo?.error?.message ??
    corpo?.error_description ??
    `HTTP ${resposta.status}`
  );
}

/**
 * Passo 2 — o código vira token de UMA hora.
 *
 * Corpo em `application/x-www-form-urlencoded`, não JSON: este endpoint recusa
 * JSON, e a recusa vem como "Missing required field client_id" mesmo com o
 * campo presente no corpo — o erro aponta para o lugar errado.
 */
export async function trocarCodigoPorTokenCurto(entrada: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
}): Promise<ResultadoDeToken & { instagramUserId?: string }> {
  const corpo = new URLSearchParams({
    client_id: entrada.appId,
    client_secret: entrada.appSecret,
    grant_type: "authorization_code",
    redirect_uri: entrada.redirectUri,
    code: limparCodigo(entrada.code),
  });

  let r: Response;
  try {
    r = await fetch(`${instagramApiBaseUrl()}/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: corpo.toString(),
    });
  } catch (e) {
    return { ok: false, motivo: `rede: ${e instanceof Error ? e.message : "falhou"}` };
  }

  if (!r.ok) return { ok: false, motivo: await lerErro(r) };

  const cru = await r.text().catch(() => "");
  let dados: { access_token?: string } | null = null;
  try {
    dados = JSON.parse(cru) as { access_token?: string };
  } catch {
    return { ok: false, motivo: "resposta não é JSON" };
  }

  if (!dados?.access_token) return { ok: false, motivo: "resposta sem access_token" };

  return {
    ok: true,
    token: dados.access_token,
    expiraEm: null,
    // A conta já vem aqui, e é lida do texto CRU pelo mesmo motivo do outro
    // endpoint: 17 dígitos não cabem no inteiro seguro do JavaScript. Guardar
    // este valor evitaria uma chamada, mas NÃO substitui a consulta do passo
    // seguinte — há relatos de ele divergir do id usado no envio.
    instagramUserId: lerIdGrande(cru, "user_id") ?? undefined,
  };
}

/**
 * Passo 3 — o token de uma hora vira o de 60 dias.
 *
 * OBRIGATÓRIO no mesmo fluxo: o curto vence em uma hora, e uma conexão que
 * guardasse só ele estaria morta antes de alguém testar.
 */
export async function trocarCurtoPorLongo(entrada: {
  appSecret: string;
  tokenCurto: string;
  baseUrl: string;
  agora: Date;
}): Promise<ResultadoDeToken> {
  const u = new URL("/access_token", entrada.baseUrl);
  u.searchParams.set("grant_type", "ig_exchange_token");
  u.searchParams.set("client_secret", entrada.appSecret);
  u.searchParams.set("access_token", entrada.tokenCurto);
  return pedirToken(u, entrada.agora);
}

/**
 * A renovação, que é o que impede o canal de morrer aos 60 dias.
 *
 * A Meta exige que o token tenha ao menos 24 horas de vida e ainda esteja
 * válido. Vencido, não há renovação: só reconectar pela tela. É a diferença
 * entre um cron que roda e um cliente que descobre sozinho que parou de receber
 * mensagem — o Chatwoot não tem esta rodada, e a caixa de entrada dele morre em
 * silêncio no sexagésimo dia.
 */
export async function renovarTokenLongo(entrada: {
  tokenLongo: string;
  baseUrl: string;
  agora: Date;
}): Promise<ResultadoDeToken> {
  const u = new URL("/refresh_access_token", entrada.baseUrl);
  u.searchParams.set("grant_type", "ig_refresh_token");
  u.searchParams.set("access_token", entrada.tokenLongo);
  return pedirToken(u, entrada.agora);
}

async function pedirToken(u: URL, agora: Date): Promise<ResultadoDeToken> {
  let r: Response;
  try {
    r = await fetch(u.toString(), { method: "GET" });
  } catch (e) {
    return { ok: false, motivo: `rede: ${e instanceof Error ? e.message : "falhou"}` };
  }

  if (!r.ok) return { ok: false, motivo: await lerErro(r) };

  const dados = (await r.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;

  if (!dados?.access_token) return { ok: false, motivo: "resposta sem access_token" };

  // `expires_in` vem em SEGUNDOS. Tratá-lo como milissegundos põe o vencimento
  // a 60 segundos de distância e faz o cron renovar sem parar; tratá-lo ao
  // contrário põe o vencimento em 2085 e o cron nunca renova. Os dois erros são
  // silenciosos, e o segundo só aparece no sexagésimo dia.
  const expiraEm =
    typeof dados.expires_in === "number" && Number.isFinite(dados.expires_in)
      ? new Date(agora.getTime() + dados.expires_in * 1000).toISOString()
      : null;

  return { ok: true, token: dados.access_token, expiraEm };
}

/**
 * Qual conta este token abre.
 *
 * O token no CABEÇALHO, nunca na query — a mesma regra do envio. Query string
 * entra no log de qualquer proxy no caminho, e ali o token vira credencial
 * vazada.
 */
export async function contaDoToken(entrada: {
  token: string;
  baseUrl: string;
  graphVersion: string;
}): Promise<ResultadoDaConta> {
  const u = new URL(`/${entrada.graphVersion}/me`, entrada.baseUrl);
  u.searchParams.set("fields", "user_id,username");

  let r: Response;
  try {
    r = await fetch(u.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${entrada.token}` },
    });
  } catch (e) {
    return { ok: false, motivo: `rede: ${e instanceof Error ? e.message : "falhou"}` };
  }

  if (!r.ok) return { ok: false, motivo: await lerErro(r) };

  // O texto CRU primeiro: o id não pode passar por `JSON.parse` (ver
  // `lerIdGrande`). O resto pode, porque `username` é string.
  const cru = await r.text().catch(() => "");

  // `user_id` ANTES de `id`, e a ordem não é indiferente: o endpoint de
  // mensagens é indexado pelo id da conta profissional, que vem em `user_id`.
  // `id` é o do app-scoped user e, usado no lugar dele, produz 404 numa chamada
  // que parece correta.
  const conta = lerIdGrande(cru, "user_id") ?? lerIdGrande(cru, "id");
  if (!conta) return { ok: false, motivo: "resposta sem id da conta" };

  let username: string | null = null;
  try {
    username = (JSON.parse(cru) as { username?: string })?.username ?? null;
  } catch {
    // Corpo ilegível não invalida o id: ele já foi extraído do texto.
  }

  return { ok: true, instagramUserId: conta, username };
}
