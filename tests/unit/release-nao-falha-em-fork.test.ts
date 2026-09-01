/**
 * O CICLO DE RELEASE SALTA NUM FORK — NUNCA FALHA VERMELHO.
 *
 * ─── O problema, medido ─────────────────────────────────────────────────────
 *
 * `release.yml` roda em TODO push na `main`, e a primeira linha dos seus jobs é
 * `actions/create-github-app-token`, que exige `RELEASE_APP_ID` — um segredo do
 * GitHub App do repositório de origem. Todo fork nasce sem ele.
 *
 * Medido num fork em 2026-09-01, nas 100 rodadas mais recentes:
 *
 *     release          12 failure   ← 100% dos pushes na main
 *     ci               13 success
 *     perf             12 success
 *     Publicar imagem  18 success
 *
 * Um e-mail de "workflow failed" por merge, por semanas.
 *
 * ─── Por que isso é mais que incômodo ───────────────────────────────────────
 *
 * Vermelho constante treina quem recebe a NÃO abrir o vermelho. No dia em que a
 * falha for real — o `ci` reprovando, a imagem não publicando —, ela chega na
 * mesma caixa, com a mesma cara, e não é lida. Um alarme que toca sempre é
 * indistinguível de um alarme quebrado.
 *
 * ─── A regra que este arquivo protege ───────────────────────────────────────
 *
 * Todo job de `release.yml` que usa o App depende do sentinela `tem-credencial`
 * e só roda quando ele diz `true`. Sem credencial: SALTO (cinza), não falha.
 * A distinção é a mesma de `checkHealth` nos canais — "não deu para perguntar"
 * não é "está quebrado".
 *
 * O sentinela existe porque o contexto `secrets` NÃO está disponível em
 * `jobs.<id>.if`, só dentro de `steps`. Sem ele, a guarda teria de morar em cada
 * passo — e um job novo nasceria sem ela.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const YAML = readFileSync(".github/workflows/release.yml", "utf8");

/** Os jobs do arquivo, com o corpo de cada um. */
function jobs(): { nome: string; corpo: string }[] {
  const linhas = YAML.split("\n");
  const inicio = linhas.findIndex((l) => /^jobs:/.test(l));
  const achados: { nome: string; corpo: string }[] = [];
  for (let i = inicio + 1; i < linhas.length; i++) {
    const m = /^ {2}([a-z0-9-]+):\s*$/.exec(linhas[i]!);
    if (!m) continue;
    let fim = i + 1;
    while (fim < linhas.length && !/^ {2}[a-z0-9-]+:\s*$/.test(linhas[fim]!)) fim++;
    achados.push({ nome: m[1]!, corpo: linhas.slice(i, fim).join("\n") });
  }
  return achados;
}

describe("release.yml não pode ficar vermelho num fork", () => {
  it("o sentinela existe e lê os DOIS segredos", () => {
    const sentinela = jobs().find((j) => j.nome === "tem-credencial");
    expect(sentinela, "o job sentinela sumiu").toBeDefined();

    // Os dois, não só o id: um App com id e sem chave privada falharia igual,
    // e a guarda passaria dizendo que está tudo certo.
    expect(sentinela!.corpo).toContain("RELEASE_APP_ID");
    expect(sentinela!.corpo).toContain("RELEASE_APP_PRIVATE_KEY");
    expect(sentinela!.corpo).toContain("sim=false");
  });

  it("⚠️ TODO job que usa o App depende do sentinela", () => {
    // A asserção central. Um job novo que chame `create-github-app-token` sem
    // `needs: tem-credencial` reintroduz exatamente o defeito — e a próxima
    // sessão descobriria pelo e-mail, semanas depois.
    const semGuarda = jobs()
      .filter((j) => j.corpo.includes("create-github-app-token"))
      .filter(
        (j) =>
          !j.corpo.includes("needs: tem-credencial") ||
          !j.corpo.includes("needs.tem-credencial.outputs.sim == 'true'"),
      )
      .map((j) => j.nome);

    expect(
      semGuarda,
      `job(s) usando o App sem depender do sentinela: ${semGuarda.join(", ")}.\n` +
        "Sem isso, todo fork volta a receber e-mail de falha em cada push na main.",
    ).toEqual([]);
  });

  it("o sentinela NÃO interpola segredo direto no shell", () => {
    // Segredo interpolado em `run:` vira argumento de processo e vaza em log de
    // erro. Pelo `env:` ele fica na variável, que o runner mascara.
    const sentinela = jobs().find((j) => j.nome === "tem-credencial")!;
    const linhasDeRun = sentinela.corpo
      .split("\n")
      .filter((l) => l.includes("${{ secrets."));

    for (const l of linhasDeRun) {
      expect(l, `segredo fora de um bloco env: ${l.trim()}`).toMatch(/^\s+[A-Z_]+: \$\{\{ secrets\./);
    }
  });

  it("o salto EXPLICA o que fazer — silêncio cinza não ensina ninguém", () => {
    // Um job pulado sem explicação faz quem olha concluir que o release está
    // quebrado. O resumo diz que é esperado num fork e dá o caminho manual.
    const sentinela = jobs().find((j) => j.nome === "tem-credencial")!;
    expect(sentinela.corpo).toContain("GITHUB_STEP_SUMMARY");
    expect(sentinela.corpo).toContain("release:cortar");
  });
});
