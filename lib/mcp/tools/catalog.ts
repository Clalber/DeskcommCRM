/**
 * Catalogo estatico de tools MCP — apenas metadados (id, label, categoria).
 *
 * Este modulo NAO importa handlers nem nada que dependa de `next/headers`,
 * `lib/supabase/server`, ou audit log. Pode ser importado com seguranca por
 * Client Components (ex: AgentForm via lib/ai/agents/validation.ts).
 *
 * Runtime de execucao (handlers reais) vive em `lib/mcp/tools/index.ts` e so
 * pode ser importado por Server Components / Route Handlers / server actions.
 *
 * DUAS AUDIENCIAS, DOIS TEXTOS (epico IA 360):
 *   - `description` fala com o MODELO. Tecnica; e por ela que a tool e escolhida.
 *   - `rotulo` / `explicacao` / `oQueToca` falam com o HUMANO que configura o
 *     agente — dono de clinica, de loja, de imobiliaria. Sem jargao. O gate
 *     mecanico vive em `tests/unit/catalogo-tools-leigo-friendly.test.ts`.
 *
 * `name` e CONTRATO DE WIRE: agentes ja publicados em VPS de clientes e clientes
 * MCP externos referenciam esta string. Nunca renomeie tool publicada — o nome
 * amigavel e camada de apresentacao, nao rename.
 */
import type { McpToolCategory } from "../types";
import type { ToolBundle, ToolRisk } from "./pacotes";

export interface McpToolCatalogEntry {
  /** CONTRATO DE WIRE — imutavel depois de publicado. */
  name: string;
  /** Dirige requiresScope/requiresRole. Nao e rotulo de tela. */
  category: McpToolCategory;
  /** Texto tecnico entregue ao MODELO. */
  description: string;

  // ---- camada de apresentacao: o que o HUMANO le ----
  /** Verbo no infinitivo, pt-BR. Ex: "Mover oportunidade de etapa". */
  rotulo: string;
  /** O que acontece quando a IA usa isto, em portugues de gente (>= 40 chars). */
  explicacao: string;
  /** O recurso na linguagem do usuario. Ex: "Funil de vendas". */
  oQueToca: string;
  risco: ToolRisk;
  /** >= 1 pacote. Uma capacidade pode servir a mais de uma jornada. */
  pacotes: ReadonlyArray<ToolBundle>;
}

export const TOOL_CATALOG: ReadonlyArray<McpToolCatalogEntry> = [
  // ---------------- read ----------------
  {
    name: "crm_search_contacts",
    category: "read",
    description: "Busca contatos por nome/telefone/email",
    rotulo: "Procurar cliente",
    explicacao:
      "Encontra um cliente pelo nome, telefone ou e-mail, para o agente saber com quem está falando antes de responder.",
    oQueToca: "Cadastro de clientes",
    risco: "seguro",
    pacotes: ["atender", "vender"],
  },
  {
    name: "crm_get_contact",
    category: "read",
    description: "Detalhe de um contato",
    rotulo: "Ver ficha do cliente",
    explicacao:
      "Abre a ficha completa de um cliente: dados de contato, histórico e por onde ele chegou até a empresa.",
    oQueToca: "Cadastro de clientes",
    risco: "seguro",
    pacotes: ["atender", "vender"],
  },
  {
    name: "crm_list_conversations",
    category: "read",
    description:
      "Lista conversas (com assignee_kind, assigned_to_user_name, tags, queue_position)",
    rotulo: "Listar conversas",
    explicacao:
      "Mostra as conversas em andamento, quem está cuidando de cada uma e a posição de cada cliente na fila de espera.",
    oQueToca: "Atendimento",
    risco: "seguro",
    pacotes: ["atender", "escalar"],
  },
  {
    name: "crm_get_conversation",
    category: "read",
    description:
      "Detalhe de conversa (com assignee_kind, assigned_to_user_name, tags, queue_position)",
    rotulo: "Ver uma conversa",
    explicacao:
      "Abre os detalhes de uma conversa: quem está atendendo, marcadores aplicados e há quanto tempo o cliente espera.",
    oQueToca: "Atendimento",
    risco: "seguro",
    pacotes: ["atender", "escalar"],
  },
  {
    name: "crm_get_conversation_history",
    category: "read",
    description: "Historico de mensagens de uma conversa",
    rotulo: "Ler o histórico da conversa",
    explicacao:
      "Lê as mensagens já trocadas com o cliente, para o agente responder sem pedir que ele repita o que já contou.",
    oQueToca: "Atendimento",
    risco: "seguro",
    pacotes: ["atender"],
  },
  {
    name: "crm_get_queue_status",
    category: "read",
    description: "Snapshot da fila de atendimento da org",
    rotulo: "Ver a fila de atendimento",
    explicacao:
      "Mostra quantas pessoas estão esperando atendimento agora e há quanto tempo, para priorizar quem espera mais.",
    oQueToca: "Atendimento",
    risco: "seguro",
    pacotes: ["atender", "escalar"],
  },
  {
    name: "crm_list_leads",
    category: "read",
    description: "Lista leads de um pipeline (com owner_user_name, stage, tags)",
    rotulo: "Listar oportunidades do funil",
    explicacao:
      "Lista as oportunidades de venda de um funil, com a etapa em que cada uma está e quem é o responsável por ela.",
    oQueToca: "Funil de vendas",
    risco: "seguro",
    pacotes: ["vender"],
  },
  {
    name: "crm_get_lead",
    category: "read",
    description: "Detalhe de lead (com owner_user_name, stage, tags)",
    rotulo: "Ver uma oportunidade",
    explicacao:
      "Abre os detalhes de uma oportunidade de venda: etapa atual, responsável, marcadores e valor do negócio.",
    oQueToca: "Funil de vendas",
    risco: "seguro",
    pacotes: ["vender"],
  },
  {
    name: "crm_list_pipelines",
    category: "read",
    description: "Lista pipelines da org",
    rotulo: "Listar funis",
    explicacao:
      "Mostra os funis de venda existentes e suas etapas, para o agente saber onde pode colocar uma oportunidade.",
    oQueToca: "Funil de vendas",
    risco: "seguro",
    pacotes: ["vender", "organizar"],
  },

  // ---------------- write ----------------
  {
    name: "crm_create_lead",
    category: "write",
    description: "Cria um lead",
    rotulo: "Criar oportunidade no funil",
    explicacao:
      "Registra uma nova oportunidade de venda no funil, para que o interesse demonstrado pelo cliente não se perca.",
    oQueToca: "Funil de vendas",
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_update_lead",
    category: "write",
    description: "Atualiza campos de um lead",
    rotulo: "Atualizar uma oportunidade",
    explicacao:
      "Altera dados de uma oportunidade de venda: valor do negócio, responsável e informações colhidas na conversa.",
    oQueToca: "Funil de vendas",
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_move_lead_stage",
    category: "write",
    description: "Move lead para outro stage",
    rotulo: "Mover oportunidade de etapa",
    explicacao:
      "Move a oportunidade para outra etapa do funil, registrando o avanço da negociação ou a perda do negócio.",
    oQueToca: "Funil de vendas",
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_send_whatsapp_message",
    category: "write",
    description: "Envia mensagem WhatsApp",
    rotulo: "Enviar mensagem no WhatsApp",
    explicacao:
      "Envia uma mensagem de WhatsApp para o cliente. Ele recebe de verdade, no celular dele, e não dá para desfazer.",
    oQueToca: "Atendimento",
    risco: "critico",
    pacotes: ["atender"],
  },
  {
    name: "crm_assign_conversation",
    category: "write",
    description: "Atribui/transfere/libera uma conversa",
    rotulo: "Direcionar conversa para alguém",
    explicacao:
      "Passa a conversa para um atendente, transfere para outra pessoa ou devolve o cliente para a fila de espera.",
    oQueToca: "Atendimento",
    risco: "atencao",
    pacotes: ["escalar", "atender"],
  },
  {
    name: "crm_manage_tags",
    category: "write",
    description: "Adiciona/remove tags em conversation/contact/lead",
    rotulo: "Aplicar marcadores",
    explicacao:
      "Adiciona ou remove marcadores numa conversa, cliente ou oportunidade, para organizar e filtrar a operação depois.",
    oQueToca: "Organização da operação",
    risco: "atencao",
    pacotes: ["organizar", "atender"],
  },

  // ---------------- handoff ----------------
  {
    name: "crm_request_human_handoff",
    category: "handoff",
    description: "Solicita handoff para atendente humano",
    rotulo: "Chamar um atendente humano",
    explicacao:
      "Interrompe o atendimento automático e chama uma pessoa, entregando um resumo do que já aconteceu na conversa.",
    oQueToca: "Atendimento",
    risco: "atencao",
    pacotes: ["escalar"],
  },
] as const;

export const VALID_TOOL_IDS: ReadonlyArray<string> = TOOL_CATALOG.map((t) => t.name);

export function catalogEntry(name: string): McpToolCatalogEntry | undefined {
  return TOOL_CATALOG.find((t) => t.name === name);
}
