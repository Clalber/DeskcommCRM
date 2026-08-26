/**
 * O instante em que um DIA começa, num fuso — o inverso de `localMoment()`.
 *
 * ─── Por que este arquivo existe ───────────────────────────────────────────
 *
 * O Google descreve evento de dia inteiro como `{ "date": "2026-09-02" }`, sem
 * hora e **sem fuso** (`timeZone` vem nulo nesses eventos). Quem lê isso com
 * `new Date("2026-09-02")` recebe **meia-noite UTC** — e a especificação manda
 * mesmo: string só-data em JS é parseada como UTC. Para quem está em São Paulo
 * (UTC−3) o dia 2 passa a ocupar das 21h do dia 1 às 21h do dia 2. O compromisso
 * some do fim do dia e aparece na véspera; o motor de horários oferece um
 * horário que está ocupado e esconde um que está livre. É a classe de bug que a
 * referência do cal.com carrega até hoje.
 *
 * A conversão certa precisa do fuso DO CALENDÁRIO, que quem chama injeta.
 *
 * ─── Por que não é `new Date(...)` com offset fixo ────────────────────────
 *
 * O deslocamento de um fuso muda ao longo do ano (horário de verão) e ao longo
 * da história (o Brasil aboliu o dele em 2019). Um `-03:00` colado no código
 * acerta hoje e erra em qualquer data antiga. Quem sabe o deslocamento de um
 * instante é o `Intl` — a mesma base que `lib/routing/eligibility.ts` já usa em
 * produção, e sem dependência nova.
 *
 * ─── O buraco do horário de verão, que não é hipótese ─────────────────────
 *
 * Enquanto o Brasil teve horário de verão, a virada era **à meia-noite**: em
 * `America/Sao_Paulo`, 2018-11-04 pulou de 2018-11-03 23:59:59 (GMT−3) direto
 * para 2018-11-04 01:00:00 (GMT−2). **A meia-noite daquele dia não existiu.**
 * Medido neste runtime, não suposto. Uma conversão ingênua devolve um instante
 * que cai na véspera — o dia inteiro escorrega um dia para trás.
 *
 * Por isso a busca abaixo tem três passos: o palpite, a correção, e — quando
 * nenhum dos dois casa com a parede pedida — o **primeiro instante que existe
 * naquele dia**, que é o que a palavra "dia inteiro" quer dizer.
 *
 * ─── ⚠️ DUPLICAÇÃO DECLARADA, para não ser mergeada em silêncio ───────────
 *
 * Medido em 2026-08-26 13:36, na branch `cal/w1-api` (motor de horários):
 * existe lá um `lib/agenda/fuso.ts` com `instanteDe(parede, fuso)` e
 * `partesNoFuso(instante, fuso)` — a MESMA primitiva, na forma geral (qualquer
 * hora de parede, não só a meia-noite). Conferi o algoritmo: é a mesma busca de
 * duas passadas e resolve o salto do horário de verão para o mesmo instante.
 *
 * As duas branches desembocam em `feat/calendario-vivo`, e duas
 * implementações da conversão de fuso no mesmo `lib/agenda/` é o anti-pattern 2
 * do `CLAUDE.md` (duplicação sem fonte declarada). **Quando as branches se
 * encontrarem, esta função deve virar uma casca sobre `instanteDe`**, guardando
 * só o que é próprio da leitura do Google e não existe lá: o parse do formato
 * `AAAA-MM-DD`, a recusa de data que não existe no calendário, e a recusa de
 * fuso desconhecido (o dado vem de terceiro, então `null` é resposta, não
 * exceção).
 *
 * Aquele arquivo não está nesta branch — releia antes de agir, ele pode ter
 * mudado.
 *
 * **A unificação NÃO pode adotar a do motor sem consertar o salto de DST, e
 * isto está medido nos dois sentidos.** Comparei as duas funções na única
 * pergunta que ambas respondem — o primeiro instante de um dia:
 *
 * - nos 13 fusos que `lib/tempo/fusos.ts` oferece, 2018 a 2027, meses inteiros
 *   (com os dias 29, 30 e 31, que é onde mora a virada de fim de mês):
 *   **47.476 pares, zero divergências**;
 * - fora desse conjunto, **divergem 20 pares em 83.996** (23 fusos, 2018 a 2027)
 *   — e não são anomalias avulsas: é **uma por virada de horário de verão, por
 *   ano**, concentradas em `Asia/Beirut` e `Asia/Tehran`. O lado errado é o do
 *   motor:
 *
 *   ```
 *   Asia/Beirut 2026-03-29  daqui 2026-03-28T22:00Z (parede 29/03 01:00 — dia certo)
 *                           motor 2026-03-28T21:00Z (parede 28/03 23:00 — DIA ERRADO)
 *   Asia/Beirut 2018-03-25  idem, 1h
 *   Asia/Tehran 2018-03-22  daqui 2018-03-21T20:30Z (22/03 01:00) · motor 19:30Z (21/03 23:00)
 *   ```
 *
 * **A causa, e ela explica por que São Paulo concorda e Beirute não.** Nos dois
 * a meia-noite cai dentro do salto do horário de verão. A diferença é o SINAL
 * do deslocamento: onde ele é negativo (as Américas), o primeiro candidato já é
 * o instante mais tarde, e devolvê-lo acerta por acidente. Onde é positivo
 * (Beirute, Teerã), a ordem se inverte e o primeiro candidato cai na VÉSPERA.
 * Por isso aqui a escolha é explícita — `Math.max` dos dois candidatos, que é o
 * primeiro instante que de fato existe naquele dia — e lá é "fica o primeiro".
 *
 * Nenhum dos fusos que o produto oferece hoje cai nessa classe, então isto não
 * bloqueia nada. Mas a unificação anunciada acima trocaria uma função certa por
 * uma errada nessa borda, e é exatamente o tipo de troca que ninguém revisa
 * porque "as duas fazem a mesma coisa". Ao unificar: leve o `Math.max` daqui
 * para lá, ou mantenha esta.
 *
 * (Achado do QAVivo. A divergência inicial entre a medição dele e a minha era
 * régua implícita: ele mediu 25 fusos, eu medi os 13 da lista canônica, e os
 * três divergentes moram inteiramente fora dela.)
 */

import { fusoValido } from "@/lib/tempo/fusos";

/** `AAAA-MM-DD`, o formato que o Google usa em evento de dia inteiro. */
const SO_DATA = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A hora de parede de `instante` naquele fuso, expressa como epoch UTC.
 *
 * Não é um instante de verdade — é a leitura do relógio da parede embrulhada
 * num número comparável. A diferença entre ela e o instante real É o
 * deslocamento do fuso naquele momento, com horário de verão embutido.
 */
function paredeComoUTC(instante: number, fuso: string): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instante));

  const ler = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return Date.UTC(ler("year"), ler("month") - 1, ler("day"), ler("hour"), ler("minute"), ler("second"));
}

/**
 * Uma hora lida no relógio da parede — o que a pessoa vê, sem instante ainda.
 *
 * O nome e os campos são deliberadamente os mesmos de `lib/agenda/fuso.ts`
 * (branch do motor de horários), para que a unificação anunciada acima seja
 * troca de import e não reescrita.
 */
export interface HoraDeParede {
  ano: number;
  mes: number;
  dia: number;
  hora?: number;
  minuto?: number;
  segundo?: number;
}

/**
 * Hora de parede num fuso → o instante correspondente.
 *
 * Devolve `null` — nunca lança e nunca chuta — quando a data não existe no
 * calendário ou o fuso não existe neste runtime. Quem chama transforma isso em
 * recusa nomeada; cair num `new Date()` de consolo é como um evento corrompido
 * vira "ocupado agora".
 *
 * **Na hora que não existe** (o salto do horário de verão) devolve o primeiro
 * instante DEPOIS do salto — o pedido deslocado pelo tamanho do buraco, que é o
 * que qualquer agenda faz. **Na hora que acontece duas vezes** (a volta)
 * devolve a primeira. Escolher é obrigatório; escolher em silêncio é que não
 * pode, e por isso está escrito aqui e tem teste.
 */
export function instanteDaParede(parede: HoraDeParede, fuso: string): Date | null {
  const { ano, mes, dia } = parede;
  const hora = parede.hora ?? 0;
  const minuto = parede.minuto ?? 0;
  const segundo = parede.segundo ?? 0;
  if (![ano, mes, dia, hora, minuto, segundo].every((n) => Number.isInteger(n))) return null;
  if (!fusoValido(fuso)) return null;

  const alvo = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo);
  // Guarda contra data que não existe no calendário (31 de fevereiro): o
  // `Date.UTC` normaliza em silêncio para 3 de março, e o dia ocupado seria
  // outro. Só aceitamos quando a volta bate com o que veio escrito.
  const conferencia = new Date(alvo);
  if (
    conferencia.getUTCFullYear() !== ano ||
    conferencia.getUTCMonth() !== mes - 1 ||
    conferencia.getUTCDate() !== dia ||
    conferencia.getUTCHours() !== hora ||
    conferencia.getUTCMinutes() !== minuto ||
    conferencia.getUTCSeconds() !== segundo
  ) {
    return null;
  }

  const palpite = alvo - (paredeComoUTC(alvo, fuso) - alvo);
  if (paredeComoUTC(palpite, fuso) === alvo) return new Date(palpite);

  const corrigido = alvo - (paredeComoUTC(palpite, fuso) - palpite);
  if (paredeComoUTC(corrigido, fuso) === alvo) return new Date(corrigido);

  // Nenhum instante tem essa hora de parede: ela caiu dentro do salto do
  // horário de verão. Fica o primeiro instante DEPOIS do salto — o maior dos
  // dois candidatos.
  return new Date(Math.max(palpite, corrigido));
}

/**
 * O primeiro instante do dia `AAAA-MM-DD` naquele fuso.
 *
 * É o caso de dia inteiro: a meia-noite local, com a ressalva de que existem
 * dias cuja meia-noite não aconteceu.
 */
export function primeiroInstanteDoDia(dataYmd: string, fuso: string): Date | null {
  const casou = SO_DATA.exec(dataYmd.trim());
  if (!casou) return null;
  const [, ano, mes, dia] = casou;
  if (!ano || !mes || !dia) return null;
  return instanteDaParede({ ano: Number(ano), mes: Number(mes), dia: Number(dia) }, fuso);
}
