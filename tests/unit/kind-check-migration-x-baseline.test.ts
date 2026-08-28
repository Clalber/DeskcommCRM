/**
 * A MIGRATION QUE RECONSTRÓI UMA CONSTRAINT DE VOCABULÁRIO NÃO PODE ENCOLHÊ-LA.
 *
 * O repo tem dois caminhos de schema que precisam terminar no mesmo lugar:
 *
 *   * `supabase/baseline.sql`, que o kit self-host aplica (install + update);
 *   * `supabase/migrations/*.sql`, que o Supabase CLI aplica em ordem.
 *
 * `tests/unit/baseline-constraint-reconstruida.test.ts` já vigia o primeiro:
 * uma constraint, um bloco. Ninguém vigiava o segundo, e foi por aí que passou
 * a **0129**, que reconstruiu `agent_inbox_items_kind_check` com 15 valores
 * quando o vocabulário vigente tinha 18 — apagando `contact_proposal_expired`
 * (criado pela 0124, a migration imediatamente anterior), `promise_unfulfilled`
 * e `other`.
 *
 * O sintoma é mudo do jeito pior: em quem aplica migrations incrementalmente,
 * os INSERTs de aviso passam a violar a constraint, o `catch` fire-and-forget
 * engole, e o operador simplesmente nunca vê o aviso. Nenhum gate reprovava,
 * porque `pnpm test:db` aplica só o BASELINE — que estava certo.
 *
 * A guarda aqui é a comparação que faltava: a ÚLTIMA migration que reconstrói
 * a constraint tem de terminar com a lista do baseline, valor a valor. Não é
 * uma checagem de "cresce sempre": é igualdade com a fonte que o self-hoster
 * realmente recebe.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const BASELINE = join(RAIZ, "supabase", "baseline.sql");
const MIGRATIONS = join(RAIZ, "supabase", "migrations");

/**
 * Vocabulário de um `add constraint <nome> check (<coluna> in ( … ))`.
 *
 * Devolve `null` quando o SQL não reconstrói essa constraint — que é diferente
 * de "reconstrói com lista vazia", e a diferença importa: sem ela, um regex que
 * parasse de casar devolveria `[]` e o teste ficaria verde por não medir nada.
 */
function vocabularioDe(sqlBruto: string, constraint: string): string[] | null {
  // Os comentários saem ANTES do parse. O bloco do baseline explica cada valor
  // com um `--` no meio da lista, e vários desses comentários contêm parênteses
  // ("(migration 0109, issue #129)") — o fechamento da lista seria lido no
  // parêntese errado e a lista voltaria truncada, o que aqui apareceria como
  // uma divergência inventada.
  const sql = sqlBruto.replace(/--[^\n]*/g, "");
  // DUAS formas, porque o repo escreve as duas e o Postgres não distingue:
  // `check (kind in ('a','b'))` e `check (kind = any (array['a'::text,...]))`.
  //
  // A régua só conhecia a primeira, e o ponto cego não era teórico: a migration
  // 0202 reconstruiu `agent_inbox_items_kind_check` na forma `= any (array[...])`
  // e ficou INVISÍVEL para esta guarda. O efeito é o que o cabeçalho deste
  // arquivo teme — a `ultima` passava a ser uma migration ANTERIOR, e a
  // comparação media o par errado. Guarda cega para metade das formas não é
  // guarda: ela reprova quem está certo e absolve quem está errado.
  // AINDA CEGA para duas formas, e vale saber quais antes de copiar SQL de
  // fora: a forma que o `pg_dump` emite com cast — `((kind)::text = any (...))`
  // — porque o `)` de `(kind)` corta o `[^)]*?` antes do `=`; e o array-literal
  // `= any ('{a,b}'::text[])`. Migration escrita colando saída de pg_dump some
  // desta guarda com o MESMO silêncio que a 0202 teve. Há caso de controle
  // abaixo que trava o dia em que alguém as cobrir sem atualizar esta nota.
  const abre = new RegExp(
    `add\\s+constraint\\s+${constraint}\\s+check\\s*\\(`
      + `(?:[^)]*?\\bin\\s*\\(|[^)]*?=\\s*any\\s*\\(\\s*array\\s*\\[)`,
    "is",
  );
  const m = abre.exec(sql);
  if (!m) return null;
  const inicio = m.index + m[0].length;
  // O fechamento acompanha a forma: `in (` fecha em `)`, `array[` fecha em `]`.
  const fechamento = m[0].trimEnd().endsWith("[") ? "]" : ")";
  const fim = sql.indexOf(fechamento, inicio);
  if (fim === -1) return null;
  return [...sql.slice(inicio, fim).matchAll(/'([^']+)'/g)].map((x) => x[1] as string);
}

/** As migrations que reconstroem a constraint, em ordem de aplicação (nome). */
function migrationsQueReconstroem(constraint: string): Array<{ arquivo: string; valores: string[] }> {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ arquivo: f, valores: vocabularioDe(readFileSync(join(MIGRATIONS, f), "utf8"), constraint) }))
    .filter((x): x is { arquivo: string; valores: string[] } => x.valores !== null);
}

/**
 * As constraints de vocabulário aberto que valem esta guarda. Uma lista, e não
 * uma varredura de todas: só entra aqui a constraint cujo valor perdido produz
 * silêncio no produto (aviso que não abre, fila que não anda). Acrescentar uma
 * linha é o custo de trazer uma constraint nova para debaixo da guarda.
 */
const VIGIADAS = ["agent_inbox_items_kind_check"];

describe("migrations × baseline — vocabulário de constraint não encolhe", () => {
  const baseline = readFileSync(BASELINE, "utf8");

  for (const constraint of VIGIADAS) {
    it(`a última migration que reconstrói ${constraint} bate com o baseline`, () => {
      const noBaseline = vocabularioDe(baseline, constraint);
      expect(
        noBaseline,
        `não achei ${constraint} no baseline.sql — o instrumento perdeu o alvo, não é aprovação`,
      ).not.toBeNull();

      const reconstrutoras = migrationsQueReconstroem(constraint);
      expect(
        reconstrutoras.length,
        `nenhuma migration reconstrói ${constraint} — o instrumento perdeu o alvo`,
      ).toBeGreaterThan(0);

      const ultima = reconstrutoras[reconstrutoras.length - 1]!;
      const faltando = (noBaseline ?? []).filter((v) => !ultima.valores.includes(v));
      const sobrando = ultima.valores.filter((v) => !(noBaseline ?? []).includes(v));

      expect(
        { faltando, sobrando },
        `A migration ${ultima.arquivo} deixa ${constraint} diferente do baseline.sql.\n` +
          `Faltando nela: ${faltando.join(", ") || "(nada)"}\n` +
          `Sobrando nela: ${sobrando.join(", ") || "(nada)"}\n` +
          "Quem aplica migrations em ordem (supabase db push) fica com um vocabulário\n" +
          "menor que o do kit, e os INSERTs dos valores perdidos passam a violar a\n" +
          "constraint em silêncio — o aviso simplesmente nunca abre.\n" +
          "Conserto: uma migration NOVA (forward-fix) com a lista completa do baseline.",
      ).toEqual({ faltando: [], sobrando: [] });
    });
  }

  it("o instrumento distingue lista diferente de lista ausente (controle)", () => {
    expect(vocabularioDe("alter table t add constraint c_check check (k in ('a','b'));", "c_check")).toEqual([
      "a",
      "b",
    ]);
    // Constraint que não está no SQL devolve null — nunca `[]`, que se
    // compararia como "vocabulário vazio" e passaria despercebido.
    expect(vocabularioDe("select 1;", "c_check")).toBeNull();
  });

  it("lê as DUAS formas que o repo escreve — `in (...)` e `= any (array[...])`", () => {
    // A segunda forma não é hipótese: a migration 0202 a usou, ficou INVISÍVEL
    // para esta guarda, e o efeito foi ela comparar o baseline com uma migration
    // ANTERIOR e dar verde enquanto o vocabulário encolhia de verdade (perdeu
    // `conhecimento_nao_indexado`, curado pela 0204).
    expect(
      vocabularioDe(
        "alter table t add constraint c_check check (k = any (array['a'::text, 'b'::text]));",
        "c_check",
      ),
    ).toEqual(["a", "b"]);
  });

  it("as formas que a régua NÃO lê estão declaradas — e mudá-las quebra este caso", () => {
    // Controle de HONESTIDADE do comentário em `vocabularioDe`, não de
    // comportamento desejável. Estas duas formas são pontos cegos conhecidos:
    //
    //   ((kind)::text = any (...))   — o que o pg_dump emite, com cast
    //   = any ('{a,b}'::text[])      — array-literal
    //
    // Quem as cobrir vai ver este caso ficar vermelho, e é o ponto: obriga a
    // atualizar a nota em vez de deixar prosa afirmando cegueira que já não
    // existe. Documentação que nenhum gate lê é documentação que diverge.
    expect(
      vocabularioDe("alter table t add constraint c_check check ((k)::text = any (array['a'::text]));", "c_check"),
    ).toBeNull();
    expect(
      vocabularioDe("alter table t add constraint c_check check (k = any ('{a,b}'::text[]));", "c_check"),
    ).toBeNull();
  });
});
