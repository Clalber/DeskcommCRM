/**
 * O que ocupa um horário — e o que só parece ocupar.
 *
 * O motor (`horariosLivres`) recebe uma lista de `Ocupado` e não pergunta de
 * onde veio. Quem decide o que entra nela é este arquivo, e cada regra daqui
 * tem um desfecho concreto do lado de fora: oferecer um horário que não existe,
 * ou esconder um que existe.
 *
 * ─── A assimetria que governa todas as decisões deste arquivo ─────────────
 *
 * **Oferecer de menos é recuperável; marcar em cima não é.** Um horário
 * escondido volta assim que alguém remarca ou reconecta. Um paciente chegando
 * para uma consulta que não existe custa a confiança, e não tem desfazer.
 *
 * Por isso, na dúvida, OCUPA. Vale para status que ainda não existe no
 * vocabulário, para evento tentativo, e para a conexão do Google que caiu.
 */
import { SITUACOES_DO_AGENDAMENTO, type SituacaoDaConexao } from "./tipos";

import type { Ocupado } from "./horarios-livres";

/** A linha de `calendar_appointments` como o banco a devolve. */
export interface LinhaDeAgendamento {
  starts_at: string;
  ends_at: string;
  status: string;
}

/**
 * A linha de `calendar_external_events`, já com a situação da conexão junto.
 *
 * ⚠️ `calendar_external_events` NÃO TEM `user_id`: o dono vem por
 * `connection_id → calendar_connections.user_id`, então a query precisa do
 * join — e é lá que a situação da conexão é colhida de carona.
 */
export interface LinhaDeEventoExterno {
  starts_at: string;
  ends_at: string;
  transparency: string;
  status: string;
  situacaoDaConexao: string;
}

export interface OQueOcupa {
  ocupados: Ocupado[];
  /**
   * As situações de conexão que produziram algum conflito e NÃO estão
   * saudáveis — para a tela dizer "sua agenda do Google desconectou; estes
   * horários podem estar defasados" em vez de mentir nos dois sentidos.
   *
   * Falha fechada na AÇÃO (o horário fica bloqueado), aberta na INFORMAÇÃO.
   */
  fontesDefasadas: SituacaoDaConexao[];
}

/**
 * Situações do agendamento que LIBERAM o horário. Todo o resto ocupa —
 * inclusive um valor que ainda não exista neste vocabulário.
 *
 * `pending` NÃO está aqui de propósito: "aguardando confirmação" é um pedido em
 * cima daquele horário, e não contá-lo faria um segundo pedido ser aceito para
 * o mesmo instante, com um dos dois levando bolo.
 */
const LIBERAM_O_HORARIO = new Set<string>(["cancelled", "no_show"]);

/** O `transparent` do Google é o "estou livre" — quem o marca aceita compromisso por cima. */
const NAO_OCUPA_NO_GOOGLE = new Set<string>(["cancelled"]);

function intervaloValido(inicioISO: string, fimISO: string): Ocupado | null {
  const inicio = new Date(inicioISO);
  const fim = new Date(fimISO);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) return null;
  if (fim.getTime() <= inicio.getTime()) return null;
  return { inicio, fim };
}

export function ocupadosDoDono(
  agendamentos: LinhaDeAgendamento[],
  externos: LinhaDeEventoExterno[],
): OQueOcupa {
  const ocupados: Ocupado[] = [];
  const defasadas = new Set<SituacaoDaConexao>();

  for (const linha of agendamentos) {
    if (LIBERAM_O_HORARIO.has(linha.status)) continue;
    const intervalo = intervaloValido(linha.starts_at, linha.ends_at);
    if (intervalo) ocupados.push(intervalo);
  }

  for (const linha of externos) {
    if (linha.transparency === "transparent") continue;
    if (NAO_OCUPA_NO_GOOGLE.has(linha.status)) continue;
    const intervalo = intervaloValido(linha.starts_at, linha.ends_at);
    if (!intervalo) continue;

    // ⚠️ A CONEXÃO CAÍDA CONTINUA OCUPANDO (DECISÃO 3.2, versão corrigida).
    //
    // A primeira versão da decisão mandava parar de contar o calendário
    // expirado, justificando que contar "uma fonte que não responde marcaria em
    // cima de compromisso real". O argumento estava invertido, e o maestro o
    // corrigiu: PARAR de contar é que causa o marcar em cima. O compromisso
    // segue existindo na agenda do Google da pessoa; o que parou foi a
    // ATUALIZAÇÃO dele, não a existência.
    //
    // O que temos é o último estado conhecido. Contá-lo pode bloquear um
    // horário que já vagou — e aí alguém liga e remarca. Não contá-lo oferece
    // um horário ocupado — e aí o paciente chega e o médico não está.
    ocupados.push(intervalo);
    if (linha.situacaoDaConexao !== "healthy") {
      defasadas.add(linha.situacaoDaConexao as SituacaoDaConexao);
    }
  }

  return { ocupados, fontesDefasadas: [...defasadas] };
}

/**
 * As situações que OCUPAM, derivadas — e ela existe para ser VERIFICADA, não
 * para ser lida.
 *
 * ⚠️ A versão anterior deste bloco dizia "é a lista ao alcance de quem edita,
 * para a decisão não ser tomada por omissão" — e não era: ninguém a importava,
 * nenhum teste a lia, e o comentário prometia uma guarda que não existia. Órfão
 * com promessa é pior que órfão calado, porque quem lê acha que está protegido.
 *
 * O consumidor agora é `tests/unit/agenda-o-que-ocupa.test.ts`, que prova que
 * toda situação do vocabulário está classificada — ou libera, ou ocupa, nunca
 * fora das duas. Se `SITUACOES_DO_AGENDAMENTO` ganhar um valor e ninguém decidir
 * aqui, o teste diz qual.
 *
 * (Achado aplicando em mim a régua do Arquiteto: export sem consumidor NOMEADO
 * é dívida sem dono. Ele varreu `lib/agenda` e achou 28; cinco eram meus, e
 * quatro daqueles são tipos de assinatura — este era o único morto de verdade.)
 */
export const SITUACOES_QUE_OCUPAM = SITUACOES_DO_AGENDAMENTO.filter(
  (s) => !LIBERAM_O_HORARIO.has(s),
);

/** O par: as que liberam. Exportada para o mesmo teste poder somar as duas. */
export const SITUACOES_QUE_LIBERAM = SITUACOES_DO_AGENDAMENTO.filter((s) =>
  LIBERAM_O_HORARIO.has(s),
);
