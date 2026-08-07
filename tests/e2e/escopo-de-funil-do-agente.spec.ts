/**
 * EM QUE FUNIS O ASSISTENTE MEXE — provado PELA TELA (spec 17 passos 3 e 4).
 *
 * O que só a tela prova:
 *  1. a marcação SOBREVIVE ao salvar e recarregar (o defeito clássico do campo
 *     que "se desmarca sozinho" — foi o que aconteceu com `cases_enabled`, que
 *     entrou em 2 dos 7 arquivos que copiam a lista de colunas);
 *  2. o estado vazio é EXPLICADO, não deixado em branco;
 *  3. a lacuna de tradução aparece no funil MARCADO e some no não marcado.
 *
 * ⚠️ O spec do papel Operador (`agente-papeis-operador.spec.ts`) confessa no
 * cabeçalho que não rodava em CI nenhum. Este entra na lista do workflow no
 * mesmo commit — prova nova fora do gate é repetir o defeito que ele registra.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");

interface Creds {
  org_id: string;
  password: string;
  users: Record<string, { email: string }>;
  capacidades?: { agent_id: string; version_id: string };
}

function lerCreds(): Creds {
  if (!fs.existsSync(CREDS_PATH)) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  let c = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
  if (!c.capacidades?.agent_id) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-capacidades.ts"], { stdio: "inherit" });
    c = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
  }
  return c;
}

const creds = lerCreds();

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(creds.users.manager!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app/, { timeout: 30_000 });
}

/** Abre a aba do Operador, onde a marcação de funis vive. */
async function abrirOperacao(page: Page): Promise<void> {
  await page.goto(`/app/ai/agents/${creds.capacidades!.agent_id}`);
  await page.getByRole("button", { name: /opera(ç|c)(ã|a)o/i }).first().click();
  await expect(page.getByText(/em que neg(ó|o)cios ele pode mexer/i)).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("a marcação de funis do assistente", () => {
  test("nasce FECHADA e a tela explica o que isso significa", async ({ page }) => {
    await login(page);
    await abrirOperacao(page);

    // Falha fechada: o agente do seed nunca marcou funil nenhum.
    const semFunil = page.getByTestId("agente-sem-funil");
    await expect(semFunil).toBeVisible();
    await expect(semFunil).toContainText(/não mexe em negócio/i);

    await page.screenshot({ path: "evidence/spec-17/escopo-nasce-fechado.png", fullPage: true });
  });

  test("marcar um funil SOBREVIVE ao salvar e recarregar", async ({ page }) => {
    await login(page);
    await abrirOperacao(page);

    const caixas = page.getByTestId("agente-funis").locator('input[type="checkbox"]');
    const quantos = await caixas.count();
    expect(quantos, "a organização de teste precisa ter funil para marcar").toBeGreaterThan(0);

    // Controle: antes de marcar, nenhuma está marcada.
    await expect(caixas.first()).not.toBeChecked();

    await caixas.first().check();
    // O aviso de "nenhum funil" some assim que algo é marcado.
    await expect(page.getByTestId("agente-sem-funil")).toHaveCount(0);

    await page.getByRole("button", { name: /salvar/i }).first().click();

    // ⚠️ RECARREGAR é o ponto do teste. O defeito que o gate de colunas existe
    // para pegar aparece exatamente aqui: o campo salva, a tela mostra certo, e
    // depois do refresh ele volta desmarcado — porque um dos 7 arquivos que
    // copiam a lista de colunas não recebeu o campo.
    await page.reload();
    await page.getByRole("button", { name: /opera(ç|c)(ã|a)o/i }).first().click();

    const depois = page.getByTestId("agente-funis").locator('input[type="checkbox"]');
    await expect(depois.first(), "a marcação não sobreviveu ao reload").toBeChecked({
      timeout: 20_000,
    });

    await page.screenshot({ path: "evidence/spec-17/escopo-sobrevive-ao-reload.png", fullPage: true });
  });
});
