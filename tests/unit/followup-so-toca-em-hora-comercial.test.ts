/**
 * O follow-up tem janela PRÓPRIA, separada da do atendimento.
 *
 * ─── Por que separar ────────────────────────────────────────────────────────
 *
 * Responder é atendimento: quem escreveu à meia-noite merece resposta, e uma
 * instalação pode legitimamente atender 24 horas. O follow-up é INICIATIVA —
 * parte de nós, para quem sumiu, sem ninguém do outro lado esperando.
 *
 * Tocar às 4 da manhã é o gesto que faz um número ser denunciado, e o cliente
 * que acorda com cobrança automática não volta.
 *
 * ─── O defeito, medido em 2026-09-02 ────────────────────────────────────────
 *
 * Os dois usavam a MESMA janela (a de `channel_knobs`). Uma instalação abriu o
 * canal para 0h–24h porque queria atender de madrugada — e abriu o follow-up
 * junto, sem saber. O toque de 2 horas passou a poder cair às 4 da manhã, com a
 * instrução de reoferecer horário.
 *
 * ─── As três decisões que este arquivo trava ────────────────────────────────
 *
 * 1. **Adiar, nunca descartar.** Fora da janela o toque é reagendado para a
 *    abertura. Descartar perderia o retorno, e o follow-up existe justamente
 *    para não perder.
 * 2. **Herdar tudo do canal, trocar só as HORAS.** Fuso e domingo continuam
 *    sendo decisão de quem configurou o canal; esta janela responde por uma
 *    coisa só. Reimplementar "domingo" aqui criaria duas verdades.
 * 3. **Ausente = comportamento de sempre.** Sem as duas horas declaradas, o
 *    follow-up herda a janela do canal — nenhuma instalação existente muda de
 *    comportamento por causa de um deploy.
 */
import { describe, expect, it } from "vitest";

import { janelaDeEnvioAberta, proximaAberturaDaJanela } from "@/lib/agent-engine/pacing/engine";
import type { PacingKnobs } from "@/lib/agent-engine/pacing/defaults";

/** Canal aberto 24h — o cenário que criou o defeito. */
const CANAL_24H: PacingKnobs = {
  throttleMs: 1200,
  jitterMaxMs: 0,
  windowStartHour: 0,
  windowEndHour: 24,
  allowSunday: true,
  timezone: "America/Sao_Paulo",
  warmupDailyCaps: [],
};

/** A janela comercial que o dono escolheu para o follow-up. */
const COMERCIAL = { startHour: 8, endHour: 19 };

const comJanelaComercial = (canal: PacingKnobs): PacingKnobs => ({
  ...canal,
  windowStartHour: COMERCIAL.startHour,
  windowEndHour: COMERCIAL.endHour,
});

/** Um instante na parede de São Paulo (UTC-3), como Date real. */
const emSP = (dia: string, hora: number, min = 0): Date =>
  new Date(`${dia}T${String(hora + 3).padStart(2, "0")}:${String(min).padStart(2, "0")}:00.000Z`);

describe("a janela do follow-up é separada da do atendimento", () => {
  it("⚠️ 4h da manhã: o ATENDIMENTO responde e o FOLLOW-UP não toca", () => {
    // O coração da separação. Com o canal em 24h, as 4h estão abertas para
    // responder — e é isso que a instalação quis. O follow-up não.
    const quatroDaManha = emSP("2026-09-03", 4);

    expect(
      janelaDeEnvioAberta(quatroDaManha, CANAL_24H),
      "o atendimento ficou fechado às 4h — a instalação abriu o canal justamente para isso",
    ).toBe(true);

    expect(
      janelaDeEnvioAberta(quatroDaManha, comJanelaComercial(CANAL_24H)),
      "o follow-up tocaria às 4 da manhã",
    ).toBe(false);
  });

  it("⚠️ o toque das 4h é ADIADO para as 8h, não descartado", () => {
    // Descartar perderia o retorno. A pessoa some, o toque não sai, e ninguém
    // nunca mais fala com ela — pior que o defeito original.
    const quatroDaManha = emSP("2026-09-03", 4);
    const abertura = proximaAberturaDaJanela(quatroDaManha, comJanelaComercial(CANAL_24H));

    expect(abertura.getTime(), "adiou para o passado").toBeGreaterThan(quatroDaManha.getTime());
    // Mesmo dia, na abertura da janela.
    const horaSP = Number(
      new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        hour12: false,
      }).format(abertura),
    );
    expect(horaSP, "a abertura não caiu às 8h").toBe(COMERCIAL.startHour);
  });

  it("dentro do comercial o toque sai normalmente", () => {
    // O controle na direção oposta: sem ele, "nunca tocar" passaria nos dois
    // casos acima e o follow-up morreria inteiro, em silêncio.
    for (const hora of [8, 12, 18]) {
      expect(
        janelaDeEnvioAberta(emSP("2026-09-03", hora), comJanelaComercial(CANAL_24H)),
        `o toque foi barrado às ${hora}h, dentro do horário comercial`,
      ).toBe(true);
    }
  });

  it("19h é o FIM da janela — às 19h já não toca", () => {
    // `endHour` é exclusivo (`h < windowEndHour`), e a diferença importa: 19h
    // significa "até as 19", não "durante as 19".
    expect(janelaDeEnvioAberta(emSP("2026-09-03", 18, 59), comJanelaComercial(CANAL_24H))).toBe(true);
    expect(janelaDeEnvioAberta(emSP("2026-09-03", 19), comJanelaComercial(CANAL_24H))).toBe(false);
  });

  it("domingo continua sendo decisão do CANAL, não desta janela", () => {
    // A janela comercial troca só as HORAS. Se o dono liberou domingo no canal,
    // o follow-up também toca domingo — uma verdade só sobre o dia da semana.
    const domingoMeioDia = emSP("2026-09-06", 12); // 06/09/2026 é domingo
    expect(
      janelaDeEnvioAberta(domingoMeioDia, comJanelaComercial(CANAL_24H)),
      "bloqueou domingo por conta própria, contrariando o canal",
    ).toBe(true);

    const canalSemDomingo = { ...CANAL_24H, allowSunday: false };
    expect(
      janelaDeEnvioAberta(domingoMeioDia, comJanelaComercial(canalSemDomingo)),
      "ignorou o canal que proíbe domingo",
    ).toBe(false);
  });
});

describe("a guarda de artefato", () => {
  it("o portão continua no turno de follow-up, e continua ADIANDO", async () => {
    // O portão vive dentro de um handler que precisa de banco, fila e registry
    // para rodar. Sem esta guarda, alguém removeria o bloco e os casos acima
    // seguiriam verdes — eles medem a REGRA de janela, não o call site.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/agent-engine/agent/followup-turn.ts", "utf8");

    // Cobra a INTENÇÃO, não a pontuação: o acesso é `deps.knobs?.followupWindow`
    // de propósito — ler configuração ausente não pode derrubar o turno, e um
    // teste que cobrasse o ponto exato reprovaria essa correção.
    expect(src, "o portão da janela comercial sumiu do turno de follow-up").toMatch(
      /deps\.knobs\??\.followupWindow/,
    );
    expect(src, "deixou de adiar — provavelmente passou a descartar").toContain("rescheduleJob");
    expect(src, "o motivo do adiamento sumiu do rastro").toContain(
      "fora da janela comercial do follow-up",
    );
    // Trocar só as horas é a decisão nº 2; se alguém reimplementar domingo aqui,
    // passam a existir duas verdades sobre o dia da semana.
    expect(src, "a janela deixou de herdar o canal").toContain("...knobs,");
  });
});
