/**
 * O MOTOR DE HORÁRIOS LIVRES — a peça que, errada, marca consulta às 3h.
 *
 * ─── O que este arquivo protege ────────────────────────────────────────────
 *
 * Que ninguém consiga marcar em cima de compromisso existente, fora do
 * expediente, no almoço, com antecedência menor que a exigida, ou longe demais
 * no futuro. Cada uma dessas frases é um `it` aqui embaixo — se algum sumir, a
 * frase deixou de ser verdade.
 *
 * ─── `agora` é INJETADO em todos os casos, e isso não é preciosismo ────────
 *
 * Esta base já foi mordida duas vezes por teste que lê o relógio: a janela
 * anti-banimento derruba o `test:db` depois das 22h, e o CI ficou vermelho de
 * madrugada sem ninguém ter mudado uma linha. Nenhum teste deste arquivo pode
 * mudar de resultado conforme a hora em que roda — nem conforme o fuso da
 * máquina, que é por isso que as asserções leem o slot NO FUSO DA JORNADA em
 * vez de usarem `toLocaleString` do processo.
 *
 * ─── As datas ──────────────────────────────────────────────────────────────
 *
 * 2026-03-09 é uma segunda-feira; 2026-03-14, um sábado. As datas de 2018 são o
 * horário de verão brasileiro, que existiu até 2019 e que o `Intl` deste
 * runtime conhece: São Paulo era GMT-3 em 03/11/2018 e GMT-2 em 05/11/2018.
 */
import { describe, expect, it } from "vitest";

import { partesNoFuso } from "@/lib/agenda/fuso";
import {
  horariosLivres,
  type ExcecaoDeData,
  type JornadaDaAgenda,
  type Ocupado,
  type Slot,
  type TipoDeAgendamento,
} from "@/lib/agenda/horarios-livres";

const SP = "America/Sao_Paulo";

/** Jornada padrão: segunda a sexta, 9h-12h e 13h-18h (o almoço é a ausência de janela). */
const JORNADA_COMERCIAL: JornadaDaAgenda = {
  timezone: SP,
  windows: [1, 2, 3, 4, 5].flatMap((dow) => [
    { dow, start: "09:00", end: "12:00" },
    { dow, start: "13:00", end: "18:00" },
  ]),
};

const CONSULTA_DE_1H: TipoDeAgendamento = {
  duracaoMin: 60,
  bufferAntesMin: 0,
  bufferDepoisMin: 0,
  avisoMinimoMin: 0,
  janelaDias: 60,
};

/** Slots legíveis no fuso pedido — "09:00", "10:00"… É assim que o humano confere. */
function horas(slots: Slot[], fuso = SP): string[] {
  return slots.map((s) => {
    const p = partesNoFuso(s.inicio, fuso);
    return `${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
  });
}

/** Slots com o dia junto, para os casos que atravessam datas. */
function diasEHoras(slots: Slot[], fuso = SP): string[] {
  return slots.map((s) => {
    const p = partesNoFuso(s.inicio, fuso);
    const dois = (n: number) => String(n).padStart(2, "0");
    return `${p.ano}-${dois(p.mes)}-${dois(p.dia)} ${dois(p.hora)}:${dois(p.minuto)}`;
  });
}

/** O dia inteiro de uma data local, como intervalo de consulta. */
function oDiaDe(dataISO: string): { de: Date; ate: Date } {
  return { de: new Date(`${dataISO}T00:00:00Z`), ate: new Date(`${dataISO}T23:59:59Z`) };
}

describe("a jornada publicada é o que abre a agenda", () => {
  it("dia sem janela publicada é ZERO horário — e não 24/7", () => {
    // A MESMA coluna, lida com outra régua: no roteamento, `windows` vazio quer
    // dizer "aceita a qualquer hora"; aqui quer dizer "não publiquei nada".
    // Herdar o 24/7 do roteamento ofereceria consulta às 3 da manhã.
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [] },
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(slots).toEqual([]);
  });

  it("domingo não tem janela na jornada comercial, então não tem horário", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-08"), // domingo
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(slots).toEqual([]);
  });

  it("o almoço parte o dia em duas janelas, e não sobra horário às 12h", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual([
      "09:00", "10:00", "11:00",
      "13:00", "14:00", "15:00", "16:00", "17:00",
    ]);
  });

  it("o último slot precisa CABER na janela: 50min de duração não gera um às 17:30", () => {
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "10:30" }] },
      excecoes: [],
      ocupados: [],
      tipo: { ...CONSULTA_DE_1H, duracaoMin: 50, intervaloMin: 30 },
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    // 09:00→09:50 e 09:30→10:20 cabem; 10:00→10:50 passaria das 10:30.
    expect(horas(slots)).toEqual(["09:00", "09:30"]);
  });

  it("o intervalo da grade é independente da duração", () => {
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "12:00" }] },
      excecoes: [],
      ocupados: [],
      tipo: { ...CONSULTA_DE_1H, duracaoMin: 60, intervaloMin: 30 },
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
  });
});

describe("o que já está marcado sai da grade — com os buffers em volta", () => {
  const ocupadoDas14: Ocupado[] = [
    { inicio: new Date("2026-03-09T17:00:00Z"), fim: new Date("2026-03-09T18:00:00Z") }, // 14h-15h em SP
  ];

  it("sem buffer, só o horário do compromisso some", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: ocupadoDas14,
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual([
      "09:00", "10:00", "11:00",
      "13:00", "15:00", "16:00", "17:00",
    ]);
  });

  it("com 15min de buffer dos dois lados, o vizinho que ENCOSTA também sai", () => {
    // O compromisso é 14h-15h; com buffer o bloqueio vira 13:45-15:15.
    // 13:00→14:00 encosta no começo do buffer, e 15:00→16:00 no fim.
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: ocupadoDas14,
      tipo: { ...CONSULTA_DE_1H, bufferAntesMin: 15, bufferDepoisMin: 15 },
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual(["09:00", "10:00", "11:00", "16:00", "17:00"]);
  });

  it("compromisso que termina exatamente quando o slot começa NÃO bloqueia (sem buffer)", () => {
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "11:00" }] },
      excecoes: [],
      ocupados: [
        { inicio: new Date("2026-03-09T11:00:00Z"), fim: new Date("2026-03-09T12:00:00Z") }, // 08h-09h SP
      ],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual(["09:00", "10:00"]);
  });
});

describe("os dois cortes do tempo: aviso mínimo e janela de agendamento", () => {
  it("o aviso mínimo come o começo do dia", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: [],
      tipo: { ...CONSULTA_DE_1H, avisoMinimoMin: 120 },
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-09T12:00:00Z"), // 09:00 em SP
    });
    // 09:00 + 2h ⇒ nada antes das 11:00.
    expect(horas(slots)).toEqual(["11:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("a janela de agendamento corta o futuro distante", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: [],
      tipo: { ...CONSULTA_DE_1H, janelaDias: 2 },
      de: new Date("2026-03-09T00:00:00Z"),
      ate: new Date("2026-03-20T23:59:59Z"),
      agora: new Date("2026-03-09T12:00:00Z"),
    });
    // 2 dias a partir de 09/03 12:00Z ⇒ nada depois de 11/03 12:00Z (09:00 SP).
    const dias = new Set(diasEHoras(slots).map((s) => s.slice(0, 10)));
    expect([...dias].sort()).toEqual(["2026-03-09", "2026-03-10", "2026-03-11"]);
    expect(diasEHoras(slots).filter((s) => s.startsWith("2026-03-11"))).toEqual([
      "2026-03-11 09:00",
    ]);
  });

  it("horário que já passou não aparece, mesmo sem aviso mínimo", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-09T19:00:00Z"), // 16:00 em SP
    });
    expect(horas(slots)).toEqual(["16:00", "17:00"]);
  });
});

/**
 * A EXCEÇÃO SUBTRAI (DECISÃO 11) — e "dia inteiro" deixou de ser caso especial.
 *
 * O schema guarda a faixa da exceção NOT NULL, com `(0, 1440)` para o dia
 * inteiro. O motivo é uma armadilha real do Postgres: numa UNIQUE, NULL não
 * colide com NULL, então dois "dia 12 bloqueado" da mesma pessoa passariam os
 * dois, em silêncio, e a tela mostraria a exceção duplicada.
 *
 * A consequência é que `is_unavailable = true` com `(600, 720)` virou
 * representável — "dia 12, das 10h às 12h, não atendo". A primeira versão deste
 * motor zerava o dia inteiro nesse caso: quem bloqueasse duas horas perderia o
 * dia. Agora a exceção indisponível SUBTRAI do que sobrou, e o dia inteiro é
 * apenas a subtração de `(0, 1440)`.
 *
 * Por que subtrair em vez de restringir: "das 12h às 14h não atendo" é o caso
 * comum — almoço estendido, reunião, compromisso pessoal. Com restrição, a
 * pessoa teria de cadastrar os pedaços que SOBRAM, e pensar ao contrário é o que
 * faz errar em tela de agenda.
 */
describe("exceções por data — o que a jornada semanal não sabe dizer", () => {
  it("exceção que bloqueia o dia inteiro zera aquele dia, e só aquele", () => {
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-10", indisponivel: true, inicioMinuto: 0, fimMinuto: 1440 },
    ];
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      de: new Date("2026-03-09T00:00:00Z"),
      ate: new Date("2026-03-11T23:59:59Z"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    const dias = new Set(diasEHoras(slots).map((s) => s.slice(0, 10)));
    expect([...dias].sort()).toEqual(["2026-03-09", "2026-03-11"]);
  });

  it("exceção com horário ABRE um sábado que a jornada não tem", () => {
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-14", indisponivel: false, inicioMinuto: 9 * 60, fimMinuto: 12 * 60 },
    ];
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-14"), // sábado
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("exceção com horário SUBSTITUI a jornada do dia, não soma a ela", () => {
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: false, inicioMinuto: 15 * 60, fimMinuto: 17 * 60 },
    ];
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    // A segunda tinha 9-12 e 13-18; a exceção diz "neste dia, só 15h-17h".
    expect(horas(slots)).toEqual(["15:00", "16:00"]);
  });

  it("indisponível NO MEIO do dia tira só aquelas horas — o resto do dia continua", () => {
    // O caso comum: almoço estendido, reunião interna, compromisso pessoal.
    // A versão anterior deste motor perdia o dia inteiro aqui.
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 12 * 60, fimMinuto: 14 * 60 },
    ];
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "18:00" }] },
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual([
      "09:00", "10:00", "11:00",
      "14:00", "15:00", "16:00", "17:00",
    ]);
  });

  it("subtrair no meio parte a janela em DUAS, e a grade renasce em cada pedaço", () => {
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 10 * 60, fimMinuto: 11 * 60 },
    ];
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "13:00" }] },
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    // 09:00-10:00 de um lado; 11:00-13:00 do outro. Nada às 10h.
    expect(horas(slots)).toEqual(["09:00", "11:00", "12:00"]);
  });

  it("disponível E indisponível no mesmo dia: a segunda subtrai o que a primeira abriu", () => {
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: false, inicioMinuto: 9 * 60, fimMinuto: 12 * 60 },
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 10 * 60, fimMinuto: 11 * 60 },
    ];
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    // Vale das 9h às 10h e das 11h às 12h.
    expect(horas(slots)).toEqual(["09:00", "11:00"]);
  });

  it("bloqueio de dia inteiro VENCE exceção disponível do mesmo dia — decidido, não acidental", () => {
    // Levantado pelo MaestroConexoes: as duas linhas coexistem (a UNIQUE é por
    // `start_minute`, e 0 ≠ 540), e quem as cadastrou provavelmente queria
    // "não atendo, MENOS das 9h às 12h". A regra faz outra coisa: o disponível
    // substitui a base, e o `(0, 1440)` subtrai tudo depois.
    //
    // Fica assim de propósito. Inverter a ordem consertaria este caso e
    // quebraria o "sábado excepcional substitui", que é o caso que motivou o
    // passo 2 — trocar um defeito por outro não é conserto. Quem tem de avisar
    // é a TELA, ao salvar a segunda linha.
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: false, inicioMinuto: 9 * 60, fimMinuto: 12 * 60 },
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 0, fimMinuto: 1440 },
    ];
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(slots).toEqual([]);
  });

  it("ADJACÊNCIA NÃO É SOBREPOSIÇÃO: bloqueio que termina às 12h não come o slot das 12h", () => {
    // Levantado pelo QAVivo. É um `<=` contra `<`: trocar o sinal aqui come um
    // slot inteiro, e nenhum dos casos da decisão pegaria.
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 10 * 60, fimMinuto: 12 * 60 },
    ];
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "12:00", end: "15:00" }] },
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    // A janela começa exatamente onde o bloqueio termina: intacta.
    expect(horas(slots)).toEqual(["12:00", "13:00", "14:00"]);
  });

  it("bloqueio que encosta no FIM da janela também não a toca", () => {
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 12 * 60, fimMinuto: 14 * 60 },
    ];
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "12:00" }] },
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("dois bloqueios no mesmo dia subtraem os dois, em qualquer ordem de cadastro", () => {
    const excecoes: ExcecaoDeData[] = [
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 15 * 60, fimMinuto: 16 * 60 },
      { data: "2026-03-09", indisponivel: true, inicioMinuto: 10 * 60, fimMinuto: 11 * 60 },
    ];
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "18:00" }] },
      excecoes,
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual([
      "09:00", "11:00", "12:00", "13:00", "14:00", "16:00", "17:00",
    ]);
  });
});

describe("fuso horário — onde a agenda ingênua quebra", () => {
  it("a virada do horário de verão não desloca a hora de parede da jornada", () => {
    // 04/11/2018: São Paulo entrou no horário de verão (00:00 virou 01:00).
    // O expediente continua começando às 9h de PAREDE nos dois dias — o que
    // muda é o instante no mundo.
    const jornada: JornadaDaAgenda = {
      timezone: SP,
      windows: [
        { dow: 6, start: "09:00", end: "11:00" }, // sábado 03/11
        { dow: 1, start: "09:00", end: "11:00" }, // segunda 05/11
      ],
    };
    const slots = horariosLivres({
      jornada,
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      de: new Date("2018-11-03T00:00:00Z"),
      ate: new Date("2018-11-06T00:00:00Z"),
      agora: new Date("2018-10-01T12:00:00Z"),
    });

    expect(horas(slots)).toEqual(["09:00", "10:00", "09:00", "10:00"]);
    // E os instantes provam a virada: 9h de sábado é 12:00Z (GMT-3); 9h de
    // segunda é 11:00Z (GMT-2). Um motor que somasse 24h por dia erraria.
    expect(slots.map((s) => s.inicio.toISOString())).toEqual([
      "2018-11-03T12:00:00.000Z",
      "2018-11-03T13:00:00.000Z",
      "2018-11-05T11:00:00.000Z",
      "2018-11-05T12:00:00.000Z",
    ]);
  });

  it("atendente e consultante em fusos diferentes veem o MESMO instante", () => {
    const slots = horariosLivres({
      jornada: { timezone: SP, windows: [{ dow: 1, start: "09:00", end: "11:00" }] },
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });

    // A regra vale no fuso da jornada: o atendente de São Paulo atende 9h e 10h.
    expect(horas(slots, SP)).toEqual(["09:00", "10:00"]);
    // Quem consulta de Manaus vê os mesmos compromissos uma hora mais cedo no
    // relógio DELE. O motor devolve instante; o fuso é escolha de quem exibe.
    expect(horas(slots, "America/Manaus")).toEqual(["08:00", "09:00"]);
    expect(horas(slots, "UTC")).toEqual(["12:00", "13:00"]);
  });

  it("a jornada de um fuso, o compromisso em UTC: o conflito é resolvido no instante", () => {
    const slots = horariosLivres({
      jornada: { timezone: "America/Manaus", windows: [{ dow: 1, start: "09:00", end: "12:00" }] },
      excecoes: [],
      ocupados: [
        // 10h em Manaus = 14:00Z. Quem comparasse "10:00" com "10:00" sem fuso
        // bloquearia o slot errado.
        { inicio: new Date("2026-03-09T14:00:00Z"), fim: new Date("2026-03-09T15:00:00Z") },
      ],
      tipo: CONSULTA_DE_1H,
      ...oDiaDe("2026-03-09"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots, "America/Manaus")).toEqual(["09:00", "11:00"]);
  });
});

describe("o intervalo consultado", () => {
  it("slots vêm em ordem cronológica", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      de: new Date("2026-03-09T00:00:00Z"),
      ate: new Date("2026-03-11T23:59:59Z"),
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    const instantes = slots.map((s) => s.inicio.getTime());
    expect(instantes).toEqual([...instantes].sort((a, b) => a - b));
    expect(instantes.length).toBeGreaterThan(0);
  });

  it("`de` e `ate` recortam: meio dia consultado devolve meio dia de horários", () => {
    const slots = horariosLivres({
      jornada: JORNADA_COMERCIAL,
      excecoes: [],
      ocupados: [],
      tipo: CONSULTA_DE_1H,
      de: new Date("2026-03-09T16:00:00Z"), // 13:00 em SP
      ate: new Date("2026-03-09T21:00:00Z"), // 18:00 em SP
      agora: new Date("2026-03-01T12:00:00Z"),
    });
    expect(horas(slots)).toEqual(["13:00", "14:00", "15:00", "16:00", "17:00"]);
  });
});
