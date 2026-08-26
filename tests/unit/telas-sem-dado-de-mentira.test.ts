/**
 * NENHUMA TELA ALCANÇÁVEL É ALIMENTADA POR DADO DE MENTIRA.
 *
 * ## O defeito, e por que ele é pior do que soa
 *
 * A tela da Agenda (`app/app/agenda/_client.tsx`) nasceu importando
 * `components/agenda/dados-de-mentira` — deliberadamente, porque a API ainda não
 * existia e o maestro autorizou começar pelo que não depende do banco. O
 * problema não era existir; era estar ALCANÇÁVEL: a rota tinha porta no
 * `lib/navigation/registry.ts`, e nada — nenhuma flag, nenhum "em breve",
 * nenhum `disabled` — a escondia.
 *
 * O que transforma isso de sujeira em risco é o FORMATO do dado. Os nomes são
 * plausíveis: "Ana Prado", "Marina Alves", "Família Souza", "Visita ao imóvel"
 * — brasileiros, críveis, nos nichos que este produto atende.
 *
 * **Num produto multi-tenant, dado falso plausível é indistinguível de
 * vazamento.** O relato que chega não é "tem dado de teste na tela"; é "estou
 * vendo paciente de outra clínica na minha agenda". E aí o time queima horas
 * caçando um furo de RLS que não existe, enquanto o cliente perde a confiança
 * na única propriedade que um CRM multi-tenant precisa ter.
 *
 * Achado do QAVivo na revisão da Wave 1; decisão 18 do maestro.
 *
 * ## A inversão que este teste NÃO deve apagar
 *
 * O mesmo dado plausível é ACERTO na vitrine (`app/vitrine-agenda`): é ele que
 * faz o desenho ser julgável — uma grade com "Fulano 1" e "Evento 2" não deixa
 * ninguém avaliar densidade, truncamento ou contraste de verdade. Mesmo dado,
 * valor oposto conforme onde está pendurado.
 *
 * Por isso o escopo é `app/app/**` (a área do tenant, atrás da navegação) e
 * NÃO o repositório inteiro.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const AREA_DO_TENANT = path.join(RAIZ, "app/app");

/**
 * Módulos que só existem para alimentar tela sem banco. `mock`/`stub` entram
 * porque são o nome que a próxima pessoa vai usar quando `dados-de-mentira`
 * estiver vigiado — o gate tem de mirar na categoria, não no nome de hoje.
 */
const PROIBIDOS = /(dados-de-mentira|fixtures?|mock|stub|dados-falsos|seed-de-tela)/i;

/**
 * Exceção precisa de MOTIVO ESCRITO, e o teste cobra o motivo — allowlist sem
 * razão vira depósito, e depósito não é exceção, é a regra desmontada.
 */
const PERMITIDOS: Record<string, string> = {};

function arquivosDeTela(dir: string): string[] {
  const achados: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = path.join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      achados.push(...arquivosDeTela(completo));
    } else if (/\.tsx?$/.test(entrada)) {
      achados.push(completo);
    }
  }
  return achados;
}

/** Só o que é IMPORT — a palavra num comentário explicando a regra não conta. */
function importesDe(fonte: string): string[] {
  const alvos: string[] = [];
  const re = /(?:import[^"']*from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte)) !== null) alvos.push(m[1]!);
  return alvos;
}

describe("tela alcançável não come dado de mentira", () => {
  const arquivos = arquivosDeTela(AREA_DO_TENANT);

  it("a varredura enxerga a área do tenant (senão o verde não vale nada)", () => {
    // Um gate que varre zero arquivo passa sempre. Este número existe para a
    // suíte ficar vermelha se alguém mover `app/app/` e o teste continuar
    // "verde" varrendo o vazio.
    expect(arquivos.length).toBeGreaterThan(50);
  });

  it("nenhum arquivo de `app/app/**` importa fixture de tela", () => {
    const infratores: string[] = [];
    for (const arquivo of arquivos) {
      const relativo = path.relative(RAIZ, arquivo);
      if (PERMITIDOS[relativo]) continue;
      const proibidos = importesDe(readFileSync(arquivo, "utf8")).filter((i) => PROIBIDOS.test(i));
      if (proibidos.length > 0) infratores.push(`${relativo} → ${proibidos.join(", ")}`);
    }
    expect(
      infratores,
      "Tela do tenant alimentada por dado de mentira. Num produto multi-tenant, " +
        "dado falso PLAUSÍVEL é indistinguível de vazamento — o relato que chega é " +
        '"estou vendo paciente de outra clínica na minha agenda". Caia no estado ' +
        "vazio até a API existir, ou tire a porta do registry com justificativa.",
    ).toEqual([]);
  });

  it("toda exceção explica o porquê", () => {
    for (const [rota, motivo] of Object.entries(PERMITIDOS)) {
      expect(motivo.length, `${rota} está na allowlist sem motivo escrito`).toBeGreaterThan(30);
    }
  });
});
