import { describe, expect, it } from "vitest";

import {
  nivelExigido,
  proximaVersao,
  type EvidenciaDaRelease,
} from "./nivel-da-versao";

/**
 * A CALIBRAÇÃO — o que separa esta regra de uma opinião.
 *
 * Uma régua de versionamento que ninguém mediu contra a realidade é a mesma
 * coisa que o olho que ela substitui. Então ela é exercitada contra as OITO
 * releases reais do projeto, e o critério de aprovação é duplo:
 *
 *   - **não reprovar as 7 corretas** (senão nasce vermelha, some no ruído e
 *     ninguém mais olha);
 *   - **reprovar a 1 errada** (senão não é instrumento nenhum).
 *
 * A tabela é evidência congelada, não invenção. Para refazê-la do zero:
 *
 * ```bash
 * for t in $(git tag -l 'v*' --sort=creatordate | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$'); do
 *   [ -n "$p" ] && echo "$p → $t  rotas=$(git diff --name-only --diff-filter=A $p..$t | grep -cE '^app/api/.+[/]route[.]ts$')" \
 *     "telas=$(git diff --name-only --diff-filter=A $p..$t | grep -cE '^app/.+[/]page[.]tsx$')" \
 *     "adicionado=$(git show $t:CHANGELOG.md | grep -cE '^### Adicionado$')"
 *   p=$t
 * done
 * ```
 *
 * A v1.4.1 é o defeito medido: PATCH entregue, `### Adicionado` no próprio
 * CHANGELOG dela (três formas novas de conectar o WhatsApp no onboarding), sem
 * rota nem tela nova porque a capacidade entrou em arquivo que já existia.
 */
const CALIBRACAO: Array<{
  de: string;
  ate: string;
  rotas: number;
  telas: number;
  portas: number;
  adicionado: boolean;
  entregue: string;
}> = [
  { de: "v1.0.0", ate: "v1.1.0", rotas: 16, telas: 6, portas: 0, adicionado: true, entregue: "1.1.0" },
  { de: "v1.1.0", ate: "v1.2.0", rotas: 24, telas: 8, portas: 38, adicionado: true, entregue: "1.2.0" },
  { de: "v1.2.0", ate: "v1.2.1", rotas: 0, telas: 0, portas: 0, adicionado: false, entregue: "1.2.1" },
  { de: "v1.2.1", ate: "v1.3.0", rotas: 6, telas: 0, portas: 0, adicionado: false, entregue: "1.3.0" },
  { de: "v1.3.0", ate: "v1.4.0", rotas: 7, telas: 6, portas: 1, adicionado: true, entregue: "1.4.0" },
  { de: "v1.4.0", ate: "v1.4.1", rotas: 0, telas: 0, portas: 0, adicionado: true, entregue: "1.4.1" },
  { de: "v1.4.1", ate: "v1.5.0", rotas: 3, telas: 1, portas: 0, adicionado: true, entregue: "1.5.0" },
  { de: "v1.5.0", ate: "v1.6.0", rotas: 0, telas: 0, portas: 0, adicionado: true, entregue: "1.6.0" },
];

/** Monta a evidência sintética a partir de uma linha da calibração. */
function evidenciaDe(l: (typeof CALIBRACAO)[number]): EvidenciaDaRelease {
  return {
    arquivosNovos: [
      ...Array.from({ length: l.rotas }, (_, i) => `app/api/v1/x${i}/route.ts`),
      ...Array.from({ length: l.telas }, (_, i) => `app/app/x${i}/page.tsx`),
    ],
    portasNovas: l.portas,
    secaoDoChangelog: l.adicionado ? "### Adicionado\n\n- coisa nova\n" : "### Corrigido\n\n- conserto\n",
  };
}

describe("nivelExigido — calibração contra as 8 releases reais", () => {
  it("as SETE releases com número correto passam — a régua não nasce vermelha", () => {
    const falsosPositivos: string[] = [];
    for (const l of CALIBRACAO) {
      if (l.ate === "v1.4.1") continue; // a errada, medida no caso abaixo
      const exigido = proximaVersao(l.de, nivelExigido(evidenciaDe(l)).nivel);
      if (exigido !== l.entregue) falsosPositivos.push(`${l.ate}: exigiu ${exigido}, foi entregue ${l.entregue}`);
    }
    expect(
      falsosPositivos,
      "a régua reprovou release que estava certa — catraca que nasce vermelha é catraca que ninguém respeita",
    ).toEqual([]);
  });

  it("a v1.4.1 é REPROVADA: saiu PATCH e o conteúdo pedia MINOR", () => {
    const l = CALIBRACAO.find((c) => c.ate === "v1.4.1")!;
    const v = nivelExigido(evidenciaDe(l));
    expect(v.nivel).toBe("minor");
    expect(proximaVersao(l.de, v.nivel)).toBe("1.5.0");
    expect(l.entregue, "se isto mudar, a calibração perdeu o único caso positivo").toBe("1.4.1");
  });

  it("CONTROLE: sem capacidade nenhuma o veredito é patch, senão tudo seria minor", () => {
    const v = nivelExigido({ arquivosNovos: [], portasNovas: 0, secaoDoChangelog: "### Corrigido\n- x\n" });
    expect(v.nivel).toBe("patch");
  });
});

describe("nivelExigido — as duas fontes se cobrem", () => {
  it("estrutura sozinha basta: rota nova sem `### Adicionado` já é minor (o caso da v1.3.0)", () => {
    const v = nivelExigido({
      arquivosNovos: ["app/api/v1/channels/partner/route.ts"],
      portasNovas: 0,
      secaoDoChangelog: "### Corrigido\n\n- conserto\n",
    });
    expect(v.nivel).toBe("minor");
    expect(v.discordancias.join(" "), "a divergência prosa×código precisa ser DITA").toContain("não a anunciam");
  });

  it("`### Adicionado` sozinho basta: capacidade em arquivo existente (o caso da v1.4.1/v1.6.0)", () => {
    const v = nivelExigido({
      arquivosNovos: [],
      portasNovas: 0,
      secaoDoChangelog: "### Adicionado\n\n- três formas de conectar\n",
    });
    expect(v.nivel).toBe("minor");
    expect(v.discordancias, "isto NÃO é defeito — não pode virar ruído").toEqual([]);
  });

  it("porta nova na navegação conta como capacidade, mesmo sem rota nem tela", () => {
    const v = nivelExigido({ arquivosNovos: [], portasNovas: 1, secaoDoChangelog: "### Corrigido\n- x\n" });
    expect(v.nivel).toBe("minor");
  });
});

describe("nivelExigido — o MAJOR se declara", () => {
  const COM_AVISO = "### ⚠️ Requer atenção\n\n**Promova a pessoa a administrador antes de atualizar.**\n";

  it("bloco de atenção SEM o marcador vira pendência — a pergunta que a v1.2.1 nunca fez", () => {
    const v = nivelExigido({ arquivosNovos: [], portasNovas: 0, secaoDoChangelog: COM_AVISO });
    expect(v.pendencias.length, "seguiu sem responder se o operador precisa agir").toBeGreaterThan(0);
    expect(v.pendencias.join(" ")).toContain("exige-acao-do-operador");
  });

  it("`exige-acao-do-operador: sim` promove a MAJOR", () => {
    const v = nivelExigido({
      arquivosNovos: [],
      portasNovas: 0,
      secaoDoChangelog: `${COM_AVISO}\n<!-- exige-acao-do-operador: sim -->\n`,
    });
    expect(v.nivel).toBe("major");
    expect(v.pendencias).toEqual([]);
  });

  it("CONTROLE: `nao` NÃO promove — senão todo aviso viraria major e a régua morre", () => {
    const v = nivelExigido({
      arquivosNovos: [],
      portasNovas: 0,
      secaoDoChangelog: `${COM_AVISO}\n<!-- exige-acao-do-operador: nao -->\n`,
    });
    expect(v.nivel).toBe("patch");
    expect(v.pendencias).toEqual([]);
  });

  it("o major vence o minor quando os dois se aplicam", () => {
    const v = nivelExigido({
      arquivosNovos: ["app/api/v1/x/route.ts"],
      portasNovas: 0,
      secaoDoChangelog: `### Adicionado\n- x\n${COM_AVISO}\n<!-- exige-acao-do-operador: sim -->\n`,
    });
    expect(v.nivel).toBe("major");
  });
});

describe("proximaVersao", () => {
  it("aplica cada nível no segmento certo", () => {
    expect(proximaVersao("1.6.0", "patch")).toBe("1.6.1");
    expect(proximaVersao("1.6.0", "minor")).toBe("1.7.0");
    expect(proximaVersao("1.6.0", "major")).toBe("2.0.0");
    expect(proximaVersao("v1.6.3", "minor"), "aceita o `v`").toBe("1.7.0");
    expect(proximaVersao("1.6.3", "major"), "major zera menor E correção").toBe("2.0.0");
  });

  it("recusa versão ilegível em vez de inventar um número", () => {
    expect(() => proximaVersao("stable", "patch")).toThrow(/ilegível/);
  });
});
