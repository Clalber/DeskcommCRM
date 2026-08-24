/**
 * Quem manda nesta conversa — a pergunta com UMA resposta.
 *
 * ## O defeito que este arquivo existe para consertar
 *
 * "Quem está atendendo?" e "o automático está ligado?" eram respondidas por
 * SETE fatos espalhados: `conversations.status`, `assigned_to_user_id`,
 * `assignee_kind`, `bot_silenced_until`, `last_handoff_at/reason` e
 * `contacts.force_human`. Cada pedaço da tela juntava um subconjunto diferente —
 * o cabeçalho olhava dois (`bot_silenced_until || force_human`), a linha da lista
 * olhava um (`status === 'ai_handling'`, por COR), e o painel direito olhava
 * nenhum. Três leituras parciais do mesmo estado é como se produz uma tela em que
 * ninguém sabe quem manda.
 *
 * Aqui não nasce estado novo: a doutrina DIRC manda **C**alcular antes de
 * duplicar, e uma oitava coluna a sincronizar seria o anti-pattern nº 5. Isto é
 * uma função pura sobre a linha que a rota JÁ devolve.
 *
 * ## Por que estes gates e não outros
 *
 * O espelho é o do MOTOR, não o do desenhista. Quem cala o automático, medido no
 * código de produção:
 *
 *   1. `contacts.force_human`            → `isLeadInHandoff`, `before-send`, worker
 *   2. `conversations.bot_silenced_until`→ `isLeadInHandoff`, worker
 *   3. `conversations.assignee_kind='user'` → worker legado (`assigned_to_human`)
 *      e, desde a migration 0173, consequência de (2): assumir grava silêncio.
 *
 * Um motivo a MAIS na lista seria a tela afirmando sobre o motor uma coisa que o
 * motor não faz. Dois candidatos ficaram FORA de propósito:
 *
 *   * **janela de 24h** — o canal primário não tem janela (`capabilities.waha
 *     .freeformOutsideWindow`), e quem responde por isso na tela é o `JanelaSelo`,
 *     que é provider-aware. Recalcular 24h aqui diria "o automático está calado
 *     porque a janela fechou" em toda conversa WAHA com mais de um dia, ao lado de
 *     um selo dizendo o contrário.
 *   * **conversa encerrada** — já é o `status`, e o `STATUS_LABEL` do cabeçalho já
 *     a mostra. Ela entra como ESTADO DE COMANDO (`encerrada`), não como motivo.
 *
 * Informação com propósito (invariante 5): cada motivo aqui muda a ação de quem
 * lê. `resposta_humana_recente` existe justamente para dizer **não faça nada** —
 * é a janela deslizante de 5 min do envio manual, que se desfaz sozinha, e hoje a
 * tela oferece um botão de "devolver" para um estado que já vai voltar sozinho.
 */

/** As colunas de que esta função precisa — nada além. */
export interface FatosDoComando {
  status: string;
  assigned_to_user_id: string | null;
  /** Nome do atendente, quando o servidor conseguiu resolvê-lo (pode ser null). */
  assigned_to_user_name?: string | null;
  assignee_kind?: string | null;
  /** ISO, ou o literal `"infinity"` que o Postgres devolve para o silêncio durável. */
  bot_silenced_until?: string | null;
  /** A trava do CONTATO — irrevogável pelo agente. */
  force_human?: boolean | null;
}

export type Comando =
  /** Uma pessoa está no comando. */
  | { quem: "humano"; userId: string; nome: string | null }
  /** O automático está atendendo. */
  | { quem: "automatico" }
  /** Ninguém: o automático saiu e nenhuma pessoa assumiu. É a fila. */
  | { quem: "aguardando" }
  /** Acabou. Nem pessoa nem automático têm o que fazer aqui. */
  | { quem: "encerrada" };

export type MotivoDoSilencio =
  /** Alguém assumiu. Ação: só devolver ao automático libera. */
  | "atendente_no_comando"
  /** `contacts.force_human` — vale para TODAS as conversas deste cliente. */
  | "contato_travado"
  /** Alguém pausou de propósito, ou o automático passou o caso para uma pessoa. */
  | "pausado"
  /** Janela deslizante do envio manual. Ação: NENHUMA — volta sozinho. */
  | "resposta_humana_recente";

export interface ComandoDaConversa {
  comando: Comando;
  /** O automático responderia a próxima mensagem do cliente? */
  automaticoAtivo: boolean;
  /** Por que ele está calado. `null` quando está ativo. */
  motivo: MotivoDoSilencio | null;
  /**
   * Quando o silêncio se desfaz sozinho — só existe para
   * `resposta_humana_recente`. Nos outros motivos alguém tem de agir, e é a
   * diferença entre "espere" e "faça algo".
   */
  silencioAte: Date | null;
}

/** O literal que o PostgREST devolve para `timestamptz 'infinity'`. */
const INFINITO = "infinity";

const STATUS_ENCERRADOS = new Set(["closed", "archived"]);

/**
 * `"infinity"` NÃO passa por `new Date()` (devolve Invalid Date, e comparar
 * Invalid Date é sempre falso — o silêncio durável leria como "já venceu", que é
 * o oposto). Este é o mesmo cuidado que `extendBotSilence` documenta no envio.
 */
function silencioVigente(
  valor: string | null | undefined,
  agora: Date,
): { vigente: boolean; duravel: boolean; ate: Date | null } {
  if (valor === null || valor === undefined) return { vigente: false, duravel: false, ate: null };
  if (valor === INFINITO) return { vigente: true, duravel: true, ate: null };
  const ate = new Date(valor);
  if (Number.isNaN(ate.getTime())) {
    // Valor que não sabemos ler: falha FECHADA no que é ação (tratar como
    // calado) em vez de afirmar que o automático está ativo. Dizer "ativo" sobre
    // um dado ilegível é a frase tranquilizadora que a doutrina proíbe.
    return { vigente: true, duravel: true, ate: null };
  }
  return { vigente: ate.getTime() > agora.getTime(), duravel: false, ate };
}

export function comandoDaConversa(fatos: FatosDoComando, agora: Date = new Date()): ComandoDaConversa {
  const silencio = silencioVigente(fatos.bot_silenced_until, agora);
  const travado = fatos.force_human === true;
  const encerrada = STATUS_ENCERRADOS.has(fatos.status);

  const comando: Comando = fatos.assigned_to_user_id
    ? {
        quem: "humano",
        userId: fatos.assigned_to_user_id,
        nome: fatos.assigned_to_user_name ?? null,
      }
    : encerrada
      ? { quem: "encerrada" }
      : // Sem dono: quem manda depende do automático estar de pé. Calado e sem
        // dono é a conversa que o automático escalou e ninguém pegou — a fila.
        silencio.vigente || travado
        ? { quem: "aguardando" }
        : { quem: "automatico" };

  // Encerrada com dono: quem atendeu continua sendo o registro (o produto NÃO
  // solta o dono ao fechar, de propósito), mas o comando acabou.
  const comandoFinal: Comando =
    encerrada && comando.quem === "humano" ? { quem: "encerrada" } : comando;

  const automaticoAtivo = !encerrada && !travado && !silencio.vigente;

  const motivo: MotivoDoSilencio | null = automaticoAtivo
    ? null
    : encerrada
      ? null // Encerrada não é silêncio: é ausência de assunto. O estado já diz.
      : travado
        ? "contato_travado"
        : // Ordem importa: a trava do CONTATO é mais forte e mais ampla que a da
          // conversa, então ela nomeia o motivo mesmo havendo silêncio local —
          // senão a tela ofereceria "devolver ao automático" explicando o motivo
          // menor, e a pessoa clicaria esperando o efeito errado.
          silencio.duravel
          ? fatos.assigned_to_user_id
            ? "atendente_no_comando"
            : "pausado"
          : "resposta_humana_recente";

  return {
    comando: comandoFinal,
    automaticoAtivo,
    motivo,
    silencioAte: motivo === "resposta_humana_recente" ? silencio.ate : null,
  };
}

/**
 * O que a tela ESCREVE para cada estado. Fica aqui, ao lado da regra, porque foi
 * ter duas listas em arquivos diferentes que fez a timeline e o banco divergirem
 * (ver o cabeçalho de `lib/leads/activity-vocabulary.ts`).
 *
 * A palavra do estado é **"automático"**, nunca "IA": ela já é contrato em quatro
 * arquivos (`ConversationHeader`, `BudgetCard`, `orcamento.ts`, `dicionario.ts`) e
 * está travada por `tests/unit/handoff-por-orcamento.test.ts`, cujo controle
 * NEGATIVO usa literalmente "Voltar para a IA" como a sabotagem que deve reprovar.
 */
export const ROTULO_DO_COMANDO: Record<Comando["quem"], string> = {
  humano: "Em atendimento",
  automatico: "Automático atendendo",
  aguardando: "Aguardando atendente",
  encerrada: "Encerrada",
};

export const ROTULO_DO_MOTIVO: Record<MotivoDoSilencio, string> = {
  atendente_no_comando: "Automático pausado — alguém assumiu",
  contato_travado: "Automático pausado para este cliente",
  pausado: "Automático pausado",
  resposta_humana_recente: "Automático volta em instantes",
};
