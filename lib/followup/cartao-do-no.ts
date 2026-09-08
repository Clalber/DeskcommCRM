/**
 * O QUE CADA CARD DO FLUXO CONTA SOBRE SI MESMO.
 *
 * ## O defeito que este módulo existe para consertar
 *
 * O card do gatilho imprimia `Início do fluxo` — o MESMO texto para os seis
 * tipos de gatilho. `describeNodeConfig("trigger", …)` recebe a config do nó, e
 * a config do trigger é `{}` por contrato: não há o que descrever. A informação
 * (agenda? etapa? silêncio? de quanto em quanto tempo?) mora no `trigger_config`
 * do FLUXO, e nunca chegava ao desenho — ficava num botão no topo da tela.
 *
 * Foi assim que um dono de produto, olhando o próprio fluxo publicado, disse:
 *
 *   "Tem lá os três cards, mas não tem nada visível para quem está do outro
 *    lado. Se for só você que enxerga, está errado."
 *
 * Estava. O canvas mostrava três caixas ligadas por setas escritas "Sempre" —
 * isso descreve a ORDEM, não o SENTIDO. Quem chega sem saber o que o autor sabia
 * não monta um fluxo desses; no máximo copia um pronto.
 *
 * ## A regra
 *
 * **Cada card responde às perguntas que ele mesmo levanta.** Um card de ação
 * levanta "avisar quem, por onde, dizendo o quê" — então responde as três. Um
 * card de gatilho levanta "quando, e por causa do quê" — então responde as duas.
 * Nada de "está nas configurações do fluxo".
 *
 * ## Por que aqui, e puro
 *
 * Fora do React: é decisão de CONTEÚDO ("o que este card diz"), não de pixel, e
 * decisão de conteúdo se testa sem montar componente. O card de gatilho de um
 * fluxo de compromisso ter de citar a Agenda é regra de produto — se ela morasse
 * dentro do `.tsx`, a única forma de vigiá-la seria um teste de tela.
 *
 * ⚠️ NADA AQUI INVENTA DADO. Onde o motor decide em tempo de execução — o canal
 * de saída é a conversa mais recente do contato, não uma escolha do fluxo —, o
 * card DIZ ISSO, em vez de mostrar um número que seria mentira em metade dos
 * casos. Card que chuta é pior que card vazio: o vazio manda perguntar, o chute
 * manda confiar.
 */
import type { TriggerConfig } from "./api-schemas";
import { conditionLabel } from "./edge-condition-options";
import {
  branchIdForCondition,
  nodeBranches,
  type FlowEdge,
  type FlowNode,
  type NodeType,
} from "./graph-schema";
import { rotuloDoRamo } from "./rotulo-do-ramo";
import { GATILHOS, RESULTADOS_DO_FIM } from "./vocabulario";

/** Uma linha de detalhe: rótulo curto à esquerda, valor à direita. */
export interface LinhaDoCartao {
  rotulo: string;
  valor: string;
  /** Destaca o valor — o dado que responde a pergunta principal daquela linha. */
  forte?: boolean;
  /**
   * Texto do USUÁRIO, que não passa pelo dicionário.
   *
   * A nota do nó de fim é escrita por quem monta o fluxo. Traduzida, uma nota
   * que por acaso coincida com uma chave («Para», «Vale») viraria espanhol na
   * cara de quem a escreveu em português. Improvável e constrangedor.
   */
  bruto?: boolean;
}

export interface ConteudoDoCartao {
  /** O título, quando o card sabe dizer algo melhor que o nome que o usuário deu. */
  titulo: string | null;
  linhas: LinhaDoCartao[];
  /** A ressalva que não cabe numa linha rotulada — regra que age sozinha. */
  rodape: string | null;
}

const VAZIO: ConteudoDoCartao = { titulo: null, linhas: [], rodape: null };

type ConfigOf<T extends NodeType> = Extract<FlowNode, { type: T }>["config"];

const minutosPorExtenso = (min: number): string => {
  if (min % 1440 === 0) {
    const dias = min / 1440;
    return dias === 1 ? "1 dia" : `${dias} dias`;
  }
  if (min % 60 === 0) {
    const horas = min / 60;
    return horas === 1 ? "1 hora" : `${horas} horas`;
  }
  return `${min} minutos`;
};

/**
 * O card do GATILHO, descrito pelo `trigger_config` do fluxo.
 *
 * `trigger` é o único tipo de nó cujo conteúdo NÃO vem da config do próprio nó
 * — ela é `{}`. Vem do fluxo. É por isso que esta função recebe o
 * `triggerConfig` e as outras não: sem ele, este card não tem o que dizer, e foi
 * exatamente essa a falha.
 *
 * `null` quando não há config (fluxo antigo, ou o painel ainda carregando): o
 * chamador cai no texto genérico de antes, que é feio e honesto.
 *
 * ⚠️ LIMITE CONHECIDO: `stage_change` não diz QUAL etapa. O card só recebe o
 * `stage_id`, e resolver o nome exigiria levar `useEtapasDeGatilho` até aqui —
 * é o único gatilho cujo card não distingue dois fluxos do mesmo tipo. Omissão
 * declarada, não esquecimento: o botão do topo já mostra a etapa com o funil.
 */
export function cartaoDoGatilho(triggerConfig: TriggerConfig | null): ConteudoDoCartao {
  if (!triggerConfig) return VAZIO;

  switch (triggerConfig.kind) {
    case "appointment_upcoming": {
      const antes = minutosPorExtenso(triggerConfig.params.minutes_before);
      return {
        titulo: `Quando faltar ${antes} para um compromisso`,
        linhas: [
          { rotulo: "Olha", valor: "a Agenda, a cada minuto" },
          { rotulo: "Só se", valor: "o compromisso ainda está de pé" },
        ],
        // As duas regras que agem sozinhas e que ninguém adivinha olhando o
        // desenho — e que são a diferença entre "confio" e "vou testar".
        rodape:
          "Cada compromisso entra uma vez só. Remarcou, entra de novo na hora nova.",
      };
    }
    case "silence": {
      const p = triggerConfig.params;
      const segmentos = p.segments?.length ? ` · ${p.segments.join(", ")}` : "";
      return {
        titulo: `Quando o contato some por ${minutosPorExtenso(p.threshold_minutes)}`,
        linhas: [
          { rotulo: "Olha", valor: "as conversas abertas, a cada minuto" },
          ...(segmentos ? [{ rotulo: "Só", valor: `quem tem a etiqueta${segmentos}` }] : []),
        ],
        rodape: null,
      };
    }
    case "stage_change":
      return {
        titulo: "Quando o negócio entra numa etapa",
        linhas: [{ rotulo: "Olha", valor: "o movimento dos cards no funil" }],
        rodape: "A entrada leva poucos minutos — não é instantânea.",
      };
    case "case_opened":
      return {
        titulo: "Quando o agente pede ajuda de um humano",
        linhas: [{ rotulo: "Vale", valor: "para qualquer caso desta conta" }],
        rodape: "Resolvido o caso, o acompanhamento é cancelado sozinho.",
      };
    case "webhook":
      return {
        titulo: "Quando uma automação manda",
        linhas: [{ rotulo: "Vem de", valor: "uma regra em Webhooks" }],
        rodape: null,
      };
    case "manual":
      return {
        titulo: "Quando alguém inicia à mão",
        linhas: [{ rotulo: "Vem de", valor: "a Fila, ou a API" }],
        rodape: null,
      };
    default:
      // `conversation_end` e o que vier depois: nomeia o gatilho em vez de
      // inventar frase. O vocabulário é exaustivo por tipo, então isto não
      // silencia um gatilho novo — ele aparece com o nome dele.
      return { titulo: GATILHOS[triggerConfig.kind], linhas: [], rodape: null };
  }
}

/**
 * Para QUEM a mensagem vai, dito pelo gatilho.
 *
 * Não é escolha do nó de ação: quem o fluxo alcança é decidido lá na entrada.
 * O card de ação levanta a pergunta, então é ele que a responde — mesmo que a
 * resposta more noutro lugar.
 */
function destinatarioPeloGatilho(triggerConfig: TriggerConfig | null): string {
  switch (triggerConfig?.kind) {
    case "appointment_upcoming":
      return "quem marcou o compromisso";
    case "stage_change":
      return "o contato do negócio que se moveu";
    case "case_opened":
      return "o contato da conversa que abriu o caso";
    case "silence":
      return "o contato que sumiu";
    default:
      return "o contato do acompanhamento";
  }
}

/** O card de AÇÃO: para quem, por onde, dizendo o quê. */
export function cartaoDaAcao(
  config: ConfigOf<"action">,
  triggerConfig: TriggerConfig | null,
): ConteudoDoCartao {
  // ⚠️ NÃO mostra número, e a frase MUDA POR MODO — porque a regra muda.
  //
  // Nos modos `ai_message` e `template` quem envia é o turno do agent-worker, e
  // ele usa `resolveSendTarget`: a conversa 1:1 mais recente do contato.
  //
  // No modo `text` há um SEGUNDO consumidor em produção, e ele decide diferente:
  // `enviarTextoFixoPendente` (chamado por `aplicar-inbound.ts` a partir da
  // reatividade, no cron de um minuto) drena o job pelo `sessaoProntaParaEnvio`
  // — a sessão WORKING de `created_at` mais antigo, isto é, O PRIMEIRO NÚMERO
  // CONECTADO. («número principal» seria conceito inventado: o produto não usa
  // essa palavra em tela nenhuma.) Numa conta com dois números,
  // os dois caminhos dão respostas diferentes, e quem envia é quem chegar
  // primeiro. Dizer só "a conversa mais recente" seria o card afirmando uma
  // garantia que o motor não dá. (Achado em auditoria; unificar os dois
  // caminhos é conserto de motor, e não cabia nesta entrega de tela.)
  const porOnde =
    config.mode === "text"
      ? "a conversa do contato — ou o primeiro número conectado, se ele escrever antes"
      : "a conversa mais recente do contato";
  const comuns: LinhaDoCartao[] = [
    { rotulo: "Para", valor: destinatarioPeloGatilho(triggerConfig), forte: true },
    { rotulo: "Por", valor: porOnde },
  ];

  switch (config.mode) {
    case "text":
      return {
        titulo: "Manda a mensagem para o cliente",
        linhas: comuns,
        rodape: "Texto fixo — a IA não reescreve.",
      };
    case "ai_message":
      return {
        titulo: "A IA escreve e manda",
        linhas: comuns,
        rodape: "O texto muda a cada envio.",
      };
    case "template":
      return {
        titulo: "Manda um modelo pronto",
        linhas: comuns,
        rodape: "O modelo vive em Respostas rápidas.",
      };
  }
}

/** O card de FIM: o que fica registrado, e o que acontece depois. */
export function cartaoDoFim(config: ConfigOf<"end">): ConteudoDoCartao {
  return {
    titulo: "Encerra o acompanhamento",
    linhas: [
      {
        rotulo: "Grava",
        // A nota do usuário é mais específica que o rótulo do desfecho — quando
        // ela existe, é ela que a pessoa escreveu para se lembrar.
        valor: config.note?.trim() || RESULTADOS_DO_FIM[config.outcome],
        forte: true,
        // Só é texto do usuário quando a nota existe; o rótulo do desfecho é
        // vocabulário do produto e deve ser traduzido.
        bruto: Boolean(config.note?.trim()),
      },
      { rotulo: "Depois", valor: "o contato fica livre para outro follow-up" },
    ],
    rodape: "Aparece na Fila e no histórico do acompanhamento.",
  };
}

/**
 * As chaves que o motor troca, com um valor de exemplo.
 *
 * Espelha `variaveis-do-compromisso.ts`, que é quem resolve de verdade. Não é
 * fonte da verdade — é vitrine: existe para o card mostrar «às 14:00» em vez de
 * `{{agendamento.hora}}`, porque a chave crua não diz nada a quem está montando
 * o fluxo pela primeira vez.
 *
 * ⚠️ `agendamento.profissional` está de fora DE PROPÓSITO, e a ausência é a
 * mensagem: `renderTemplate` bloqueia essa chave em mensagem ao cliente
 * (fronteira interno/cliente), então ela sai VAZIA de verdade. Mostrar um nome
 * de exemplo aqui ensinaria a escrever a chave errada. Quem quer o nome usa
 * `agendamento.com_quem`.
 */
const EXEMPLOS: Record<string, string> = {
  nome: "Ana",
  "contact.name": "Ana",
  "agendamento.hora": "14:00",
  "agendamento.data": "10/09/2026",
  "agendamento.quando": "Qui 10/09 às 14:00",
  "agendamento.tipo": "Reunião",
  "agendamento.com_quem": "Thiago",
  "agendamento.titulo": "Reunião de diagnóstico",
};

/**
 * O texto com as chaves trocadas por exemplos. `null` quando não há chave
 * nenhuma — aí o corpo já é o próprio exemplo e repeti-lo seria ruído.
 */
export function exemploDaMensagem(corpo: string): string | null {
  if (!corpo.includes("{{")) return null;
  let trocou = false;
  const texto = corpo.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (bruto, chave: string) => {
    const exemplo = EXEMPLOS[chave];
    if (exemplo === undefined) return bruto;
    trocou = true;
    return exemplo;
  });
  return trocou ? texto : null;
}

/**
 * O rótulo da seta quando a saída é "sempre".
 *
 * `Sempre` é o nome INTERNO da condição, e no desenho ele não diz nada: toda
 * seta de um fluxo linear vira "Sempre", "Sempre", "Sempre". Com o tipo do nó de
 * ORIGEM dá para dizer o que de fato acontece ali. As demais condições (sim/não,
 * classe da IA, ramo nomeado) já têm rótulo próprio e não passam por aqui.
 */
export function rotuloDaSaidaSempre(origem: NodeType | undefined): string {
  return rotuloPorTipo(origem);
}

/**
 * O rótulo da aresta no canvas — A DECISÃO INTEIRA, não um pedaço dela.
 *
 * ⚠️ ESTA FUNÇÃO EXISTE PORQUE A PRIMEIRA VERSÃO ERA CÓDIGO MORTO. O canvas
 * decidia assim:
 *
 *     const branch = nodeBranches(origem).find(b => b.id === branchIdForCondition(...));
 *     branch ? rotuloDoRamo(branch) : rotuloDaSaidaSempre(origem.type)
 *
 * e `nodeBranches` devolve `[fallback('Sempre')]` para TODO nó não-ramificado —
 * o `branch` era sempre encontrado, o segundo ramo nunca corria, e as setas
 * seguiam dizendo "Sempre". O teste passava porque exercitava a função isolada,
 * não o caminho do canvas: sabotagem verde que não provava ligação nenhuma.
 *
 * Agora a decisão MORA AQUI e o canvas só a chama. O teste usa nós de verdade e
 * passa por `nodeBranches`/`branchIdForCondition` como a tela passa.
 *
 * A régua é a MESMA do card: `branches.length > 1` é o que faz o nó ramificar
 * (é o que `NodeCard` usa para desenhar as linhas de saída). Com uma saída só,
 * o "ramo" é uma ficção interna — o que interessa é o que acontece ali.
 */
export function rotuloDaArestaNoCanvas(
  condition: FlowEdge["condition"],
  origem: FlowNode | undefined,
): string {
  const branches = origem ? nodeBranches(origem) : [];
  if (origem && branches.length > 1) {
    const alvo = branchIdForCondition(origem, condition);
    const ramo = branches.find((b) => b.id === alvo);
    if (ramo) return rotuloDoRamo(ramo);
  }
  if (condition.type === "always") return rotuloPorTipo(origem?.type);
  return conditionLabel(condition);
}

function rotuloPorTipo(origem: NodeType | undefined): string {
  switch (origem) {
    case "trigger":
      return "assim que disparar";
    case "action":
      return "depois de enviar";
    case "wait":
      return "passado o tempo";
    default:
      return "Sempre";
  }
}

/** O conteúdo do card, por tipo. Tipos sem card rico caem no `VAZIO`. */
export function conteudoDoCartao(
  type: NodeType,
  config: FlowNode["config"],
  triggerConfig: TriggerConfig | null,
): ConteudoDoCartao {
  switch (type) {
    case "trigger":
      return cartaoDoGatilho(triggerConfig);
    case "action":
      return cartaoDaAcao(config as ConfigOf<"action">, triggerConfig);
    case "end":
      return cartaoDoFim(config as ConfigOf<"end">);
    default:
      // Espera, condição, classificar, resposta e repetir seguem com o subtítulo
      // de uma linha que já tinham: eles descrevem a PRÓPRIA config, e o
      // `describeNodeConfig` faz isso bem. O buraco era nos três acima.
      return VAZIO;
  }
}
