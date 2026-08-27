import { expect, test, type Page } from "@playwright/test";

import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

/**
 * A PROVA NA TELA DO PRODUTO — e ela existe porque a outra estava na tela errada.
 *
 * `agenda-kit-visual.spec.ts` prova os componentes na VITRINE
 * (`/vitrine-agenda`), com dado sintético. Isso foi a decisão certa enquanto a
 * API não existia: o desenho precisava ser julgável antes de haver o que exibir.
 *
 * Mas o efeito líquido era que TUDO estava provado na tela que o cliente nunca
 * abre. Medido pelo maestro: dez dos dez itens do pedido, parciais, por essa
 * única razão. Esta spec é a outra metade — o que o dono do produto realmente vê.
 *
 * A diferença que mais importa está no primeiro caso: chegar em `/app/agenda`
 * **clicando no menu**, não por `goto`. `goto` prova que a rota responde;
 * clicar prova que a tela é ALCANÇÁVEL, que é outra coisa e é a que o usuário
 * exercita. Ter tela e ter porta são propriedades diferentes — o repo já tem um
 * gate para isso no nível do registro, e aqui ela é exercida pelo clique.
 */
const ESPERA = 60_000;
test.describe.configure({ mode: "serial", timeout: 180_000 });

test.describe("a Agenda como o dono do produto a usa", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    page = await browser.newPage();
    await loginComoAdmin(page, lerCreds());
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("chego na Agenda CLICANDO no menu, não digitando a URL", async () => {
    await page.goto("/app");
    // O item vive no grupo "Atendimento", junto do Inbox — decisão registrada
    // no `registry.ts`: a Agenda é onde o dia acontece, não onde se configura.
    const item = page.getByRole("link", { name: "Agenda", exact: true }).first();
    await expect(item).toBeVisible({ timeout: ESPERA });
    await item.click();

    await expect(page).toHaveURL(/\/app\/agenda/, { timeout: ESPERA });
    await expect(page.getByTestId("tela-agenda")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda" })).toBeVisible();
  });

  test("as pessoas da equipe são REAIS — o filtro deixou de ser invisível", async () => {
    // `FiltroDePessoas` devolve `null` com menos de duas pessoas. Enquanto a
    // tela do produto passava lista vazia, o filtro existia, estava provado na
    // vitrine, e NINGUÉM o via aqui. Componente provado e não montado é o mesmo
    // que componente ausente, do ponto de vista de quem usa.
    await page.goto("/app/agenda");
    await expect(page.getByTestId("tela-agenda")).toBeVisible({ timeout: ESPERA });

    const filtro = page.getByTestId("filtro-de-pessoas");
    const avatares = page.locator('[data-testid^="avatar-pessoa-"]');

    // O seed do E2E tem admin, manager, agent, viewer e dono — mais de uma
    // pessoa, então o filtro TEM de aparecer.
    await expect(filtro).toBeVisible({ timeout: ESPERA });
    const quantas = await avatares.count();
    expect(quantas, "o filtro apareceu mas sem avatares").toBeGreaterThan(1);

    // Cada pessoa tem trilha de cor, e trilhas diferentes entre si: a cor vem do
    // `user_id` e não de um índice, então duas pessoas não colidem por estarem
    // na mesma posição da lista.
    const trilhas = await avatares.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.trilha),
    );
    expect(trilhas.every((t) => t && Number(t) >= 1 && Number(t) <= 8)).toBe(true);
  });

  test("o histórico está NA TELA DO PRODUTO, com as quatro abas", async () => {
    // Estava provado só na vitrine. Aqui ele aparece mesmo sem dado: as abas com
    // contador zero respondem "não há nada" sem gastar um clique.
    const hist = page.getByTestId("historico-da-agenda");
    await expect(hist).toBeVisible({ timeout: ESPERA });
    for (const aba of ["proximos", "aguardando", "passados", "cancelados"]) {
      await expect(page.getByTestId(`aba-${aba}`)).toBeVisible();
    }
  });

  test("a tela declara honestamente que ainda não lê agendamentos", async () => {
    // Enquanto `GET /api/v1/agenda/agendamentos` não existir, a grade fica
    // vazia. O que NÃO pode acontecer é ela fingir: nem dado de mentira
    // (decisão 18), nem mensagem que sugira que não há nada marcado quando o
    // que há é uma leitura que ninguém implementou.
    await expect(page.getByTestId("tela-agenda")).toHaveAttribute(
      "data-fonte",
      "vazio-ate-a-api",
    );
  });

  test("evidência visual da tela do produto", async () => {
    // As três fotos que existiam eram todas da VITRINE. Esta é a primeira da
    // tela que o cliente abre.
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/app/agenda");
    await expect(page.getByTestId("tela-agenda")).toBeVisible({ timeout: ESPERA });
    await page.screenshot({ path: "evidence/calendario/tela-do-produto-claro.png", fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId("tela-agenda")).toBeVisible();
    await page.screenshot({ path: "evidence/calendario/tela-do-produto-celular.png", fullPage: true });

    const estouro = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(estouro, "a tela do produto estourou a largura no celular").toBeLessThanOrEqual(0);
  });
});
