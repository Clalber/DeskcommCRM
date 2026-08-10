import { describe, expect, it } from "vitest";

import { descreveEspera, leituraDoPlano } from "./plano-de-tempo";

describe("leituraDoPlano", () => {
  it("lê o contrato do timing_plan", () => {
    const plano = leituraDoPlano({
      decidido_em: "2026-08-10T10:00:00.000Z",
      modelo: "anthropic/claude-sonnet-4-6",
      esperas: {
        "wait-1": {
          escolhido_ms: 14_400_000,
          min_ms: 3_600_000,
          max_ms: 14_400_000,
          clampado: true,
          motivo: "o cliente pediu para retomar depois do almoço",
        },
      },
    });
    expect(plano?.esperas["wait-1"]?.clampado).toBe(true);
    expect(plano?.modelo).toBe("anthropic/claude-sonnet-4-6");
  });

  it("sem plano NÃO inventa placeholder — fluxo v1 e espera fixa não mostram bloco", () => {
    expect(leituraDoPlano(null)).toBeNull();
    expect(leituraDoPlano({})).toBeNull();
    expect(leituraDoPlano({ esperas: {} })).toBeNull();
  });

  it("espera sem os números que a tela promete é DESCARTADA, não exibida pela metade", () => {
    const plano = leituraDoPlano({
      esperas: {
        bom: { escolhido_ms: 1, min_ms: 0, max_ms: 2, clampado: false, motivo: "ok" },
        capenga: { escolhido_ms: 1, motivo: "faltam min/max" },
      },
    });
    expect(Object.keys(plano?.esperas ?? {})).toEqual(["bom"]);
  });

  it("motivo ausente vira frase honesta, porque o bloco existe para explicar", () => {
    const plano = leituraDoPlano({
      esperas: { w: { escolhido_ms: 1, min_ms: 0, max_ms: 2, clampado: false } },
    });
    expect(plano?.esperas.w?.motivo).toBe("sem motivo registrado");
  });
});

describe("descreveEspera", () => {
  it("diz o escolhido, o limite configurado e o porquê — as três coisas que o operador pergunta", () => {
    const d = descreveEspera({
      escolhido_ms: 14_400_000,
      min_ms: 3_600_000,
      max_ms: 14_400_000,
      clampado: true,
      motivo: "o cliente pediu para retomar depois do almoço",
    });
    expect(d.escolhido).toBe("4 horas");
    expect(d.faixa).toBe("seu limite: de 1 hora a 4 horas");
    expect(d.motivo).toBe("o cliente pediu para retomar depois do almoço");
  });
});
