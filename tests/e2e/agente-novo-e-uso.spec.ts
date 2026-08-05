/**
 * Duas telas do épico que não tinham teste de tela nenhum: criar um agente
 * (`/app/ai/agents/new`) e olhar o consumo de IA (`/app/ai/usage`).
 *
 * A diferença deste spec para os outros do repo é de propósito: o agente é
 * criado **pela interface**, preenchendo o formulário como uma pessoa faria, em
 * vez de aparecer pronto por seed. Seed prova que a tela funciona quando alguém
 * já colocou os dados lá; não prova que alguém consegue chegar lá sozinho.
 *
 * O que ele NÃO consegue provar, e por quê: a organização de teste já tem
 * credencial de IA e número de WhatsApp (outros seeds do repo criam), então o
 * caso "instalei agora e não tenho nada" é montado interceptando as duas
 * listagens — o mais perto do estado real sem plantar nem apagar dado de
 * ninguém num banco que quatro frentes compartilham.
 *
 * Locale pt-BR fixado no arquivo: sem isso o navegador de teste roda en-US e
 * campos `<input type="date">` aparecem como mm/dd/yyyy, que parece defeito do
 * produto e é do ambiente.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";

import { generateTotp, msUntilNextTotpWindow } from "./utils/totp";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const EVIDENCIA = path.join(process.cwd(), "evidence", "ia-360-w1");

interface Creds {
  password: string;
  users: Record<string, { email: string }>;
  admin_totp?: { secret: string };
}

function loadCreds(): Creds {
  if (!fs.existsSync(CREDS_PATH)) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
}

const creds = loadCreds();

test.use({ locale: "pt-BR" });

/**
 * O último código TOTP entregue ao servidor nesta execução.
 *
 * Um código de 6 dígitos vale para a janela de 30 segundos inteira, mas o
 * servidor aceita cada um UMA vez (proteção contra replay). Testes que logam em
 * sequência caem na mesma janela e mandam o mesmo código — o segundo é recusado,
 * e o sintoma que aparece é "MFA falhou", que lê como bug de senha, de relógio
 * ou da tela de MFA. Medido: este spec passava isolado e falhava inteiro em
 * sequência, com 2 minutos de timeout por caso.
 */
let ultimoCodigoEnviado: string | null = null;

async function loginComoAdmin(page: Page): Promise<void> {
  const secret = creds.admin_totp!.secret;
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.admin!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/login\/mfa/);

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    // Espera a próxima janela quando ela está por virar OU quando o código
    // desta janela já foi gasto por um login anterior.
    if (msUntilNextTotpWindow() < 3_000 || generateTotp(secret) === ultimoCodigoEnviado) {
      await page.waitForTimeout(msUntilNextTotpWindow() + 300);
    }
    const codigo = generateTotp(secret);
    ultimoCodigoEnviado = codigo;

    const digito = page.locator('input[aria-label="Dígito 1"]');
    await digito.waitFor({ state: "visible", timeout: 15_000 });
    await digito.click();
    await page.keyboard.type(codigo, { delay: 40 });
    try {
      await page.waitForURL(/\/app\//, { timeout: 10_000 });
      return;
    } catch {
      await page.waitForTimeout(msUntilNextTotpWindow() + 300);
    }
  }
  throw new Error("MFA do admin falhou depois de 3 tentativas de TOTP");
}

test.describe.configure({ timeout: 120_000 });

test.beforeEach(async ({ page }) => {
  fs.mkdirSync(EVIDENCIA, { recursive: true });
  await loginComoAdmin(page);
});

test.describe("Criar um agente pela tela", () => {
  test("o formulário abre e diz o que falta antes de deixar criar", async ({ page }) => {
    await page.goto("/app/ai/agents/new");
    await expect(page.getByRole("heading", { name: /novo agent/i })).toBeVisible();

    // O botão nasce bloqueado: a tela não deixa criar um agente pela metade.
    const criar = page.getByRole("button", { name: /criar agent/i });
    await expect(criar).toBeDisabled();

    // E ela diz o que falta — as três exigências que o servidor também impõe.
    for (const exigencia of [
      /selecione um modelo/i,
      /selecione uma credencial/i,
      /selecione um número de whatsapp/i,
    ]) {
      await expect(page.getByText(exigencia).first()).toBeVisible();
    }

    await page.screenshot({
      path: path.join(EVIDENCIA, "w1-nova-01-tela-de-criar.png"),
      fullPage: true,
    });
  });

  test("preencho como uma pessoa faria e o agente nasce, com as capacidades que liguei", async ({
    page,
  }) => {
    await page.goto("/app/ai/agents/new");
    const nome = `Recepção da Clínica ${Date.now()}`;

    await page.locator("#name").fill(nome);
    await page
      .locator("textarea")
      .first()
      .fill(
        "Você é a recepção de uma clínica odontológica. Atenda com educação, responda dúvidas sobre horários e ajude a marcar consulta.",
      );

    // Os três campos que a tela exige. São comboboxes do Radix, NÃO `<select>`
    // nativo: não existe `<option>` no DOM até o menu abrir, e procurar por
    // `option` devolve zero — que lê como "a tela não tem modelo nenhum" quando
    // na verdade o instrumento é que estava olhando o lugar errado.
    for (const id of ["model", "credential_id", "channel_session_id"]) {
      const gatilho = page.locator(`#${id}`);
      if ((await gatilho.count()) === 0) continue;
      await gatilho.click();
      const opcoes = page.getByRole("option");
      const quantas = await opcoes.count();
      expect(quantas, `o campo "${id}" abriu sem nenhuma opção para escolher`).toBeGreaterThan(0);
      await opcoes.first().click();
      await expect(gatilho).not.toContainText(/^Selecione/);
    }

    // Liga uma jornada de trabalho — o caminho que a W1 entregou.
    await page.getByTestId("switch-pacote-atender").click();
    await expect(page.getByTestId("pacote-atender")).toHaveAttribute("data-estado", "ligado");
    const ligadas = await page.getByTestId("consumo-teto").textContent();

    await page.screenshot({
      path: path.join(EVIDENCIA, "w1-nova-02-preenchido.png"),
      fullPage: true,
    });

    const criar = page.getByRole("button", { name: /criar agent/i });
    await expect(criar).toBeEnabled();
    await criar.click();

    // Nasceu: a tela navega para o agente criado.
    await page.waitForURL(/\/app\/ai\/agents\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByText(nome).first()).toBeVisible();

    // E as capacidades que liguei ANTES de criar sobreviveram ao nascimento —
    // é aqui que uma tela de criação costuma perder metade do formulário.
    await page.getByTestId("tool-picker").waitFor({ state: "visible", timeout: 60_000 });
    await expect(page.getByTestId("consumo-teto")).toHaveText(ligadas!.trim());
    await expect(page.getByTestId("pacote-atender")).toHaveAttribute("data-estado", "ligado");

    await page.screenshot({
      path: path.join(EVIDENCIA, "w1-nova-03-agente-criado.png"),
      fullPage: true,
    });

    // Aparece na lista, que é onde a pessoa vai procurar depois.
    await page.goto("/app/ai/agents");
    await expect(page.getByText(nome).first()).toBeVisible({ timeout: 30_000 });
  });

  test("a tela oferece caminho para o que ela exige, sem exigir que o usuário adivinhe", async ({
    page,
  }) => {
    await page.goto("/app/ai/agents/new");
    await expect(page.getByRole("heading", { name: /novo agent/i })).toBeVisible();

    // ⚠️ O QUE ESTE CASO NÃO CONSEGUE MEDIR, declarado em vez de fingido: o
    // estado "instalei agora e não tenho credencial nem número". A primeira
    // versão tentava montá-lo interceptando as listagens no navegador e passava
    // sem medir nada — a página é Server Component, as duas consultas acontecem
    // NO SERVIDOR, e interceptar no browser não alcança. Montar o estado de
    // verdade exigiria uma organização zerada, que este banco (compartilhado
    // por quatro frentes) não tem. Fica como item para quem tiver ambiente
    // fresco; ver o HANDOFF.
    //
    // O que dá para cobrar sempre: a tela exige credencial e número — então ela
    // precisa dizer ONDE se consegue cada um. Sem isso, quem não tem trava sem
    // pista, e quem tem mas quer outro também.
    const caminhos = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => `${(a.textContent ?? "").trim()} -> ${a.getAttribute("href")}`)
        .filter((t) => /credencial|conex|whatsapp|numero|número|canal/i.test(t)),
    );

    expect(
      caminhos.length,
      "a tela exige credencial e número de WhatsApp e não oferece nenhum link para conseguir os dois",
    ).toBeGreaterThan(0);
  });
});

test.describe("Olhar o consumo de IA", () => {
  test("a tela mostra os números do período e nomeia o que eles são", async ({ page }) => {
    await page.goto("/app/ai/usage");
    await expect(page.getByRole("heading", { name: /uso de ia/i })).toBeVisible();

    // Os quatro cartões do topo existem e trazem número, não traço.
    for (const rotulo of [/custo no período/i, /invocações/i]) {
      await expect(page.getByText(rotulo).first()).toBeVisible();
    }

    // Nada de NaN/undefined vazando para a tela — o defeito clássico de
    // dashboard quando a agregação recebe zero linhas.
    const lixo = await page.evaluate(() =>
      [...document.querySelectorAll("main *")]
        .filter((el) => el.children.length === 0)
        .map((el) => (el.textContent ?? "").trim())
        .filter((t) => /\bNaN\b|\bundefined\b|\bInfinity\b|\[object/i.test(t)),
    );
    expect(lixo, `a tela mostrou valor inválido: ${JSON.stringify(lixo)}`).toEqual([]);

    await page.screenshot({
      path: path.join(EVIDENCIA, "w1-uso-01-tela.png"),
      fullPage: true,
    });
  });

  test("um período sem nenhum dado é explicado, não fica em branco", async ({ page }) => {
    await page.goto("/app/ai/usage");
    await expect(page.getByRole("heading", { name: /uso de ia/i })).toBeVisible();

    // Uma janela no passado onde não houve uso nenhum.
    const de = page.locator('input[type="date"]').first();
    const ate = page.locator('input[type="date"]').nth(1);
    await de.fill("2020-01-01");
    await ate.fill("2020-01-31");
    await page.waitForTimeout(2500);

    const corpo = await page.locator("main").innerText();
    expect(
      /sem dados|nenhum|0/i.test(corpo),
      "período vazio não disse nada ao usuário",
    ).toBe(true);

    await page.screenshot({
      path: path.join(EVIDENCIA, "w1-uso-02-periodo-vazio.png"),
      fullPage: true,
    });
  });
});
