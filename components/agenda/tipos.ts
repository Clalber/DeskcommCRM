/**
 * Vocabulário da Agenda — em pt-br, como o resto do produto.
 *
 * O produto renomeia termo técnico na cara do usuário ("Kanban" virou "Funis",
 * "Templates" virou "Respostas rápidas"), então aqui não existe `Booking`,
 * `Event` nem `Slot`: existe agendamento, pessoa e horário.
 *
 * Este arquivo é só forma. Enquanto o schema da Wave 0 não existe, a tela é
 * alimentada por `dados-de-mentira.ts` — e quando existir, o que muda é a
 * origem, não o formato.
 */

/** As três visões da grade. A semana é o padrão de quem atende. */
export type VisaoDaAgenda = "dia" | "semana" | "mes";

/** Índice da trilha de cor, 1..8 — casa com `--agenda-pessoa-N` no globals.css. */
export type TrilhaDeCor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Pessoa = {
  id: string;
  nome: string;
  /** Atribuída na entrada da pessoa na organização, não sorteada a cada render. */
  trilha: TrilhaDeCor;
};

/**
 * De onde veio o agendamento. `google` entra como OCUPAÇÃO, não como
 * agendamento nosso: não se edita, não se cancela, não se remarca por aqui —
 * quem manda nele é a agenda de origem. A grade mostra isso desenhando-o
 * esmaecido e hachurado, e escondendo as ações.
 */
export type OrigemDoAgendamento = "deskcomm" | "google";

export type SituacaoDoAgendamento =
  | "confirmado"
  | "aguardando"
  | "cancelado"
  | "realizado"
  | "faltou";

export type Agendamento = {
  id: string;
  titulo: string;
  /** Quem vai ser atendido. Ausente em ocupação vinda do Google. */
  quemSeraAtendido?: string;
  /** Quem atende — é dele a cor do bloco. */
  responsavelId: string;
  /** ISO-8601. */
  comeca: string;
  termina: string;
  tipo?: string;
  local?: string;
  origem: OrigemDoAgendamento;
  situacao: SituacaoDoAgendamento;
};

/** Um horário oferecido pelo painel de marcação. */
export type HorarioLivre = {
  /** ISO-8601 do início. */
  instante: string;
  /** Rótulo já formatado no fuso de apresentação (ex.: "09:30"). */
  rotulo: string;
};
