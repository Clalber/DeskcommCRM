/**
 * O motor de horários livres — função PURA, sem banco e sem relógio.
 *
 * ─── O que ele responde ────────────────────────────────────────────────────
 *
 * "Dado o que esta pessoa publicou como jornada, o que ela já tem marcado e as
 * regras deste tipo de agendamento, quais horários posso oferecer entre X e Y?"
 *
 * Nada aqui lê banco e nada aqui lê o relógio: `agora` é parâmetro. Duas
 * armadilhas que esta base já pagou justificam isso. A janela anti-banimento
 * usava `new Date()` cru e derrubava o `test:db` depois das 22h — CI vermelho de
 * madrugada, sem ninguém ter mudado uma linha. E teste que depende da hora do
 * dia mente nos dois sentidos: passa quando não devia e falha quando devia
 * passar.
 *
 * ─── A ordem das subtrações, e por que a grade é ancorada na JANELA ────────
 *
 * 1. As janelas do dia, no fuso da jornada.
 * 2. Menos as exceções de data: as disponíveis SUBSTITUEM a base, as
 *    indisponíveis SUBTRAEM dela (DECISÃO 11 — ver `janelasDoDia`).
 * 3. A grade nasce no início de CADA janela, de `intervaloMin` em `intervaloMin`.
 * 4. Menos os ocupados, com os buffers inflando cada um.
 * 5. Menos o que começa antes de `agora + avisoMinimo`.
 * 6. Menos o que passa de `agora + janelaDias`.
 *
 * A ordem entre 3 e 4 é uma DECISÃO, e é o oposto do que parece natural. Se os
 * ocupados fossem subtraídos das janelas ANTES de gradear, a grade recomeçaria
 * no fim de cada compromisso: um paciente marcado às 10h15 faria a tarde inteira
 * ser oferecida às 11h15, 12h15, 13h15. Os horários oferecidos mudariam a cada
 * agendamento, e o dono da clínica veria a agenda dele "andar" sozinha.
 *
 * Ancorando na janela publicada, os horários oferecidos são sempre os mesmos —
 * 09:00, 10:00, 11:00 — e o que está ocupado apenas some da lista. É o que o
 * cal.com faz (`slotInterval` mais `offsetStart` só fazem sentido sobre uma
 * âncora fixa) e é o que o usuário consegue prever.
 *
 * ─── A régua do `windows` vazio é OUTRA aqui ───────────────────────────────
 *
 * Ver `janelasDoDia`. Este é o ponto mais fácil de errar do arquivo inteiro.
 *
 * ─── Uma limitação declarada, porque ninguém a mediu como defeito ──────────
 *
 * **Nada aqui cruza a meia-noite.** Nem a jornada (`22:00`–`02:00` é uma janela
 * com `end < start`, descartada), nem a exceção, nem um slot que comece 23:30 e
 * termine 00:30. A limitação é SIMÉTRICA — não há um lado que funcione e outro
 * que não — e está escrita aqui para ser encontrada antes que alguém venda
 * atendimento noturno, e não depois. Medido pelo QAVivo.
 */
import type { ScheduleWindow } from "@/lib/schemas/routing";

import { diaDaSemanaLocal, diaLocalISO, instanteDe, type HoraDeParede } from "./fuso";

/**
 * A jornada semanal da pessoa — lida de `attendant_availability.schedule`, que
 * continua sendo a fonte ÚNICA. A agenda lê; não duplica.
 */
export interface JornadaDaAgenda {
  timezone: string;
  windows: ScheduleWindow[];
}

/**
 * Uma linha de `calendar_availability_exceptions`, já em vocabulário de domínio.
 *
 * ⚠️ A FAIXA É SEMPRE PREENCHIDA, inclusive quando o dia inteiro está bloqueado
 * — aí ela é `(0, 1440)`. Não é detalhe de serialização: numa UNIQUE do
 * Postgres, NULL não colide com NULL, então dois "dia 12 bloqueado" da mesma
 * pessoa passariam os dois, em silêncio, e a tela mostraria a exceção
 * duplicada. `(0, 1440)` é a mesma informação e colide como deve.
 */
export interface ExcecaoDeData {
  /**
   * Data local, `YYYY-MM-DD` — a mesma régua de `diaLocalISO`.
   *
   * ⚠️ A COLUNA NO BANCO CHAMA `exception_date`, não `date`. Os briefings da
   * entrega dizem `date`, e quem escrever a rota ou a query lendo o briefing usa
   * o nome errado. Achado do QAVivo, lendo a migration do Arquiteto.
   */
  data: string;
  /** `true` SUBTRAI a faixa do dia (ver `janelasDoDia`); não zera o dia por si só. */
  indisponivel: boolean;
  /** Minutos desde a meia-noite local. Dia inteiro é `0`…`1440`. */
  inicioMinuto: number;
  fimMinuto: number;
}

/** Um intervalo que já está tomado: agendamento do dono ou evento vindo do Google. */
export interface Ocupado {
  inicio: Date;
  fim: Date;
}

/** As regras do molde (`calendar_event_types`) que o motor precisa conhecer. */
export interface TipoDeAgendamento {
  duracaoMin: number;
  bufferAntesMin: number;
  bufferDepoisMin: number;
  /** Antecedência mínima para marcar (cal.com usa 120 por padrão). */
  avisoMinimoMin: number;
  /** Granularidade da grade. `null`/ausente ⇒ usa a duração. */
  intervaloMin?: number | null;
  /** Até quantos dias no futuro se pode marcar. */
  janelaDias: number;
}

/** Um horário oferecível. Instantes — quem exibe escolhe o fuso. */
export interface Slot {
  inicio: Date;
  fim: Date;
}

export interface EntradaDeHorariosLivres {
  jornada: JornadaDaAgenda;
  excecoes: ExcecaoDeData[];
  ocupados: Ocupado[];
  tipo: TipoDeAgendamento;
  de: Date;
  ate: Date;
  /** INJETADO. Nunca `new Date()` aqui dentro. */
  agora: Date;
}

const MINUTO = 60_000;
const DIA = 86_400_000;

/**
 * Faixa em minutos desde a meia-noite LOCAL (é assim que a jornada é escrita).
 *
 * `ancora` é onde a grade daquela janela COMEÇA, e sobrevive aos cortes. Sem
 * ela, um bloqueio das 10:30 às 11:30 faria a tarde inteira ser oferecida às
 * 12:30, 13:30, 14:30 — a agenda "andando sozinha" que o cabeçalho deste
 * arquivo diz impedir. Medido pelo QAVivo: os casos da DECISÃO 11 usam só
 * múltiplos de 60, e para números assim o deslocamento não aparece.
 */
interface FaixaEmMinutos {
  inicio: number;
  fim: number;
  ancora: number;
}

/** Faixa em instantes (`getTime()`) — é assim que um compromisso existe. */
interface FaixaEmInstantes {
  inicio: number;
  fim: number;
}

function hhmmParaMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":");
  return Number(h) * 60 + Number(m);
}

/**
 * A data civil deslocada de N minutos, normalizada em UTC puro.
 *
 * O deslocamento é feito em UTC de propósito: UTC não tem horário de verão, e é
 * o único lugar onde somar minutos nunca muda de significado. O resultado é uma
 * hora de PAREDE (ano/mês/dia/hora/minuto), que só então vira instante no fuso
 * certo. Faz `24:00` virar meia-noite do dia seguinte sem caso especial.
 */
function paredeDeMinutos(ano: number, mes: number, dia: number, minuto: number): HoraDeParede {
  const base = new Date(Date.UTC(ano, mes - 1, dia, 0, 0, 0));
  base.setUTCMinutes(base.getUTCMinutes() + minuto);
  return {
    ano: base.getUTCFullYear(),
    mes: base.getUTCMonth() + 1,
    dia: base.getUTCDate(),
    hora: base.getUTCHours(),
    minuto: base.getUTCMinutes(),
  };
}

/**
 * Funde faixas que se sobrepõem ou se encostam, preservando a âncora da mais
 * à esquerda.
 *
 * ⚠️ NADA IMPEDE SOBREPOSIÇÃO A MONTANTE: o Zod valida `start < end` DENTRO de
 * cada janela e o array só tem `.max(50)`; a tela acrescenta janela sem checar;
 * a rota também não. E duas exceções disponíveis sobrepostas entram as duas —
 * a UNIQUE é por `start_minute`, e 540 ≠ 600.
 *
 * Sem esta união, `09:00–12:00` mais `10:00–13:00` gera 10:00 e 11:00 DUAS
 * vezes, e dois pacientes clicam em dois "10:00" que são o mesmo instante.
 *
 * **Sobreposição é inofensiva para quem TESTA pertinência e venenosa para quem
 * GERA.** `isWithinSchedule` usa `.some()`, e um OR responde `true` uma vez só —
 * por isso o roteamento conviveu com isso sem sintoma. A agenda é o primeiro
 * consumidor que GERA a partir de `schedule.windows`, e por isso esta função é
 * nomeada e exportável: a próxima peça que gerar herda o buraco se reimplementar
 * inline.
 */
export function unirFaixas(faixas: FaixaEmMinutos[]): FaixaEmMinutos[] {
  const ordenadas = [...faixas]
    .filter((f) => f.fim > f.inicio)
    .sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);

  const unidas: FaixaEmMinutos[] = [];
  for (const faixa of ordenadas) {
    const ultima = unidas[unidas.length - 1];
    // `<=` funde também as contíguas: 09:00–12:00 e 12:00–18:00 são um bloco de
    // trabalho só, e a grade deve fluir através da emenda.
    if (ultima && faixa.inicio <= ultima.fim) {
      if (faixa.fim > ultima.fim) ultima.fim = faixa.fim;
      continue;
    }
    unidas.push({ ...faixa });
  }
  return unidas;
}

/**
 * Subtrai uma faixa de uma lista de faixas.
 *
 * ⚠️ ADJACÊNCIA NÃO É SOBREPOSIÇÃO, e é aqui que um sinal trocado come um slot
 * inteiro sem nenhum outro teste reclamar: um bloqueio que termina às 12:00 não
 * toca a janela que começa às 12:00. Por isso `<=` e `>=` na guarda, e `<` e `>`
 * nos dois pedaços que sobram.
 *
 * Cortar no MEIO devolve DUAS faixas — é o caso "almoço estendido", e é a razão
 * de a assinatura ser lista, não faixa única.
 */
function subtraiFaixa(base: FaixaEmMinutos[], corte: FaixaEmMinutos): FaixaEmMinutos[] {
  const resto: FaixaEmMinutos[] = [];
  for (const faixa of base) {
    if (corte.fim <= faixa.inicio || corte.inicio >= faixa.fim) {
      resto.push(faixa);
      continue;
    }
    // Os pedaços herdam a âncora da janela-mãe: quem foi cortado continua a
    // grade original, não recomeça uma nova.
    if (corte.inicio > faixa.inicio) {
      resto.push({ inicio: faixa.inicio, fim: corte.inicio, ancora: faixa.ancora });
    }
    if (corte.fim < faixa.fim) {
      resto.push({ inicio: corte.fim, fim: faixa.fim, ancora: faixa.ancora });
    }
  }
  return resto;
}

/**
 * As faixas de trabalho de um dia — e o ponto onde a agenda diverge do roteamento.
 *
 * ⚠️ `windows` VAZIO SIGNIFICA COISAS OPOSTAS NOS DOIS USOS DESTA MESMA COLUNA:
 *
 * | Quem lê | vazio quer dizer | por quê |
 * |---|---|---|
 * | `isWithinSchedule` (roteamento, em produção) | 24/7, aceita | mensagem chega a qualquer hora, e janela existe para RESTRINGIR |
 * | aqui (agenda) | nada publicado ⇒ zero horário | agenda 24/7 ofereceria consulta às 3 da manhã |
 *
 * Por isso esta função existe em vez de reusar `isWithinSchedule` — que tem
 * consumidor em produção e não deve mudar. Quem quiser "unificar as duas" daqui
 * a seis meses está prestes a oferecer madrugada para o paciente de alguém.
 *
 * ─── Os três passos, nesta ordem (DECISÃO 11) ──────────────────────────────
 *
 * 1. **Base**: as janelas da jornada semanal daquele dia.
 * 2. **Exceções DISPONÍVEIS** substituem a base, se houver ao menos uma — é o
 *    sábado excepcional, que vale NO LUGAR da jornada, não somado a ela.
 * 3. **Exceções INDISPONÍVEIS** subtraem do que sobrou.
 *
 * "Dia inteiro bloqueado" NÃO é caso especial: é subtrair `(0, 1440)`, e o
 * resultado é vazio pela regra geral. A versão anterior desta função fazia
 * `if (algumaIndisponivel) return []`, e com a faixa preenchida isso virou um
 * defeito: quem bloqueasse duas horas perdia o dia inteiro.
 *
 * ⚠️ CONSEQUÊNCIA CONHECIDA E ACEITA: um `(0, 1440)` indisponível VENCE uma
 * exceção disponível do mesmo dia, porque subtrai depois. Quem cadastrou "não
 * atendo" mais "mas das 9h às 12h sim" fica sem o dia. Inverter a ordem
 * consertaria este caso e quebraria o sábado excepcional do passo 2 — trocar um
 * defeito por outro não é conserto. Quem tem de avisar é a TELA, ao salvar a
 * segunda linha. Está fixado em teste, com o porquê no nome.
 */
function janelasDoDia(
  jornada: JornadaDaAgenda,
  excecoesDoDia: ExcecaoDeData[],
  dow: number,
): FaixaEmMinutos[] {
  const disponiveis = excecoesDoDia.filter((e) => !e.indisponivel);

  const base: FaixaEmMinutos[] =
    disponiveis.length > 0
      ? disponiveis.map((e) => ({
          inicio: e.inicioMinuto,
          fim: e.fimMinuto,
          ancora: e.inicioMinuto,
        }))
      : jornada.windows
          .filter((w) => w.dow === dow)
          .map((w) => {
            const inicio = hhmmParaMinutos(w.start);
            return { inicio, fim: hhmmParaMinutos(w.end), ancora: inicio };
          });

  // Unir ANTES de subtrair: sobreposição na base viraria horário em dobro, e a
  // subtração não conserta isso por acidente — medido.
  let faixas = unirFaixas(base);

  for (const corte of excecoesDoDia.filter((e) => e.indisponivel)) {
    faixas = subtraiFaixa(faixas, {
      inicio: corte.inicioMinuto,
      fim: corte.fimMinuto,
      ancora: corte.inicioMinuto,
    });
  }

  return faixas;
}

/**
 * O slot inflado pelos buffers — e é o SLOT que infla, não o compromisso.
 *
 * O campo promete folga ANTES do meu atendimento e DEPOIS dele. Inflar o
 * compromisso dá a mesma conta só enquanto os dois buffers são iguais; com
 * `antes = 60` e `depois = 0` as duas leituras divergem, e a que corresponde ao
 * que a tela promete é esta.
 */
function slotInflado(inicio: number, fim: number, tipo: TipoDeAgendamento): FaixaEmInstantes {
  return {
    inicio: inicio - tipo.bufferAntesMin * MINUTO,
    fim: fim + tipo.bufferDepoisMin * MINUTO,
  };
}

/**
 * Sobreposição estrita: encostar não é conflitar.
 *
 * Um compromisso que termina 09:00 não impede o slot que começa 09:00 — é o
 * comportamento que o dono da agenda espera, e quem quiser folga entre um e
 * outro configura o buffer, que é o campo feito para isso.
 */
function colide(inicio: number, fim: number, faixa: FaixaEmInstantes): boolean {
  return inicio < faixa.fim && fim > faixa.inicio;
}

export function horariosLivres(entrada: EntradaDeHorariosLivres): Slot[] {
  const { jornada, excecoes, ocupados, tipo, de, ate, agora } = entrada;
  const fuso = jornada.timezone;
  const passo = tipo.intervaloMin ?? tipo.duracaoMin;
  if (passo <= 0 || tipo.duracaoMin <= 0) return [];

  // Os dois cortes do tempo, resolvidos uma vez: o começo é o mais tarde entre
  // o que se pediu e o aviso mínimo; o fim, o mais cedo entre o que se pediu e
  // a janela de agendamento.
  const naoAntesDe = Math.max(de.getTime(), agora.getTime() + tipo.avisoMinimoMin * MINUTO);
  const naoDepoisDe = Math.min(ate.getTime(), agora.getTime() + tipo.janelaDias * DIA);
  if (naoAntesDe > naoDepoisDe) return [];

  // Os compromissos, em instantes. Os bloqueios por exceção entram por dia, no
  // laço — eles nascem em minutos de parede e só viram instante lá dentro.
  const compromissos: FaixaEmInstantes[] = ocupados.map((o) => ({
    inicio: o.inicio.getTime(),
    fim: o.fim.getTime(),
  }));

  const excecoesPorData = new Map<string, ExcecaoDeData[]>();
  for (const e of excecoes) {
    const doDia = excecoesPorData.get(e.data);
    if (doDia) doDia.push(e);
    else excecoesPorData.set(e.data, [e]);
  }

  // Caminhamos por DIA LOCAL, com um dia de margem de cada lado: o fuso desloca
  // as bordas, e o primeiro slot de um dia local pode cair no dia UTC anterior.
  const primeiro = diaLocalISO(new Date(naoAntesDe - DIA), fuso);
  const ultimo = diaLocalISO(new Date(naoDepoisDe + DIA), fuso);

  const slots: Slot[] = [];
  for (let dataISO = primeiro; dataISO <= ultimo; dataISO = diaSeguinte(dataISO)) {
    const { ano, mes, dia } = dataCivil(dataISO);

    // O meio-dia local como âncora do dia: é o instante que nunca cai numa
    // virada de horário de verão (elas acontecem de madrugada), então ler o dia
    // da semana a partir dele é seguro em qualquer fuso.
    const meioDia = instanteDe({ ano, mes, dia, hora: 12, minuto: 0 }, fuso);
    const dow = diaDaSemanaLocal(meioDia, fuso);

    const excecoesDoDia = excecoesPorData.get(dataISO) ?? [];
    const emInstantes = (f: FaixaEmMinutos | ExcecaoDeData): FaixaEmInstantes => {
      const inicio = "inicio" in f ? f.inicio : f.inicioMinuto;
      const fim = "inicio" in f ? f.fim : f.fimMinuto;
      return {
        inicio: instanteDe(paredeDeMinutos(ano, mes, dia, inicio), fuso).getTime(),
        fim: instanteDe(paredeDeMinutos(ano, mes, dia, fim), fuso).getTime(),
      };
    };

    // ⚠️ O BLOQUEIO POR EXCEÇÃO CONTA COMO OCUPADO PARA EFEITO DE BUFFER.
    //
    // Ele já saiu das faixas pela subtração — mas isso só impede o slot de cair
    // DENTRO dele. O buffer é outra pergunta: a dentista que pede 15 minutos
    // entre pacientes e bloqueia 12h-14h para o almoço não quer um paciente às
    // 11h, porque a esterilização dele invade o almoço dela. Sem esta linha o
    // buffer valia contra compromisso e não valia contra bloqueio — mesma
    // intenção, duas telas, dois resultados. Medido pelo QAVivo; a DECISÃO 11
    // criou o caso, porque antes dela a exceção zerava o dia e não havia borda
    // no meio do dia para o buffer atravessar.
    const bloqueiosDoDia = [
      ...compromissos,
      ...excecoesDoDia.filter((e) => e.indisponivel).map(emInstantes),
    ];

    for (const faixa of janelasDoDia(jornada, excecoesDoDia, dow)) {
      const fimDaFaixa = instanteDe(paredeDeMinutos(ano, mes, dia, faixa.fim), fuso).getTime();

      // A grade continua a da JANELA, não recomeça no pedaço: avança da âncora
      // até o primeiro ponto que caia dentro desta faixa.
      const primeiroDaGrade =
        faixa.ancora + Math.ceil((faixa.inicio - faixa.ancora) / passo) * passo;

      for (let minuto = primeiroDaGrade; ; minuto += passo) {
        const inicio = instanteDe(paredeDeMinutos(ano, mes, dia, minuto), fuso).getTime();
        const fim = inicio + tipo.duracaoMin * MINUTO;

        // O slot inteiro precisa caber na faixa publicada. Comparação em
        // INSTANTES, não em minutos de parede: numa virada de horário de verão
        // a faixa pode ter 3h de parede e 2h de mundo.
        if (fim > fimDaFaixa) break;

        if (inicio < naoAntesDe) continue;
        if (inicio > naoDepoisDe) break;

        const comFolga = slotInflado(inicio, fim, tipo);
        if (bloqueiosDoDia.some((b) => colide(comFolga.inicio, comFolga.fim, b))) continue;

        slots.push({ inicio: new Date(inicio), fim: new Date(fim) });
      }
    }
  }

  // ⚠️ DOIS HORÁRIOS NÃO PODEM SER O MESMO INSTANTE.
  //
  // No salto do horário de verão a hora que não existe desliza para depois do
  // salto (decisão de `fuso.ts`), e aterrissa em cima do slot seguinte: em Nova
  // York, 2026-03-08, as 02:00 e as 03:00 viram o mesmo `07:00Z`. Dois pacientes
  // escolheriam "o seu" 03:00 e cairiam no mesmo `timestamptz`, sem erro em
  // lugar nenhum. O Brasil não tem mais horário de verão, mas Santiago e
  // Assunção — que o produto oferece — têm.
  const porInstante = new Map<number, Slot>();
  for (const slot of slots) {
    if (!porInstante.has(slot.inicio.getTime())) porInstante.set(slot.inicio.getTime(), slot);
  }

  return [...porInstante.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

/** `YYYY-MM-DD` → data civil. Uma função só, para o tipo não virar `number | undefined`. */
function dataCivil(dataISO: string): { ano: number; mes: number; dia: number } {
  const [ano = 0, mes = 1, dia = 1] = dataISO.split("-").map(Number);
  return { ano, mes, dia };
}

/** Próxima data civil em `YYYY-MM-DD`, normalizada em UTC (sem horário de verão pelo caminho). */
function diaSeguinte(dataISO: string): string {
  const { ano, mes, dia } = dataCivil(dataISO);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + 1);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`;
}
