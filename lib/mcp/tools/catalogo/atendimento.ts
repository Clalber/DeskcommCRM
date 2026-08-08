/**
 * Capacidades de ATENDIMENTO — cliente, conversa, mensagem.
 *
 * `description` fala com o modelo; `rotulo`/`explicacao`/`oQueToca` falam com o
 * humano que configura o agente. Ver `docs/handoffs/BRIEFING-ia-360.md` §4.
 */
import { declararTools } from "./tipos";

export const TOOLS_ATENDIMENTO = declararTools([
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
    name: "crm_propose_contact_field",
    category: "write",
    description:
      "Registra email/nome/telefone que o cliente informou como PROPOSTA (contact_field_proposals, " +
      "status='pending'). NADA é gravado no cadastro por conta desta chamada; uma pessoa confirma, e " +
      "a proposta vence sozinha. Recusa se já houver proposta viva do mesmo campo, se o valor for " +
      "igual ao gravado, ou se o contato foi anonimizado.",
    rotulo: "Anotar dado que o cliente informou",
    explicacao:
      "Quando o cliente diz o e-mail, o nome ou o telefone dele na conversa, guarda essa informação para uma pessoa conferir antes de entrar na ficha.",
    oQueToca: "Cadastro de clientes",
    // `atencao`, não `critico`: nada sai para o cliente e nada entra na ficha
    // por conta dela — o peso mora na confirmação, que é humana. Marcar
    // `critico` aqui faria a tela pedir cerimônia para uma anotação.
    risco: "atencao",
    // ⚠️ FORA de "atender", e a razão é o TETO — não o valor da capacidade.
    //
    // O pacote "Atender" já exigia 18 vagas e, com as 3 que um agente novo
    // costuma ter, chega a 21 num teto de 20: ligá-lo já era impossível sem
    // desligar algo antes (o e2e `capacidades-do-agente` mede exatamente isso).
    // Acrescentar esta capacidade ali levaria a 22 — pioraria um defeito
    // conhecido em troca de nada, porque o pacote continuaria não cabendo.
    //
    // Fica em "vender", que tem folga, e continua alcançável em qualquer jornada
    // pelo modo avançado. Quando o teto ou o tamanho do pacote for revisto, esta
    // linha é candidata natural a voltar.
    pacotes: ["vender"],
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
]);
