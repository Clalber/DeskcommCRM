import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { cssDaMarca } from "@/lib/branding/css";
import { derivarMarca } from "@/lib/branding/contraste";
import { GRAUS } from "@/lib/branding/rampa";
import { REGUA_DO_PRODUTO } from "@/lib/branding/regua-do-produto";
import { camadaDoAmbiente, resolverMarca, type CorResolvida } from "@/lib/branding/resolve";

const RAIZ = process.cwd();
const REGUA = REGUA_DO_PRODUTO;

/** A mesma fixture adversarial do teste de contraste, pelo mesmo motivo. */
const SEMENTES = [
  "#0f172a", "#f5c518", "#ffffff", "#000000", "#808080", "#dc2626", "#22c55e",
  "#f59e0b", "#2563eb", "#14b8a6", "#4b0082", "#e11d48", "#7c3aed", "#1a1f36",
  "#fafafa", "#506d48",
] as const;

const corDe = (hex: string): CorResolvida => {
  const cor = resolverMarca([camadaDoAmbiente({ APP_ACCENT_HEX: hex })], REGUA).cor;
  if (!cor) throw new Error(`fixture ${hex} não resolveu — o teste mediria nada`);
  return cor;
};

/** `{ ":root:root": { "--x": "#fff" }, … }` — os blocos lidos de volta do texto. */
function lerBlocos(css: string): Record<string, Record<string, string>> {
  const saida: Record<string, Record<string, string>> = {};
  for (const bruto of css.split("}")) {
    const abre = bruto.indexOf("{");
    if (abre === -1) continue;
    const seletor = bruto.slice(0, abre).trim();
    const decls: Record<string, string> = {};
    for (const linha of bruto.slice(abre + 1).split(";")) {
      const corte = linha.indexOf(":");
      if (corte === -1) continue;
      decls[linha.slice(0, corte).trim()] = linha.slice(corte + 1).trim();
    }
    saida[seletor] = decls;
  }
  return saida;
}

describe("serialização — os dois blocos", () => {
  it("emite `:root:root` e `:root:root[data-theme=\"dark\"]`, nesta forma", () => {
    // A especificidade dobrada é o mecanismo, não estilo: `:root` (0,1,0) e
    // `[data-theme="dark"]` (0,1,0) do globals.css empatariam com um `:root`
    // simples, e aí quem decide é a ORDEM do `<link>` — que difere entre dev
    // (HMR) e produção (standalone). Perder o `:root` duplicado é um bug que só
    // aparece num dos dois ambientes.
    const { css } = cssDaMarca(corDe("#2563eb"));
    expect(Object.keys(lerBlocos(css ?? ""))).toEqual([
      ":root:root",
      ':root:root[data-theme="dark"]',
    ]);
  });

  it("os dois blocos declaram EXATAMENTE o mesmo conjunto de tokens", () => {
    // Um token emitido só no bloco claro venceria, com 0,2,0, o valor escuro do
    // globals.css também no tema escuro: a marca vazaria para o tema errado e a
    // alternância ficaria pela metade.
    for (const hex of SEMENTES) {
      const blocos = lerBlocos(cssDaMarca(corDe(hex)).css ?? "");
      const claro = Object.keys(blocos[":root:root"] ?? {}).sort();
      const escuro = Object.keys(blocos[':root:root[data-theme="dark"]'] ?? {}).sort();
      expect(claro, hex).toEqual(escuro);
      expect(claro.length, hex).toBeGreaterThan(0);
    }
  });

  it("emite a rampa inteira, os papéis do accent e a identidade", () => {
    const blocos = lerBlocos(cssDaMarca(corDe("#2563eb")).css ?? "");
    const claro = blocos[":root:root"] ?? {};
    expect(Object.keys(claro).sort()).toEqual(
      [
        "--color-brand",
        ...GRAUS.map((g) => `--color-accent-${g}`),
        "--color-accent",
        "--color-accent-fg",
        "--color-accent-hover",
        "--color-accent-soft",
      ].sort(),
    );
    expect(claro["--color-brand"]).toBe("#2563eb");
  });

  it("o valor por tema difere — senão a alternância estaria morta", () => {
    // Guarda de vacuidade: dois blocos idênticos passariam em tudo acima e
    // deixariam o tema escuro com a cor do claro.
    const blocos = lerBlocos(cssDaMarca(corDe("#2563eb")).css ?? "");
    expect(blocos[":root:root"]?.["--color-accent"]).not.toBe(
      blocos[':root:root[data-theme="dark"]']?.["--color-accent"],
    );
  });

  it("marca acromática ainda emite `--color-brand`", () => {
    // `derivarMarca` diz, no motivo, que "a cor da marca fica só em
    // --color-brand". Sem emitir o token, esse motivo seria mentira.
    for (const hex of ["#808080", "#ffffff", "#000000"]) {
      const blocos = lerBlocos(cssDaMarca(corDe(hex)).css ?? "");
      expect(blocos[":root:root"]?.["--color-brand"], hex).toBe(hex);
    }
  });

  it("sem cor configurada não injeta nada, e isso não é falha", () => {
    expect(cssDaMarca(null)).toEqual({ css: null, motivos: [] });
  });

  it("semente que não pinta emite só a identidade", () => {
    const cor: CorResolvida = { semente: "#2563eb", papel: "marca", derivada: null };
    const blocos = lerBlocos(cssDaMarca(cor).css ?? "");
    expect(Object.keys(blocos[":root:root"] ?? {})).toEqual(["--color-brand"]);
  });
});

describe("allowlist de FORMA de valor", () => {
  const comSoftForjado = (valor: string): CorResolvida => {
    const derivada = derivarMarca("#506d48", REGUA);
    return {
      semente: "#506d48",
      papel: "accent",
      derivada: { ...derivada, claro: { ...derivada.claro, accentSoft: valor } },
    };
  };

  it.each([
    ["fecha o bloco e injeta regra", "#fff; } body { display: none"],
    ["fecha a tag <style>", "#fff</style><script>x()</script>"],
    ["expressão CSS com url", "url(https://exemplo.invalid/x.png)"],
    ["cor nomeada", "rebeccapurple"],
    ["var com fallback executável", "var(--x, url(javascript:alert(1)))"],
    ["hex com sobra pendurada", "#ff0000 !important"],
    ["comentário que abre e não fecha", "#fff /*"],
  ])("recusa %s, devolvendo null com motivo", (_rotulo, valor) => {
    const { css, motivos } = cssDaMarca(comSoftForjado(valor));
    // `null`, nunca uma string parcial: devolver "o que deu" seria devolver o
    // bloco até o ponto do furo, com o furo dentro.
    expect(css).toBeNull();
    expect(motivos.map((m) => m.codigo)).toContain("valor_fora_da_allowlist");
    expect(motivos.find((m) => m.codigo === "valor_fora_da_allowlist")?.alvo).toBe(
      "--color-accent-soft",
    );
  });

  it("aceita as três formas que o produto de fato emite", () => {
    for (const bom of ["#abc", "#a1b2c3", "rgb(1, 2, 3)", "rgba(130, 160, 119, 0.16)"]) {
      expect(cssDaMarca(comSoftForjado(bom)).css, bom).not.toBeNull();
    }
  });

  it("toda a fixture adversarial serializa, e nada na saída é suspeito", () => {
    // Guarda de vacuidade da allowlist: uma regra que recusasse tudo passaria
    // nos testes de recusa acima e deixaria o produto sem marca nenhuma.
    for (const hex of SEMENTES) {
      const { css, motivos } = cssDaMarca(corDe(hex));
      expect(css, hex).not.toBeNull();
      expect(motivos.map((m) => m.codigo), hex).not.toContain("valor_fora_da_allowlist");
      expect(css ?? "", hex).not.toContain("<");
      expect(css ?? "", hex).not.toContain(";}");
    }
  });
});

describe("o que a derivação move e o CSS ainda não emite", () => {
  it("toda semântica deslocada vira um motivo de não-serialização", () => {
    // O par com rótulo: a derivação DIZ que girou `--color-success`; se o CSS
    // não a emite, o log precisa dizer isso também — senão o motivo descreve um
    // movimento que a tela não faz.
    const cor = corDe("#22c55e");
    const movidas = (cor.derivada?.motivos ?? []).filter(
      (m) => m.codigo === "semantica_deslocada",
    );
    expect(movidas.length).toBeGreaterThan(0);
    const naoEmitidas = cssDaMarca(cor).motivos.filter(
      (m) => m.codigo === "token_nao_serializado",
    );
    expect(naoEmitidas).toHaveLength(movidas.length);
  });
});

describe("guardas de mecanismo", () => {
  it("ninguém escreve a cor com style.setProperty", () => {
    // POR QUE ESTE TESTE EXISTE: `document.documentElement.style.setProperty` é
    // o caminho curto e é uma armadilha — declaração inline vence `:root` E
    // `[data-theme="dark"]` ao mesmo tempo, então o valor de um tema passa a
    // valer nos dois. A alternância continua trocando o atributo, o resto da
    // paleta troca, e só o accent fica preso: quebra sem sintoma visível.
    const alvos = ["lib/branding/css.ts", "lib/branding/resolve.ts", "app/layout.tsx"];
    for (const alvo of alvos) {
      const fonte = fs.readFileSync(path.join(RAIZ, alvo), "utf8");
      const linhas = fonte
        .split("\n")
        .filter((l) => /style\.setProperty/.test(l) && !l.trimStart().startsWith("*"));
      expect(linhas, `${alvo}: ${linhas.join(" | ")}`).toEqual([]);
    }
  });

  it("o layout injeta o bloco no <head>, antes do script de tema", () => {
    // Zero flash depende disso: o bloco é HTML no primeiro byte. Se ele descer
    // para o <body> ou virar efeito de cliente, a tela pinta a cor do produto e
    // troca depois — que é exatamente o que o self-hoster reporta como "piscou".
    const layout = fs.readFileSync(path.join(RAIZ, "app/layout.tsx"), "utf8");
    const head = layout.indexOf("<head>");
    const estilo = layout.indexOf("<EstiloDaMarca />");
    const tema = layout.indexOf("THEME_INIT_SCRIPT }}");
    expect(head).toBeGreaterThan(-1);
    expect(estilo).toBeGreaterThan(head);
    expect(estilo).toBeLessThan(layout.indexOf("</head>"));
    expect(estilo).toBeLessThan(tema);
  });
});
