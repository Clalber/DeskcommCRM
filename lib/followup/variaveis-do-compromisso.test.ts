import { describe, expect, it } from "vitest";

import {
  contextoDoCompromisso,
  precisaResolver,
  renderizarTextoDoFollowup,
} from "./variaveis-do-compromisso";

const COMPROMISSO = {
  titulo: "Reunião de diagnóstico",
  tipoNome: "Reunião",
  // 17:00 UTC = 14:00 em São Paulo. O caso que dá nome ao teste do fuso.
  startsAt: "2026-09-10T17:00:00.000Z",
  timeZone: "America/Sao_Paulo",
  donoNome: "Thiago",
};

describe("precisaResolver", () => {
  it("texto sem chave não vai ao banco", () => {
    expect(precisaResolver("Oi! Sua reunião é daqui a uma hora.")).toBe(false);
  });
  it("texto com chave do compromisso resolve", () => {
    expect(precisaResolver("Sua reunião é às {{agendamento.hora}}")).toBe(true);
  });
  it("aceita espaços dentro das chaves, como o renderizador", () => {
    expect(precisaResolver("Oi {{ nome }}")).toBe(true);
  });

  it("⚠️ NÃO alcança fluxo alheio: {{volta}} sozinho continua fora", () => {
    // A regressão que este teste impede: `{{volta}}` fora de um laço sai HOJE
    // com a chave literal (`interpolarVolta` devolve o texto intacto quando não
    // há repetição). Um gatilho `texto.includes("{{")` faria `renderTemplate`
    // apagá-la — mudança calada, em fluxo publicado que não pediu nada disto.
    expect(precisaResolver("Este é o lembrete {{volta}} de {{voltas}}")).toBe(false);
    expect(precisaResolver("Cupom: {{campo.cupom}}")).toBe(false);
  });

  it("uma chave nossa no meio já traz o texto inteiro para o contrato", () => {
    // Dentro de um texto que OPTOU pelo vocabulário, apagar o desconhecido é a
    // regra certa — a mesma das automações.
    expect(precisaResolver("Oi {{nome}}, cupom {{campo.cupom}}")).toBe(true);
  });
});

describe("contextoDoCompromisso", () => {
  it("a hora sai no fuso do COMPROMISSO, não no do servidor", () => {
    const ctx = contextoDoCompromisso(COMPROMISSO);
    // 17:00Z lido em São Paulo. Formatar em UTC diria 17:00 e o cliente perderia
    // a hora — este número é o motivo de `time_zone` existir na tabela.
    expect(ctx.hora).toBe("14:00");
    expect(ctx.data).toBe("10/09/2026");
  });

  it("fuso inválido cai no padrão em vez de quebrar", () => {
    const ctx = contextoDoCompromisso({ ...COMPROMISSO, timeZone: "Marte/Olympus" });
    expect(ctx.hora).toBe("14:00");
  });

  it("sem tipo cadastrado, o título do compromisso responde por «tipo»", () => {
    const ctx = contextoDoCompromisso({ ...COMPROMISSO, tipoNome: null });
    expect(ctx.tipo).toBe("Reunião de diagnóstico");
  });

  it("compromisso sem dono não deixa buraco na frase", () => {
    const ctx = contextoDoCompromisso({ ...COMPROMISSO, donoNome: null });
    expect(ctx.com_quem).toBe("nossa equipe");
  });
});

describe("renderizarTextoDoFollowup", () => {
  const agendamento = contextoDoCompromisso(COMPROMISSO);

  it("monta o lembrete inteiro", () => {
    const texto = renderizarTextoDoFollowup(
      "Oi {{nome}}! Sua {{agendamento.tipo}} com {{agendamento.com_quem}} é hoje às {{agendamento.hora}}.",
      { nomeDoContato: "Ana", agendamento },
    );
    expect(texto).toBe("Oi Ana! Sua Reunião com Thiago é hoje às 14:00.");
  });

  it("sem compromisso encontrado, a chave vira vazio — nunca `{{...}}` cru no WhatsApp", () => {
    const texto = renderizarTextoDoFollowup("Sua reunião é às {{agendamento.hora}}.", {
      nomeDoContato: "Ana",
      agendamento: null,
    });
    expect(texto).toBe("Sua reunião é às .");
  });

  it("⚠️ `{{agendamento.profissional}}` continua bloqueado — `com_quem` é o endereço público", () => {
    // A fronteira interno/cliente de `lib/automation/template.ts` NÃO foi
    // afrouxada por esta entrega. Quem quer o nome na mensagem escreve
    // `com_quem`, e escrever isso é a escolha explícita que a fronteira pede.
    const bloqueado = renderizarTextoDoFollowup("com {{agendamento.profissional}}", {
      nomeDoContato: "Ana",
      agendamento,
    });
    expect(bloqueado).toBe("com ");

    const publico = renderizarTextoDoFollowup("com {{agendamento.com_quem}}", {
      nomeDoContato: "Ana",
      agendamento,
    });
    expect(publico).toBe("com Thiago");
  });

  it("variável interna do funil não vaza para o cliente", () => {
    const texto = renderizarTextoDoFollowup("orçamento {{qualificacao.orcamento}}", {
      nomeDoContato: "Ana",
      agendamento,
    });
    expect(texto).toBe("orçamento ");
  });
});
