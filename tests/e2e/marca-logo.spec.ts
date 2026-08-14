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
 * `tests/e2e/utils/precondicao.ts`. Os dois entram por `/login/mfa`, e a razão é o
 * CADASTRO, não o papel: `signInWithPassword.ts:93-97` desvia para o desafio
 * quando o usuário tem um fator TOTP verificado, e o seed cadastra um para cada um
 * destes dois (`scripts/seed-e2e-credentials.ts`). Desde a MFA opcional,
 * `requiresMfa` (`lib/auth/server.ts:176-206`) consulta duas políticas cujo padrão
 * é NÃO exigir — ela decide quem é obrigado a cadastrar, e não decide nada sobre
 * quem já cadastrou. Uma versão anterior deste cabeçalho dizia que o gate era
 * `platform_admin || role === "admin"`; isso descreve a regra que o produto tinha
 * antes, e quem lesse aqui concluiria que basta despromover para pular o desafio.
 *
 * ⚠️ Esta spec ESCREVE marca. A restauração (remover os dois logos) é pela ROTA,
 * não por SQL: quem invalida o memo de 30s da marca da instalação é o código do
 * produto (`invalidarMarcaDaInstalacao`), e um `update` direto no banco deixaria a
 * spec seguinte medindo a sobra. Ela mora num `test.afterAll` — o porquê, medido,
 * está no comentário do hook lá embaixo.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

import { test, expect, type Page, type Browser, type Locator } from "@playwright/test";

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

type Escopo = "instalacao" | "organizacao";

async function subir(page: Page, escopo: Escopo, arquivo: {
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
 * Remove o logo desta camada SE houver um — a peça da restauração.
 *
 * Tolerante a "não há nada para remover" de propósito: o botão só é renderizado
 * quando a camada tem logo próprio (`CampoDeLogo.tsx:176`), e o hook precisa poder
 * rodar tanto depois da spec inteira (onde os casos já removeram) quanto depois de
 * um estouro no primeiro caso (onde nada chegou a ser subido). Um `click()` cego
 * nos dois casos esperaria até o timeout e transformaria a limpeza em vermelho.
 */
async function removerLogoSeHouver(page: Page, tela: string, escopo: Escopo): Promise<void> {
  await page.goto(tela);
  const remover = page
    .locator(`[data-campo-de-logo='${escopo}']`)
    .getByRole("button", { name: /^remover$/i });
  if ((await remover.count()) === 0) return;
  await remover.click();
  await expect(page.getByText(/logo removido/i)).toBeVisible({ timeout: 15_000 });
}

/** O que um `<img>` do produto mostra, medido por ferramenta. */
interface LogoNaTela {
  readonly src: string;
  /** A altura pintada. Descritiva — quem prova download é `larguraNatural`. */
  readonly altura: number;
  /** A largura do BITMAP decodificado: 0 = o navegador não tem imagem. */
  readonly larguraNatural: number;
}

/**
 * Mede um `<img>` DEPOIS de o navegador terminar com ele.
 *
 * ⚠️ Quem prova o download é `naturalWidth`, e NÃO a altura na tela — o contrário
 * do que esta spec afirmou. Os dois `<img>` de marca do produto têm altura fixada
 * por CSS (`h-7` em `components/shell/Sidebar.tsx:82`, `h-10` em
 * `app/(public)/layout.tsx:54`), e altura fixa mede o mesmo para quem baixou e
 * para quem não baixou. MEDIDO em chromium, dois `<img>` sob `height: 1.75rem`
 * (o `h-7`), um com PNG válido e outro apontando para um endereço morto:
 *
 *   boa={"nat":1,"altura":28}   quebrada={"nat":0,"altura":28}
 *
 * `altura > 0` passava nos DOIS — ou seja, passava exatamente no cenário (bucket
 * privado, URL assinada vencida) que ela alegava cobrir. `naturalWidth` é a
 * dimensão do bitmap decodificado, e só ele separa os dois casos. Provar este elo
 * é a razão declarada de esta spec existir em vez de um `curl`.
 *
 * A espera pelo `load`/`error` antes de medir não é zelo: sem ela, medir cedo
 * demais devolve `naturalWidth: 0` de uma imagem que estava só a caminho — um
 * vermelho por corrida, no lugar de um vermelho por defeito.
 */
async function medirImagem(img: Locator): Promise<LogoNaTela> {
  await expect(img).toBeVisible();
  await img.evaluate(
    (el) =>
      new Promise<void>((resolve) => {
        const imagem = el as HTMLImageElement;
        // `complete` é true também quando o download FALHOU — que é o caso que
        // interessa medir. Ele encerra a espera; quem separa sucesso de falha é
        // o `naturalWidth` logo abaixo.
        if (imagem.complete) return resolve();
        imagem.addEventListener("load", () => resolve(), { once: true });
        imagem.addEventListener("error", () => resolve(), { once: true });
        // Teto próprio: sem ele um download pendurado consumiria o timeout do
        // teste inteiro, e a reprovação sairia como "timed out" sem dizer o quê.
        setTimeout(() => resolve(), 10_000);
      }),
  );
  return img.evaluate((el) => ({
    src: (el as HTMLImageElement).src,
    altura: el.getBoundingClientRect().height,
    larguraNatural: (el as HTMLImageElement).naturalWidth,
  }));
}

/** O logo da barra lateral. `null` = a barra está sem `<img>` (nome em texto). */
async function logoDaBarra(page: Page): Promise<LogoNaTela | null> {
  const img = page.locator("aside img").first();
  if ((await img.count()) === 0) return null;
  return medirImagem(img);
}

/** O que prova que o logo BAIXOU, e não só que o `src` está escrito. */
function baixou(logo: LogoNaTela, onde: string): void {
  expect(
    logo.larguraNatural,
    `${onde}: o <img> tem src mas o bitmap veio vazio — o navegador não baixou do bucket público`,
  ).toBeGreaterThan(0);
}

/**
 * O logo da FACHADA (as telas de antes de entrar), visto por quem não entrou.
 *
 * O seletor é o `data-testid` do `<img>` de `app/(public)/layout.tsx`, e não "a
 * primeira imagem da página": a asserção de NEGAÇÃO do caso (3) — a fachada não
 * mostra o logo da empresa — passaria vacuosamente no dia em que qualquer ícone
 * entrasse antes do logo no DOM do `/login`.
 */
async function logoDoLogin(browser: Browser): Promise<LogoNaTela | null> {
  // Contexto NOVO e sem sessão: é o estado de quem acabou de receber o endereço.
  const contexto = await browser.newContext();
  try {
    const pagina = await contexto.newPage();
    await pagina.goto("/login");
    const img = pagina.getByTestId("logo-da-fachada");
    // Ausência é resposta legítima: sem logo em nenhuma camada, o layout não
    // renderiza `<img>` nenhum e a fachada aparece com o nome em texto.
    if ((await img.count()) === 0) return null;
    return await medirImagem(img);
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
  /**
   * TODO CASO QUE PRECISA DE SESSÃO FAZ O PRÓPRIO LOGIN. Não existe "um login por
   * papel no arquivo": `mode: "serial"` encadeia a ORDEM e o ESTADO DO BANCO, não
   * a sessão do navegador. As fixtures `context` e `page` são de escopo de TESTE
   * (medido na fonte do Playwright 1.62.1 instalado,
   * `playwright/lib/index.js:425` e `:443`: são funções simples, sem o
   * `{ scope: "worker" }` que fecha a definição de `browser:` — a que começa
   * na linha 216 e traz a opção na 238), então cada `test` recebe um
   * BrowserContext novo, com cookies zerados.
   *
   * Este comentário já afirmou o contrário, e o custo era invisível: os casos (4)
   * e (5) começavam deslogados, `page.goto` caía no redirect de `requireAuth()`, o
   * seletor do campo nunca aparecia — e como `playwright.config.ts` não define
   * `actionTimeout` (o default do Playwright é 0, `lib/index.js:259`), a espera ia
   * até estourar os 120s abaixo.
   *
   * O teto de login não é razão para economizar sessão aqui: o CI roda com
   * `AUTH_RATE_LIMIT_LOGIN_IP: "1000"` (`.github/workflows/e2e.yml`), e as specs
   * vizinhas — `system-update.spec.ts`, seis casos, seis logins — fazem assim.
   */
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
    //
    // 15s, e não o default de 5s: a prévia só nasce quando o RSC do
    // `router.refresh()` volta, e o `refresh` só é disparado DEPOIS do toast
    // (`CampoDeLogo.tsx:127-132`). Os 5s mediam a máquina de quem escreveu.
    await expect(page.locator("[data-previa-do-logo='claro'] img")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("[data-previa-do-logo='escuro'] img")).toBeVisible({
      timeout: 15_000,
    });
    await page.screenshot({ path: evidencia("1-admin-marca-previa.png"), fullPage: true });

    await page.goto("/app");
    const barra = await logoDaBarra(page);
    expect(barra, "nenhuma <img> na barra lateral depois do upload").not.toBeNull();
    expect(barra!.src).toContain(`${PREFIXO_PUBLICO}platform/`);
    baixou(barra!, "barra lateral do dono");
    await page.screenshot({ path: evidencia("2-sidebar-do-dono.png") });
  });

  test("(2) quem NÃO entrou vê o logo do dono na tela de acesso — a P0", async ({ browser }) => {
    const fachada = await logoDoLogin(browser);
    expect(fachada, "a tela de acesso não renderizou logo nenhum").not.toBeNull();
    expect(fachada!.src).toContain(`${PREFIXO_PUBLICO}platform/`);
    // A P0 é ver o logo, não ter o endereço dele escrito: é aqui que um bucket
    // privado apareceria, e é a única tela onde ninguém está logado para ver.
    baixou(fachada!, "tela de acesso");

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
    expect(barra, "nenhuma <img> na barra lateral depois do upload da empresa").not.toBeNull();
    expect(barra!.src).toContain(`${PREFIXO_PUBLICO}${creds.org_id}/`);
    baixou(barra!, "barra lateral da empresa");
    await page.screenshot({ path: evidencia("4-sidebar-da-empresa.png") });

    // A camada de cima NÃO alcança a fachada: quem não entrou continua vendo o
    // logo do revendedor. Sem esta asserção, o caso (1) e o (3) seriam
    // indistinguíveis de "o último upload repinta tudo".
    const noLogin = await logoDoLogin(browser);
    expect(noLogin, "a tela de acesso ficou sem logo depois do upload da empresa").not.toBeNull();
    expect(noLogin!.src).toContain(`${PREFIXO_PUBLICO}platform/`);
    expect(noLogin!.src).not.toContain(`${PREFIXO_PUBLICO}${creds.org_id}/`);
  });

  test("(4) SVG renomeado para .png é recusado pelos BYTES, com a razão dita", async ({ page }) => {
    await loginComTotp(page, creds.users.admin!.email, creds.admin_totp!.secret);

    await page.goto("/app");
    const antes = await logoDaBarra(page);
    // O estado de partida é o logo que o caso (3) subiu. A asserção é explícita
    // porque `antes!.src` lá embaixo, com `antes` nulo, reprova como
    // "Cannot read properties of null" — que não diz a ninguém o que faltou.
    expect(antes, "precondição: a barra precisa entrar neste caso COM logo da empresa").not.toBeNull();

    await page.goto("/app/settings/marca");
    await subir(page, "organizacao", {
      // Nome E `Content-Type` mentem — os dois campos que o atacante escolhe.
      nome: "logo.png",
      mime: "image/png",
      bytes: SVG_DISFARCADO,
    });
    // A recusa tem código próprio para a frase falar de SVG, e não "tipo de
    // mídia não suportado": é o formato em que um designer entrega logo.
    //
    // ⚠️ A âncora é DUPLA de propósito, e nenhuma metade é decorativa. O texto de
    // ajuda do campo (`CampoDeLogo.tsx:182-186`) diz, o tempo todo e antes de
    // qualquer upload, "SVG não é aceito: ele pode executar código…" — então
    // `getByText(/SVG não é aceito/i)` casava aquele `<p>` em t=0 e ficava verde
    // sem o toast jamais ter existido (e virava violação de strict mode quando o
    // toast aparecia no mesmo poll, com 2 elementos). O contêiner do toast
    // (`[data-sonner-toast]`) exclui o texto de ajuda; "aceito COMO LOGO" é a
    // frase que só a rota escreve (`app/api/v1/marca/logo/route.ts:396`).
    const recusa = page
      .locator("[data-sonner-toast]")
      .filter({ hasText: /SVG não é aceito como logo/i });
    await expect(recusa).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: evidencia("5-svg-recusado.png"), fullPage: true });

    await page.goto("/app");
    const depois = await logoDaBarra(page);
    expect(depois, "a recusa apagou o logo — a gravação não foi atômica").not.toBeNull();
    expect(depois!.src, "a recusa mudou o logo — a gravação não foi atômica").toBe(antes!.src);
  });

  test("(5) remover devolve o logo da camada de baixo", async ({ page }) => {
    await loginComTotp(page, creds.users.admin!.email, creds.admin_totp!.secret);

    await page.goto("/app/settings/marca");
    // O botão só existe quando ESTA camada tem logo próprio (`CampoDeLogo.tsx:176`):
    // a asserção nomeia a precondição em vez de deixá-la sair como um clique que
    // esperou até o timeout.
    const remover = page.locator("[data-campo-de-logo='organizacao']").getByRole("button", {
      name: /^remover$/i,
    });
    await expect(remover, "precondição: a empresa precisa entrar neste caso COM logo próprio").toBeVisible();
    await remover.click();
    await expect(page.getByText(/logo removido/i)).toBeVisible({ timeout: 15_000 });

    await page.goto("/app");
    const barra = await logoDaBarra(page);
    expect(barra, "a barra ficou sem logo — a camada de baixo não assumiu").not.toBeNull();
    expect(barra!.src).toContain(`${PREFIXO_PUBLICO}platform/`);
    baixou(barra!, "barra lateral depois de remover o logo da empresa");
    await page.screenshot({ path: evidencia("6-volta-ao-da-instalacao.png") });
  });

  test("(6) o dono remove o logo da instalação e a fachada volta ao que era", async ({
    page,
    browser,
  }) => {
    // Este caso é uma ASSERÇÃO (remover devolve a fachada ao estado anterior), não
    // a restauração — quem garante a restauração é o `afterAll` abaixo.
    await loginComTotp(page, creds.users.dono!.email, creds.dono_totp!.secret);
    await page.goto("/admin/marca");
    const remover = page.locator("[data-campo-de-logo='instalacao']").getByRole("button", {
      name: /^remover$/i,
    });
    await expect(
      remover,
      "precondição: a instalação precisa entrar neste caso COM logo próprio",
    ).toBeVisible();
    await remover.click();
    await expect(page.getByText(/logo removido/i)).toBeVisible({ timeout: 15_000 });

    const noLogin = await logoDoLogin(browser);
    // `null` (nenhuma imagem) ou uma URL que não é do bucket (o `APP_LOGO_URL`
    // do `.env`, se houver): o que NÃO pode sobrar é o arquivo desta spec.
    if (noLogin !== null) expect(noLogin.src).not.toContain(PREFIXO_PUBLICO);
  });

  /**
   * A RESTAURAÇÃO — e ela é um `afterAll`, ao contrário do que este arquivo
   * afirmou.
   *
   * A versão anterior justificava fazer a limpeza num caso dizendo que "`afterAll`
   * não roda quando a spec estoura no meio". É o contrário do que o Playwright
   * faz. MEDIDO com o Playwright 1.62.1 deste repo, num `describe` serial de três
   * casos (A passa, B lança, C depois) mais um `afterAll` que registra a ordem:
   *
   *   MEDIDO ordem=["A","B","afterAll"]
   *   1 failed · 1 did not run · 1 passed
   *
   * O `afterAll` RODOU; o caso seguinte ao estouro NÃO. Ou seja a justificativa
   * escolhia o mecanismo estritamente pior justamente para o modo de falha que ela
   * nomeava: se o caso (3) estourasse depois de subir o logo da empresa, uma
   * limpeza escrita como caso seria pulada com os demais, e a marca ficaria de pé
   * para as specs seguintes do mesmo banco (as duas partes do job `e2e` rodam
   * contra o MESMO banco, sem reset — ver `.github/workflows/e2e.yml`).
   *
   * Limpa as DUAS camadas, e não só a da instalação: um estouro no meio deixa para
   * trás o logo da EMPRESA com a mesma facilidade.
   *
   * Um login só, e do `dono`, porque ele é platform admin E `admin` da mesma
   * organização (`scripts/seed-e2e-credentials.ts:79-84`) — alcança `/admin/marca`
   * e `/app/settings/marca`.
   */
  test.afterAll(async ({ browser }) => {
    // O `test.setTimeout` do topo do `describe` vale para os CASOS; um hook nasce
    // com o timeout do config (30s). E aqui cabe um login com TOTP, que na
    // segunda tentativa espera a janela virar (até ~30s em `loginComTotp`) — sem
    // esta linha a restauração viraria vermelho por relógio, não por defeito.
    test.setTimeout(120_000);
    const contexto = await browser.newContext();
    try {
      const pagina = await contexto.newPage();
      await loginComTotp(pagina, creds.users.dono!.email, creds.dono_totp!.secret);
      await removerLogoSeHouver(pagina, "/app/settings/marca", "organizacao");
      await removerLogoSeHouver(pagina, "/admin/marca", "instalacao");
    } finally {
      await contexto.close();
    }
  });
});
