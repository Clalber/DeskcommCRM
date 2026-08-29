/**
 * O indicador "digitando…" — o laço de renovação e a ponte com o canal do turno.
 *
 * O que estes testes protegem, em ordem de dano:
 *
 *   1. o indicador NUNCA fica aceso além do teto (um turno pendurado deixaria o
 *      cliente vendo "digitando…" para sempre — pior que não ter o recurso);
 *   2. `parar()` apaga na hora, sem esperar o sono corrente terminar (senão o
 *      balãozinho sobrevive à mensagem que já chegou);
 *   3. um canal que não sabe sinalizar é tentado UMA vez por turno, não a cada
 *      renovação, para sempre, em toda instalação sem o recurso.
 *
 * O relógio e o sono são injetados: o teto de 60s é provado em milissegundos.
 */
import { describe, expect, it, vi } from "vitest";

import { digitacaoDoTurno, manterDigitando } from "./digitando";
import type { ChannelAdapter } from "../channel-adapter";
import type { Logger } from "../obs/logger";

const KNOBS = { renovarAposMs: 8_000, duracaoMaximaMs: 60_000 };

/** Relógio fake que só anda quando o sono anda — o tempo do teste é o do laço. */
function relogioESono(): {
  agora: () => number;
  dormir: (ms: number) => Promise<void>;
  dormidas: number[];
} {
  let t = 0;
  const dormidas: number[] = [];
  return {
    agora: () => t,
    dormir: async (ms: number) => {
      dormidas.push(ms);
      t += ms;
    },
    dormidas,
  };
}

const logMudo: Logger = { info: () => {}, warn: () => {}, error: () => {} };

describe("manterDigitando", () => {
  it("renova até o teto e para sozinho — nunca acende além dele", async () => {
    const { agora, dormir, dormidas } = relogioESono();
    // Parâmetro NOMEADO (mesmo sem uso no corpo): sem ele o mock tem aridade
    // zero e `mock.calls` vira tupla vazia — o filtro por argumento abaixo não
    // compila no modo estrito.
    const sinalizar = vi.fn(async (_ligado: boolean) => true);

    const pulso = manterDigitando({ sinalizar, knobs: KNOBS, agora, dormir });
    pulso.iniciar();
    // O laço roda sozinho; sem `parar()`, ele termina quando o teto vence.
    await vi.waitFor(() => expect(dormidas.at(-1)).toBe(4_000));

    // 60s / 8s = 7,5 → acende em 0, 8, 16, 24, 32, 40, 48, 56 s. Em t=60s a
    // condição do laço já é falsa: a 9ª acendida NÃO acontece.
    const acendidas = sinalizar.mock.calls.filter(([ligado]) => ligado === true);
    expect(acendidas).toHaveLength(8);
    expect(agora()).toBe(60_000);

    // A última espera é ENCURTADA para caber no teto (4s, não 8s) — é isso que
    // faz o laço terminar exatamente no limite em vez de o ultrapassar.
    expect(dormidas).toEqual([8_000, 8_000, 8_000, 8_000, 8_000, 8_000, 8_000, 4_000]);
  });

  it("parar() apaga na hora, sem esperar o sono corrente", async () => {
    const sinalizar = vi.fn(async () => true);
    // Sono que NUNCA resolve: se `parar()` dependesse dele, este teste travaria.
    let dormindo = false;
    const dormir = (): Promise<void> => {
      dormindo = true;
      return new Promise<void>(() => {});
    };

    const pulso = manterDigitando({ sinalizar, knobs: KNOBS, agora: () => 0, dormir });
    pulso.iniciar();
    // ⚠️ Esperar pela SINALIZAÇÃO aqui não bastava, e a diferença é o teste
    // inteiro: com `parar()` logo depois dela, o laço acordava já com
    // `ativo === false` e saía pelo `if (!ativo) return` — sem NUNCA chegar ao
    // sono. O teste passava com a corrida removida do código. Medido: sabotar o
    // `Promise.race` deixava esta suíte verde. Esperar pelo SONO é o que põe o
    // laço no estado que o teste diz exercitar.
    await vi.waitFor(() => expect(dormindo).toBe(true));

    await pulso.parar();

    expect(sinalizar).toHaveBeenNthCalledWith(1, true);
    expect(sinalizar).toHaveBeenNthCalledWith(2, false);
    expect(sinalizar).toHaveBeenCalledTimes(2);
    // Timeout curto de propósito: a forma de este teste falhar é TRAVAR (o sono
    // não resolve nunca), e 15s de espera por caso quebrado é pedágio no CI.
  }, 3_000);

  it("canal que recusa é tentado UMA vez, e não recebe o desligamento", async () => {
    const { agora, dormir } = relogioESono();
    const sinalizar = vi.fn(async () => false);

    const pulso = manterDigitando({ sinalizar, knobs: KNOBS, agora, dormir });
    pulso.iniciar();
    await pulso.parar();

    // Uma tentativa e mais nada: nem renovação, nem o `paused` de desligamento —
    // que seria uma chamada garantidamente inútil por turno.
    expect(sinalizar).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("sinalizar que REJEITA conta como recusa e não vaza a exceção", async () => {
    const { agora, dormir } = relogioESono();
    const sinalizar = vi.fn(async () => {
      throw new Error("canal fora do ar");
    });

    const pulso = manterDigitando({ sinalizar, knobs: KNOBS, agora, dormir });
    pulso.iniciar();
    // O `expect` é a asserção: `parar()` não pode propagar o erro do canal para
    // o `finally` do turno — lá ele mascararia a exceção real do turno.
    await expect(pulso.parar()).resolves.toBeUndefined();
    expect(sinalizar).toHaveBeenCalledTimes(1);
  });

  it("parar() é seguro sem iniciar, e não repete o desligamento", async () => {
    const sinalizar = vi.fn(async () => true);
    const pulso = manterDigitando({ sinalizar, knobs: KNOBS, agora: () => 0, dormir: async () => {} });

    await pulso.parar();
    expect(sinalizar).not.toHaveBeenCalled();

    // Depois de parado, `iniciar()` não ressuscita o laço: o turno acabou.
    pulso.iniciar();
    await pulso.parar();
    expect(sinalizar).not.toHaveBeenCalled();
  });

  it("iniciar() duas vezes não abre um segundo laço", async () => {
    const sinalizar = vi.fn(async () => true);
    const dormir = (): Promise<void> => new Promise<void>(() => {});
    const pulso = manterDigitando({ sinalizar, knobs: KNOBS, agora: () => 0, dormir });

    pulso.iniciar();
    pulso.iniciar();
    await vi.waitFor(() => expect(sinalizar).toHaveBeenCalledTimes(1));
    await pulso.parar();

    // Dois laços dariam duas acendidas concorrentes e dois desligamentos.
    expect(sinalizar).toHaveBeenCalledTimes(2);
  });
});

describe("digitacaoDoTurno", () => {
  function canalCom(setTyping?: ChannelAdapter["setTyping"]): ChannelAdapter {
    return {
      channel: "teste",
      send: async () => ({ kind: "unavailable", reason: "teste" }),
      sessionHealth: async () => ({ healthy: true, status: "WORKING", since: null }),
      capabilities: () => ({ freeformAnytime: true, serviceWindowHours: null }),
      costPerMessage: () => ({ perMessageUsdCents: 0, model: "flat" }),
      ...(setTyping ? { setTyping } : {}),
    };
  }

  it("liga e desliga pelo canal, carregando tenant e conversa", async () => {
    const setTyping = vi.fn(async () => true);
    const dormir = (): Promise<void> => new Promise<void>(() => {});
    const digitacao = digitacaoDoTurno({
      knobs: KNOBS,
      tenantId: "org-1",
      conversationId: "conv-1",
      log: logMudo,
      agora: () => 0,
      dormir,
    });

    digitacao.ligar(canalCom(setTyping));
    await vi.waitFor(() => expect(setTyping).toHaveBeenCalledTimes(1));
    await digitacao.parar();

    expect(setTyping).toHaveBeenNthCalledWith(1, {
      tenantId: "org-1",
      conversationId: "conv-1",
      typing: true,
    });
    expect(setTyping).toHaveBeenNthCalledWith(2, {
      tenantId: "org-1",
      conversationId: "conv-1",
      typing: false,
    });
  });

  it("sem knobs (recurso desligado) não toca no canal", async () => {
    const setTyping = vi.fn(async () => true);
    const digitacao = digitacaoDoTurno({
      tenantId: "org-1",
      conversationId: "conv-1",
      log: logMudo,
    });

    digitacao.ligar(canalCom(setTyping));
    await digitacao.parar();

    expect(setTyping).not.toHaveBeenCalled();
  });

  it("canal que não sabe sinalizar é no-op — o turno não pergunta quem ele é", async () => {
    const digitacao = digitacaoDoTurno({
      knobs: KNOBS,
      tenantId: "org-1",
      conversationId: "conv-1",
      log: logMudo,
    });

    // Um adapter SEM `setTyping` é o caso de todo canal futuro que não suporte o
    // recurso. Nem `ligar` nem `parar` podem estourar por causa disso.
    expect(() => digitacao.ligar(canalCom())).not.toThrow();
    await expect(digitacao.parar()).resolves.toBeUndefined();
  });

  it("registra o desfecho UMA vez por turno, não a cada renovação", async () => {
    const { agora, dormir } = relogioESono();
    const info = vi.fn();
    const digitacao = digitacaoDoTurno({
      knobs: KNOBS,
      tenantId: "org-1",
      conversationId: "conv-1",
      log: { info, warn: () => {}, error: () => {} },
      agora,
      dormir,
    });

    digitacao.ligar(canalCom(vi.fn(async () => true)));
    await vi.waitFor(() => expect(agora()).toBe(60_000));
    await digitacao.parar();

    // Oito acendidas e um desligamento produzem UMA linha de log. Sem isso, uma
    // conversa longa enterraria o log do turno em ruído decorativo.
    expect(info).toHaveBeenCalledExactlyOnceWith("indicador de digitação", {
      aceito_pelo_canal: true,
    });
  });
});
