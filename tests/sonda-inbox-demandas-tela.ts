/**
 * PROVA DE TELA — a demanda no painel do inbox (passo 4 do cap. 5).
 *
 * ## O que esta sonda prova que o teste de componente NÃO pode
 *
 * O teste unitário mocka `apiClient` e prova o COMPORTAMENTO do painel. Ele não
 * toca a RLS. E aqui a RLS é o risco real: a rota `crm-summary` lê com o
 * **client de sessão**, e a política de `demandas` chama `fn_user_org_ids()`.
 * Se essa leitura não passar, o painel diz "Nenhuma demanda aberta." para
 * sempre — que é EXATAMENTE o defeito que a rota inteira veio curar (erro de
 * permissão traduzido em afirmação sobre o negócio), reintroduzido por mim numa
 * seção nova.
 *
 * Por isso o caso central não é "a seção apareceu": é **a seção mostrar as duas
 * demandas que existem no banco**, com a sem próximo passo distinguível.
 *
 * Uso: `npx tsx tests/sonda-inbox-demandas-tela.ts`
 * Requer o app na 3100 apontando para o Supabase LOCAL. Semeia e limpa.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_PORT
  ? `http://127.0.0.1:${process.env.E2E_PORT}`
  : "http://127.0.0.1:3100";
const CONVERSA = "8b9fcd5f-252d-4f6b-9538-f7c2c538807f";
const CONTATO = "564d1c58-52a1-4610-bd43-2d88df13064c";
const ORG = "ad365e5b-45e5-45d3-99fa-33b388501fec";
const MARCA = "sonda-inbox-demanda";
const c = JSON.parse(readFileSync("/Users/rafaelmelgaco/DeskcommCRM/.e2e-creds.json", "utf8"));

function psql(script: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_deskcomm-crm", "psql", "-U", "postgres", "-d", "postgres", "-tA"],
    { input: script, encoding: "utf8" },
  );
}

const limpar = `delete from public.demandas where assunto = '${MARCA}';`;

function semear(): number {
  psql(`
    ${limpar}
    insert into public.demandas
      (organization_id, contact_id, aberta_em, origem, estado, assunto, proximo_passo, proximo_passo_em)
    values
      ('${ORG}', '${CONTATO}', now() - interval '9 hours', 'inbound', 'aberta', '${MARCA}', null, null),
      ('${ORG}', '${CONTATO}', now() - interval '3 hours', 'handoff', 'em_atendimento', '${MARCA}',
       'Enviar o orçamento revisado', now() + interval '1 day');
  `);
  // Quantas demandas ABERTAS o banco tem para este contato — a régua contra a
  // qual a tela é comparada. Sem ela, "apareceu alguma coisa" passaria por
  // prova.
  return Number(
    psql(
      `select count(*) from public.demandas where contact_id='${CONTATO}' and fechada_em is null;`,
    ).trim(),
  );
}

async function main(): Promise<void> {
  const noBanco = semear();
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const erros: string[] = [];
  let statusSummary = 0;
  p.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });
  p.on("response", (r) => {
    if (r.url().includes("/crm-summary")) statusSummary = r.status();
  });

  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await p.click('input[type="email"]');
  await p.locator('input[type="email"]').pressSequentially(c.users.manager.email, { delay: 8 });
  await p.click('input[type="password"]');
  await p.locator('input[type="password"]').pressSequentially(c.password, { delay: 8 });
  await p.click('button[type="submit"]');
  await p.waitForURL(/\/app/, { timeout: 30000 });

  await p.goto(`${BASE}/app/inbox?id=${CONVERSA}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(3000);

  const m = (await p.evaluate(`(() => {
    var sec = document.querySelector('[data-testid="inbox-demandas"]');
    if (!sec) return { presente: false };
    var r = sec.getBoundingClientRect();
    var sem = sec.querySelectorAll('[data-testid="demanda-sem-proximo-passo"]');
    var com = sec.querySelectorAll('[data-testid="demanda-com-proximo-passo"]');
    var leads = null;
    var h3s = document.querySelectorAll("h3");
    for (var i = 0; i < h3s.length; i++) {
      // case-INSENSITIVE: o h3 usa \`uppercase\` no CSS e \`innerText\` no browser
      // devolve "LEADS RECENTES". No jsdom do teste unitário não há
      // text-transform, então lá o texto casa e aqui não casava — a medida
      // voltava \`null\` e a asserção reprovava por não ter medido, não por
      // estar errada.
      if (/leads recentes/i.test(h3s[i].innerText)) { leads = h3s[i]; break; }
    }
    return {
      presente: true,
      texto: sec.innerText.replace(/\\s+/g, " ").trim(),
      itens_sem_passo: sem.length,
      itens_com_passo: com.length,
      // A frase, não só a cor — acessibilidade medida, não presumida.
      diz_por_escrito: /Sem próximo passo definido/.test(sec.innerText),
      // Zero lisonjeiro: com dados no banco, dizer "nenhuma" seria a mentira.
      afirma_nenhuma: /Nenhuma demanda aberta/.test(sec.innerText),
      confessa_falha: /Não consegui ler/.test(sec.innerText),
      antes_dos_leads: leads
        ? !!(sec.compareDocumentPosition(leads) & Node.DOCUMENT_POSITION_FOLLOWING)
        : null,
      largura: Math.round(r.width),
      visivel: r.width > 0 && r.height > 0,
      scroll_horizontal:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  })()`)) as Record<string, unknown>;

  // CONGELA as medidas do caminho feliz ANTES da fase de falha: o listener de
  // `response` e o array de `erros` são cumulativos, e o 500 injetado adiante
  // sobrescreveria o status e somaria um erro de console. A primeira versão
  // desta sonda reprovou "a rota respondeu 200" e "sem erro de console" por
  // isso — a medida do caminho feliz tinha sido contaminada pela fase seguinte.
  const statusFeliz = statusSummary;
  const errosFeliz = [...erros];
  console.log(JSON.stringify({ ...m, statusSummary: statusFeliz, noBanco, erros: errosFeliz }, null, 2));
  await p.screenshot({ path: "evidence/passo4-inbox-demandas.png", fullPage: false });

  // ---------------------------------------------------------------------------
  // O CAMINHO DA FALHA, na tela. `tests/sonda-painel-inbox.ts` já guarda isto
  // para as três seções antigas, mas não roda neste banco: sua fixture
  // ("Ana Souza LGPD E2E") não existe aqui — medido, 0 contatos. Em vez de
  // deixar a seção nova sem prova de tela no caminho de erro, o caso vem junto.
  //
  // A rota devolve 500 e o painel tem de CONFESSAR. Dizer "Nenhuma demanda
  // aberta" aqui seria uma afirmação sobre o negócio feita em cima de uma falha
  // de leitura — exatamente o defeito que a rota `crm-summary` veio curar.
  // ---------------------------------------------------------------------------
  await p.route("**/crm-summary", (r) =>
    r.fulfill({ status: 500, contentType: "application/json", body: '{"error":{"code":"boom"}}' }),
  );
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  const falha = (await p.evaluate(`(() => {
    var sec = document.querySelector('[data-testid="inbox-demandas"]');
    if (!sec) return { presente: false };
    var t = sec.innerText;
    return {
      presente: true,
      confessa: /Não consegui ler/.test(t),
      mente: /Nenhuma demanda aberta/.test(t),
      oferece_retry: /Tentar de novo/.test(t),
    };
  })()`)) as Record<string, unknown>;
  console.log("SOB FALHA:", JSON.stringify(falha));
  await p.screenshot({ path: "evidence/passo4-inbox-demandas-falha.png", fullPage: false });

  await b.close();
  psql(limpar);

  const casos: Array<[string, boolean]> = [
    ["a rota respondeu 200", statusFeliz === 200],
    ["a seção está na tela", m.presente === true],
    ["mostra TODAS as demandas abertas do banco", Number(m.itens_sem_passo) + Number(m.itens_com_passo) === noBanco],
    ["a sem próximo passo é distinguível", Number(m.itens_sem_passo) >= 1],
    ["a com próximo passo também aparece", Number(m.itens_com_passo) >= 1],
    ["diz a ausência por escrito, não só por cor", m.diz_por_escrito === true],
    ["NÃO afirma 'nenhuma demanda' havendo demanda", m.afirma_nenhuma === false],
    ["não confessa falha de leitura (a RLS deixou ler)", m.confessa_falha === false],
    ["vem antes dos negócios", m.antes_dos_leads === true],
    ["sem scroll horizontal", m.scroll_horizontal === false],
    ["sem erro de console", errosFeliz.length === 0],
    ["sob falha: a seção continua na tela", falha.presente === true],
    ["sob falha: CONFESSA que não conseguiu ler", falha.confessa === true],
    ["sob falha: NÃO afirma 'nenhuma demanda aberta'", falha.mente === false],
    ["sob falha: oferece tentar de novo", falha.oferece_retry === true],
  ];
  let falhas = 0;
  for (const [nome, ok] of casos) {
    console.log(`${ok ? "  ok  " : "FALHA "} ${nome}`);
    if (!ok) falhas += 1;
  }
  console.log(falhas === 0 ? "\nTODOS OS CASOS PASSARAM" : `\n${falhas} CASO(S) FALHARAM`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  psql(limpar);
  console.error(e);
  process.exit(1);
});
