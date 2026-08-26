/**
 * A FRONTEIRA: o que o BANCO devolve não é o que o motor aceita.
 *
 * O motor de horários livres é função pura e recebe `{timezone, windows}` já em
 * forma. Quem lê `attendant_availability.schedule` recebe um **jsonb**, e jsonb
 * não tem forma nenhuma. Este arquivo é o contrato entre os dois.
 *
 * ─── Os três defeitos que existiam nessa fronteira, medidos ───────────────
 *
 * Rodando o motor com o que a coluna devolve de verdade:
 *
 *   schedule `{}` (o DEFAULT da coluna) → TypeError em `windows.filter`
 *   windows ausente                     → TypeError
 *   windows null                        → TypeError
 *   timezone ausente                    → NÃO explode: 3 slots, no fuso DA MÁQUINA
 *
 * Os três primeiros são o **caminho normal**, não borda: todo atendente
 * recém-criado tem `schedule` no default, então a agenda dele derrubaria a rota.
 *
 * ─── O quarto é o grave, e é INVERTIDO ────────────────────────────────────
 *
 * `timezone` ausente não explode — o `Intl` cai no fuso do processo. Medido no
 * repo: `docker-compose.prod.yml:222` define `TZ: UTC` **apenas** no serviço
 * `scheduler`; o serviço `app` não define TZ nenhum, e o `Dockerfile` é
 * `node:22-alpine` sem `tzdata`. Em produção, portanto, o fuso do processo é
 * **UTC**. Para uma clínica em São Paulo, a jornada declarada 09:00–18:00 seria
 * calculada como 09:00–18:00 UTC — 06:00–15:00 na parede dela. O sistema
 * ofereceria horário às 6 da manhã e nenhum depois das 15h, sem um erro em
 * lugar nenhum.
 *
 * E no Mac de quem desenvolve o `TZ` é `America/Sao_Paulo`, então o mesmo
 * código acerta. **O defeito é invisível em dev e certo em produção.** Explodir
 * apareceria no primeiro teste; isto só apareceria no relato de um dono de
 * clínica dizendo que a agenda está três horas adiantada.
 *
 * (Achado meu na varredura de fronteira; magnitude medida pelo QAVivo.)
 *
 * ─── A peça que resolve já existia ────────────────────────────────────────
 *
 * `availabilityScheduleSchema` é o schema central que a DECISÃO 1 nomeia como
 * fonte única, e ele preenche os defaults e valida o fuso contra o `Intl`. Não
 * há validação nova aqui: há reuso, e a garantia de que o motor nunca vê jsonb
 * cru.
 */
import { describe, expect, it } from "vitest";

import { lerJornadaDoBanco } from "@/lib/agenda/jornada";

describe("o que o banco devolve de verdade", () => {
  it("`{}` — o DEFAULT da coluna — vira jornada válida sem horário publicado", () => {
    const r = lerJornadaDoBanco({});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jornada.windows).toEqual([]);
    expect(r.publicouHorarios).toBe(false);
  });

  it("`windows` ausente não explode, e o fuso NÃO vem da máquina", () => {
    const r = lerJornadaDoBanco({ timezone: "America/Manaus" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jornada.timezone).toBe("America/Manaus");
    expect(r.jornada.windows).toEqual([]);
  });

  it("TIMEZONE AUSENTE cai no padrão declarado, e nunca no fuso do processo", () => {
    // Este é o teste que impede o defeito invertido de voltar. Em produção o
    // processo roda em UTC (alpine sem tzdata, e o serviço `app` sem `TZ`), e
    // herdar isso deslocaria a jornada de toda clínica brasileira em 3 horas.
    const r = lerJornadaDoBanco({ windows: [{ dow: 1, start: "09:00", end: "18:00" }] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.jornada.timezone).toBe("America/Sao_Paulo");
    expect(r.jornada.timezone).not.toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone === "America/Sao_Paulo"
        ? "__nunca__"
        : Intl.DateTimeFormat().resolvedOptions().timeZone,
    );
  });

  it("publicouHorarios distingue 'não publiquei' de 'não tenho vaga'", () => {
    // A DECISÃO 1.1: sem janela publicada a tela NÃO diz "nenhum horário
    // disponível" e cala — ela diz "você ainda não publicou seus horários de
    // atendimento" e leva para lá. São estados diferentes e a rota precisa
    // distingui-los, senão o dono conclui que está lotado.
    const vazia = lerJornadaDoBanco({});
    expect(vazia.ok && vazia.publicouHorarios).toBe(false);
    const cheia = lerJornadaDoBanco({ windows: [{ dow: 1, start: "09:00", end: "18:00" }] });
    expect(cheia.ok && cheia.publicouHorarios).toBe(true);
  });
});

describe("o que o banco pode devolver e NÃO pode passar", () => {
  it("`windows: null` é recusado, e com motivo legível", () => {
    // É representável no jsonb, e um `parse` viraria 500 na rota.
    const r = lerJornadaDoBanco({ timezone: "UTC", windows: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/array/i);
  });

  it("fuso com acento é recusado — o erro que já custou um bug a esta base", () => {
    const r = lerJornadaDoBanco({ timezone: "America/Asunción", windows: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/fuso/i);
  });

  it("janela invertida é recusada", () => {
    const r = lerJornadaDoBanco({ timezone: "UTC", windows: [{ dow: 1, start: "18:00", end: "09:00" }] });
    expect(r.ok).toBe(false);
  });

  it("recusa NUNCA vira lista vazia silenciosa — o motivo sempre acompanha", () => {
    // Falha fechada na AÇÃO (não oferece horário) e ABERTA na INFORMAÇÃO.
    // Devolver `[]` sem motivo faz o dono concluir "não tenho horário livre"
    // quando o que ele tem é schedule corrompido — e essa conclusão errada não
    // gera chamado nenhum, então ninguém descobre.
    for (const ruim of [{ windows: null }, { timezone: "X/Y", windows: [] }, { timezone: "UTC", windows: [{ dow: 9, start: "09:00", end: "10:00" }] }]) {
      const r = lerJornadaDoBanco(ruim);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0);
    }
  });

  it("null e undefined — a linha que não existe — são recusados sem explodir", () => {
    expect(lerJornadaDoBanco(null).ok).toBe(false);
    expect(lerJornadaDoBanco(undefined).ok).toBe(false);
  });
});
