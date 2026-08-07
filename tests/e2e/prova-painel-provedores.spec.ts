import { test, expect } from "@playwright/test";

const EMAIL = "gerente@deskcomm.local";
const SENHA = "GerenteProva!2026";

test("o painel de provedores abre, agrupa e explica", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/app/, { timeout: 30000 });

  await page.goto("/app/ai/providers");
  await page.waitForSelector('[data-testid="painel-de-provedores"]', { timeout: 30000 });

  await expect(page.getByRole("heading", { name: "Provedores de IA" })).toBeVisible();

  // Os seis papéis estão na tela (o agrupamento que o Rafael pediu).
  for (const papel of ["atender", "entender", "proteger", "lembrar", "perceber", "melhorar"]) {
    await expect(page.locator(`[data-testid="papel-${papel}"]`)).toBeVisible();
  }
  await page.screenshot({ path: "/tmp/evidencia-01-painel.png", fullPage: true });

  // "Configuração avançada" revela os pontos um a um.
  await page.click('[data-testid="avancado-entender"]');
  await expect(page.locator('[data-testid="ponto-stage_classifier"]')).toBeVisible();
  await expect(page.locator('[data-testid="origem-stage_classifier"]')).toBeVisible();
  await page.screenshot({ path: "/tmp/evidencia-02-avancado.png", fullPage: true });

  // O sintoma de falha aparece — a razão de a tela existir.
  const cartao = page.locator('[data-testid="ponto-stage_classifier"]');
  await expect(cartao).toContainText("Se falhar:");

  // Ponto FIXO mostra a razão escrita, não um cadeado mudo.
  await page.click('[data-testid="avancado-lembrar"]');
  await expect(page.locator('[data-testid="razao-fixo-embedding_indexar"]')).toContainText(
    "mesmo modelo",
  );
  await page.screenshot({ path: "/tmp/evidencia-03-ponto-fixo.png", fullPage: true });
});
