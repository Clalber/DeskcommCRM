/**
 * A sequência de migrations é um recurso COMPARTILHADO que o git não protege.
 *
 * Duas branches podem criar `<timestamp>_0100_<slug-a>.sql` e
 * `<timestamp>_0100_<slug-b>.sql`: nomes de arquivo diferentes, então o merge passa
 * limpo e a duplicata nasce em silêncio. O único sinal é o conflito no MANIFEST — e é
 * lá que alguém resolve escolhendo um lado e apaga a linha da outra migration. Duas
 * falhas silenciosas empilhadas, e aconteceu três vezes neste repo antes deste arquivo
 * existir.
 *
 * DÍVIDA CONGELADA, e não main vermelha: ao escrever isto, o repo JÁ tinha 1 número e 4
 * timestamps repetidos, e 3 divergências entre MANIFEST e arquivos. Reprovar tudo faria
 * a `main` nascer vermelha, e gate que nasce vermelho é gate que alguém desliga na
 * primeira urgência — aí se perde a catraca inteira em vez de ganhar. Então a dívida
 * existente está listada abaixo, item a item, e o que reprova é o item NOVO. Mesma
 * mecânica do `lint:channels` ("N arquivos de dívida conhecida, nenhum novo").
 *
 * Roda em `test:unit` (gate `verify`) e não em `tests/invariants/` de propósito: a
 * checagem é de NOME DE ARQUIVO, não de schema, então não precisa de Postgres e cabe no
 * gate barato, que é o que roda em todo push.
 *
 * O que ele NÃO cobre, dito aqui para ninguém confiar demais: dois PRs abertos ao mesmo
 * tempo, cada um com um número livre na SUA base, que só colidem depois do primeiro
 * merge. Isso só o CI rodando contra a `main` já mergeada pega — e ele roda.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const DIR_MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const MANIFEST = join(DIR_MIGRATIONS, "MANIFEST.md");

/** `<timestamp>_<NNNN>_<slug>.sql` — o padrão que o CLAUDE.md fixa. */
const PADRAO_ARQUIVO = /^(\d+)_(\d{4})_(.+)\.sql$/;
/** `| \`<timestamp>\` | \`<NNNN>_<slug>\` | <descrição> |` na tabela "Applied". */
const LINHA_MANIFEST = /^\|\s*`(\d+)`\s*\|\s*`(\d{4})_([^`]+)`\s*\|/;

/**
 * A única migration anterior à convenção. Nomeada uma a uma de propósito: afrouxar o
 * PADRAO_ARQUIVO para acomodá-la deixaria passar também qualquer arquivo novo torto,
 * que é metade do que este arquivo existe para pegar. Ela também não tem linha no
 * MANIFEST — a tabela "Applied" começa depois dela.
 */
const LEGADAS = new Set(["00001_initial_schema.sql"]);

/** Números que já estavam repetidos. Não crie mais; para tirar daqui, renumere. */
const NUMEROS_REPETIDOS_CONHECIDOS = new Set(["0068"]);

/**
 * Timestamps repetidos herdados. Menos grave que número repetido — não quebra a
 * identidade da migration —, mas deixa a ORDEM de aplicação decidida pelo desempate do
 * runner, e é a ordem que diz qual DDL roda antes num banco novo.
 */
const TIMESTAMPS_REPETIDOS_CONHECIDOS = new Set([
  "20260717190000",
  "20260718160000",
  "20260721120000",
  "20260722160000",
]);

/** Divergências MANIFEST↔arquivos herdadas, nos dois sentidos. */
const MANIFEST_SEM_ARQUIVO_CONHECIDO = new Set([
  "20260428000000_0016_lgpd_emergency_scope.sql",
]);
const ARQUIVO_SEM_MANIFEST_CONHECIDO = new Set([
  "20260429070000_0013_ai_faq_items.sql",
  "20260429130000_0021_incidents.sql",
]);

type Migration = { arquivo: string; timestamp: string; numero: string; slug: string };

function migrations(): Migration[] {
  return readdirSync(DIR_MIGRATIONS)
    .filter((f) => f.endsWith(".sql") && !LEGADAS.has(f))
    .sort()
    .map((arquivo) => {
      const m = PADRAO_ARQUIVO.exec(arquivo);
      if (!m) {
        throw new Error(
          `migration fora do padrão <timestamp>_<NNNN>_<slug>.sql: ${arquivo}`,
        );
      }
      return { arquivo, timestamp: m[1]!, numero: m[2]!, slug: m[3]! };
    });
}

function repetidos(itens: Migration[], chave: (m: Migration) => string): Map<string, Migration[]> {
  const por = new Map<string, Migration[]>();
  for (const item of itens) {
    const k = chave(item);
    por.set(k, [...(por.get(k) ?? []), item]);
  }
  return new Map([...por].filter(([, v]) => v.length > 1));
}

function descreve(colisoes: Map<string, Migration[]>, chaves: Set<string>): string[] {
  return [...colisoes]
    .filter(([k]) => !chaves.has(k))
    .map(([k, ms]) => `${k}: ${ms.map((m) => m.arquivo).join(" + ")}`);
}

describe("sequência de migrations", () => {
  // Guarda de vacuidade: sem ela, um diretório vazio (ou um regex que parou de casar)
  // faz TODOS os casos abaixo passarem sem medir nada — verde de instrumento morto.
  it("o diretório tem migrations para medir", () => {
    const todas = migrations();
    expect(todas.length).toBeGreaterThan(50);
    expect(todas.every((m) => /^\d{4}$/.test(m.numero))).toBe(true);
  });

  it("nenhum número NNNN novo se repete", () => {
    expect(
      descreve(repetidos(migrations(), (m) => m.numero), NUMEROS_REPETIDOS_CONHECIDOS),
    ).toEqual([]);
  });

  // Regra SEPARADA da anterior de propósito: número repetido quebra a IDENTIDADE da
  // migration; timestamp repetido quebra a ORDEM de aplicação. Sintomas diferentes,
  // sabotagens diferentes — juntas, uma passaria de carona no vermelho da outra.
  it("nenhum timestamp novo se repete", () => {
    expect(
      descreve(repetidos(migrations(), (m) => m.timestamp), TIMESTAMPS_REPETIDOS_CONHECIDOS),
    ).toEqual([]);
  });

  it("MANIFEST e arquivos correspondem 1:1", () => {
    const doManifest = readFileSync(MANIFEST, "utf8")
      .split("\n")
      .map((l) => LINHA_MANIFEST.exec(l))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => `${m[1]}_${m[2]}_${m[3]}.sql`);

    // Vacuidade de novo: se o regex parar de casar (a tabela mudou de forma), a
    // comparação viraria "vazio contra vazio" e passaria verde sem ter lido nada.
    expect(doManifest.length).toBeGreaterThan(50);

    const arquivos = new Set(migrations().map((m) => m.arquivo));
    const declaradas = new Set(doManifest);

    expect(
      doManifest.filter((f) => !arquivos.has(f) && !MANIFEST_SEM_ARQUIVO_CONHECIDO.has(f)),
    ).toEqual([]);
    expect(
      [...arquivos].filter((f) => !declaradas.has(f) && !ARQUIVO_SEM_MANIFEST_CONHECIDO.has(f)),
    ).toEqual([]);
  });

  // Sem isto a lista de dívida vira ficção: alguém conserta uma colisão, a entrada fica,
  // e o próximo lê "dívida conhecida" para um problema que não existe mais — perdendo a
  // única informação que a lista carrega, que é o tamanho real do buraco.
  it("a dívida congelada ainda existe (lista honesta)", () => {
    const todas = migrations();
    const nums = repetidos(todas, (m) => m.numero);
    const times = repetidos(todas, (m) => m.timestamp);
    const arquivos = new Set(todas.map((m) => m.arquivo));

    expect([...NUMEROS_REPETIDOS_CONHECIDOS].filter((n) => !nums.has(n))).toEqual([]);
    expect([...TIMESTAMPS_REPETIDOS_CONHECIDOS].filter((t) => !times.has(t))).toEqual([]);
    expect([...ARQUIVO_SEM_MANIFEST_CONHECIDO].filter((f) => !arquivos.has(f))).toEqual([]);
  });
});
