/**
 * Prova pela TELA da Fase 5: conectar o canal oficial pelo frontend.
 *
 * O que precisa ser provado, e não só "a página abre":
 *   1. o admin chega pelo hub de configurações, clicando;
 *   2. credencial ERRADA é recusada **com o motivo da Meta** e nada é gravado —
 *      este é o caso que distingue "validar" de "aceitar e torcer";
 *   3. credencial certa conecta, e a tela mostra o que colar no painel da Meta.
 *
 * O caso 2 usa a Graph API REAL. Não há mock: o valor da tela é justamente falar
 * com a Meta antes de gravar, e mockar isso testaria o mock.
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { generateTotp, msUntilNextTotpWindow } from "../e2e/utils/totp";

interface Creds {
  password: string;
  users: Record<string, { email: string } | undefined>;
  admin_totp?: { secret: string };
}
const creds = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), ".e2e-creds.json"), "utf8"),
) as Creds;

const EVIDENCE = path.join(
  process.cwd(),
  process.env.CANAIS_EVIDENCE_DIR ?? "evidence/canais/fase5",
);
fs.mkdirSync(EVIDENCE, { recursive: true });

/** Credenciais reais da WABA de teste, do ambiente — nunca hardcoded no spec. */
const REAL = {
  phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? "",
  wabaId: process.env.META_WABA_ID ?? "",
  token: process.env.META_SYSTEM_USER_TOKEN ?? "",
};

async function loginAdmin(page: Page): Promise<void> {
  const secret = creds.admin_totp?.secret;
  if (!secret) throw new Error(".e2e-creds.json sem admin_totp");
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.admin!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/login\/mfa/, { timeout: 30_000 });

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (msUntilNextTotpWindow() < 3_000) await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    await page.locator('input[aria-label="Dígito 1"]').click();
    await page.keyboard.type(generateTotp(secret), { delay: 40 });
    try {
      await page.waitForURL(/\/(app|onboarding)\//, { timeout: 10_000 });
      return;
    } catch {
      await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    }
  }
  throw new Error("MFA falhou após 3 tentativas");
}

test.describe.configure({ mode: "serial" });

test("o admin chega ao canal oficial pelo hub de configurações", async ({ page }) => {
  await loginAdmin(page);
  await page.goto("/app/settings");

  const card = page.getByRole("link", { name: /Canal oficial/i });
  await expect(card).toBeVisible();
  await card.click();

  await page.waitForURL(/\/app\/settings\/canal-oficial/, { timeout: 20_000 });
  await expect(page.getByTestId("canal-oficial-root")).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${EVIDENCE}/01-tela-conexao.png`, fullPage: true });
});

test("credencial errada é RECUSADA com o motivo da Meta, e nada é gravado", async ({ page }) => {
  // É o caso que separa "validar" de "aceitar e torcer". Sem ele, o operador acharia
  // que conectou e só entenderia que não na primeira mensagem que não sai.
  await loginAdmin(page);
  await page.goto("/app/settings/canal-oficial");
  await expect(page.getByTestId("canal-oficial-root")).toBeVisible({ timeout: 20_000 });

  await page.locator("#pnid").fill("000000000000000");
  await page.locator("#waba").fill("000000000000000");
  await page.locator("#tok").fill("EAAtoken-invalido-de-proposito-para-o-teste");

  const resposta = page.waitForResponse(
    (r) => r.url().includes("/api/v1/channels/official") && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await page.getByTestId("btn-conectar").click();
  const res = await resposta;

  // 422, não 500: credencial ruim é entrada inválida, não falha nossa.
  expect(res.status()).toBe(422);
  await expect(page.getByTestId("canal-conectado")).toHaveCount(0);
  await page.screenshot({ path: `${EVIDENCE}/02-credencial-recusada.png`, fullPage: true });
});

test("credencial real conecta e a tela mostra o que colar na Meta", async ({ page }) => {
  test.skip(!REAL.token, "sem META_SYSTEM_USER_TOKEN no ambiente");

  await loginAdmin(page);
  await page.goto("/app/settings/canal-oficial");
  await expect(page.getByTestId("canal-oficial-root")).toBeVisible({ timeout: 20_000 });

  await page.locator("#pnid").fill(REAL.phoneNumberId);
  await page.locator("#waba").fill(REAL.wabaId);
  await page.locator("#tok").fill(REAL.token);

  const resposta = page.waitForResponse(
    (r) => r.url().includes("/api/v1/channels/official") && r.request().method() === "POST",
    { timeout: 60_000 },
  );
  await page.getByTestId("btn-conectar").click();
  expect((await resposta).status()).toBe(200);

  // O nome vem da Meta, não do que digitamos — é a prova de que a validação
  // realmente falou com a plataforma.
  await expect(page.getByTestId("canal-conectado")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("canal-conectado")).toContainText(/Test Number/i);
  await expect(page.getByTestId("canal-conectado")).toContainText("credencial guardada");

  // Sem o webhook colado no painel da Meta o canal envia e não recebe — a tela
  // precisa entregar a URL pronta, não descrever onde achá-la.
  await expect(page.getByText(/URL de callback/i)).toBeVisible();
  await expect(page.getByText(/api\/v1\/webhooks\/meta\//)).toBeVisible();

  await page.screenshot({ path: `${EVIDENCE}/03-conectado.png`, fullPage: true });
});
