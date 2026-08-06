import { describe, expect, it } from "vitest";

import {
  formatarDuracao,
  formatarMedida,
  montarPares,
  razao,
  taxaDeAutomacao,
  taxaDeContorno,
  vetosPorExecucao,
  type AtritoRaw,
} from "@/lib/metrics/atrito";

/**
 * O GATE DA REGRA 3.3 — toda eficiência publicada com sua contra-métrica.
 *
 * A doutrina (`docs/doctrine/sistema-vivo/03-medida-do-proposito.md` §3.3) diz:
 * "toda medida que empurra o sistema a fazer mais de alguma coisa vem
 * acompanhada da medida que denuncia o custo dessa coisa. Publicadas juntas,
 * nunca separadas — separadas, a de eficiência vence sempre, porque é a que
 * sobe."
 *
 * Isso é enumerável a partir do código, então é teste e não hábito (cap. 8.4).
 * Sem ele, a regra seria um comentário pedindo cuidado — e a próxima métrica de
 * eficiência entraria sozinha, porque é a mais fácil de coletar e a que todo
 * mundo pede.
 *
 * O segundo bloco guarda o ZERO LISONJEIRO: denominador vazio devolve `null`,
 * nunca `0`. Um `0` aqui viraria "0% de contorno" numa org sem nenhum envio —
 * exatamente a frase tranquilizadora que a ausência de medição não autoriza.
 */

/** Fixture com números distintos por campo — troca de campo não passa batida. */
const RAW: AtritoRaw = {
  escopo: { demandas: 40, de: "2026-07-01T00:00:00Z", ate: "2026-08-01T00:00:00Z" },
  cliente: {
    turnos_p50: 7,
    turnos_p90: 21,
    insistencia_media: 2.5,
    insistencia_max: 6,
    pedidos_de_humano: 11,
    descadastros: 3,
  },
  empresa: {
    intervencoes_por_demanda: 1.4,
    espera_humana_p50_s: 900,
    espera_humana_p90_s: 7200,
    retrabalho: 5,
    vetos: 18,
    execucoes_medidas: 120,
    envios_por_ia: 600,
    envios_humano_no_sistema: 300,
    envios_humano_fora: 100,
  },
  eficiencia: { ganhos: 12, perdidos: 8 },
};

describe("regra 3.3 — nenhuma eficiência é publicada sozinha", () => {
  const pares = montarPares(RAW);

  it("existe pelo menos um par (senão o gate é vácuo)", () => {
    expect(pares.length).toBeGreaterThan(0);
  });

  it.each(montarPares(RAW).map((p) => [p.chave, p] as const))(
    "par %s tem eficiência e ao menos um dano",
    (_chave, par) => {
      expect(par.eficiencia).toBeDefined();
      expect(par.eficiencia.rotulo.length).toBeGreaterThan(0);
      expect(par.danos.length).toBeGreaterThanOrEqual(1);
      for (const d of par.danos) {
        expect(d.rotulo.length).toBeGreaterThan(0);
      }
    },
  );

  it("as chaves dos pares são únicas — dois pares com a mesma chave some na tela", () => {
    const chaves = pares.map((p) => p.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("cobre as quatro frentes da Fase 1 da spec 16", () => {
    expect(pares.map((p) => p.chave).sort()).toEqual(
      ["automacao", "contencao", "conversao", "custo_humano"].sort(),
    );
  });

  it("a insistência do agente é publicada — é o defeito que motivou a spec", () => {
    // Um agente que insiste 6x converte mais e queima relacionamento; nos
    // painéis antigos ele era o melhor da org. Se esta medida sair do par de
    // conversão, o defeito volta em silêncio.
    const conversao = pares.find((p) => p.chave === "conversao");
    expect(conversao?.danos.map((d) => d.chave)).toContain("insistencia_media");
  });

  it("a taxa de contorno é publicada — mede a ferramenta sendo evitada", () => {
    const automacao = pares.find((p) => p.chave === "automacao");
    expect(automacao?.danos.map((d) => d.chave)).toContain("taxa_de_contorno");
  });
});

describe("zero lisonjeiro — ausência de dado é null, nunca 0", () => {
  it("razao devolve null quando o denominador é zero", () => {
    expect(razao(0, 0)).toBeNull();
    expect(razao(5, 0)).toBeNull();
  });

  it("razao devolve null para entrada não-finita", () => {
    expect(razao(Number.NaN, 10)).toBeNull();
    expect(razao(10, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("org sem nenhum envio não reporta '0% de contorno'", () => {
    const vazio = {
      ...RAW.empresa,
      envios_por_ia: 0,
      envios_humano_no_sistema: 0,
      envios_humano_fora: 0,
    };
    expect(taxaDeContorno(vazio)).toBeNull();
    expect(taxaDeAutomacao(vazio)).toBeNull();
    expect(formatarMedida({ chave: "x", rotulo: "x", valor: null, unidade: "razao" })).toBe("—");
  });

  it("org sem execução medida não reporta '0 vetos por execução'", () => {
    expect(vetosPorExecucao({ ...RAW.empresa, vetos: 0, execucoes_medidas: 0 })).toBeNull();
  });
});

describe("cálculos derivados", () => {
  it("taxa de contorno é sobre as respostas HUMANAS, não sobre o total", () => {
    // 100 fora / (300 no sistema + 100 fora) = 25%. Se o denominador incluísse
    // os 600 da IA, daria 10% e faria o contorno parecer pequeno.
    expect(taxaDeContorno(RAW.empresa)).toBeCloseTo(0.25, 6);
  });

  it("taxa de automação inclui o contorno no denominador", () => {
    // 600 / (600 + 300 + 100) = 60%. Excluir o external_device daria 66,7% —
    // automação inflada numa org onde o time responde pelo celular.
    expect(taxaDeAutomacao(RAW.empresa)).toBeCloseTo(0.6, 6);
    const semContorno = razao(
      RAW.empresa.envios_por_ia,
      RAW.empresa.envios_por_ia + RAW.empresa.envios_humano_no_sistema,
    );
    expect(semContorno).not.toBeCloseTo(taxaDeAutomacao(RAW.empresa)!, 6);
  });

  it("vetos por execução usa as execuções medidas como denominador", () => {
    expect(vetosPorExecucao(RAW.empresa)).toBeCloseTo(18 / 120, 6);
  });
});

describe("formatação", () => {
  it("razão vira percentual", () => {
    expect(formatarMedida({ chave: "x", rotulo: "x", valor: 0.25, unidade: "razao" })).toBe("25.0%");
  });

  it("contagem é inteira", () => {
    expect(formatarMedida({ chave: "x", rotulo: "x", valor: 12, unidade: "contagem" })).toBe("12");
  });

  it("média mantém uma casa — 2.5 retornos não é 3", () => {
    expect(formatarMedida({ chave: "x", rotulo: "x", valor: 2.5, unidade: "media" })).toBe("2.5");
  });

  it.each([
    [45, "45s"],
    [900, "15min"],
    [3600, "1h"],
    [7200, "2h"],
    [5400, "1h 30min"],
  ])("duração de %is é %s", (segundos, esperado) => {
    expect(formatarDuracao(segundos)).toBe(esperado);
  });
});
