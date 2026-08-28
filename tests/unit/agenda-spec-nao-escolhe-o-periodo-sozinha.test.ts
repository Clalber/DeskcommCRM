/**
 * SPEC DE AGENDA NÃO ESCOLHE O PERÍODO SOZINHA — a guarda da CLASSE, não das
 * quatro instâncias.
 *
 * ═══ A classe ════════════════════════════════════════════════════════════════
 *
 * "Teste que lê uma grandeza que ninguém declarou como ENTRADA." Em 2026-08-28
 * ela apareceu QUATRO vezes em um único dia, todas na agenda:
 *
 *   - `agenda-painel-cabe-na-tela` (PR #402) abria no primeiro dia clicável, que
 *     é hoje: a `main` reprovou com 9 horários às 15:27 UTC e 7 às 16:37 — mesmo
 *     commit, mesmo seed, contagens diferentes;
 *   - `agenda-grade-interativa`, `agenda-marcar-pela-tela` e
 *     `agenda-remarcar-e-cancelar` trabalhavam na semana desenhada, que é a de
 *     hoje, e reprovaram a `main` em quatro runs seguidos a partir das ~15h50.
 *
 * Medido com o motor real (`lib/agenda/horarios-livres.ts`), numa sexta-feira,
 * contando horários livres na semana que a grade desenha:
 *
 *     dia          09h  12h  15h  16h  17h  20h  23h
 *     sex (hoje)    16   10    4    2    0    0    0
 *     sáb            0    0    0    0    0    0    0
 *     semana +1     90   90   90   90   90   90   90
 *
 * Consertar as quatro instâncias não fecha nada: a quinta spec de agenda vai
 * nascer com `.first()` no primeiro dia que a tela oferecer, porque é o gesto
 * óbvio — e vai passar, verde, até a próxima sexta às 16h.
 *
 * ═══ A régua ═════════════════════════════════════════════════════════════════
 *
 * Existe UM módulo que decide o período (`tests/e2e/helpers/agenda-semana-integra.ts`),
 * e toda spec que escolhe dia ou bloco na agenda tem de passar por ele. A guarda
 * cobra três coisas:
 *
 *   1. a spec que casa "agenda + seletor de dia/bloco" IMPORTA o módulo;
 *   2. e o CHAMA — importar para calar a guarda não conta;
 *   3. o módulo não lê o relógio do PROCESSO (`new Date()` / `Date.now()` no
 *      Node): o período sai do que a tela desenhou, ou de um `page.evaluate`,
 *      que roda no mesmo relógio e no mesmo fuso que formataram o `data-testid`.
 *
 * ═══ O QUE ESTA GUARDA NÃO PEGA — e está escrito porque a omissão anestesia ══
 *
 * Ela não lê o corpo da spec procurando outras leituras de tempo: uma spec pode
 * importar o módulo, chamá-lo, e ainda assim asserir sobre "o compromisso das
 * 14h" logo abaixo. O que ela garante é que quem escrever a próxima spec de
 * agenda ESBARRE na regra e leia a tabela acima — não que o autor a obedeça em
 * cada linha. Guarda de fonte não substitui revisão; ela impede a reincidência
 * silenciosa, que é como as quatro instâncias chegaram aqui.
 *
 * Também não vale para specs fora da agenda. A classe é maior que este módulo
 * (a janela anti-ban derrubando o `test:db` de madrugada é a mesma doença), mas
 * uma guarda que tentasse cobrir tudo teria de adivinhar o que é leitura de
 * tempo legítima — e uma guarda que tolera não distingue.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const DIR_E2E = path.join(RAIZ, "tests/e2e");
const MODULO = path.join(DIR_E2E, "helpers/agenda-semana-integra.ts");

/** As funções que o módulo publica — chamar qualquer uma satisfaz a régua 2. */
const CHAMADAS = [
  "irParaASemanaSeguinte",
  "escolherDiaDesenhado",
  "escolherPrimeiroDiaCheio",
  "escolherUltimoDiaCheio",
];

/**
 * Specs dispensadas, com o motivo escrito. Esta lista SÓ ENCOLHE — cada entrada
 * é dívida declarada, e entrar nela exige a razão pela qual a spec não escolhe
 * período nenhum.
 */
const DISPENSADAS: Record<string, string> = {
  "agenda-kit-visual.spec.ts":
    "roda contra /vitrine-agenda, que PASSA o instante como fixture — é o padrão certo, " +
    "não a exceção: por isso ela clica num `dia-2026-08-24` fixo e segue verde com essa " +
    "data no passado.",
};

function specsDeAgenda(): string[] {
  return readdirSync(DIR_E2E)
    .filter((f) => f.endsWith(".spec.ts"))
    .filter((f) => {
      const fonte = readFileSync(path.join(DIR_E2E, f), "utf8");
      const naAgenda = /\/app\/agenda|tela-agenda|painel-de-marcacao/.test(fonte);
      // A spec JÁ MIGRADA não tem mais os seletores literais — eles moraram para
      // o módulo. Sem contá-la aqui, migrar uma spec a tiraria do conjunto e o
      // controle de vacuidade abaixo mediria um conjunto que só encolhe.
      const escolhePeriodo =
        /\[data-testid\^="(dia|bloco)-"\]|getByTestId\(`(dia|bloco)-/.test(fonte) ||
        /from "\.\/helpers\/agenda-semana-integra"/.test(fonte);
      return naAgenda && escolhePeriodo;
    });
}

describe("spec de agenda não escolhe o período sozinha", () => {
  it("a varredura ENCONTRA specs — uma lista vazia passaria por vacuidade", () => {
    // Sem este caso, quebrar o regex acima (ou renomear os `data-testid`) faria
    // os dois casos abaixo ficarem verdes sobre um conjunto vazio.
    // Cinco em 2026-08-28, e cada uma foi uma instância da classe. O piso é o
    // que havia quando a guarda nasceu: spec de agenda não some, só aparece.
    expect(specsDeAgenda().length).toBeGreaterThanOrEqual(5);
  });

  it("toda spec que escolhe dia ou bloco na agenda passa pelo módulo do período", () => {
    const faltando: string[] = [];
    for (const spec of specsDeAgenda()) {
      if (spec in DISPENSADAS) continue;
      const fonte = readFileSync(path.join(DIR_E2E, spec), "utf8");
      const importa = /from "\.\/helpers\/agenda-semana-integra"/.test(fonte);
      const chama = CHAMADAS.some((f) => new RegExp(`\\b${f}\\(`).test(fonte));
      if (!importa || !chama) faltando.push(`${spec} (importa=${importa}, chama=${chama})`);
    }
    expect(
      faltando,
      "estas specs escolhem dia ou bloco na agenda sem passar por " +
        "`tests/e2e/helpers/agenda-semana-integra`. O período que elas pegarem será o de " +
        "HOJE, e hoje encolhe: 16 vagas às 9h, 2 às 16h, ZERO das 17h em diante e zero o " +
        "sábado inteiro. Use `irParaASemanaSeguinte` + `escolherDiaDesenhado` (quando a " +
        "asserção envolve a grade) ou `escolherPrimeiroDiaCheio` (quando é só o painel) — " +
        "ou declare a dispensa em DISPENSADAS, com o motivo.",
    ).toEqual([]);
  });

  it("o módulo do período não lê o relógio do processo", () => {
    const fonte = readFileSync(MODULO, "utf8");
    // `page.evaluate(() => { ... new Date() ... })` roda no BROWSER, e é
    // legítimo: é o mesmo relógio e o mesmo fuso que formataram o `data-testid`.
    // O que não pode é o Node decidir a data e o browser desenhar outra.
    // Comentário NÃO é código, e este arquivo cita `ancora={new Date()}` ao
    // explicar por que o mini-calendário abre no mês de hoje. Uma guarda que
    // lesse a prosa como código proibiria a explicação do próprio defeito.
    const semProsa = fonte
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/page\.evaluate\(\(\)\s*=>\s*\{[\s\S]*?\n\s*\}\)/g, "<browser>");
    const noNode = semProsa.match(/new Date\(|Date\.now\(/g) ?? [];
    expect(
      noNode,
      "o módulo passou a ler o relógio do processo. O período tem de sair do que a TELA " +
        "desenhou (`coluna-dia-…`) ou de um `page.evaluate`, que roda no relógio do browser — " +
        "senão o Node escolhe uma data e a tela desenha outra, e a divergência aparece uma " +
        "vez por dia, à meia-noite.",
    ).toEqual([]);
  });
});
