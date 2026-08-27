/**
 * ESPANHOL DE VERDADE NA TELA — e o português intacto na volta.
 *
 * ─── Por que existe, se já há um guarda estático ───────────────────────────
 *
 * `tests/unit/i18n-espanhol-cobre-a-tela` prova coisas sobre o CÓDIGO: que todo
 * texto passa por `t()`, e que toda chave tem espanhol. Nada disso prova que a
 * tela RENDERIZADA muda — e essa distância já engoliu uma feature inteira neste
 * repo: o seletor de idioma existia, gravava no banco, e ninguém lia o campo.
 * O código estava "certo" em todas as pontas e a interface não mudava uma letra.
 *
 * Aqui a pergunta é outra: **quem escolhe espanhol vê espanhol?** E a de trás,
 * que importa igual: **quem fica em português continua vendo exatamente o que
 * via?**
 *
 * ─── Como o vazamento é detectado, sem lista escrita à mão ─────────────────
 *
 * A tentação é comparar o texto da tela com um dicionário de palavras
 * portuguesas. Não serve: os DADOS são em português (nome de contato, rótulo de
 * funil, título de conversa vindos do seed) e continuariam em português em
 * qualquer idioma — traduzi-los seria o erro, não o acerto.
 *
 * A régua aqui é derivada do próprio dicionário: se um texto renderizado na
 * tela em espanhol é EXATAMENTE uma chave que o dicionário sabe traduzir, então
 * aquele texto não passou por `t()` — nenhum dado de banco coincide com uma
 * chave de interface por acaso, e a chave que coincidisse estaria traduzida.
 * Zero lista para manter: chave nova entra na régua no dia em que é escrita.
 *
 * ─── O que este arquivo NÃO prova ──────────────────────────────────────────
 *
 * Que a DATA sai em espanhol. Ela não sai: `locale: ptBR` é passado à mão em 38
 * arquivos com date-fns e em 24 chamadas de `Intl`, e trocar isso é um passe
 * próprio (a dívida está declarada no cabeçalho do guarda estático). Uma tela
 * com todo o texto em espanhol e "quinta-feira, 3 de março" no meio continua
 * passando aqui — de propósito, porque o contrário seria este arquivo mentir
 * sobre a própria cobertura.
 */
import { mkdirSync } from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";

import { DICIONARIO } from "../../lib/i18n/dicionario";
import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const creds = lerCreds();
const EVIDENCIA = path.join(process.cwd(), "evidence", "i18n-es");
mkdirSync(EVIDENCIA, { recursive: true });

const PRAZO = 60_000;

/**
 * As telas do dia a dia, e uma de configuração.
 *
 * Poucas e escolhidas: o valor deste arquivo está em provar o MECANISMO
 * (escolheu → mudou → voltou intacto), não em varrer o produto inteiro — quem
 * varre tudo é o guarda estático, que alcança arquivo que ainda não existe e
 * roda em segundos.
 */
const TELAS = ["/app/inbox", "/app/kanban", "/app/contacts", "/app/metrics", "/app/settings"];

/**
 * Chaves que o dicionário traduz de verdade — o espanhol DIFERE do português.
 *
 * As que não diferem ("CRM", "Inbox", "Webhooks", "Radar") são inúteis como
 * régua: aparecer igual nos dois idiomas é o comportamento correto delas, e
 * incluí-las produziria acusação em cima do que está certo.
 */
const CHAVES_QUE_MUDAM = new Set(
  Object.entries(DICIONARIO)
    .filter(([chave, t]) => t.es && t.es !== chave)
    .map(([chave]) => chave),
);

/** Todo texto que a pessoa consegue LER nesta tela, normalizado. */
async function textosVisiveis(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const saida: string[] = [];
    const anda = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let no = anda.nextNode(); no; no = anda.nextNode()) {
      const texto = (no.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!texto) continue;
      const pai = no.parentElement;
      if (!pai) continue;
      // `sr-only` conta: é texto que o leitor de tela fala, e traduzir a
      // interface e deixar o leitor de tela em português seria acessibilidade
      // de mentira. O que não conta é o que está escondido de TODO mundo.
      const estilo = getComputedStyle(pai);
      if (estilo.display === "none" || estilo.visibility === "hidden") continue;
      if (pai.closest("script,style,noscript")) continue;
      saida.push(texto);
    }
    return saida;
  });
}

async function trocarIdiomaPeloTopo(page: Page, codigo: "pt-BR" | "es"): Promise<void> {
  await page.getByTestId("seletor-de-idioma").click();
  await page.getByTestId(`idioma-${codigo}`).click();
  // A troca pinta a tela antes do servidor responder; esperar a rede assentar
  // evita medir o instante entre o clique e a gravação.
  await page.waitForLoadState("networkidle", { timeout: PRAZO });
}

test.describe("o idioma escolhido chega à tela", () => {
  test.setTimeout(180_000);

  test("espanhol cobre a interface, e o português volta byte a byte", async ({ page }) => {
    await loginComoAdmin(page, creds);

    // ── 1. O retrato em português, ANTES de qualquer troca ──────────────────
    const antes = new Map<string, string[]>();
    for (const tela of TELAS) {
      await page.goto(tela);
      await page.waitForLoadState("networkidle", { timeout: PRAZO });
      antes.set(tela, await textosVisiveis(page));
    }

    // ── 2. Troca pelo topo — é o seletor que se está provando, não a API ────
    await page.goto(TELAS[0]!);
    await page.waitForLoadState("networkidle", { timeout: PRAZO });
    await trocarIdiomaPeloTopo(page, "es");
    await page.screenshot({ path: path.join(EVIDENCIA, "01-inbox-em-espanhol.png"), fullPage: true });

    // ── 3. A tela MUDOU. Sem isto, um seletor quebrado passaria em tudo ─────
    //
    // O caso que este produto já viveu: o controle existia, gravava, e a tela
    // não mudava. Um teste que só procura vazamento daria verde ali — não há
    // vazamento nenhum numa tela que continua 100% em português, porque todo o
    // texto dela é "dado" para quem não sabe o que esperar.
    const inboxEmEspanhol = await textosVisiveis(page);
    const inboxEmPortugues = antes.get(TELAS[0]!)!;
    expect(
      inboxEmEspanhol.join("\n"),
      "o seletor do topo não mudou nada na tela — o idioma escolhido não chegou",
    ).not.toBe(inboxEmPortugues.join("\n"));

    // ── 4. Vazamento: texto que o dicionário sabe traduzir, mostrado em pt ──
    const vazando: string[] = [];
    for (const tela of TELAS) {
      await page.goto(tela);
      await page.waitForLoadState("networkidle", { timeout: PRAZO });
      for (const texto of await textosVisiveis(page)) {
        if (CHAVES_QUE_MUDAM.has(texto)) vazando.push(`${tela} → ${JSON.stringify(texto)}`);
      }
    }
    expect(
      vazando,
      `${vazando.length} texto(s) apareceram em PORTUGUÊS com a interface em espanhol. ` +
        "Cada um é uma chave que o dicionário sabe traduzir e que não passou por t() " +
        "no ponto em que a tela o renderiza.",
    ).toEqual([]);

    // ── 5. E a volta: o português tem de ser IDÊNTICO ao do começo ──────────
    //
    // Esta é a metade que ninguém lembra de testar, e é a que protege quem
    // NUNCA pediu espanhol. Envolver um texto em `t()` com a chave levemente
    // diferente da original (três pontos ASCII virando reticência unicode, por
    // exemplo) muda a tela de quem está em português — aconteceu três vezes no
    // PR #352 e nada ficou vermelho.
    await page.goto(TELAS[0]!);
    await page.waitForLoadState("networkidle", { timeout: PRAZO });
    await trocarIdiomaPeloTopo(page, "pt-BR");
    for (const tela of TELAS) {
      await page.goto(tela);
      await page.waitForLoadState("networkidle", { timeout: PRAZO });
      expect(
        (await textosVisiveis(page)).join("\n"),
        `a tela ${tela} não voltou ao português idêntico depois de passar pelo espanhol`,
      ).toBe(antes.get(tela)!.join("\n"));
    }
    await page.screenshot({ path: path.join(EVIDENCIA, "02-inbox-de-volta-em-portugues.png"), fullPage: true });
  });
});
