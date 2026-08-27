import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * VARREDURA: botão que fica cinza por falta de FIAÇÃO, não de permissão.
 *
 * ─── O padrão, e as três vezes que este repo pagou por ele ───────────────────
 * Um componente aceita `onAlgumaCoisa?` e escreve `disabled={!onAlgumaCoisa}`.
 * A tela do produto monta o componente sem passar a callback. O botão nasce
 * CINZA em toda linha, de toda organização, para sempre — e a ausência tem cara
 * de permissão, não de defeito.
 *
 *   PR #295 · cinco controles decorativos de uma vez;
 *   `useRemarcarAgendamento.ts` · "Remarcar" e "Cancelar" cinzas desde que
 *      `HistoricoDaAgenda` nasceu — só a IA conseguia remarcar;
 *   e o mesmo componente, de novo · "Realizado" e "Faltou" ficaram para trás no
 *      conserto acima, no MESMO arquivo, com a MESMA frase falsa no `title`
 *      ("Disponível quando a agenda estiver conectada" — o PATCH de status não
 *      toca o Google). Conserto por instância cobra a segunda passada.
 *
 * As quatro props nasceram juntas, no mesmo componente, com o mesmo padrão. A
 * varredura que teria consertado as quatro custava um `grep` a mais — e é este
 * arquivo.
 *
 * ─── Por que a cerca é ESTÁTICA e não um teste de tela ───────────────────────
 * `tests/e2e/agenda-kit-visual.spec.ts` já assere `toBeDisabled()` nesses
 * botões, e passa: ele roda contra a VITRINE, que legitimamente não passa
 * callback nenhuma. Um teste de tela sobre a vitrine nunca vai enxergar a
 * fiação faltando no produto — foi por isso que o defeito ficou verde por tempo
 * indeterminado.
 *
 * ─── O que conta como "ligado" ───────────────────────────────────────────────
 * Um caller em `app/app/**` — a tela do PRODUTO. A vitrine (`app/vitrine-*`) e
 * as páginas de demonstração não contam de propósito: passar a callback lá
 * silenciaria o gate sem ligar nada para o usuário.
 */
const RAIZ = process.cwd();

function arquivos(dir: string, ext: RegExp): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : arquivos(p, ext);
    return e.isFile() && ext.test(p) ? [p] : [];
  });
}

interface Controle {
  onde: string;
  prop: string;
}

/** `disabled={!onAlgo}` dentro de `components/**`. */
function controlesQueDependemDeCallback(): Controle[] {
  const out: Controle[] = [];
  for (const arquivo of arquivos(path.join(RAIZ, "components"), /\.tsx$/)) {
    const fonte = fs.readFileSync(arquivo, "utf8");
    const rel = path.relative(RAIZ, arquivo);
    for (const m of fonte.matchAll(/disabled=\{!\s*(on[A-Z][A-Za-z0-9]*)\s*\}/g)) {
      const prop = m[1] as string;
      const linha = fonte.slice(0, m.index ?? 0).split("\n").length;
      // A prop tem de ser OPCIONAL para o padrão existir; obrigatória nunca fica
      // cinza por ausência.
      if (!new RegExp(`\\b${prop}\\?\\s*:`).test(fonte)) continue;
      out.push({ onde: `${rel}:${linha}`, prop });
    }
  }
  return out;
}

/** Toda prop `onAlgo=` passada por alguma tela do PRODUTO. */
function propsLigadasNoProduto(): Set<string> {
  const ligadas = new Set<string>();
  for (const arquivo of arquivos(path.join(RAIZ, "app", "app"), /\.tsx$/)) {
    const fonte = fs.readFileSync(arquivo, "utf8");
    for (const m of fonte.matchAll(/\b(on[A-Z][A-Za-z0-9]*)=\{/g)) ligadas.add(m[1] as string);
  }
  return ligadas;
}

const CONTROLES = controlesQueDependemDeCallback();
const LIGADAS = propsLigadasNoProduto();

/**
 * Controles que ficam cinzas de propósito, com o motivo escrito. Esta lista só
 * ENCOLHE — e entrada nova precisa dizer POR QUE a tela do produto legitimamente
 * não liga aquele botão.
 */
const JUSTIFICADOS: Record<string, string> = {};

describe("nenhum botão fica cinza por falta de fiação", () => {
  it("a varredura enxerga os dois lados (senão ela mede o vazio)", () => {
    // Controle do instrumento. Sem isto, mover `components/` ou quebrar o
    // extrator deixaria o gate verde por não conhecer controle nenhum — e ele
    // afirmaria o que não mediu.
    expect(CONTROLES.length, "nenhum `disabled={!onAlgo}` encontrado").toBeGreaterThanOrEqual(4);
    expect(LIGADAS.size, "nenhuma callback encontrada em app/app").toBeGreaterThanOrEqual(20);
  });

  it("a sonda exige prop OPCIONAL — obrigatória não fica cinza por ausência", () => {
    // Prende a regra que evita o falso positivo: `onX: () => void` sem `?` é
    // sempre passada, então `disabled={!onX}` ali é outra coisa (estado, não
    // fiação).
    expect(/\bonSalvar\?\s*:/.test("  onSalvar?: () => void;")).toBe(true);
    expect(/\bonSalvar\?\s*:/.test("  onSalvar: () => void;")).toBe(false);
  });

  it("toda callback que apaga um botão é passada por alguma tela do produto", () => {
    const mortos = CONTROLES.filter(
      (c) => !LIGADAS.has(c.prop) && !(c.prop in JUSTIFICADOS),
    ).map((c) => `${c.onde} → ${c.prop}`);

    expect(
      mortos,
      "Botão com `disabled={!callback}` e NENHUMA tela de `app/app/**` passando a " +
        "callback nasce cinza em toda linha, de toda organização, para sempre — e a " +
        "ausência tem cara de permissão, não de defeito. Este repo já pagou por isso " +
        "três vezes (PR #295 com cinco de uma vez; remarcar/cancelar; realizado/faltou). " +
        "Ligue o fio, ou declare em JUSTIFICADOS com o motivo. Passar a callback só na " +
        "vitrine NÃO conta: ela não liga nada para quem usa o produto.",
    ).toEqual([]);
  });
});
