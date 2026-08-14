/**
 * O LOGO SUBIDO PELA TELA CHEGA À TELA — nas duas camadas, e sem uma vazar na outra.
 *
 * ═══ POR QUE ESTA SPEC EXISTE, E POR QUE NÃO BASTA `curl` ═══
 *
 * O produto é distribuído open-source: a experiência de quem instala numa VPS É o
 * produto. O que se prova aqui é a cadeia inteira que uma pessoa percorre — abrir
 * a tela, escolher um arquivo, ver a barra lateral mudar — e ela tem quatro elos
 * que uma chamada de API não exercita: o `<input type=file>`, o `fetch` do
 * componente, o `router.refresh()` que traz o render novo, e o `<img>` que o
 * navegador de fato baixa do bucket **público** (uma URL assinada vencida, ou um
 * bucket privado, aparece exatamente aqui e em lugar nenhum antes).
 *
 * ═══ AS TRÊS PROPRIEDADES, E A ORDEM EM QUE ELAS SE PROVAM ═══
 *
 *   1. **A camada da instalação pinta a fachada.** O logo do dono do servidor
 *      aparece na barra lateral E no `/login` de quem não entrou — a P0 de
 *      primeira impressão.
 *   2. **A camada da organização NÃO vaza para a fachada.** O logo do cliente
 *      final troca a barra lateral dele e o `/login` continua sendo o do
 *      revendedor. É a propriedade que separa "marca própria" de "qualquer um
 *      repinta a instalação".
 *   3. **O que não é imagem não entra.** Um SVG renomeado para `.png` é recusado
 *      pelos BYTES, com a razão dita em português, e nada muda na tela.
 *
 * ═══ QUEM É QUEM ═══
 *
 * O dono do servidor é `e2e-dono@deskcomm.test` (dedicado, `platform_admins`), e
 * o admin de tenant é `e2e-admin@deskcomm.test` — a separação e o porquê estão em
 * `tests/e2e/utils/precondicao.ts`. Os dois têm TOTP: `requiresMfa`
 * (`lib/auth/server.ts`) é verdadeiro para platform admin E para `role === admin`.
 *
 * ⚠️ Esta spec ESCREVE marca. Ela restaura o estado no fim (remove os dois logos)
 * e a restauração é pela ROTA, não por SQL: quem invalida o memo de 30s da marca
 * da instalação é o código do produto (`invalidarMarcaDaInstalacao`), e um
 * `update` direto no banco deixaria a spec seguinte medindo a sobra.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

import { test, expect, type Page, type Browser } from "@playwright/test";

import { generateTotp, msUntilNextTotpWindow } from "./utils/totp";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const EVIDENCIA = path.join(process.cwd(), "evidence", "marca-logo");

interface E2ECreds {
  password: string;
  org_id: string;
  users: Record<string, { id: string; email: string; role: string }>;
  admin_totp?: { factor_id: string; secret: string };
  dono_totp?: { factor_id: string; secret: string };
}

function loadCreds(): E2ECreds {
  const precisaSemear = (): boolean => {
    if (!fs.existsSync(CREDS_PATH)) return true;
    const c = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as E2ECreds;
    return !c.users?.dono || !c.admin_totp?.secret || !c.dono_totp?.secret || !c.org_id;
  };
  if (precisaSemear()) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  // Promove `dono` a platform admin e REVOGA a promoção do `admin` — idempotente.
  // Sem a revogação, o admin de tenant desta spec passaria pelo gate da camada da
  // instalação e o caso (3) mediria o escape, não a separação de camadas.
  execFileSync("npx", ["tsx", "scripts/seed-e2e-system-update.ts"], { stdio: "inherit" });
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as E2ECreds;
}

const creds = loadCreds();

// ── Os arquivos de teste, gerados aqui ──────────────────────────────────────
//
// PNG de verdade, montado byte a byte, e não um base64 colado: um blob opaco no
// meio da spec é impossível de auditar (ninguém sabe se aquilo é mesmo uma
// imagem), e o caso do SVG depende de os bytes estarem exatamente errados.

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, "latin1"), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

/** Um PNG sólido de `lado`×`lado`, RGB, sem transparência. */
function pngSolido(lado: number, cor: [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  const linhas: Buffer[] = [];
  for (let y = 0; y < lado; y++) {
    const linha = Buffer.alloc(1 + lado * 3);
    for (let x = 0; x < lado; x++) {
      linha[1 + x * 3] = cor[0];
      linha[2 + x * 3] = cor[1];
      linha[3 + x * 3] = cor[2];
    }
    linhas.push(linha);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(Buffer.concat(linhas))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const PNG_DA_PLATAFORMA = pngSolido(48, [0x1d, 0x4e, 0xd8]);
const PNG_DA_ORGANIZACAO = pngSolido(48, [0xd8, 0x4e, 0x1d]);
/** Um SVG legítimo com script — o arquivo que o produto tem de recusar. */
const SVG_DISFARCADO = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><script>fetch("/x")</script><rect width="48" height="48"/></svg>',
  "utf8",
);

// ── Helpers de tela ─────────────────────────────────────────────────────────

async function loginComTotp(page: Page, email: string, secret: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/login\/mfa/);
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    if (msUntilNextTotpWindow() < 3_000) await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    await page.locator('input[aria-label="Dígito 1"]').click();
    await page.keyboard.type(generateTotp(secret), { delay: 40 });
    try {
      await page.waitForURL(/\/app\//, { timeout: 8_000 });
      return;
    } catch {
      await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    }
  }
  throw new Error(`MFA falhou depois de 2 tentativas para ${email}`);
}

async function subir(page: Page, escopo: "instalacao" | "organizacao", arquivo: {
  nome: string;
  mime: string;
  bytes: Buffer;
}): Promise<void> {
  await page.locator(`#logo-${escopo}`).setInputFiles({
    name: arquivo.nome,
    mimeType: arquivo.mime,
    buffer: arquivo.bytes,
  });
}

/**
 * O `src` do logo da barra lateral, MEDIDO por ferramenta, junto da altura.
 *
 * O par não é zelo: `src` certo com altura 0 é o defeito de uma imagem que o
 * navegador não conseguiu baixar (bucket privado, URL assinada vencida) — e ele
 * é invisível numa asserção que olhe só o atributo.
 */
async function logoDaBarra(page: Page): Promise<{ src: string; altura: number } | null> {
  const img = page.locator("aside img").first();
  if ((await img.count()) === 0) return null;
  await expect(img).toBeVisible();
  return img.evaluate((el) => ({
    src: (el as HTMLImageElement).src,
    altura: el.getBoundingClientRect().height,
  }));
}

async function logoDoLogin(browser: Browser): Promise<string | null> {
  // Contexto NOVO e sem sessão: é o estado de quem acabou de receber o endereço.
  const contexto = await browser.newContext();
  try {
    const pagina = await contexto.newPage();
    await pagina.goto("/login");
    const img = pagina.locator("form img, main img, div > img").first();
    if ((await img.count()) === 0) return null;
    return img.evaluate((el) => (el as HTMLImageElement).src);
  } finally {
    await contexto.close();
  }
}

const PREFIXO_PUBLICO = "/storage/v1/object/public/brand-logos/";

function evidencia(nome: string): string {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  return path.join(EVIDENCIA, nome);
}

// ── A spec ──────────────────────────────────────────────────────────────────

test.describe.configure({ mode: "serial" });

test.describe("o logo subido pela tela chega à tela", () => {
  // Um login por papel no arquivo inteiro: a suíte compartilha o teto de
  // 60 logins/IP/300s e o CI roda tudo do mesmo 127.0.0.1.
  test.setTimeout(120_000);

  test("(1) o dono do servidor sobe o logo e ele aparece na barra lateral", async ({ page }) => {
    const secret = creds.dono_totp?.secret;
    expect(secret, "sem `dono_totp` no .e2e-creds.json — rode seed-e2e-credentials.ts").toBeTruthy();
    await loginComTotp(page, creds.users.dono!.email, secret!);

    await page.goto("/admin/marca");
    await expect(page.locator("#logo-instalacao")).toBeVisible();
    await subir(page, "instalacao", {
      nome: "logo-da-plataforma.png",
      mime: "image/png",
      bytes: PNG_DA_PLATAFORMA,
    });
    await expect(page.getByText(/logo atualizado/i)).toBeVisible({ timeout: 15_000 });

    // A prévia sobre as DUAS superfícies mostra a imagem real — é o que
    // substituiu o analisador de luminância no servidor.
    await expect(page.locator("[data-previa-do-logo='claro'] img")).toBeVisible();
    await expect(page.locator("[data-previa-do-logo='escuro'] img")).toBeVisible();
    await page.screenshot({ path: evidencia("1-admin-marca-previa.png"), fullPage: true });

    await page.goto("/app");
    const barra = await logoDaBarra(page);
    expect(barra, "nenhuma <img> na barra lateral depois do upload").not.toBeNull();
    expect(barra!.src).toContain(`${PREFIXO_PUBLICO}platform/`);
    // Altura > 0 é o que distingue "o `src` está certo" de "o navegador
    // conseguiu baixar a imagem do bucket público".
    expect(barra!.altura).toBeGreaterThan(0);
    await page.screenshot({ path: evidencia("2-sidebar-do-dono.png") });
  });

  test("(2) quem NÃO entrou vê o logo do dono na tela de acesso — a P0", async ({ browser }) => {
    const src = await logoDoLogin(browser);
    expect(src, "a tela de acesso não renderizou logo nenhum").not.toBeNull();
    expect(src!).toContain(`${PREFIXO_PUBLICO}platform/`);

    const contexto = await browser.newContext();
    const pagina = await contexto.newPage();
    await pagina.goto("/login");
    await pagina.screenshot({ path: evidencia("3-login-deslogado.png"), fullPage: true });
    await contexto.close();
  });

  test("(3) o logo da EMPRESA troca a barra dela e NÃO vaza para a tela de acesso", async ({
    page,
    browser,
  }) => {
    const secret = creds.admin_totp?.secret;
    expect(secret, "sem `admin_totp` no .e2e-creds.json").toBeTruthy();
    await loginComTotp(page, creds.users.admin!.email, secret!);

    await page.goto("/app/settings/marca");
    await expect(page.locator("#logo-organizacao")).toBeVisible();
    await subir(page, "organizacao", {
      nome: "logo-da-empresa.png",
      mime: "image/png",
      bytes: PNG_DA_ORGANIZACAO,
    });
    await expect(page.getByText(/logo atualizado/i)).toBeVisible({ timeout: 15_000 });

    await page.goto("/app");
    const barra = await logoDaBarra(page);
    expect(barra).not.toBeNull();
    expect(barra!.src).toContain(`${PREFIXO_PUBLICO}${creds.org_id}/`);
    expect(barra!.altura).toBeGreaterThan(0);
    await page.screenshot({ path: evidencia("4-sidebar-da-empresa.png") });

    // A camada de cima NÃO alcança a fachada: quem não entrou continua vendo o
    // logo do revendedor. Sem esta asserção, o caso (1) e o (3) seriam
    // indistinguíveis de "o último upload repinta tudo".
    const noLogin = await logoDoLogin(browser);
    expect(noLogin!).toContain(`${PREFIXO_PUBLICO}platform/`);
    expect(noLogin!).not.toContain(`${PREFIXO_PUBLICO}${creds.org_id}/`);
  });

  test("(4) SVG renomeado para .png é recusado pelos BYTES, com a razão dita", async ({ page }) => {
    await page.goto("/app/settings/marca");
    const antes = await (async () => {
      await page.goto("/app");
      return logoDaBarra(page);
    })();

    await page.goto("/app/settings/marca");
    await subir(page, "organizacao", {
      // Nome E `Content-Type` mentem — os dois campos que o atacante escolhe.
      nome: "logo.png",
      mime: "image/png",
      bytes: SVG_DISFARCADO,
    });
    // A recusa tem código próprio para a frase falar de SVG, e não "tipo de
    // mídia não suportado": é o formato em que um designer entrega logo.
    await expect(page.getByText(/SVG não é aceito/i)).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: evidencia("5-svg-recusado.png"), fullPage: true });

    await page.goto("/app");
    const depois = await logoDaBarra(page);
    expect(depois!.src, "a recusa mudou o logo — a gravação não foi atômica").toBe(antes!.src);
  });

  test("(5) remover devolve o logo da camada de baixo", async ({ page }) => {
    await page.goto("/app/settings/marca");
    await page.getByRole("button", { name: /^remover$/i }).click();
    await expect(page.getByText(/logo removido/i)).toBeVisible({ timeout: 15_000 });

    await page.goto("/app");
    const barra = await logoDaBarra(page);
    expect(barra, "a barra ficou sem logo — a camada de baixo não assumiu").not.toBeNull();
    expect(barra!.src).toContain(`${PREFIXO_PUBLICO}platform/`);
    await page.screenshot({ path: evidencia("6-volta-ao-da-instalacao.png") });
  });

  test("(6) restaura o estado — o dono remove o logo da instalação", async ({ page, browser }) => {
    // A restauração é um CASO, e não um `afterAll`: `afterAll` não roda quando a
    // spec estoura no meio, e o que ficaria para trás é a marca da instalação
    // trocada para todas as specs seguintes do mesmo banco.
    await loginComTotp(page, creds.users.dono!.email, creds.dono_totp!.secret);
    await page.goto("/admin/marca");
    await page.getByRole("button", { name: /^remover$/i }).click();
    await expect(page.getByText(/logo removido/i)).toBeVisible({ timeout: 15_000 });

    const noLogin = await logoDoLogin(browser);
    // `null` (nenhuma imagem) ou uma URL que não é do bucket (o `APP_LOGO_URL`
    // do `.env`, se houver): o que NÃO pode sobrar é o arquivo desta spec.
    if (noLogin !== null) expect(noLogin).not.toContain(PREFIXO_PUBLICO);
  });
});
