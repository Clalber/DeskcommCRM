/**
 * O endereço interno do Supabase não pode vazar para fora.
 *
 * Quando `SUPABASE_INTERNAL_URL` está configurada, o cliente do servidor fala
 * com o banco por dentro da rede — e as URLs assinadas do Storage nascem com o
 * host INTERNO, que o navegador não alcança. Toda URL assinada que SAI daqui
 * (redirect, corpo de resposta, payload de envio de mídia, e-mail de LGPD)
 * precisa passar por `urlPublicaDaAssinatura`.
 *
 * ⚠️ O defeito que este arquivo existe para pegar é MUDO: o link é gerado
 * corretamente e o teste da rota passa; ele só não abre na máquina de quem
 * recebeu. Não há resposta de erro, não há log, não há alerta — a foto
 * simplesmente não carrega, e semanas depois alguém reporta "as imagens sumiram".
 *
 * Por isso a varredura abaixo é por ARQUIVO, e não por confiança: quem
 * acrescentar um `createSignedUrl` novo é reprovado até ligar a conversão.
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let envMock: Record<string, string | undefined> = {};
vi.mock("@/lib/env", () => ({
  get env() {
    return envMock;
  },
}));

import { urlDoSupabaseNoServidor, urlPublicaDaAssinatura } from "@/lib/supabase/enderecos";

const PUBLICA = "https://supabase.exemplo.com.br";
const INTERNA = "http://supabase-envoy:8000";

beforeEach(() => {
  envMock = { NEXT_PUBLIC_SUPABASE_URL: PUBLICA, SUPABASE_INTERNAL_URL: INTERNA };
});

describe("qual endereço o servidor usa", () => {
  it("usa o interno quando ele existe", () => {
    expect(urlDoSupabaseNoServidor()).toBe(INTERNA);
  });

  it("cai na URL pública quando não há interno — o estado de toda instalação atual", () => {
    envMock = { NEXT_PUBLIC_SUPABASE_URL: PUBLICA };
    expect(urlDoSupabaseNoServidor()).toBe(PUBLICA);
  });
});

describe("a variável vazia é ausente, não erro", () => {
  // O `.env.example` declara `SUPABASE_INTERNAL_URL=` em branco. Se o schema
  // tratasse isso como valor, `.url()` reprovaria e NENHUMA instalação que
  // copiasse o exemplo subiria. Aqui a garantia é do lado de quem consome.
  it("string vazia cai na URL pública, sem lançar", () => {
    envMock = { NEXT_PUBLIC_SUPABASE_URL: PUBLICA, SUPABASE_INTERNAL_URL: undefined };
    expect(() => urlDoSupabaseNoServidor()).not.toThrow();
    expect(urlDoSupabaseNoServidor()).toBe(PUBLICA);
  });
});

describe("a URL assinada que sai daqui", () => {
  it("troca o host interno pelo público, preservando caminho, token e query", () => {
    const assinada = `${INTERNA}/storage/v1/object/sign/whatsapp-media/org/x.jpg?token=abc.def&outro=1`;
    expect(urlPublicaDaAssinatura(assinada)).toBe(
      `${PUBLICA}/storage/v1/object/sign/whatsapp-media/org/x.jpg?token=abc.def&outro=1`,
    );
  });

  it("não mexe em URL que já é pública", () => {
    const ja = `${PUBLICA}/storage/v1/object/sign/whatsapp-media/org/x.jpg?token=abc`;
    expect(urlPublicaDaAssinatura(ja)).toBe(ja);
  });

  it("não mexe em host de terceiro — só o interno é reescrito", () => {
    const alheia = "https://cdn.outra-empresa.com/arquivo.jpg?token=abc";
    expect(urlPublicaDaAssinatura(alheia)).toBe(alheia);
  });

  it("sem endereço interno configurado, devolve intacta", () => {
    envMock = { NEXT_PUBLIC_SUPABASE_URL: PUBLICA };
    const url = `${INTERNA}/storage/v1/object/sign/a/b.jpg`;
    expect(urlPublicaDaAssinatura(url)).toBe(url);
  });

  it("não lança em entrada malformada: falhar aqui derrubaria um envio que ia funcionar", () => {
    expect(urlPublicaDaAssinatura("nem-url-isso-e")).toBe("nem-url-isso-e");
    expect(urlPublicaDaAssinatura("")).toBe("");
  });
});

// ─── A VARREDURA ────────────────────────────────────────────────────────────

const RAIZES = ["app", "lib", "workers", "components", "hooks"];

function arquivosDeCodigo(dir: string, achados: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome === ".next") continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeCodigo(caminho, achados);
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

describe("varredura: todo createSignedUrl entrega URL pública", () => {
  it("nenhum arquivo assina sem converter", () => {
    const devedores: string[] = [];

    for (const raiz of RAIZES) {
      for (const arquivo of arquivosDeCodigo(raiz)) {
        const texto = readFileSync(arquivo, "utf-8");
        if (!texto.includes("createSignedUrl")) continue;
        // Com o parêntese: a linha de `import` sozinha NÃO satisfaz. Sem isso,
        // um refactor que perde a CHAMADA e mantém o import passa verde.
        if (!texto.includes("urlPublicaDaAssinatura(")) devedores.push(arquivo);
      }
    }

    expect(
      devedores,
      "Estes arquivos geram URL assinada e NÃO passam por `urlPublicaDaAssinatura` " +
        "(lib/supabase/enderecos.ts). Com `SUPABASE_INTERNAL_URL` configurada, o link " +
        "sai com um host que só existe dentro da rede — e falha em silêncio na mão de " +
        "quem recebeu:\n  " + devedores.join("\n  "),
    ).toEqual([]);
  });

  it("a varredura enxerga alguma coisa — senão ela passa por estar cega", () => {
    const comAssinatura = RAIZES.flatMap((r) => arquivosDeCodigo(r)).filter((a) =>
      readFileSync(a, "utf-8").includes("createSignedUrl"),
    );
    expect(comAssinatura.length).toBeGreaterThan(0);
  });
});
