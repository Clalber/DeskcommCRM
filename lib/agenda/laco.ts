/**
 * O laço de retorno do agendamento — invariante 7 do Sistema Vivo.
 *
 * Marcar um horário não é escrever uma linha: é um fato que precisa VOLTAR ao
 * sistema. São dois emissores, e eles respondem perguntas diferentes:
 *
 *   `crm_lead_activities` → o HUMANO vê na timeline do lead o que a IA marcou
 *   `event_log`           → o WORKER leva o compromisso para o Google
 *
 * Um sem o outro deixa metade do laço aberto: só a atividade, e o Google nunca
 * sabe; só o evento, e a equipe não vê o que foi marcado.
 *
 * Este arquivo decide O QUE emitir. Quem grava é a rota, e a separação é
 * proposital: emitir o TIPO ERRADO é o erro silencioso desta feature — a linha
 * existe, a timeline mostra uma frase, e ninguém nota que a frase está errada.
 * Decisão que se pode testar sem banco tem que ficar onde se testa sem banco.
 */
import type { AtividadeDaAgenda } from "./tipos";

/** O que o compromisso era antes; `null` quando ele está nascendo. */
export type SituacaoAnterior = "pending" | "confirmed" | null;

/**
 * Para onde ele foi. `rescheduled` não é situação no banco — é a TRANSIÇÃO de
 * remarcar, que no banco continua `confirmed` com outro horário. Ela existe
 * aqui porque a timeline precisa distinguir "marcou" de "mudou de ideia".
 */
export type Transicao =
  | "pending"
  | "confirmed"
  | "rescheduled"
  | "cancelled"
  | "completed"
  | "no_show";

/**
 * A atividade que a transição emite, ou `null` quando ela não é fato de linha
 * do tempo.
 *
 * ⚠️ NEM TODA MUDANÇA VIRA LINHA. Confirmar um pendente é operação interna — o
 * compromisso já entrou na timeline quando foi pedido — e um PATCH que só mexeu
 * em observação não mudou nada que o lead precise saber. Timeline com ruído é
 * timeline que ninguém lê, e aí o invariante 3 (log visível) morre por excesso
 * em vez de por falta.
 */
export function atividadeDaTransicao(
  de: SituacaoAnterior,
  para: Transicao,
): AtividadeDaAgenda | null {
  if (de === null) {
    // Nascer pendente ou confirmado é a MESMA notícia para quem lê: foi
    // marcado. A distinção é de operação, não de história.
    return para === "pending" || para === "confirmed" ? "appointment_scheduled" : null;
  }

  switch (para) {
    case "rescheduled":
      return "appointment_rescheduled";
    case "cancelled":
      return "appointment_cancelled";
    case "completed":
      return "appointment_completed";
    case "no_show":
      return "appointment_no_show";
    default:
      // `pending → confirmed` e qualquer transição para o mesmo estado.
      return null;
  }
}

/**
 * O compromisso precisa ser empurrado para o Google?
 *
 * ⚠️ `completed` e `no_show` NÃO empurram. O evento lá fora já aconteceu;
 * registrar aqui que a pessoa compareceu não muda nada no calendário dela.
 * Empurrar geraria escrita externa sem efeito — e escrita externa é a coisa mais
 * cara e mais arriscada que esta feature faz, então ela só acontece quando muda
 * o que o outro lado enxerga.
 */
export function precisaEmpurrarAoGoogle(de: SituacaoAnterior, para: Transicao): boolean {
  if (de === null) return para === "pending" || para === "confirmed";
  return para === "rescheduled" || para === "cancelled";
}
