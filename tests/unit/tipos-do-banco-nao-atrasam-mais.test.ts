/**
 * A CATRACA dos tipos do banco.
 *
 * ─── O problema, medido ─────────────────────────────────────────────────────
 *
 * `lib/database.types.ts` estava parado em 2026-08-28 com migrations de 08-31.
 * Faltavam três tabelas inteiras e cinco colunas, e ninguém percebeu por meses.
 *
 * Três coisas explicam o apodrecimento, e as três foram VERIFICADAS:
 *
 *   1. **não existe receita.** Não há `gen:types` no `package.json`, nem script
 *      em `scripts/`, nem passo no CI. Quem quisesse regenerar teria de
 *      reconstruir o procedimento do zero;
 *   2. **a documentação MENTE.** `docs/specs/09-spec-frontend-backend-integration.md`
 *      dizia "regenerado via `pnpm gen:types`" — um comando que nunca existiu;
 *   3. **nada quebra quando ele atrasa.** ZERO arquivos importam `Database`
 *      (os três clients Supabase são `SupabaseClient` sem genérico), então o
 *      `typecheck` fica verde com o arquivo arbitrariamente velho.
 *
 * O item 3 é o que torna este teste necessário. A dívida não aparece sozinha em
 * lugar nenhum: ela aparece como `.from("push_subscriptions" as never)` espalhado
 * pelo código, que é o contorno silencioso de um tipo que não existe.
 *
 * ─── Por que CATRACA e não "regenere agora" ────────────────────────────────
 *
 * Regenerar exige um Supabase local (Docker), que nem toda máquina de quem
 * trabalha neste repo tem — esta sessão não tinha. Um teste que exigisse o
 * arquivo em dia seria vermelho permanente e acabaria desligado.
 *
 * A catraca é o mesmo idioma de `tests/unit/branding.test.ts`: a lista de dívida
 * conhecida **só encolhe**. Tabela nova que chegar sem tipo fica vermelha aqui, e
 * quem quitar uma dívida antiga é OBRIGADO a tirá-la da lista — porque a segunda
 * asserção reprova entrada que já não é verdade. Sem essa segunda metade, a
 * lista viraria um cemitério e a catraca giraria para trás em silêncio.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const BASELINE = readFileSync("supabase/baseline.sql", "utf8");
const TIPOS = readFileSync("lib/database.types.ts", "utf8");

/**
 * A dívida conhecida em 2026-08-31, cada linha com o PORQUÊ.
 *
 * ⚠️ Esta lista só encolhe. Acrescentar entrada aqui para calar um vermelho é
 * usar a catraca ao contrário — o vermelho existe porque a tabela nova nasceu
 * sem tipo, e o conserto é gerar o tipo.
 */
const DIVIDA_CONHECIDA: Record<string, string> = {
  channel_contact_identities:
    "migration 0203. Contornada com `.from(... as never)` na ingestão do canal por id opaco.",
  push_subscriptions:
    "migration 0197. Contornada em `app/api/v1/notifications/push/route.ts`.",
  calendar_oauth_nonces:
    "migration 0190. Sem contorno no código — a tabela é usada só por função SQL.",
};

/** As tabelas que o `baseline.sql` cria — é ele que o self-hoster aplica. */
function tabelasDoBaseline(): string[] {
  const achadas = new Set<string>();
  for (const m of BASELINE.matchAll(
    /create table (?:if not exists )?(?:only )?public\.("?)(\w+)\1/gi,
  )) {
    achadas.add(m[2]!);
  }
  return [...achadas].sort();
}

/** As tabelas que o arquivo de tipos declara. */
function tabelaTemTipo(nome: string): boolean {
  // A forma do gerador do Supabase: duas chaves aninhadas sob `Tables`.
  return new RegExp(`^ {6}${nome}: \\{`, "m").test(TIPOS);
}

describe("os tipos do banco não podem atrasar em silêncio", () => {
  it("toda tabela do baseline tem tipo — ou está na dívida DECLARADA", () => {
    const semTipo = tabelasDoBaseline().filter((t) => !tabelaTemTipo(t));
    const naoDeclaradas = semTipo.filter((t) => !(t in DIVIDA_CONHECIDA));

    expect(
      naoDeclaradas,
      `tabela(s) sem tipo e sem justificativa: ${naoDeclaradas.join(", ")}.\n` +
        "Gere o tipo (ver docs/specs/09) ou declare a dívida com o motivo escrito.",
    ).toEqual([]);
  });

  it("⚠️ a dívida SÓ ENCOLHE — entrada que já foi quitada tem de sair da lista", () => {
    // A metade que faz a catraca girar num sentido só. Sem ela, a lista guardaria
    // para sempre nomes já resolvidos, e a próxima pessoa mediria a dívida contra
    // uma régua inflada — sem saber que o trabalho já estava feito.
    const quitadas = Object.keys(DIVIDA_CONHECIDA).filter((t) => tabelaTemTipo(t));

    expect(
      quitadas,
      `estas já têm tipo e continuam na lista de dívida: ${quitadas.join(", ")}. Remova-as.`,
    ).toEqual([]);
  });

  it("a dívida conhecida não cresceu além do medido em 2026-08-31", () => {
    // Um número, de propósito, e é o único do arquivo. Ele não envelhece para o
    // lado errado: quitar dívida deixa a lista MENOR, e o `toBeLessThanOrEqual`
    // aceita. Só cresce se alguém acrescentar entrada — que é exatamente o
    // movimento que esta catraca existe para tornar difícil.
    expect(Object.keys(DIVIDA_CONHECIDA).length).toBeLessThanOrEqual(3);
  });
});

describe("a receita de regenerar existe e é achável", () => {
  it("a documentação NÃO manda rodar comando que não existe", () => {
    // `pnpm gen:types` foi citado na spec 09 por meses e nunca existiu. Uma
    // receita falsa é pior que nenhuma: quem tenta segui-la conclui que a
    // própria máquina está quebrada, e desiste.
    //
    // ⚠️ A sonda olha SÓ dentro de bloco de código. A primeira versão varria a
    // prosa inteira atrás de qualquer `pnpm x` entre crases — e ficou vermelha
    // na frase que EXPLICA que o comando não existe. Medir menção não é medir
    // instrução: um documento tem todo o direito de nomear um comando para
    // dizer que ele não existe, e é exatamente isso que a spec faz hoje.
    // (Terceira vez que uma sonda por texto me engana pelo mesmo motivo neste
    // repositório — as outras duas estão registradas em
    // `tests/unit/lead-diz-por-onde-entrou.test.ts`.)
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const spec = readFileSync("docs/specs/09-spec-frontend-backend-integration.md", "utf8");

    const blocos = [...spec.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]!).join("\n");
    const mandados = [...blocos.matchAll(/^\s*(?:pnpm|npm run) ([a-z:-]+)/gm)].map((m) => m[1]!);
    const inexistentes = [...new Set(mandados)].filter((s) => !(s in pkg.scripts));

    expect(
      inexistentes,
      `a spec 09 manda rodar comando(s) que o package.json não tem: ${inexistentes.join(", ")}`,
    ).toEqual([]);
  });
});
