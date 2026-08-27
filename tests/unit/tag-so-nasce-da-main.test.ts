import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A tag `vX.Y.Z` é o gatilho de atualização do parque instalado inteiro:
 * `hostgator-setup-kit/agent.sh` oferece a MAIOR tag `v*` a toda VPS, e o
 * `update.sh` puxa a imagem por aquele número. Este arquivo vigia as duas
 * propriedades que impedem que ela vire uma porta aberta.
 */
const RAIZ = process.cwd();
const publish = fs.readFileSync(path.join(RAIZ, ".github/workflows/publish-image.yml"), "utf8");
const release = fs.readFileSync(path.join(RAIZ, ".github/workflows/release.yml"), "utf8");

/** As linhas de um job, até o próximo job na mesma indentação. */
function job(yml: string, nome: string): string {
  const linhas = yml.split("\n");
  const i = linhas.findIndex((l) => l === `  ${nome}:`);
  if (i === -1) return "";
  const fim = linhas.findIndex((l, n) => n > i && /^ {2}[a-z-]+:$/.test(l));
  return linhas.slice(i, fim === -1 ? undefined : fim).join("\n");
}

describe("nenhuma tag publica sem estar contida na main", () => {
  it("o job da trava existe", () => {
    expect(job(publish, "a-tag-veio-da-main"), "a trava de procedência sumiu de publish-image.yml").not.toBe("");
  });

  it.each(["build-and-push", "imagem-do-app-sobe"])(
    "%s depende da trava — senão publica antes de ela responder",
    (nome) => {
      expect(job(publish, nome)).toMatch(/needs:\s*\[[^\]]*a-tag-veio-da-main/);
    },
  );

  it("a trava exige `identical` ou `behind` no compare com a main", () => {
    const t = job(publish, "a-tag-veio-da-main");
    expect(t).toContain("compare/main...");
    // `ahead` e `diverged` são commit que a main não tem. Aceitar qualquer um
    // dos dois devolveria a porta que este job fecha.
    expect(t).toMatch(/identical\|behind/);
    expect(t).not.toMatch(/\bahead\|/);
  });

  it("a trava NÃO tem `if:` de job — pulada, ela vira `skipped` e o imagens-ok lê isso como reprovação", () => {
    const t = job(publish, "a-tag-veio-da-main");
    // `if:` de STEP é permitido; o que não pode é o `if:` na altura do job
    // (quatro espaços), que faz o GitHub pular o job inteiro.
    expect(t.split("\n").filter((l) => /^ {4}if:/.test(l))).toEqual([]);
  });
});

describe("a tag nasce no CI, e nunca do GITHUB_TOKEN", () => {
  it("o release usa o token do GitHub App para escrever", () => {
    // Evento disparado com o GITHUB_TOKEN não cria novo workflow run (doc do
    // GitHub). Se a tag nascesse dele, `publish-image.yml` nunca rodaria: a tag
    // existiria, nenhum erro apareceria, e NENHUMA VPS receberia a atualização.
    expect(release).toContain("actions/create-github-app-token");
    expect(release).toContain("secrets.RELEASE_APP_ID");
    expect(release).toContain("secrets.RELEASE_APP_PRIVATE_KEY");
  });

  it("nenhum job do release pede escopo de escrita ao GITHUB_TOKEN", () => {
    const escritas = release
      .split("\n")
      .filter((l) => /^\s+(contents|pull-requests|packages):\s*write\s*$/.test(l));
    expect(escritas, "escrita pelo GITHUB_TOKEN: quem escreve aqui tem que ser o App").toEqual([]);
  });

  it("o corte da tag prova que as imagens saíram — a falha aqui é silenciosa por natureza", () => {
    const t = job(release, "cortar-tag");
    expect(t).toContain("ghcr_status");
    for (const img of ["deskcommcrm", "deskcomm-worker", "deskcomm-scheduler"]) {
      expect(t, `a conferência não cobre ${img}`).toContain(img);
    }
    expect(t).toMatch(/::error::/);
  });

  it("a tag só é criada em push na main, nunca num dispatch de branch qualquer", () => {
    expect(job(release, "cortar-tag")).toMatch(/if:\s*github\.event_name == 'push'/);
    expect(release).toMatch(/push:\s*\n\s*branches:\s*\[main\]/);
  });
});
