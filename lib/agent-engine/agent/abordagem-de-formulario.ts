/**
 * A PRIMEIRA MENSAGEM, escrita pelo agente publicado, a partir do que a pessoa
 * preencheu.
 *
 * ═══ O problema que isto resolve ═══
 *
 * A automação já sabia enviar mensagem — mas só TEMPLATE, com `{{nome}}` e
 * `{{telefone}}`. Um formulário que pergunta "qual o seu segmento?", "quantos
 * funcionários?" e "qual sua maior dificuldade hoje?" produz respostas que
 * nenhum template alcança: quem tem 3 funcionários e quem tem 300 recebiam a
 * mesma frase.
 *
 * ═══ Por que o agente NÃO recebe um JSON e pronto ═══
 *
 * Porque um modelo que recebe `{"segmento":"clínica","dor":"agenda vazia"}` sem
 * mais nada escreve sobre o JSON, não com ele. Faltam DUAS coisas, e as duas
 * são declaradas aqui:
 *
 *  1. A SITUAÇÃO. Isto é uma abordagem fria, primeira mensagem, ninguém disse
 *     nada ainda — o oposto do turno normal do agente, que sempre responde a
 *     alguém. Sem essa moldura o modelo escreve como se continuasse uma
 *     conversa que não existe ("como combinamos…").
 *  2. A INTENÇÃO do dono do negócio: o que fazer com aqueles dados. É o campo
 *     que a tela chama de "O que a IA deve fazer com esses dados", e é o mesmo
 *     desenho do `prompt_hint` de um passo de follow-up
 *     (`lib/followup/graph-schema.ts` → `actionConfigSchema`), que já provou
 *     funcionar: instrução curta, escrita por quem conhece o negócio, injetada
 *     na abertura do turno.
 *
 * ═══ Via limpa, igual ao rascunho do composer ═══
 *
 * Reusa `loadPublishedAgentConfigById` + `runModelCall` SEM tools —
 * `result.text` já é a mensagem. Não reconstrói toolset, playbook nem
 * checkpoint: aqui não há conversa da qual manter estado, e dar `send_message`
 * ao modelo faria dele o remetente, quando quem envia (e aplica janela, throttle
 * e opt-out) é a ação da automação.
 */
import type pg from 'pg';
import type { ModelMessage } from 'ai';

import { loadPublishedAgentConfigById } from './agent-config';
import { runModelCall, type LlmEdgeConfig } from '../edge/llm/run-model-call';

export interface AbordagemDeFormularioInput {
  tenantId: string;
  /** Agente PUBLICADO que assina a mensagem. */
  agentId: string;
  /** Contato destinatário — `leadId` no vocabulário do seam (é o contact_id). */
  leadId: string;
  /** O que o dono do negócio quer que seja feito com os dados. */
  instrucao: string;
  /** Nome da fonte/origem, quando houver ("Landing de setembro"). */
  origem?: string | null;
  /** Os campos como a pessoa preencheu: rótulo → valor. */
  dados: Record<string, string>;
  /** `false` quando o gatilho não é um formulário (tag, etapa, mensagem). */
  veioDeFormulario: boolean;
}

export type AbordagemDeFormularioResult =
  | { ok: true; texto: string }
  | { ok: false; reason: 'sem_agente_publicado' | 'texto_vazio' };

/** Teto do texto que vai ao modelo — um formulário hostil não vira prompt gigante. */
const MAX_CAMPOS = 40;
const MAX_VALOR = 500;

/**
 * Os dados em LINHAS LEGÍVEIS, não em JSON.
 *
 * Modelo escreve melhor sobre prosa rotulada do que sobre estrutura, e o custo
 * é o mesmo. Também evita que uma chave com aspas ou chaves desbalanceadas do
 * formulário de alguém pareça sintaxe para o modelo.
 */
export function formatarDados(dados: Record<string, string>): string {
  const linhas = Object.entries(dados)
    .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
    .slice(0, MAX_CAMPOS)
    .map(([k, v]) => `- ${k}: ${v.slice(0, MAX_VALOR)}`);
  return linhas.length > 0 ? linhas.join('\n') : '(o formulário não trouxe nenhum campo além do contato)';
}

/** O bloco de MODO — o que o agente precisa saber que esta situação é. */
export function blocoDeModo(veioDeFormulario: boolean): string {
  const situacao = veioDeFormulario
    ? 'A pessoa ACABOU DE PREENCHER UM FORMULÁRIO e ainda não trocou nenhuma mensagem com a empresa. ' +
      'Esta é a PRIMEIRA mensagem que ela vai receber, e ela não está esperando por ela neste segundo.'
    : 'A pessoa entrou no funil por uma automação e ainda não trocou mensagem com a empresa nesta conversa. ' +
      'Esta é a PRIMEIRA mensagem que ela vai receber.';

  return (
    `[MODO ABORDAGEM INICIAL]\n${situacao}\n\n` +
    'Escreva UMA mensagem de WhatsApp para ela. Regras:\n' +
    '- Cumprimente e diga em uma frase por que você está falando com ela, ligando ao que ela preencheu.\n' +
    '- Use os dados abaixo para personalizar de verdade — quem preencheu percebe quando a mensagem serviria para qualquer um.\n' +
    '- NÃO invente nada que os dados não digam, e não repita os dados em forma de lista de volta para ela.\n' +
    '- NÃO peça de novo uma informação que ela já preencheu.\n' +
    '- Termine com UMA pergunta aberta, para ela ter o que responder.\n' +
    '- Curta: no máximo 3 frases. É WhatsApp, não e-mail.\n' +
    '- Responda SÓ com o texto da mensagem — sem aspas, sem assinatura, sem comentários seus.'
  );
}

export async function gerarAbordagemDeFormulario(
  db: pg.Pool,
  llmCfg: LlmEdgeConfig,
  input: AbordagemDeFormularioInput,
): Promise<AbordagemDeFormularioResult> {
  const agent = await loadPublishedAgentConfigById(db, input.tenantId, input.agentId);
  if (agent === null) return { ok: false, reason: 'sem_agente_publicado' };

  // O prompt do agente PRIMEIRO (é o prefixo estável, e é quem ele é); o modo
  // depois, porque é o que muda por chamada. Mesma ordem do rascunho do
  // composer e do turno de follow-up.
  const system = `${agent.systemPrompt}\n\n${blocoDeModo(input.veioDeFormulario)}`;

  const partes = [
    input.origem ? `Origem: ${input.origem}` : null,
    `O que a pessoa preencheu:\n${formatarDados(input.dados)}`,
    // A orientação do operador vem POR ÚLTIMO, que é a posição de mais peso
    // para o modelo — e é o que distingue esta abordagem de uma genérica.
    `## O que fazer com esses dados\n${input.instrucao.trim()}`,
  ].filter((p): p is string => p !== null);

  const messages: ModelMessage[] = [{ role: 'user', content: partes.join('\n\n') }];

  const { result } = await runModelCall(db, llmCfg, {
    tenantId: input.tenantId,
    leadId: input.leadId,
    jobId: null,
    purpose: 'automation_ai_message',
    system,
    messages,
    model: agent.model,
    llmOverride: { provider: agent.provider, credentialId: agent.credentialId },
    // SEM tools e SEM maxSteps: o SDK para no 1º step e `result.text` vem
    // pronto. Quem envia é a ação da automação, com janela e opt-out.
  });

  const texto = (result.text ?? '').trim();
  if (!texto) return { ok: false, reason: 'texto_vazio' };
  return { ok: true, texto };
}
