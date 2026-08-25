import { describe, expect, it } from "vitest";
import {
  avaliarDesqualificacao,
  avaliarRevisaoHumana,
  classificarLeadInicial,
  type EntradaClassificacaoInicial,
} from "@/lib/leads/classificacao-inicial";

function base(overrides: Partial<EntradaClassificacaoInicial> = {}): EntradaClassificacaoInicial {
  return {
    customFields: { viable_investment_range: "De R$ 4 mil a R$ 7 mil por mês" },
    phoneNormalizado: "+5515988887777",
    consentGranted: true,
    contatoExistente: null,
    nomeDoEnvio: "Maria Exemplo",
    ...overrides,
  };
}

describe("avaliarDesqualificacao — os 3 motivos exatos", () => {
  it("'Ainda não posso investir' (exato, case-insensitive) desqualifica", () => {
    const r = avaliarDesqualificacao(
      base({ customFields: { viable_investment_range: "Ainda Não Posso Investir" } }),
    );
    expect(r).toBe("sem_capacidade_de_investimento");
  });

  it("frase parecida mas não exata NÃO desqualifica por esse motivo", () => {
    const r = avaliarDesqualificacao(
      base({ customFields: { viable_investment_range: "Ainda não posso investir muito, mas quero começar" } }),
    );
    expect(r).not.toBe("sem_capacidade_de_investimento");
  });

  it("telefone ausente (null) desqualifica: contato_invalido", () => {
    const r = avaliarDesqualificacao(base({ phoneNormalizado: null }));
    expect(r).toBe("contato_invalido");
  });

  it("consentimento não concedido desqualifica: sem_consentimento", () => {
    const r = avaliarDesqualificacao(base({ consentGranted: false }));
    expect(r).toBe("sem_consentimento");
  });

  it("tudo em ordem: não desqualifica", () => {
    expect(avaliarDesqualificacao(base())).toBeNull();
  });

  it("ordem: capacidade de investimento vence sobre telefone/consentimento simultaneamente ruins", () => {
    const r = avaliarDesqualificacao(
      base({
        customFields: { viable_investment_range: "Ainda não posso investir" },
        phoneNormalizado: null,
        consentGranted: false,
      }),
    );
    expect(r).toBe("sem_capacidade_de_investimento");
  });
});

describe("avaliarRevisaoHumana — conflito de identidade", () => {
  it("contato novo (sem existente): nunca conflita", () => {
    expect(avaliarRevisaoHumana(base({ contatoExistente: null }))).toBeNull();
  });

  it("nome do envio bate com o nome existente: sem conflito", () => {
    const r = avaliarRevisaoHumana(
      base({ contatoExistente: { name: "Maria Exemplo" }, nomeDoEnvio: "maria exemplo" }),
    );
    expect(r).toBeNull();
  });

  it("nome do envio diverge do nome existente: conflito_de_identidade", () => {
    const r = avaliarRevisaoHumana(
      base({ contatoExistente: { name: "João Existente" }, nomeDoEnvio: "Maria Exemplo" }),
    );
    expect(r).toBe("conflito_de_identidade");
  });

  it("um dos nomes ausente: sem dado suficiente pra afirmar conflito", () => {
    const r = avaliarRevisaoHumana(base({ contatoExistente: { name: null }, nomeDoEnvio: "Maria Exemplo" }));
    expect(r).toBeNull();
  });
});

describe("classificarLeadInicial — orquestração", () => {
  it("desqualificação vence sobre revisão humana e sobre classe", () => {
    const r = classificarLeadInicial(
      base({
        consentGranted: false,
        contatoExistente: { name: "Outro Nome" },
      }),
    );
    expect(r).toEqual({ status: "desqualificado", motivo: "sem_consentimento" });
  });

  it("revisão humana vence sobre classe quando não há desqualificação", () => {
    const r = classificarLeadInicial(base({ contatoExistente: { name: "Outro Nome" } }));
    expect(r).toEqual({ status: "revisao_humana", motivo: "conflito_de_identidade" });
  });

  it("sem config numérica (CONFIG_CLASSIFICACAO_INICIAL null): nao_avaliado, nunca uma classe adivinhada", () => {
    const r = classificarLeadInicial(base());
    expect(r.status).toBe("classificado");
    if (r.status === "classificado") {
      expect(r.classe).toBe("nao_avaliado");
      expect(r.percentual).toBeNull();
    }
  });

  it("sem config, mesmo com respondi_score presente: ainda nao_avaliado (documenta a pendência, não o valor)", () => {
    const r = classificarLeadInicial(
      base({ customFields: { viable_investment_range: "De R$ 4 mil a R$ 7 mil por mês", respondi_score: "90" } }),
    );
    expect(r).toEqual({ status: "classificado", classe: "nao_avaliado", percentual: null });
  });
});
