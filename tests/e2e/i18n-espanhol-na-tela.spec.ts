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

import { createClient } from "@supabase/supabase-js";
import { test, expect, type Page } from "@playwright/test";

import { credenciaisSupabaseDeTeste } from "../../scripts/lib/env-de-teste";
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
/**
 * Textos que a régua acusa e NÃO são vazamento: são DADO, e dado não se traduz.
 *
 * O comentário do cabeçalho diz que nenhum dado de banco coincide com uma chave
 * de interface por acaso. Coincidiu: "Entregue" é nome de etapa do funil
 * (`crm_stages.name`) semeado pelo e2e, e o produto o mostra exatamente como o
 * tenant o cadastrou — traduzir seria o erro. A afirmação do cabeçalho fica,
 * porque continua verdadeira como regra; esta lista é a exceção medida, com o
 * nome de quem a produz.
 *
 * Ela SÓ ENCOLHE, e entrada nova precisa nomear a COLUNA de onde o texto vem.
 */
const DADO_DO_TENANT = new Set([
  "Entregue", // crm_stages.name, do seed de e2e
]);

const CHAVES_QUE_MUDAM = new Set(
  Object.entries(DICIONARIO)
    .filter(([chave, t]) => t.es && t.es !== chave)
    .map(([chave]) => chave),
);

/**
 * Só o texto de INTERFACE — o que o dicionário conhece.
 *
 * ─── Por que não a tela inteira ────────────────────────────────────────────
 *
 * A primeira versão comparava todo o texto visível, byte a byte, e reprovou
 * duas vezes no CI com o produto CORRETO. Primeiro por dígito ("Aguardando há
 * 12 segundos" → "há 59 segundos") nos ~40 s que a spec leva entre as duas
 * medições; mascarei os dígitos, e a rodada seguinte reprovou por UNIDADE
 * ("há # segundos" → "há # minuto"). Não há máscara que ganhe dessa corrida: a
 * tela tem contadores, e eles andam.
 *
 * Filtrar pelo dicionário resolve na raiz e afia a asserção em vez de afrouxá-la:
 * o que ela quer vigiar é RÓTULO, e rótulo é exatamente o que o dicionário
 * conhece. Contador, nome de contato e data saem da conta por não serem
 * interface — e nenhum deles poderia acusar o defeito que ela procura.
 */
function rotulosDeInterface(textos: string[]): string {
  return textos.filter((t) => t in DICIONARIO).sort().join("\n");
}

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

/**
 * Põe a interface no idioma pedido, clicando como uma pessoa clicaria.
 *
 * Independente do estado inicial DE PROPÓSITO: o banco do e2e é compartilhado e
 * sobrevive entre execuções, então a preferência do `e2e-admin` é o que a
 * rodada anterior deixou. Uma spec que assume "começa em português" passa uma
 * vez e falha na seguinte por um motivo que não tem nada a ver com o produto.
 *
 * O botão mostra o código em vigor ("PT"/"ES"), então ele é a própria sonda.
 */
async function porIdiomaEm(page: Page, codigo: "pt-BR" | "es"): Promise<void> {
  const curto = codigo === "es" ? "ES" : "PT";
  const botao = page.getByTestId("seletor-de-idioma");
  if ((await botao.innerText()).trim() === curto) return;

  // Carimba o documento ATUAL. O seletor grava e recarrega a página (o porquê
  // está no comentário dele), e a recarga cria um documento novo — o carimbo
  // some. Esperar por isso é esperar exatamente a recarga, sem depender de um
  // evento que pode ser emitido antes de o listener existir.
  //
  // Medir antes de a recarga terminar é medir o meio do caminho: a spec lia a
  // tela ainda no idioma antigo e acusava vazamento que não existia.
  await page.evaluate(() => {
    (window as unknown as { __antesDaTroca?: boolean }).__antesDaTroca = true;
  });
  await botao.click();
  await page.getByTestId(`idioma-${codigo}`).click();
  await page.waitForFunction(
    () => !(window as unknown as { __antesDaTroca?: boolean }).__antesDaTroca,
    undefined,
    { timeout: PRAZO },
  );
  await page.waitForLoadState("networkidle", { timeout: PRAZO });
  await expect(botao, `o seletor não passou a mostrar ${curto} depois da troca`).toHaveText(curto);
}

/**
 * ⚠️ ESTA SPEC MEXE NUMA CONTA QUE A SUÍTE INTEIRA COMPARTILHA.
 *
 * O `e2e-admin` é o mesmo em todas as specs, e a preferência de idioma dele
 * vive no banco. Se esta spec falha no meio, ela deixa a conta em ESPANHOL — e
 * toda spec que procura rótulo em português depois dela quebra junto.
 *
 * Não é hipótese: aconteceu. Numa rodada do CI, 14 casos falharam na parte 2 e
 * apenas UM era desta spec; os outros treze eram `navegacao`, `marca-logo`,
 * `webhooks` e `automacao-diz-a-verdade` — todas depois desta na ordem
 * alfabética, todas procurando texto em português numa interface que esta spec
 * tinha deixado em espanhol.
 *
 * Por isso a restauração é `afterAll` e vai DIRETO AO BANCO, não pela tela: se
 * a falha foi na tela, restaurar pela tela falharia junto. `null` (e não
 * "pt-BR") porque `null` é a ausência de preferência, que é como a conta nasce
 * do seed — devolver um valor onde não havia nenhum é deixar outro rastro.
 */
test.afterAll(async () => {
  const c = credenciaisSupabaseDeTeste();
  const svc = createClient(c.url, c.serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = creds.users.admin!.email;
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 200 });
  const admin = data?.users.find((u) => u.email === email);
  if (!admin) throw new Error(`restauração: não achei ${email} para devolver o idioma`);
  const { error } = await svc.auth.admin.updateUserById(admin.id, {
    user_metadata: { ...admin.user_metadata, locale: null },
  });
  if (error) throw new Error(`restauração do idioma falhou: ${error.message}`);
});

test.describe("o idioma escolhido chega à tela", () => {
  test.setTimeout(180_000);

  test("espanhol cobre a interface, e o português volta byte a byte", async ({ page }) => {
    await loginComoAdmin(page, creds);

    // O banco do e2e é compartilhado e guarda a preferência da rodada anterior.
    // O retrato de referência tem de ser em português, então isto é precondição,
    // não medição.
    await page.goto(TELAS[0]!);
    await page.waitForLoadState("networkidle", { timeout: PRAZO });
    await porIdiomaEm(page, "pt-BR");

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
    await porIdiomaEm(page, "es");
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
      rotulosDeInterface(inboxEmEspanhol),
      "o seletor do topo não mudou nada na tela — o idioma escolhido não chegou",
    ).not.toBe(rotulosDeInterface(inboxEmPortugues));

    // ── 4. Vazamento: texto que o dicionário sabe traduzir, mostrado em pt ──
    const vazando: string[] = [];
    for (const tela of TELAS) {
      await page.goto(tela);
      await page.waitForLoadState("networkidle", { timeout: PRAZO });
      for (const texto of await textosVisiveis(page)) {
        if (CHAVES_QUE_MUDAM.has(texto) && !DADO_DO_TENANT.has(texto)) {
          vazando.push(`${tela} → ${JSON.stringify(texto)}`);
        }
      }
    }
    expect(
      vazando,
      `${vazando.length} texto(s) apareceram em PORTUGUÊS com a interface em espanhol. ` +
        "Cada um é uma chave que o dicionário sabe traduzir e que não passou por t() " +
        "no ponto em que a tela o renderiza.",
    ).toEqual([]);

    // ── 5. E a volta: o português tem de voltar ao que era ──────────────────
    //
    // ⚠️ O QUE ESTA ASSERÇÃO PROVA, e o que ela NÃO prova.
    //
    // Ela prova IDEMPOTÊNCIA: passar pelo espanhol e voltar devolve a mesma
    // tela. Pega estado que fica pela metade — um provider que não reconcilia,
    // um cache que serve o idioma velho, um rótulo que só volta com F5. Foi
    // assim que o Router Cache do cliente apareceu.
    //
    // Ela NÃO prova que o português está igual ao de ANTES DESTE PR — e a
    // primeira versão deste comentário dizia que sim, o que estava errado: os
    // dois retratos saem da MESMA execução, do MESMO código. Se uma chave
    // tivesse sido escrita com um caractere diferente do original, os dois
    // lados já viriam com o texto novo e a comparação daria igual.
    //
    // Quem pega aquilo é a revisão do diff, mais a varredura que comparou cada
    // literal com a versão anterior do mesmo arquivo (foi ela que achou os três
    // casos do PR #352). Está escrito aqui para ninguém contar esta asserção
    // como a garantia que ela não é.
    await page.goto(TELAS[0]!);
    await page.waitForLoadState("networkidle", { timeout: PRAZO });
    await porIdiomaEm(page, "pt-BR");
    for (const tela of TELAS) {
      await page.goto(tela);
      await page.waitForLoadState("networkidle", { timeout: PRAZO });
      expect(
        rotulosDeInterface(await textosVisiveis(page)),
        `a tela ${tela} não voltou ao português idêntico depois de passar pelo espanhol`,
      ).toBe(rotulosDeInterface(antes.get(tela)!));
    }
    await page.screenshot({ path: path.join(EVIDENCIA, "02-inbox-de-volta-em-portugues.png"), fullPage: true });
  });
});
