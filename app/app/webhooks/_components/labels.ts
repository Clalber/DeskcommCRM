/**
 * Labels pt-br congelados da aba Automações (UI-T3). Fonte única — a timeline
 * de atividade (UI-T4) importa os mesmos mapas, nunca redeclara os textos.
 */
import type { TRIGGER_EVENTS } from "@/lib/schemas/webhooks";

export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];
export type ActionType =
  | "create_or_move_lead"
  | "send_whatsapp_message"
  | "send_ai_message"
  | "add_tag"
  | "assign_owner"
  | "call_webhook"
  | "start_message_flow"
  | "notify_number";

export const TRIGGER_LABELS: Record<TriggerEvent, string> = {
  "lead.created": "Quando entrar um contato novo (webhook)",
  "lead.stage_changed": "Quando um lead mudar de etapa",
  "message.received": "Quando chegar mensagem no WhatsApp",
  "lead.tag_added": "Quando um lead ganhar uma tag",
  "contact.tag_added": "Quando um contato ganhar uma tag",
};

export const ACTION_LABELS: Record<ActionType, string> = {
  create_or_move_lead: "Criar/mover lead no funil",
  send_whatsapp_message: "Enviar mensagem no WhatsApp",
  send_ai_message: "Mensagem escrita pela IA",
  add_tag: "Adicionar tag",
  assign_owner: "Atribuir a um atendente",
  call_webhook: "Avisar outro sistema (webhook)",
  start_message_flow: "Iniciar fluxo de mensagem",
  // "meu" é a palavra que separa esta ação da de cima na hora do clique: uma
  // fala com o CLIENTE, a outra avisa a EQUIPE. Confundir as duas manda para o
  // lead uma mensagem escrita para o dono.
  notify_number: "Avisar um número meu (WhatsApp)",
};

/**
 * Linhas que aparecem em `actions_result` mas NÃO são ações escolhíveis.
 *
 * ⚠️ Não junte com `ACTION_LABELS`: o editor monta o seletor de ações com
 * `Object.keys(ACTION_LABELS)` (RuleEditor.tsx), então tudo que entrar lá vira
 * uma opção clicável — e "Enriquecimento do lead" não é algo que o operador
 * adiciona a uma regra, é um passo interno do motor que só ganha linha própria
 * quando FALHA (engine.ts empurra `{ type: "enrichment", status: "failed" }`
 * para o resultado, senão a falha morreria no log do servidor).
 *
 * Sem esta entrada, `actionLabel` cai no `?? type` e a tela mostra a palavra
 * `enrichment`, crua e em inglês, para quem opera em português ou espanhol.
 */
export const RESULTADO_NAO_ACAO: Record<string, string> = {
  enrichment: "Enriquecimento do lead",
};
