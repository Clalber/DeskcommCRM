import * as fs from "node:fs";
import * as path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A LIGAÇÃO do indicador "digitando…" dentro do turno do agente.
 *
 * ─── O que este arquivo cobre, e por que ele é de FORMA ─────────────────────
 *
 * As peças têm teste de comportamento próprio: o laço de renovação e a ponte com
 * o canal em `lib/agent-engine/agent/digitando.test.ts` (10 casos), a resolução
 * conversa → sessão → destinatário em `lib/messaging/digitando.test.ts` (8).
 * O que nenhum dos dois alcança é ONDE o indicador acende dentro do turno — e é
 * justamente aí que mora a decisão que dá para errar em silêncio.
 *
 * Rodar o turno inteiro é possível neste repo (`tests/invariants/
 * agent-send-template-turn.test.ts` o faz contra Postgres real, com modelo e
 * canal fakes), mas exige `pnpm test:db` — Docker, que nem toda máquina de
 * desenvolvimento tem. Este guard é a versão barata: ele falha perto do defeito
 * e roda em `pnpm test:unit`, que é check obrigatório de merge.
 *
 * **Prova:** que as quatro decisões abaixo estão escritas no código que roda.
 * **Não prova:** que um turno real, com modelo escolhendo tools, acende e apaga
 * o indicador — isso pede o harness de invariante acima.
 *
 * As duas primeiras são as que doem quando quebram:
 *
 *   - acender ANTES das guardas mostraria "digitando…" a quem o turno decidiu
 *     não responder (lead em atendimento humano, fora da janela de envio) — um
 *     sinal falso justamente para quem está esperando;
 *   - apagar fora de um `finally` deixaria o balãozinho aceso em todo caminho de
 *     exceção, que é a maioria dos caminhos interessantes de um turno.
 */

const FONTE = fs.readFileSync(
  path.join(process.cwd(), "lib/agent-engine/agent/inbound-turn.ts"),
  "utf8",
);

/** Índice de uma âncora, com mensagem de falha que diz o que procurar. */
function ancora(trecho: string): number {
  const i = FONTE.indexOf(trecho);
  expect(i, `âncora sumiu do turno: ${trecho}`).toBeGreaterThan(-1);
  return i;
}

describe("digitando — ciclo de vida dentro do turno", () => {
  it("nasce no início do turno e é parado num finally", () => {
    const criacao = ancora("const digitacao = digitacaoDoTurno({");
    const tentativa = FONTE.indexOf("try {", criacao);
    const parada = ancora("await digitacao.parar();");

    // A ordem criar → try → parar é o que garante que TODO caminho de saída
    // (sucesso, JobSettledError, exceção de modelo, veto do sink) apaga o
    // indicador. Trocar o `finally` por uma chamada no fim do caminho feliz
    // compila, passa nos testes das peças, e deixa o cliente vendo "digitando…"
    // toda vez que um turno morre — que é quando ele mais espera resposta.
    expect(tentativa, "o turno deixou de ser embrulhado em try/finally").toBeGreaterThan(criacao);
    expect(parada).toBeGreaterThan(tentativa);
    const blocoFinal = FONTE.slice(FONTE.lastIndexOf("} finally {", parada), parada);
    expect(blocoFinal, "`digitacao.parar()` saiu de dentro do `finally`").toContain("} finally {");
  });

  it("acende só DEPOIS das guardas que decidem se o turno fala", () => {
    const handoff = ancora("if (await isLeadInHandoff(pool, tenantId, leadId)) {");
    const janela = ancora("if (!janelaDeEnvioAberta(agora, knobs)) {");
    const canal = ancora("const channel = (deps.channel ??");
    const acende = ancora("digitacao.ligar(channel);");

    expect(janela).toBeGreaterThan(handoff);
    // O canal precisa existir antes: é ele quem sabe (ou não) sinalizar.
    expect(canal).toBeGreaterThan(janela);
    expect(acende).toBeGreaterThan(canal);
  });

  it("não acende para quem pediu para não ser incomodado", () => {
    const acende = ancora("digitacao.ligar(channel);");
    const guarda = FONTE.slice(acende - 200, acende);

    // Opt-out no próprio turno: o gate 1 da cadeia vai vetar o envio de qualquer
    // forma. Acender aqui seria prometer uma resposta que não vem.
    expect(guarda, "a guarda de opt-out sumiu de antes do `ligar`").toContain("if (!optedOutThisTurn)");
  });

  it("o recurso é opcional: sem knob, o turno não sinaliza", () => {
    // `knobs: deps.knobs.digitando` — e `digitando?` é opcional em
    // InboundTurnKnobs. É o que faz `AGENT_TYPING_ENABLED=false` (e todo teste
    // que não exercita o recurso) rodar o turno sem tocar no canal.
    expect(FONTE).toContain("knobs: deps.knobs.digitando");
    expect(FONTE).toMatch(/digitando\?: DigitandoKnobs/);
  });
});

describe("digitando — o knob chega do ambiente", () => {
  const MAIN = fs.readFileSync(path.join(process.cwd(), "workers/agent-worker/main.ts"), "utf8");
  const ENV = fs.readFileSync(path.join(process.cwd(), "lib/agent-engine/env.ts"), "utf8");

  it("o worker só passa o knob quando o recurso está ligado", () => {
    // Chave AUSENTE quando desligado — a convenção destes knobs é "ausente = não
    // roda". Um objeto sempre presente com um booleano dentro obrigaria cada
    // ponto de uso a lembrar de conferi-lo, e o primeiro que esquecesse
    // sinalizaria numa instalação que desligou o recurso.
    expect(MAIN).toContain("...(env.AGENT_TYPING_ENABLED");
    expect(MAIN).toContain("renovarAposMs: env.AGENT_TYPING_REFRESH_MS");
    expect(MAIN).toContain("duracaoMaximaMs: env.AGENT_TYPING_MAX_MS");
  });

  it("as três variáveis têm default — instalação fresca não precisa configurar nada", () => {
    // Doutrina de packaging: variável nova sem default quebraria o `.env` de quem
    // já instalou numa VPS.
    expect(ENV).toMatch(/AGENT_TYPING_ENABLED[\s\S]{0,120}\.default\('true'\)/);
    expect(ENV).toMatch(/AGENT_TYPING_REFRESH_MS[\s\S]{0,80}\.default\(8_000\)/);
    expect(ENV).toMatch(/AGENT_TYPING_MAX_MS[\s\S]{0,80}\.default\(60_000\)/);
  });

  it("está documentado no .env.example, que é o que o self-hoster copia", () => {
    const EXEMPLO = fs.readFileSync(path.join(process.cwd(), ".env.example"), "utf8");
    expect(EXEMPLO).toContain("AGENT_TYPING_ENABLED=true");
    expect(EXEMPLO).toContain("AGENT_TYPING_REFRESH_MS=8000");
    expect(EXEMPLO).toContain("AGENT_TYPING_MAX_MS=60000");
  });
});
