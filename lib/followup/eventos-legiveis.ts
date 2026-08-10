/**
 * O que aconteceu no follow-up, em português.
 *
 * `followup_enrollment_events` grava a história do motor em vocabulário de
 * motor: `node_advanced`, `classify_enqueued`, `wait-2`. Isso é o certo para o
 * banco e é ilegível para quem opera — e uma tela que despeja o cru não é
 * "log visível", é dump. A diferença entre as duas coisas é este arquivo.
 *
 * ⚠️ PONTO DE TROCA. O vocabulário pt-br canônico do follow-up está sendo
 * escrito em `lib/followup/vocabulario.ts` (Wave 0). Quando ele existir, as
 * tabelas daqui saem e a tradução passa a importar de lá — dois dicionários
 * divergem em uma semana, e o que diverge em silêncio é o da tela. A fronteira
 * está desenhada para essa troca: quem consome chama `descreveEvento` /
 * `resumoDoNo`, nunca lê as tabelas direto.
 *
 * ⚠️ O ALVO ANDA JUNTO COM O QUE ACONTECEU. Guardar "falhou: timeout" e
 * descartar ONDE falhou produz uma tela que parece completa e não serve para
 * diagnosticar nada. Toda descrição daqui carrega o nó (e o dossiê carrega o
 * contato) — quando o nó sumiu do grafo pinado, o id cru aparece dito como id,
 * porque um alvo feio é melhor que alvo nenhum.
 */
import {
  CONDITION_FALSE_BRANCH_ID,
  CONDITION_TRUE_BRANCH_ID,
  NO_REPLY_BRANCH_ID,
  nodeBranches,
  type FlowEdge,
  type FlowNode,
} from "./graph-schema";

// ---------------------------------------------------------------------------
// Duração
// ---------------------------------------------------------------------------

/** "45 minutos", "4 horas", "2 dias" — arredondado para a maior unidade inteira. */
export function duracaoLegivel(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "tempo indefinido";
  const minutos = Math.round(ms / 60_000);
  if (minutos < 1) return "menos de um minuto";
  if (minutos < 60) return `${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  const horas = minutos / 60;
  if (horas < 24) {
    const h = Number.isInteger(horas) ? horas : Math.round(horas * 10) / 10;
    return `${h} ${h === 1 ? "hora" : "horas"}`;
  }
  const dias = horas / 24;
  const d = Number.isInteger(dias) ? dias : Math.round(dias * 10) / 10;
  return `${d} ${d === 1 ? "dia" : "dias"}`;
}

// ---------------------------------------------------------------------------
// O estado do follow-up
// ---------------------------------------------------------------------------

/** O tom do marcador de estado — os mesmos nomes que `<Badge variant>` aceita. */
export type TomDoStatus = "neutral" | "success" | "warning" | "error" | "info";

/**
 * Como cada estado se chama e se pinta na tela — em um lugar só.
 *
 * A fila e o dossiê mostram o MESMO status, e a tabela vivia dentro do
 * componente da fila: a segunda tela nasceria com a segunda cópia, e a divergência
 * entre elas seria a mesma que `activity-vocabulary.ts` já pagou uma vez.
 *
 * `paused_handoff` e `paused_manual` NÃO compartilham rótulo: os dois pararam o
 * fluxo, mas um é "alguém está atendendo agora" e o outro é "alguém mandou
 * segurar". Quem lê a fila decide coisas diferentes em cada caso.
 */
const STATUS: Record<string, { rotulo: string; tom: TomDoStatus }> = {
  active: { rotulo: "Ativo", tom: "success" },
  waiting_reply: { rotulo: "Aguardando resposta", tom: "info" },
  paused_handoff: { rotulo: "Pausado (atendimento humano)", tom: "warning" },
  paused_manual: { rotulo: "Pausado por uma pessoa", tom: "warning" },
  completed: { rotulo: "Concluído", tom: "neutral" },
  cancelled: { rotulo: "Cancelado", tom: "neutral" },
  dead: { rotulo: "Parou de tentar", tom: "error" },
  // Os três da PROMESSA (`cron_jobs`), que a fila mostra lado a lado com os
  // enrollments — o vocabulário da tela é um só, mesmo vindo de duas tabelas.
  agendada: { rotulo: "Agendada", tom: "info" },
  "concluída": { rotulo: "Concluída", tom: "neutral" },
  cancelada: { rotulo: "Cancelada", tom: "neutral" },
};

export function rotuloDoStatus(status: string): string {
  return STATUS[status]?.rotulo ?? status;
}

export function tomDoStatus(status: string): TomDoStatus {
  return STATUS[status]?.tom ?? "neutral";
}

// ---------------------------------------------------------------------------
// Os nós do fluxo pinado
// ---------------------------------------------------------------------------

/**
 * Um nó como o dossiê o mostra.
 *
 * É de propósito uma PROJEÇÃO, não o nó inteiro: a fila é de qualquer membro
 * (`viewer`) e o `config` carrega o `prompt_hint`, que é a instrução que o dono
 * do fluxo escreveu para o agente. Editar fluxo é `manager`; mandar o config
 * cru para a tela de leitura entregaria a viewer o que ele não pode nem abrir.
 */
export interface NoDoDossie {
  id: string;
  tipo: FlowNode["type"];
  /** O nome que a pessoa deu ao nó no construtor. */
  rotulo: string;
  /** O que o nó faz, em uma linha, sem instrução de prompt. */
  resumo: string;
}

const TIPO_DO_NO: Record<FlowNode["type"], string> = {
  trigger: "Início",
  wait: "Espera",
  condition: "Condição",
  ai_classify: "Interpretação da resposta",
  action: "Mensagem",
  end: "Fim",
};

const DESFECHO: Record<string, string> = {
  converted: "converteu",
  replied: "respondeu",
  exhausted: "esgotou as tentativas",
  opted_out: "pediu para parar",
  handoff: "passou para uma pessoa",
  custom: "desfecho próprio",
};

/** O rótulo do tipo, para o cabeçalho do passo. */
export function tipoDoNo(tipo: FlowNode["type"]): string {
  return TIPO_DO_NO[tipo] ?? "Passo";
}

export function resumoDoNo(node: FlowNode): NoDoDossie {
  const base = { id: node.id, tipo: node.type, rotulo: node.label };
  switch (node.type) {
    case "trigger":
      return { ...base, resumo: "onde o follow-up começa" };
    case "wait":
      return {
        ...base,
        resumo:
          node.config.mode === "fixed"
            ? `espera ${duracaoLegivel(node.config.duration_ms)}`
            : `espera adaptativa, entre ${duracaoLegivel(node.config.min_ms)} e ${duracaoLegivel(node.config.max_ms)}`,
      };
    case "condition":
      return {
        ...base,
        resumo: `confere ${node.config.checks.length} ${node.config.checks.length === 1 ? "critério" : "critérios"} do negócio`,
      };
    case "ai_classify":
      return { ...base, resumo: `classifica a resposta em: ${node.config.classes.join(", ")}` };
    case "action":
      return {
        ...base,
        resumo:
          node.config.mode === "ai_message"
            ? "o agente escreve e envia a mensagem"
            : "envia uma mensagem de modelo pronto",
      };
    case "end":
      return { ...base, resumo: `encerra — ${DESFECHO[node.config.outcome] ?? node.config.outcome}` };
  }
}

/**
 * Quando este caminho é seguido — o que a pessoa lê ao escolher um ramo para pular.
 *
 * `class_match`/`cond_result` viram frase, não jargão; o `always` diz que é o
 * caminho único, porque "sempre" sozinho não informa nada a quem está decidindo.
 *
 * ⚠️ O RAMO NOMEADO (grafo v2) SÓ TEM NOME NO NÓ. `{type:'branch', branch_id}`
 * carrega um id opaco, estável a renomeações — de propósito: o rótulo pertence
 * ao nó de origem, e replicá-lo na aresta faria as duas cópias divergirem no
 * primeiro rename. Por isso a origem é parâmetro. Sem ela, ou com um id que o
 * nó não declara mais, aparece o ID — feio e verdadeiro ganha de um nome
 * inventado, que mandaria o operador pelo caminho errado ao pular um passo.
 */
export function rotuloDaAresta(edge: FlowEdge, origem?: FlowNode): string {
  const c = edge.condition;
  if (c.type === "always") return "caminho normal";
  if (c.type === "cond_result") {
    return c.value ? "quando a condição é verdadeira" : "quando a condição é falsa";
  }
  if (c.type === "class_match") {
    return c.value === NO_REPLY_BRANCH_ID
      ? "quando ninguém responde"
      : `quando a resposta é “${c.value}”`;
  }

  if (c.branch_id === NO_REPLY_BRANCH_ID) return "quando ninguém responde";
  if (c.branch_id === CONDITION_TRUE_BRANCH_ID) return "quando a condição é verdadeira";
  if (c.branch_id === CONDITION_FALSE_BRANCH_ID) return "quando a condição é falsa";

  const nome = rotuloDoRamo(origem, c.branch_id);
  return nome ? `quando a resposta é “${nome}”` : `pelo ramo ${c.branch_id}`;
}

/**
 * O nome que a pessoa deu ao ramo, procurado onde ele mora: no nó de origem.
 *
 * Delega a `nodeBranches` — a lista de ramos é do contrato do grafo, e uma
 * segunda travessia aqui divergiria dela no primeiro tipo de nó que ganhasse
 * ramos (é o mesmo motivo de o rótulo não viver na aresta).
 */
function rotuloDoRamo(origem: FlowNode | undefined, branchId: string): string | null {
  if (!origem) return null;
  return nodeBranches(origem).find((b) => b.id === branchId)?.label ?? null;
}

/** O nó como aparece numa frase; id cru quando ele não está mais no grafo pinado. */
export function refDoNo(nodeId: string | null, nos: Record<string, NoDoDossie>): string {
  if (!nodeId) return "sem passo associado";
  const no = nos[nodeId];
  // O nó saiu do grafo (fluxo republicado, versão pinada divergente): dizer que
  // é um id EXPLICITAMENTE é melhor que exibi-lo como se fosse um nome, e muito
  // melhor que omitir — sem ele, o evento vira "falhou" sem onde.
  return no ? no.rotulo : `passo ${nodeId} (não existe mais neste fluxo)`;
}

// ---------------------------------------------------------------------------
// Os eventos
// ---------------------------------------------------------------------------

export interface EventoDeEnrollment {
  id: string;
  node_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface EventoLegivel {
  /** O QUE aconteceu. */
  titulo: string;
  /** O detalhe — destino, classe, prazo, erro. `null` quando não há o que dizer. */
  detalhe: string | null;
  /** ONDE aconteceu (o nó), sempre presente. */
  onde: string;
  /** Quem provocou: o motor, uma pessoa, o cliente. Decide a forma do marcador. */
  autor: "motor" | "pessoa" | "cliente";
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function quandoLegivel(iso: unknown): string | null {
  const s = texto(iso);
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(t));
}

/**
 * O passo do motor virado frase.
 *
 * O `default` NÃO devolve o `event_type` disfarçado de frase — mas também não o
 * esconde. Tipo desconhecido significa "o motor ganhou um passo que esta tela
 * ainda não aprendeu", e é exatamente aí que quem diagnostica precisa do código:
 * omitir produz uma linha que afirma menos do que se sabe. É a mesma escolha do
 * `refDoNo` acima — feio e verdadeiro ganha de bonito e mudo.
 */
export function descreveEvento(
  evento: EventoDeEnrollment,
  nos: Record<string, NoDoDossie>,
): EventoLegivel {
  const onde = refDoNo(evento.node_id, nos);
  const p = evento.payload ?? {};
  const motor = { onde, autor: "motor" as const };
  const pessoa = { onde, autor: "pessoa" as const };
  const cliente = { onde, autor: "cliente" as const };

  switch (evento.event_type) {
    case "node_advanced":
      return { titulo: "Seguiu em frente", detalhe: `foi para ${refDoNo(texto(p.next_node_id), nos)}`, ...motor };
    case "wait_started": {
      const ate = quandoLegivel(p.next_eval_at);
      const modo = texto(p.mode) === "smart" ? " (tempo escolhido pelo agente)" : "";
      return { titulo: "Começou a esperar", detalhe: ate ? `volta a olhar em ${ate}${modo}` : null, ...motor };
    }
    case "turn_enqueued":
      return { titulo: "Pediu ao agente para escrever a mensagem", detalhe: null, ...motor };
    case "classify_enqueued":
      return { titulo: "Pediu ao agente para interpretar a resposta", detalhe: null, ...motor };
    case "action_recheck": {
      const ate = quandoLegivel(p.next_eval_at);
      return {
        titulo: "Conferiu se a mensagem já tinha saído",
        detalhe: ate ? `confere de novo em ${ate}` : null,
        ...motor,
      };
    }
    case "action_sent":
      return { titulo: "Mensagem enviada", detalhe: null, ...motor };
    case "ai_classified":
      return {
        titulo: "O agente interpretou a resposta",
        detalhe: texto(p.class) ? `classificou como “${texto(p.class)}”` : null,
        ...motor,
      };
    case "flow_completed": {
      const desfecho = texto(p.outcome);
      const nota = texto(p.cancel_reason);
      return {
        titulo: "Fluxo concluído",
        detalhe: desfecho ? (DESFECHO[desfecho] ?? desfecho) : nota,
        ...motor,
      };
    }
    case "flow_dead":
      return { titulo: "O fluxo parou de tentar", detalhe: texto(p.reason), ...motor };
    case "node_failed":
      return { titulo: "Falhou neste passo", detalhe: texto(p.error), ...motor };
    case "inbound_woke":
      return { titulo: "O cliente respondeu — o fluxo acordou na hora", detalhe: null, ...cliente };
    case "reactivity_replied":
      return { titulo: "Encerrado porque o cliente respondeu", detalhe: null, ...cliente };
    case "reactivity_opted_out":
      return { titulo: "Encerrado porque o cliente pediu para parar", detalhe: null, ...cliente };
    case "reactivity_handoff_cancel":
      return { titulo: "Encerrado porque uma pessoa assumiu a conversa", detalhe: null, ...pessoa };
    case "handoff_paused":
      return { titulo: "Pausado porque uma pessoa assumiu a conversa", detalhe: null, ...pessoa };
    case "handoff_resumed":
      return { titulo: "Retomado: o atendimento voltou para o agente", detalhe: null, ...motor };
    case "cancelled_manual":
      return { titulo: "Cancelado por uma pessoa da equipe", detalhe: null, ...pessoa };
    case "paused_manual":
      return { titulo: "Pausado por uma pessoa da equipe", detalhe: texto(p.motivo), ...pessoa };
    case "resumed_manual": {
      const volta = quandoLegivel(p.next_eval_at);
      return { titulo: "Retomado por uma pessoa da equipe", detalhe: volta ? `volta a andar em ${volta}` : null, ...pessoa };
    }
    case "snoozed_manual": {
      const para = quandoLegivel(p.next_eval_at);
      return { titulo: "Adiado por uma pessoa da equipe", detalhe: para ? `adiado para ${para}` : null, ...pessoa };
    }
    case "skipped_manual":
      return {
        titulo: "Passo pulado por uma pessoa da equipe",
        detalhe: `seguiu para ${refDoNo(texto(p.next_node_id), nos)}`,
        ...pessoa,
      };
    default:
      return { titulo: "Passo registrado pelo motor", detalhe: `código: ${evento.event_type}`, ...motor };
  }
}
