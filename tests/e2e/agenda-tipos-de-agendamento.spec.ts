import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect } from "@playwright/test";

/**
 * TIPOS DE AGENDAMENTO PELA TELA — o que se pode marcar, e por quem.
 *
 * ─── O buraco que esta spec fecha ────────────────────────────────────────
 *
 * `calendar_event_types` tem DEZ categorias no CHECK, duração, buffers,
 * antecedência mínima, janela de agendamento e local — e não havia como criar ou
 * editar um tipo por lugar nenhum: nem rota, nem tela. Toda organização recebia
 * três tipos semeados e ficava com eles para sempre.
 *
 * ─── E o laço com o P0 ───────────────────────────────────────────────────
 *
 * Os três tipos semeados nasciam SEM `default_owner_user_id`, e sem responsável
 * `lib/agenda/consulta.ts` devolve `sem_responsavel` — a tela de marcar não
 * oferece horário nenhum, sem dizer por quê. O último caso desta spec fecha o
 * laço: um tipo criado COM responsável aparece na tela de marcar.
 */

/**
 * ⚠️ SEM `APP_URL`: as navegações são RELATIVAS, e o `baseURL` do
 * `playwright.config.ts` resolve.
 *
 * Isto era `process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"`, e o
 * fallback é o defeito: **o CI não define `PLAYWRIGHT_BASE_URL`**. Local eu
 * exportava a variável, então passava; no runner a spec batia em `:3000`, onde
 * não há nada, e as seis caíam em bloco com `ERR_CONNECTION_REFUSED` — que se
 * parece com "o servidor morreu" e é "eu bati na porta errada".
 *
 * O log mostra o formato exato: `··········FFFFFF` — dez testes passam, os seis
 * meus caem juntos, e os seguintes voltam a passar. Servidor vivo o tempo todo.
 *
 * As irmãs já faziam certo de dois jeitos: `agenda-tela-do-produto` usa caminho
 * relativo, e `agente-marca-consulta` usa `E2E_PORT ?? 3001`. Nenhuma inventa
 * 3000.
 */
const RAIZ = path.resolve(__dirname, "../..");

// Duas jornadas completas por caso (login + navegação + formulário).
test.describe.configure({ timeout: 120_000 });

interface Creds {
  password: string;
  users: Record<string, { email: string } | undefined>;
  agenda?: { tipo_nome: string; tipo_slug: string };
}

function lerCreds(): Creds {
  const p = path.join(RAIZ, ".e2e-creds.json");
  if (!fs.existsSync(p)) throw new Error("`.e2e-creds.json` ausente — rode `scripts/seed-e2e-credentials.ts`");
  let c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  if (!c.agenda) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-agenda.ts"], { stdio: "inherit" });
    c = JSON.parse(fs.readFileSync(p, "utf8")) as Creds;
  }
  return c;
}

async function entrar(page: import("@playwright/test").Page, creds: Creds) {
  // `manager` porque criar e editar tipo exige `manager` na rota — e o `admin`
  // do seed tem MFA, que não é o assunto desta spec.
  const usuario = creds.users.manager;
  if (!usuario) throw new Error(".e2e-creds.json sem o usuário `manager`");
  await page.goto("/login");
  await page.getByLabel(/e-?mail/i).fill(usuario.email);
  await page.getByLabel(/senha/i).fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app(\/|$)/, { timeout: 20_000 });
}

test("chego nos tipos CLICANDO no menu, e a lista mostra o que existe", async ({ page }) => {
  const creds = lerCreds();
  await entrar(page, creds);

  // Pela porta, não pela URL: ter tela e ser alcançável são coisas diferentes, e
  // o CI reprova tela em que só se chega digitando o endereço.
  //
  // ⚠️ A porta é o HUB, não a barra lateral. O grupo "organizacao" tem
  // `hub: { href: "/app/settings", label: "Configurações" }`, e as onze telas
  // dele se alcançam por ali — nenhuma aparece direto na lateral. Minha primeira
  // versão procurou na lateral e reprovou dizendo "não tem porta na navegação":
  // tinha, era outra. O caminho do teste é o caminho de quem usa.
  await page.goto("/app/settings");
  const item = page.getByRole("link", { name: /Tipos de agendamento/ }).first();
  await expect(item, "a tela não aparece no hub de Configurações").toBeVisible({ timeout: 20_000 });
  await item.click();

  await expect(page).toHaveURL(/\/app\/settings\/tenant\/agenda/, { timeout: 20_000 });
  await expect(page.getByTestId("tipos-de-agendamento-config")).toBeVisible();
  await expect(
    page.getByTestId("lista-de-tipos").getByRole("listitem").first(),
    "a lista veio vazia — a organização de teste tem tipos semeados",
  ).toBeVisible({ timeout: 15_000 });
});

test("crio um tipo COM responsável, e ele passa a ser marcável na Agenda", async ({ page }) => {
  const creds = lerCreds();
  await entrar(page, creds);
  await page.goto("/app/settings/tenant/agenda");
  await expect(page.getByTestId("tipos-de-agendamento-config")).toBeVisible({ timeout: 20_000 });

  // Nome único por execução: a rota recusa slug repetido com 409, e uma spec que
  // só passa na primeira execução é pior que spec nenhuma.
  const nome = `Retorno E2E ${Date.now().toString().slice(-6)}`;

  await page.getByTestId("abrir-novo-tipo").click();
  await expect(page.getByTestId("form-novo-tipo")).toBeVisible();
  await page.getByTestId("novo-tipo-nome").fill(nome);
  await page.getByTestId("novo-tipo-categoria").selectOption("retorno");
  await page.getByTestId("novo-tipo-duracao").fill("15");

  // ⚠️ O RESPONSÁVEL É O PONTO DESTA SPEC. Sem ele o tipo nasce igual aos três
  // semeados: existe na lista e não produz horário nenhum.
  const dono = page.getByTestId("novo-tipo-dono");
  const opcoes = await dono.locator("option").count();
  expect(opcoes, "o seletor de responsável não listou ninguém — não há o que escolher").toBeGreaterThan(1);
  await dono.selectOption({ index: 1 });

  await page.getByTestId("salvar-novo-tipo").click();

  const linha = page.getByTestId("lista-de-tipos").getByRole("listitem").filter({ hasText: nome });
  await expect(linha, "criei o tipo e ele não apareceu na lista").toBeVisible({ timeout: 20_000 });
  await expect(linha).toContainText("15 min");
  await expect(
    linha.getByText("sem responsável"),
    "criei COM responsável e a lista diz que está sem",
  ).toHaveCount(0);

  // ── O laço: o tipo novo chega na tela de marcar ───────────────────────
  await page.goto("/app/agenda");
  await expect(page.getByTestId("tela-agenda")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await expect(page.getByTestId("tipos-de-agendamento")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: new RegExp(`^${nome}`) }),
    "o tipo foi criado em Configurações e não apareceu na tela de marcar — " +
      "configurar e usar ficaram em mundos separados",
  ).toBeVisible({ timeout: 15_000 });
});

test("desativar tira o tipo da tela de marcar, sem apagar a história", async ({ page }) => {
  const creds = lerCreds();
  await entrar(page, creds);
  await page.goto("/app/settings/tenant/agenda");
  await expect(page.getByTestId("tipos-de-agendamento-config")).toBeVisible({ timeout: 20_000 });

  const nome = `Temporario E2E ${Date.now().toString().slice(-6)}`;
  await page.getByTestId("abrir-novo-tipo").click();
  await page.getByTestId("novo-tipo-nome").fill(nome);
  await page.getByTestId("salvar-novo-tipo").click();

  const linha = page.getByTestId("lista-de-tipos").getByRole("listitem").filter({ hasText: nome });
  await expect(linha).toBeVisible({ timeout: 20_000 });

  await linha.getByRole("button", { name: "Desativar" }).click();

  // Continua NA LISTA, marcado como desativado — `calendar_appointments` aponta
  // para o tipo, e apagar levaria junto a história de que consulta foi feita.
  await expect(
    linha,
    "o tipo sumiu da lista ao desativar — desativar não é apagar",
  ).toBeVisible({ timeout: 20_000 });
  await expect(linha).toContainText("desativado");
  await expect(
    linha.getByRole("button", { name: "Reativar" }),
    "desativei e não há caminho de volta",
  ).toBeVisible();

  // E some de onde importa: da tela de marcar.
  await page.goto("/app/agenda");
  await page.getByRole("button", { name: /novo agendamento/i }).click();
  await expect(page.getByTestId("tipos-de-agendamento")).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("button", { name: new RegExp(`^${nome}`) }),
    "tipo desativado continua oferecido para marcar",
  ).toHaveCount(0);
});
