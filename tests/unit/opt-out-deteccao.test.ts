/**
 * A CALIBRAÇÃO DO OPT-OUT, congelada.
 *
 * Este arquivo existe porque a regra anterior errava dos DOIS lados, e cada lado
 * falha de um jeito diferente:
 *
 *   - falso POSITIVO ("tem como parar a dor?" → bloqueado) some em silêncio: a
 *     pessoa deixa de receber e ninguém descobre, porque o motivo gravado
 *     (`stop_keyword`) parece legítimo;
 *   - falso NEGATIVO ("não quero mais receber" → não bloqueava) é pedido de LGPD
 *     ignorado.
 *
 * As duas listas abaixo são o corpus: frases de atendimento brasileiro real
 * (clínica, comércio, serviços). Acrescentar padrão em `lib/opt-out/deteccao.ts`
 * sem rodar isto é como o defeito volta.
 */
import { describe, expect, it } from "vitest";

import { ehOptOutProvavel, ehPedidoDeOptOut } from "@/lib/opt-out/deteccao";

/** Pedidos de descadastro que PRECISAM ser respeitados (bloqueiam o contato). */
const PEDE_PARA_SAIR = [
  "STOP",
  "stop",
  "PARAR",
  "Parar.",
  "sair",
  "SAIR!",
  "unsubscribe",
  "descadastrar",
  "pode parar de mandar mensagem",
  "para de me mandar isso",
  "pare de me enviar essas mensagens",
  "quero parar de receber",
  "não quero mais receber nada de vocês",
  "nao quero receber mais",
  "não me mande mais mensagens",
  "me tira dessa lista",
  "me remove da lista por favor",
  "quero sair da lista",
  "quero cancelar a inscrição",
  "me descadastra aí",
];

/** Frases do dia a dia que usam a palavra e NÃO são pedido de descadastro. */
const NAO_PEDE_PARA_SAIR = [
  // clínica — o caso que motivou este arquivo
  "tem como parar a dor?",
  "dá pra parar o sangramento em casa?",
  "quero parar o tratamento por enquanto",
  "posso sair antes das 15h?",
  "preciso sair mais cedo da consulta",
  "vou ter que sair do trabalho pra ir aí",
  "o remédio fez a dor parar",
  // comércio e serviços
  "quero cancelar o pedido",
  "posso cancelar a consulta de amanhã?",
  "vocês vão parar no feriado?",
  "que horas vocês param de atender?",
  // colagem — o defeito da versão com `\b` ASCII, que já tinha sido corrigido
  "amanhã ele sairá do escritório e pararão as obras",
  "a obra pararia se chovesse",
  // vazios
  "",
  "   ",
];

describe("ehPedidoDeOptOut — pedido INEQUÍVOCO, o que autoriza bloquear", () => {
  it.each(PEDE_PARA_SAIR)("respeita o pedido: %s", (texto) => {
    expect(ehPedidoDeOptOut(texto), `deveria ter reconhecido "${texto}"`).toBe(true);
  });

  it.each(NAO_PEDE_PARA_SAIR)("não bloqueia quem não pediu: %s", (texto) => {
    expect(ehPedidoDeOptOut(texto), `bloquearia "${texto}" sem pedido`).toBe(false);
  });

  it("texto ausente não é pedido de nada", () => {
    expect(ehPedidoDeOptOut(null)).toBe(false);
    expect(ehPedidoDeOptOut(undefined)).toBe(false);
  });

  it("a palavra precisa estar SOZINHA para valer por si", () => {
    // É o coração da correção: a mesma palavra, dois significados. Se algum dia
    // este par voltar a dar o mesmo resultado, a regra regrediu para "caçar
    // palavra" — que é o defeito, não a solução.
    expect(ehPedidoDeOptOut("parar")).toBe(true);
    expect(ehPedidoDeOptOut("tem como parar a dor?")).toBe(false);
  });

  it("cancelar sozinho sai; cancelar UMA COISA fica", () => {
    expect(ehPedidoDeOptOut("cancelar")).toBe(true);
    expect(ehPedidoDeOptOut("quero cancelar o pedido")).toBe(false);
  });
});

describe("ehOptOutProvavel — soma o ambíguo, para parar de responder e escalar", () => {
  it("todo pedido inequívoco também é provável", () => {
    for (const texto of PEDE_PARA_SAIR) {
      expect(ehOptOutProvavel(texto), texto).toBe(true);
    }
  });

  it.each(["me deixa em paz", "já disse que não quero", "para com isso"])(
    "reconhece o sinal ambíguo: %s",
    (texto) => {
      expect(ehOptOutProvavel(texto)).toBe(true);
    },
  );

  it("o ambíguo NÃO autoriza bloqueio por si só", () => {
    // A assimetria é a política: silenciar alguém para sempre é decisão de
    // pessoa. O ambíguo para o robô e chama o humano; quem bloqueia é ele.
    expect(ehOptOutProvavel("me deixa em paz")).toBe(true);
    expect(ehPedidoDeOptOut("me deixa em paz")).toBe(false);
  });

  it("não confunde troca de canal com descadastro", () => {
    // "não quero receber ligação, só whatsapp" QUER continuar recebendo aqui.
    expect(ehPedidoDeOptOut("não quero receber ligação, só whatsapp")).toBe(false);
    expect(ehOptOutProvavel("não quero receber ligação, prefiro mensagem")).toBe(false);
  });
});
