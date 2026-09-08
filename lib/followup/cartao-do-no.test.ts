import { describe, expect, it } from "vitest";

import type { TriggerConfig } from "./api-schemas";
import {
  cartaoDoFim,
  cartaoDoGatilho,
  conteudoDoCartao,
  exemploDaMensagem,
  rotuloDaArestaNoCanvas,
  rotuloDaSaidaSempre,
} from "./cartao-do-no";
import type { FlowNode, NodeType } from "./graph-schema";
import { GATILHOS } from "./vocabulario";

const COMPROMISSO: TriggerConfig = {
  kind: "appointment_upcoming",
  params: { minutes_before: 60 },
};

const juntando = (c: ReturnType<typeof cartaoDoGatilho>): string =>
  [c.titulo, ...c.linhas.map((l) => `${l.rotulo} ${l.valor}`), c.rodape].filter(Boolean).join(" | ");

describe("o card do gatilho descreve o GATILHO, não «Início do fluxo»", () => {
  it("compromisso: diz a antecedência, a agenda e a cadência", () => {
    const texto = juntando(cartaoDoGatilho(COMPROMISSO));
    expect(texto).toContain("1 hora");
    expect(texto).toContain("Agenda");
    expect(texto).toContain("a cada minuto");
  });

  it("⚠️ os seis gatilhos dão textos DIFERENTES entre si", () => {
    // O defeito que este arquivo existe para impedir: `describeNodeConfig`
    // devolvia «Início do fluxo» para todos, porque lia a config do NÓ (que é
    // `{}`) em vez do gatilho do FLUXO. Seis cards idênticos para seis coisas
    // diferentes é a definição de tela que não conta nada.
    const configs: TriggerConfig[] = [
      COMPROMISSO,
      { kind: "silence", params: { threshold_minutes: 1440 } },
      { kind: "stage_change", params: { stage_id: "11111111-1111-4111-8111-111111111111" } },
      { kind: "case_opened" },
      { kind: "webhook" },
      { kind: "manual" },
    ];
    const titulos = configs.map((c) => cartaoDoGatilho(c).titulo);
    expect(new Set(titulos).size, "cada gatilho tem a sua frase").toBe(configs.length);
    expect(titulos).not.toContain("Início do fluxo");
  });

  it("gatilho sem motor conhecido cai no nome dele, não numa frase inventada", () => {
    const c = cartaoDoGatilho({ kind: "conversation_end", params: {} } as TriggerConfig);
    expect(c.titulo).toBe(GATILHOS.conversation_end);
  });

  it("sem config legível, devolve vazio — quem chama volta ao texto genérico", () => {
    const c = cartaoDoGatilho(null);
    expect(c.titulo).toBeNull();
    expect(c.linhas).toEqual([]);
  });

  it("a antecedência sai por extenso, não em minutos crus", () => {
    const hora = (min: number) => cartaoDoGatilho({ ...COMPROMISSO, params: { minutes_before: min } }).titulo;
    expect(hora(60)).toContain("1 hora");
    expect(hora(120)).toContain("2 horas");
    expect(hora(1440)).toContain("1 dia");
    expect(hora(90)).toContain("90 minutos");
  });
});

describe("o card de ação responde as três perguntas que levanta", () => {
  const config = { mode: "text" as const, body: "Oi {{nome}}!" };

  it("para quem — e a resposta vem do GATILHO, não deste nó", () => {
    const doCompromisso = conteudoDoCartao("action", config, COMPROMISSO);
    expect(doCompromisso.linhas.find((l) => l.rotulo === "Para")?.valor).toBe(
      "quem marcou o compromisso",
    );

    const doSilencio = conteudoDoCartao("action", config, {
      kind: "silence",
      params: { threshold_minutes: 60 },
    });
    expect(doSilencio.linhas.find((l) => l.rotulo === "Para")?.valor).toBe("o contato que sumiu");
  });

  it("⚠️ por onde: NÃO crava número, em modo nenhum", () => {
    // O motor escolhe o canal em tempo de execução. Cravar um número aqui seria
    // o card mentindo com confiança — na conta do dono há dois WhatsApp e um
    // Instagram, e o mesmo fluxo sai por canais diferentes conforme o contato.
    for (const modo of [
      { mode: "text" as const, body: "oi" },
      { mode: "ai_message" as const, prompt_hint: "seja breve" },
      { mode: "template" as const, template_id: "11111111-1111-4111-8111-111111111111" },
    ]) {
      const por = conteudoDoCartao("action", modo, COMPROMISSO).linhas.find((l) => l.rotulo === "Por");
      expect(por?.valor, modo.mode).not.toMatch(/\d{4}/);
    }
  });

  it("⚠️ o TEXTO FIXO tem dois caminhos de envio, e o card não promete um só", () => {
    // Achado em auditoria: além do turno do agent-worker (`resolveSendTarget`,
    // conversa mais recente), o modo `text` também é drenado por
    // `enviarTextoFixoPendente`, que usa a sessão WORKING MAIS ANTIGA da org.
    // Dizer "a conversa mais recente" seria prometer o que o motor não garante.
    const texto = conteudoDoCartao("action", config, COMPROMISSO).linhas.find((l) => l.rotulo === "Por");
    const ia = conteudoDoCartao("action", { mode: "ai_message", prompt_hint: "x" }, COMPROMISSO)
      .linhas.find((l) => l.rotulo === "Por");
    expect(texto?.valor).not.toBe(ia?.valor);
    expect(texto?.valor).toContain("primeiro número conectado");
  });

  it("diz quem escreve o texto, e é diferente por modo", () => {
    const fixo = conteudoDoCartao("action", config, COMPROMISSO);
    const ia = conteudoDoCartao("action", { mode: "ai_message", prompt_hint: "seja breve" }, COMPROMISSO);
    expect(fixo.rodape).toContain("a IA não reescreve");
    expect(ia.titulo).toContain("IA");
    expect(fixo.titulo).not.toBe(ia.titulo);
  });
});

describe("o card do fim diz o que fica registrado", () => {
  it("a nota do usuário vence o rótulo genérico do desfecho", () => {
    const c = cartaoDoFim({ outcome: "custom", note: "cliente avisado" });
    expect(c.linhas.find((l) => l.rotulo === "Grava")?.valor).toBe("cliente avisado");
  });

  it("sem nota, usa o desfecho — nunca fica vazio", () => {
    expect(cartaoDoFim({ outcome: "converted" }).linhas[0]?.valor).toBe("Convertido");
    expect(cartaoDoFim({ outcome: "custom", note: "   " }).linhas[0]?.valor).toBe("Personalizado");
  });

  it("⚠️ a nota do usuário NÃO passa pelo dicionário; o desfecho passa", () => {
    // Uma nota que por acaso coincida com uma chave («Para», «Vale») viraria
    // espanhol na cara de quem a escreveu em português. O rótulo do desfecho é
    // vocabulário do produto e deve ser traduzido — daí a distinção.
    expect(cartaoDoFim({ outcome: "custom", note: "Vale" }).linhas[0]?.bruto).toBe(true);
    expect(cartaoDoFim({ outcome: "converted" }).linhas[0]?.bruto).toBeFalsy();
    expect(cartaoDoFim({ outcome: "custom", note: "  " }).linhas[0]?.bruto).toBeFalsy();
  });
});

describe("o rótulo da seta diz o que acontece, não «Sempre»", () => {
  /**
   * ⚠️ ESTE BLOCO PASSA PELO CAMINHO DO CANVAS, com nós de verdade.
   *
   * A primeira versão testava `rotuloDaSaidaSempre` isolada, e ficava verde
   * enquanto a tela seguia dizendo "Sempre": o canvas procurava o ramo ANTES, e
   * `nodeBranches` devolve um `fallback` para TODO nó não-ramificado — então o
   * ramo era sempre achado e a função nunca corria. Sabotagem verde que não
   * provava ligação nenhuma; achado em auditoria.
   */
  const no = (id: string, type: NodeType, config: unknown): FlowNode =>
    ({ id, type, label: id, position: { x: 0, y: 0 }, config }) as FlowNode;

  const SEMPRE = { type: "always" } as const;

  it("nó de uma saída só: diz o que acontece, pelo tipo da origem", () => {
    expect(rotuloDaArestaNoCanvas(SEMPRE, no("g", "trigger", {}))).toBe("assim que disparar");
    expect(
      rotuloDaArestaNoCanvas(SEMPRE, no("a", "action", { mode: "text", body: "oi" })),
    ).toBe("depois de enviar");
    expect(
      rotuloDaArestaNoCanvas(SEMPRE, no("w", "wait", { mode: "fixed", duration_ms: 600_000 })),
    ).toBe("passado o tempo");
  });

  it("⚠️ o ramo é MESMO consultado — caso em que ele diverge do rótulo por tipo", () => {
    // Buraco achado em auditoria: o caso do classify abaixo NÃO prova ligação,
    // porque o fallback dele se chama «Sempre» e `rotuloPorTipo("ai_classify")`
    // também devolve «Sempre» — passar pelo ramo ou nunca olhá-lo dá o mesmo
    // texto. Aqui os dois DIVERGEM: no modo uma-saída-por-regra o escape se
    // chama «Nenhuma delas». Se o código parar de consultar o ramo, isto quebra.
    const perCheck = no("k", "condition", {
      combinator: "and",
      branching: "per_check",
      checks: [
        { id: "vip", label: "é VIP", field: "tag", op: "eq", value: "vip" },
        { id: "novo", label: "é novo", field: "tag", op: "eq", value: "novo" },
      ],
    });
    const rotulo = rotuloDaArestaNoCanvas(SEMPRE, perCheck);
    expect(rotulo).not.toBe("Sempre");
    expect(rotulo.toLowerCase()).toContain("nenhuma");
  });

  it("⚠️ nó que RAMIFICA continua com o rótulo do ramo — o fallback do classify é «Sempre»", () => {
    // `followup-builder.spec.ts` confere «Sempre» na aresta que sai do
    // classificar pelo caminho de escape. Um conserto que mudasse isso quebraria
    // a spec, e estaria errado: ali o ramo TEM nome próprio.
    const classify = no("c", "ai_classify", {
      classes: ["sim", "não"],
      branches: [
        { id: "sim", label: "sim" },
        { id: "nao", label: "não" },
      ],
      grace_timeout_ms: 900_000,
      target: "last_reply",
    });
    expect(rotuloDaArestaNoCanvas(SEMPRE, classify)).toBe("Sempre");
  });

  it("aresta órfã (sem nó de origem) não inventa frase", () => {
    expect(rotuloDaArestaNoCanvas(SEMPRE, undefined)).toBe("Sempre");
  });

  it("condição que não é «sempre» mantém o rótulo dela", () => {
    const cond = no("k", "condition", {
      combinator: "and",
      checks: [{ field: "tag", op: "eq", value: "vip" }],
    });
    expect(rotuloDaArestaNoCanvas({ type: "cond_result", value: true }, cond)).not.toBe(
      "assim que disparar",
    );
  });

  it("a função por tipo segue exposta, e é a mesma régua", () => {
    expect(rotuloDaSaidaSempre("trigger")).toBe("assim que disparar");
    expect(rotuloDaSaidaSempre(undefined)).toBe("Sempre");
  });
});

describe("o exemplo da mensagem troca as chaves por valores", () => {
  it("mostra a hora em vez da chave", () => {
    expect(exemploDaMensagem("Sua reunião é às {{agendamento.hora}}.")).toBe(
      "Sua reunião é às 14:00.",
    );
  });

  it("texto sem chave não ganha exemplo — repetir seria ruído", () => {
    expect(exemploDaMensagem("Até já!")).toBeNull();
  });

  it("chave desconhecida fica como está, e não inventa valor", () => {
    expect(exemploDaMensagem("Cupom {{campo.cupom}}")).toBeNull();
    expect(exemploDaMensagem("Oi {{nome}}, cupom {{campo.cupom}}")).toBe("Oi Ana, cupom {{campo.cupom}}");
  });

  it("⚠️ `agendamento.profissional` NÃO ganha exemplo — ela sai vazia de verdade", () => {
    // `renderTemplate` bloqueia essa chave em mensagem ao cliente. Dar um
    // exemplo aqui ensinaria a escrever a chave errada; quem quer o nome usa
    // `agendamento.com_quem`.
    expect(exemploDaMensagem("com {{agendamento.profissional}}")).toBeNull();
    expect(exemploDaMensagem("com {{agendamento.com_quem}}")).toBe("com Thiago");
  });
});
