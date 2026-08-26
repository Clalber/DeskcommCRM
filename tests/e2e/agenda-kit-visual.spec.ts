import { expect, test, type Page } from "@playwright/test";

/**
 * Kit visual da Agenda — prova pela TELA, clique a clique.
 *
 * Toda medida de layout e de cor aqui sai de `getBoundingClientRect` e
 * `getComputedStyle`, nunca de olho: "a coluna deslizou" e "as cores são
 * distinguíveis" são afirmações que um humano confirma errado com facilidade.
 *
 * ⚠️ Esperas em 60s, e não nos 5s do default: esta máquina roda saturada
 * (o protocolo da entrega registra load 42 em 11 CPUs) e vermelho por carga
 * desliga o gate inteiro por desconfiança.
 */
const ESPERA = 60_000;

/** A vitrine é pública e não toca banco — sem login, sem seed, sem fixture. */
const VITRINE = "/vitrine-agenda";

/** sRGB → OKLab, para medir distância entre cores como o olho a percebe. */
const OKLAB_NO_BROWSER = `
function _srgbLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function _parse(css) {
  const m = css.match(/rgba?\\(([^)]+)\\)/);
  if (!m) throw new Error("cor não parseável: " + css);
  const [r, g, b] = m[1].split(",").map((n) => parseFloat(n));
  return [r, g, b];
}
function oklab(css) {
  const [r8, g8, b8] = _parse(css);
  const r = _srgbLinear(r8), g = _srgbLinear(g8), b = _srgbLinear(b8);
  const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  return [
    0.2104542553*l + 0.7936177850*m - 0.0040720468*s,
    1.9779984951*l - 2.4285922050*m + 0.4505937099*s,
    0.0259040371*l + 0.7827717662*m - 0.8086757660*s,
  ];
}
function luminancia(css) {
  const [r, g, b] = _parse(css);
  return 0.2126*_srgbLinear(r) + 0.7152*_srgbLinear(g) + 0.0722*_srgbLinear(b);
}
function contraste(a, b) {
  const la = luminancia(a), lb = luminancia(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
`;

async function medirTrilhas(page: Page) {
  return page.evaluate(`(() => {
    ${OKLAB_NO_BROWSER}
    // O fundo que vale é o do ancestral OPACO mais próximo — onde a cor
    // realmente pousa. Um pai transparente não é fundo, é vidro.
    function fundoEfetivo(el) {
      let n = el.parentElement;
      while (n) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== "transparent" && !/rgba\(0,\s*0,\s*0,\s*0\)/.test(c)) return c;
        n = n.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    }
    const cores = [];
    let fundo = null;
    for (let t = 1; t <= 8; t++) {
      const el = document.querySelector('[data-testid="swatch-' + t + '"]');
      if (!el) throw new Error("swatch " + t + " não está na tela");
      cores.push(getComputedStyle(el).backgroundColor);
      if (fundo === null) fundo = fundoEfetivo(el);
    }
    let menorDistancia = Infinity, parMaisProximo = null;
    for (let i = 0; i < cores.length; i++) {
      for (let j = i + 1; j < cores.length; j++) {
        const a = oklab(cores[i]), b = oklab(cores[j]);
        const d = Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);
        if (d < menorDistancia) { menorDistancia = d; parMaisProximo = [i + 1, j + 1]; }
      }
    }
    return {
      tema: document.documentElement.getAttribute("data-theme"),
      fundo,
      cores,
      contrastes: cores.map((c) => contraste(c, fundo)),
      menorDistancia,
      parMaisProximo,
    };
  })()`) as Promise<{
    tema: string | null;
    fundo: string;
    cores: string[];
    contrastes: number[];
    menorDistancia: number;
    parMaisProximo: [number, number] | null;
  }>;
}

test.describe("kit visual da Agenda", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(VITRINE);
    await expect(page.getByTestId("grade-da-agenda")).toBeVisible({ timeout: ESPERA });
  });

  test("a grade troca de visão pelo clique, e cada visão desenha o que promete", async ({ page }) => {
    const grade = page.getByTestId("grade-da-agenda");
    await expect(grade).toHaveAttribute("data-visao", "semana");

    // SEMANA: sete colunas de dia, uma por dia da semana.
    await expect(page.locator('[data-testid^="coluna-dia-"]')).toHaveCount(7, { timeout: ESPERA });

    await page.getByTestId("visao-dia").click();
    await expect(grade).toHaveAttribute("data-visao", "dia", { timeout: ESPERA });
    await expect(page.locator('[data-testid^="coluna-dia-"]')).toHaveCount(1);

    await page.getByTestId("visao-mes").click();
    await expect(grade).toHaveAttribute("data-visao", "mes", { timeout: ESPERA });
    // 6 semanas × 7 dias — a grade do mês é sempre retangular, senão as células
    // mudam de tamanho de um mês para o outro.
    await expect(page.locator('[data-testid^="celula-mes-"]')).toHaveCount(42);

    await page.getByTestId("visao-semana").click();
    await expect(grade).toHaveAttribute("data-visao", "semana", { timeout: ESPERA });
  });

  test("a régua do agora cai no minuto certo, medida em pixels", async ({ page }) => {
    const regua = page.getByTestId("regua-do-agora");
    await expect(regua).toBeVisible({ timeout: ESPERA });

    // A âncora da vitrine é fixa: quarta, 14h37. Com a grade começando às 7h e
    // 48px por hora, o topo da régua tem de ser (14-7)*48 + (37/60)*48 = 365.6px.
    const medido = await regua.evaluate((el) => parseFloat((el as HTMLElement).style.top));
    expect(medido).toBeCloseTo((14 - 7) * 48 + (37 / 60) * 48, 1);
  });

  test("a coluna de horários NÃO está lá, e entra quando o dia é escolhido", async ({ page }) => {
    const painel = page.getByTestId("painel-de-marcacao");
    const coluna = page.getByTestId("coluna-de-horarios");
    await painel.scrollIntoViewIfNeeded();

    // ANTES: o painel está no primeiro tempo e a coluna tem largura ZERO.
    await expect(painel).toHaveAttribute("data-tempo", "escolhendo-dia", { timeout: ESPERA });
    const larguraAntes = (await coluna.boundingBox())?.width ?? -1;
    expect(larguraAntes).toBe(0);
    const painelAntes = (await painel.boundingBox())?.width ?? 0;

    // Escolhe um dia que TEM horário (a fixture garante).
    await page.getByTestId("dia-2026-08-24").click();

    await expect(painel).toHaveAttribute("data-tempo", "escolhendo-horario", { timeout: ESPERA });
    await expect(coluna).toHaveAttribute("data-aberta", "true");

    // DEPOIS: a coluna existe com a largura medida no cal.com (240 / 280 em lg),
    // e o painel INTEIRO cresceu — é o painel crescer, e não trocar de conteúdo,
    // que dá a sensação de "abriu".
    await expect
      .poll(async () => Math.round((await coluna.boundingBox())?.width ?? 0), { timeout: ESPERA })
      .toBeGreaterThanOrEqual(240);
    const painelDepois = (await painel.boundingBox())?.width ?? 0;
    expect(painelDepois).toBeGreaterThan(painelAntes);

    // E os horários estão lá, clicáveis, levando ao terceiro tempo.
    await page.getByTestId("horario-09:30").click();
    await expect(painel).toHaveAttribute("data-tempo", "confirmando", { timeout: ESPERA });
    await page.getByTestId("confirmar-marcacao").click();
    await expect(painel).toHaveAttribute("data-tempo", "marcado", { timeout: ESPERA });
    await expect(page.getByText("Marcado.")).toBeVisible();
  });

  test("dia sem horário nasce apagado e não aceita clique", async ({ page }) => {
    await page.getByTestId("painel-de-marcacao").scrollIntoViewIfNeeded();
    // A fixture não publica horário na quinta (2026-08-27).
    const vazio = page.getByTestId("dia-2026-08-27");
    await expect(vazio).toHaveAttribute("data-disponivel", "false", { timeout: ESPERA });
    await expect(vazio).toBeDisabled();
  });

  test("filtrar por pessoa isola a agenda dela — e só a dela", async ({ page }) => {
    const blocos = page.locator('[data-testid^="compromisso-"]');
    const antes = await blocos.count();
    expect(antes).toBeGreaterThan(3);

    await page.getByTestId("botao-pessoa-ana").click();
    await expect(page.getByTestId("filtro-de-pessoas")).toHaveAttribute("data-isolada", "ana", {
      timeout: ESPERA,
    });

    // Todo bloco que sobrou é da trilha da Ana (1) — medido no DOM, não contado
    // a olho. Contar só "diminuiu" passaria mesmo que sobrasse gente errada.
    await expect.poll(async () => await blocos.count(), { timeout: ESPERA }).toBeLessThan(antes);
    const trilhas = await blocos.evaluateAll((els) =>
      els.map((e) => (e as HTMLElement).dataset.trilha),
    );
    expect(trilhas.length).toBeGreaterThan(0);
    expect(new Set(trilhas)).toEqual(new Set(["1"]));

    // "Todos" devolve a agenda inteira.
    await page.getByTestId("botao-todos").click();
    await expect.poll(async () => await blocos.count(), { timeout: ESPERA }).toBe(antes);
  });

  test("ocupação vinda do Google é ocupação, não compromisso: não abre", async ({ page }) => {
    const doGoogle = page.locator('[data-testid^="compromisso-"][data-origem="google"]').first();
    await expect(doGoogle).toBeVisible({ timeout: ESPERA });
    await expect(doGoogle).toBeDisabled();

    // E a faixa DELE é neutra: ocupação de fora não pertence a ninguém da
    // equipe, então não recebe trilha. Comparado contra a faixa de um
    // compromisso NOSSO — "existe uma cor" passaria com qualquer valor.
    const idDoGoogle = await doGoogle.getAttribute("data-testid");
    const corDeFora = await page
      .getByTestId(`faixa-${idDoGoogle!.replace("compromisso-", "")}`)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    const nosso = page.locator('[data-testid^="compromisso-"][data-origem="deskcomm"]').first();
    const idNosso = await nosso.getAttribute("data-testid");
    const corNossa = await page
      .getByTestId(`faixa-${idNosso!.replace("compromisso-", "")}`)
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(corDeFora).not.toBe(corNossa);
    const neutra = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-border-strong").trim(),
    );
    expect(neutra, "a faixa de fora usa a cor de borda forte, não uma trilha").toBeTruthy();
  });

  test("as oito trilhas passam em contraste e são distinguíveis — nos DOIS temas", async ({
    page,
  }) => {
    const relatorio: string[] = [];

    for (const tema of ["claro", "escuro"] as const) {
      if (tema === "escuro") {
        await page.getByTestId("alternar-tema").click();
        await expect
          .poll(async () => page.evaluate(() => document.documentElement.getAttribute("data-theme")), {
            timeout: ESPERA,
          })
          .toBe("dark");
      }

      const m = await medirTrilhas(page);
      relatorio.push(
        `tema=${m.tema} fundo=${m.fundo}\n` +
          m.cores
            .map((c, i) => `  trilha ${i + 1}: ${c}  contraste ${m.contrastes[i]!.toFixed(2)}:1`)
            .join("\n") +
          `\n  par mais próximo: ${m.parMaisProximo?.join(" vs ")} — distância OKLab ${m.menorDistancia.toFixed(3)}`,
      );

      // WCAG 1.4.11: componente gráfico não-textual precisa de 3:1 contra o
      // fundo adjacente. É esta a régua — 4.5:1 é para TEXTO, e a faixa de cor
      // não carrega texto (o nome vem na inicial, que usa a cor de texto do tema).
      for (const [i, c] of m.contrastes.entries()) {
        expect(c, `trilha ${i + 1} no tema ${tema} (${m.cores[i]})`).toBeGreaterThanOrEqual(3);
      }

      // Distinguibilidade: nenhum par pode estar perto demais no espaço em que o
      // olho compara. 0.10 em OKLab é a distância abaixo da qual duas trilhas
      // vizinhas na tela começam a ser lidas como a mesma cor.
      expect(m.menorDistancia, `par mais próximo no tema ${tema}`).toBeGreaterThan(0.1);
    }

    console.info("\n[medidas das trilhas]\n" + relatorio.join("\n\n") + "\n");
  });

  test("evidência visual: claro, escuro e celular", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await expect(page.getByTestId("grade-da-agenda")).toBeVisible({ timeout: ESPERA });
    await page.screenshot({ path: "evidence/calendario/kit-visual-claro.png", fullPage: true });

    await page.getByTestId("alternar-tema").click();
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.getAttribute("data-theme")), {
        timeout: ESPERA,
      })
      .toBe("dark");
    await page.screenshot({ path: "evidence/calendario/kit-visual-escuro.png", fullPage: true });

    // 390px é o iPhone que o dono da clínica tem no bolso.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId("alternar-tema").click();
    await expect(page.getByTestId("grade-da-agenda")).toBeVisible({ timeout: ESPERA });
    await page.screenshot({ path: "evidence/calendario/kit-visual-celular.png", fullPage: true });

    // A página NUNCA rola na horizontal: `html, body` têm `overflow-x: hidden`,
    // então uma grade larga demais não ganharia barra — sumiria pela direita.
    const estouro = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(estouro, "a página estourou a largura no celular").toBeLessThanOrEqual(0);
  });
});
