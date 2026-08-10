import { describe, expect, it } from "vitest";

import {
  descreveEvento,
  duracaoLegivel,
  refDoNo,
  resumoDoNo,
  rotuloDaAresta,
  rotuloDoStatus,
  type NoDoDossie,
} from "./eventos-legiveis";
import type { FlowNode } from "./graph-schema";

const espera: FlowNode = {
  id: "wait-1",
  type: "wait",
  label: "Deixa esfriar",
  position: { x: 0, y: 0 },
  config: { mode: "fixed", duration_ms: 14_400_000 },
};

const nos: Record<string, NoDoDossie> = {
  "wait-1": resumoDoNo(espera),
  "action-1": resumoDoNo({
    id: "action-1",
    type: "action",
    label: "Primeira cutucada",
    position: { x: 0, y: 0 },
    config: { mode: "ai_message", prompt_hint: "lembre do orçamento enviado" },
  }),
};

function evento(over: Partial<Parameters<typeof descreveEvento>[0]> = {}) {
  return {
    id: "e1",
    node_id: "wait-1",
    event_type: "wait_started",
    payload: {} as Record<string, unknown>,
    created_at: "2026-08-10T12:00:00.000Z",
    ...over,
  };
}

describe("duracaoLegivel", () => {
  it("fala em minutos, horas e dias — a unidade que a pessoa usaria", () => {
    expect(duracaoLegivel(1_800_000)).toBe("30 minutos");
    expect(duracaoLegivel(3_600_000)).toBe("1 hora");
    expect(duracaoLegivel(14_400_000)).toBe("4 horas");
    expect(duracaoLegivel(172_800_000)).toBe("2 dias");
  });

  it("valor impossível não vira número esquisito na tela", () => {
    expect(duracaoLegivel(Number.NaN)).toBe("tempo indefinido");
    expect(duracaoLegivel(-1)).toBe("tempo indefinido");
  });
});

describe("resumoDoNo", () => {
  it("descreve o que o nó faz sem entregar a instrução do prompt", () => {
    const r = resumoDoNo({
      id: "a",
      type: "action",
      label: "Cutucada",
      position: { x: 0, y: 0 },
      config: { mode: "ai_message", prompt_hint: "SEGREDO DO PROMPT" },
    });
    expect(r.resumo).not.toContain("SEGREDO DO PROMPT");
    expect(r.resumo).toContain("agente escreve");
  });

  it("a espera adaptativa mostra a faixa que o dono do fluxo configurou", () => {
    const r = resumoDoNo({
      id: "w",
      type: "wait",
      label: "Espera",
      position: { x: 0, y: 0 },
      config: { mode: "smart", min_ms: 3_600_000, max_ms: 86_400_000 },
    });
    expect(r.resumo).toBe("espera adaptativa, entre 1 hora e 1 dia");
  });
});

describe("refDoNo — o alvo nunca some", () => {
  it("usa o nome que a pessoa deu ao passo", () => {
    expect(refDoNo("wait-1", nos)).toBe("Deixa esfriar");
  });

  it("passo fora do grafo pinado aparece DITO como id, não escondido", () => {
    // Registro sem o dono é indiagnosticável: "falhou" sem onde não serve para
    // nada. Feio e verdadeiro ganha de bonito e mudo.
    expect(refDoNo("wait-99", nos)).toContain("wait-99");
    expect(refDoNo("wait-99", nos)).toContain("não existe mais");
  });

  it("evento sem nó não inventa um", () => {
    expect(refDoNo(null, nos)).toBe("sem passo associado");
  });
});

describe("descreveEvento", () => {
  it("traduz o passo do motor e diz onde ele aconteceu", () => {
    const r = descreveEvento(
      evento({ event_type: "node_advanced", payload: { next_node_id: "action-1" } }),
      nos,
    );
    expect(r.titulo).toBe("Seguiu em frente");
    expect(r.detalhe).toBe("foi para Primeira cutucada");
    expect(r.onde).toBe("Deixa esfriar");
    expect(r.autor).toBe("motor");
  });

  it("a falha carrega a mensagem E o passo — nunca uma sem a outra", () => {
    const r = descreveEvento(
      evento({ event_type: "node_failed", payload: { error: "flow_version_not_found" } }),
      nos,
    );
    expect(r.detalhe).toBe("flow_version_not_found");
    expect(r.onde).toBe("Deixa esfriar");
  });

  it("intervenção humana é marcada como humana — é o que separa decisão de automatismo", () => {
    expect(descreveEvento(evento({ event_type: "paused_manual" }), nos).autor).toBe("pessoa");
    expect(descreveEvento(evento({ event_type: "reactivity_replied" }), nos).autor).toBe("cliente");
  });

  it("tipo desconhecido não vira jargão disfarçado de frase, mas também não some", () => {
    const r = descreveEvento(evento({ event_type: "passo_que_ainda_nao_existe" }), nos);
    expect(r.titulo).toBe("Passo registrado pelo motor");
    // O código aparece porque é EXATAMENTE aqui que quem diagnostica precisa dele.
    expect(r.detalhe).toContain("passo_que_ainda_nao_existe");
  });
});

describe("rotuloDaAresta", () => {
  it("diz QUANDO o caminho é seguido, em português", () => {
    expect(rotuloDaAresta({ id: "e", source: "a", target: "b", priority: 0, condition: { type: "always" } })).toBe(
      "caminho normal",
    );
    expect(
      rotuloDaAresta({
        id: "e",
        source: "a",
        target: "b",
        priority: 0,
        condition: { type: "class_match", value: "no_reply" },
      }),
    ).toBe("quando ninguém responde");
    expect(
      rotuloDaAresta({
        id: "e",
        source: "a",
        target: "b",
        priority: 0,
        condition: { type: "cond_result", value: false },
      }),
    ).toBe("quando a condição é falsa");
  });
});

describe("rotuloDoStatus", () => {
  it("as duas pausas NÃO se chamam igual — decisões diferentes dependem disso", () => {
    expect(rotuloDoStatus("paused_manual")).toBe("Pausado por uma pessoa");
    expect(rotuloDoStatus("paused_handoff")).toBe("Pausado (atendimento humano)");
  });
});
