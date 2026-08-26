/**
 * Os textos das telas que a equipe usa todo dia.
 *
 * ─── A regra de ouro deste arquivo ─────────────────────────────────────────
 *
 * A CHAVE é o texto em português. Não `inbox.filtro.todas`, não `INBOX_ALL`.
 *
 * Duas razões, e as duas doem quando se descobre tarde:
 *
 *   1. Quem lê o componente vê a frase, não um código. `t("Todas as tags")`
 *      continua legível; `t("inbox.tags.all")` obriga a abrir outro arquivo
 *      para saber o que a tela diz.
 *   2. Falta de tradução DEGRADA para português em vez de mostrar a chave. Um
 *      `t("Assumir")` sem entrada em espanhol devolve "Assumir" — feio, mas
 *      compreensível. Com chave simbólica devolveria `inbox.claim`, que não é
 *      nada para ninguém.
 *
 * ─── Parcial, e de propósito ───────────────────────────────────────────────
 *
 * Só as telas do dia a dia. Traduzir as 229 telas de uma vez é um projeto, e um
 * projeto entregue pela metade deixa a interface em dois idiomas ao mesmo
 * tempo. O que não está aqui aparece em português, que é o comportamento de
 * antes desta feature — nunca pior.
 */
import type { Idioma } from "./idiomas";

/** `pt-BR` não aparece: é a chave. Só o que DIFERE precisa de linha. */
type Traducoes = Record<string, Partial<Record<Exclude<Idioma, "pt-BR">, string>>>;

export const DICIONARIO: Traducoes = {
  // ─── Cabeçalhos de grupo da barra lateral ───
  //
  // ⚠️ NUNCA TIVERAM TRADUÇÃO, e o defeito era invisível: `Sidebar.tsx:83` já
  // chamava `t(group.label)`, então o espanhol recebia os cabeçalhos em
  // português e nada ficava vermelho — `traduzir()` devolve a chave ausente
  // como está. Achado pelo cruzamento novo entre DICIONARIO e NAV_GROUPS.
  Atendimento: { es: "Atención" },
  CRM: { es: "CRM" },
  "Agente de IA": { es: "Agente de IA" },
  Canais: { es: "Canales" },
  Análise: { es: "Análisis" },
  Organização: { es: "Organización" },

  // ─── Navegação (a barra lateral, presente em toda tela) ───
  Inbox: { es: "Inbox" },
  Radar: { es: "Radar" },
  "Respostas rápidas": { es: "Respuestas rápidas" },
  Contatos: { es: "Contactos" },
  // A CHAVE É O TEXTO PT-BR, então renomear um rótulo no registro de navegação
  // sem mexer aqui NÃO quebra teste nenhum — degrada em silêncio: `traduzir()`
  // devolve a chave ausente como português e o espanhol da barra lateral some.
  // "Kanban" saiu do menu (a tela virou "Funis"); "Etapas do funil" é o nome novo
  // da tela de configuração, que antes disputava "Funis" com ela.
  Funis: { es: "Embudos" },
  "Etapas do funil": { es: "Etapas del embudo" },
  Agentes: { es: "Agentes" },
  "Follow-ups": { es: "Seguimientos" },
  Roteadores: { es: "Enrutadores" },
  "Ver tudo em IA": { es: "Ver todo en IA" },
  Conexões: { es: "Conexiones" },
  Webhooks: { es: "Webhooks" },
  Desempenho: { es: "Rendimiento" },
  "Evolução da IA": { es: "Evolución de la IA" },
  "Audit Log": { es: "Registro de auditoría" },
  Configurações: { es: "Configuración" },
  Recolher: { es: "Contraer" },
  Buscar: { es: "Buscar" },

  // ─── Inbox: filtros e lista ───
  "Buscar mensagens…": { es: "Buscar mensajes…" },
  "Todos os números": { es: "Todos los números" },
  "Todas as tags": { es: "Todas las etiquetas" },
  "Apenas não lidos": { es: "Solo no leídos" },
  Fila: { es: "Cola" },
  Minhas: { es: "Mías" },
  Todas: { es: "Todas" },
  Fechadas: { es: "Cerradas" },
  IA: { es: "IA" },
  "Sem mensagens": { es: "Sin mensajes" },
  "Nenhuma conversa": { es: "Ninguna conversación" },

  // ─── Inbox: cabeçalho e ações da conversa ───
  Assumir: { es: "Asumir" },
  Liberar: { es: "Liberar" },
  Transferir: { es: "Transferir" },
  Lembrar: { es: "Recordar" },
  Fechar: { es: "Cerrar" },
  "Devolver ao automático": { es: "Devolver al automático" },
  Aberta: { es: "Abierta" },
  Fechada: { es: "Cerrada" },
  "Em atendimento": { es: "En atención" },
  "Aguardando atendente": { es: "Esperando agente" },
  "Automático atendendo": { es: "Automático atendiendo" },
  "Automático pausado": { es: "Automático pausado" },
  // Os motivos do silêncio (lib/inbox/comando-da-conversa.ts). "Automático
  // pausado" sozinho respondia a três situações que pedem ações diferentes:
  // alguém assumiu, o cliente inteiro está travado, ou foi pausa explícita.
  "Automático pausado — alguém assumiu": {
    es: "Automático pausado — alguien la asumió",
  },
  "Automático pausado para este cliente": {
    es: "Automático pausado para este cliente",
  },
  "Automático volta em instantes": { es: "El automático vuelve en instantes" },
  "Pausar o automático": { es: "Pausar el automático" },
  "Ver contato": { es: "Ver contacto" },

  // ─── Inbox: composer ───
  Responder: { es: "Responder" },
  "Nota interna": { es: "Nota interna" },
  "Escreva uma mensagem…": { es: "Escribe un mensaje…" },
  "Escreva uma nota interna… (só o time vê)": {
    es: "Escribe una nota interna… (solo la ve el equipo)",
  },
  Enviar: { es: "Enviar" },
  "Enviar modelo": { es: "Enviar plantilla" },
  "Escolha um modelo aprovado…": { es: "Elige una plantilla aprobada…" },

  // ─── Painel do contato ───
  CONTATO: { es: "CONTACTO" },
  "TAGS DA CONVERSA": { es: "ETIQUETAS DE LA CONVERSACIÓN" },
  "DEMANDAS ABERTAS": { es: "PEDIDOS ABIERTOS" },
  "LEADS RECENTES": { es: "LEADS RECIENTES" },
  "PEDIDOS RECENTES": { es: "PEDIDOS RECIENTES" },
  ATIVIDADE: { es: "ACTIVIDAD" },
  "Sem tags.": { es: "Sin etiquetas." },
  "Sem leads.": { es: "Sin leads." },
  "Sem pedidos.": { es: "Sin pedidos." },
  "Sem atividade.": { es: "Sin actividad." },
  "Nova tag…": { es: "Nueva etiqueta…" },
  "Sem próximo passo definido": { es: "Sin próximo paso definido" },
  "Marcar próximo passo": { es: "Marcar próximo paso" },
  Lead: { es: "Lead" },
  Tag: { es: "Etiqueta" },

  // ─── Kanban ───
  "Apenas atrasados": { es: "Solo atrasados" },
  "Sem responsável": { es: "Sin responsable" },
  "Editar campos": { es: "Editar campos" },
  "Linha do tempo": { es: "Línea de tiempo" },
  "DADOS DO NEGÓCIO": { es: "DATOS DEL NEGOCIO" },
  Título: { es: "Título" },
  Descrição: { es: "Descripción" },
  "Fechamento previsto": { es: "Cierre previsto" },
  "Tags (separadas por vírgula)": { es: "Etiquetas (separadas por coma)" },
  Salvar: { es: "Guardar" },
  vazio: { es: "vacío" },
  "Abrir conversa no Inbox": { es: "Abrir conversación en el Inbox" },

  // ─── Contatos ───
  "Buscar contatos…": { es: "Buscar contactos…" },
  Nome: { es: "Nombre" },
  Telefone: { es: "Teléfono" },
  "Nenhum contato": { es: "Ningún contacto" },
  Bloqueado: { es: "Bloqueado" },

  // ─── Conexões ───
  "Números por QR": { es: "Números por QR" },
  "API Oficial (Meta)": { es: "API Oficial (Meta)" },
  "Provedor parceiro": { es: "Proveedor asociado" },
  Conexão: { es: "Conexión" },
  "Modelos do parceiro": { es: "Plantillas del asociado" },
  "Templates da Meta": { es: "Plantillas de Meta" },
  Sincronizar: { es: "Sincronizar" },
  "Criar modelo": { es: "Crear plantilla" },
  Cancelar: { es: "Cancelar" },
  "Enviar para revisão": { es: "Enviar a revisión" },
  Reconectar: { es: "Reconectar" },
  Conectar: { es: "Conectar" },
  Desconectar: { es: "Desconectar" },
  "Fuso horário da janela": { es: "Huso horario de la ventana" },

  // ─── Estados e avisos que aparecem em várias telas ───
  "Carregando…": { es: "Cargando…" },
  "Nenhum resultado": { es: "Ningún resultado" },
  Erro: { es: "Error" },
  Excluir: { es: "Eliminar" },
  Editar: { es: "Editar" },
  Voltar: { es: "Volver" },
  // ─── Configurações: hub, perfil e tenant ───
  "Dados inválidos.": { es: "Datos inválidos." },
  "Perfil atualizado.": { es: "Perfil actualizado." },
  "Organização atualizada.": { es: "Organización actualizada." },
  "Salvando…": { es: "Guardando…" },
  "Nome completo": { es: "Nombre completo" },
  "Trocar email — em breve.": { es: "Cambiar email — próximamente." },
  "Fuso horário": { es: "Huso horario" },
  "Avatar URL": { es: "URL de avatar" },
  "Upload de arquivo — em breve. Cole uma URL pública.": {
    es: "Subida de archivo — próximamente. Pega una URL pública.",
  },
  "Nome de exibição": { es: "Nombre para mostrar" },
  "Razão social": { es: "Razón social" },
  "DPO email": { es: "Email del DPO" },
  "Retenção de mídia (dias)": { es: "Retención de medios (días)" },
  "URL política de privacidade": { es: "URL de la política de privacidad" },
  "Motivos de perda extras (separados por vírgula)": {
    es: "Motivos de pérdida adicionales (separados por coma)",
  },
  "ex: Sem orçamento, Concorrente": { es: "ej.: Sin presupuesto, Competencia" },
  "Adicionados ao set padrão. Cada pipeline pode ter seus próprios motivos.": {
    es: "Se agregan al conjunto predeterminado. Cada pipeline puede tener sus propios motivos.",
  },
  "Informações pessoais. Email só pode ser trocado em breve.": {
    es: "Información personal. El email solo se puede cambiar próximamente.",
  },
  "Dados da empresa, retenção de mídia, DPO. Admin only.": {
    es: "Datos de la empresa, retención de medios, DPO. Solo administradores.",
  },
  // ─── Hub de Configurações (NavHub: seções, rótulos e descrições das cards) ───
  "Sua conta": { es: "Tu cuenta" },
  "Sua empresa": { es: "Tu empresa" },
  "Dados e acesso": { es: "Datos y acceso" },
  Segurança: { es: "Seguridad" },
  Notificações: { es: "Notificaciones" },
  Equipe: { es: "Equipo" },
  "Distribuição de atendimento": { es: "Distribución de atención" },
  "Sua conta, os dados da empresa e quem tem acesso ao quê.": {
    es: "Tu cuenta, los datos de la empresa y quién tiene acceso a qué.",
  },
  "Seu nome, idioma, fuso horário e avatar.": {
    es: "Tu nombre, idioma, huso horario y avatar.",
  },
  "Verificação em duas etapas, códigos de recuperação e sessões.": {
    es: "Verificación en dos pasos, códigos de recuperación y sesiones.",
  },
  "Por onde e sobre o quê você quer ser avisado.": {
    es: "Por dónde y sobre qué quieres recibir avisos.",
  },
  "Quem trabalha aqui, com qual papel e quanta conversa cada um aguenta.": {
    es: "Quién trabaja aquí, con qué rol y cuántas conversaciones puede tomar cada uno.",
  },
  "Quem recebe cada cliente novo, e o que cada atendente enxerga.": {
    es: "Quién recibe cada cliente nuevo y qué ve cada agente.",
  },
  "Dados da empresa, retenção de dados e encarregado de LGPD.": {
    es: "Datos de la empresa, retención de datos y encargado de LGPD.",
  },
  "O nome e a cor que sua empresa mostra dentro do sistema.": {
    es: "El nombre y el color que tu empresa muestra dentro del sistema.",
  },
  "Plano e cobrança.": { es: "Plan y facturación." },
  "Pedidos de exportação e exclusão de dados feitos por clientes.": {
    es: "Solicitudes de exportación y eliminación de datos hechas por clientes.",
  },
  "Chaves para outro sistema conversar com o seu CRM.": {
    es: "Claves para que otro sistema converse con tu CRM.",
  },
  // ─── Shell persistente (sidebar, topbar, ⌘K, menu do usuário) ───
  "Navegação principal": { es: "Navegación principal" },
  "Expandir sidebar": { es: "Expandir barra lateral" },
  "Recolher sidebar": { es: "Contraer barra lateral" },
  Versão: { es: "Versión" },
  versão: { es: "versión" },
  "Nova versão": { es: "Nueva versión" },
  disponível: { es: "disponible" },
  "Abrir navegação": { es: "Abrir navegación" },
  "Buscar telas": { es: "Buscar pantallas" },
  "Buscar telas do sistema…": { es: "Buscar pantallas del sistema…" },
  Telas: { es: "Pantallas" },
  "Buscar…": { es: "Buscar…" },
  "Menu do usuário": { es: "Menú del usuario" },
  Sair: { es: "Cerrar sesión" },
  "Central de avisos": { es: "Central de avisos" },
  "em aberto": { es: "abiertos" },
  // ─── Agentes de IA: lista ───
  "Agents de IA": { es: "Agentes de IA" },
  "Configure o comportamento dos agents que respondem no WhatsApp.": {
    es: "Configura el comportamiento de los agentes que responden en WhatsApp.",
  },
  "Nenhum agent configurado": { es: "Ningún agente configurado" },
  "Crie um agent para responder a conversas no WhatsApp com IA. Você configura prompt, tools, gatilhos e janela de contexto.": {
    es: "Crea un agente para responder conversaciones de WhatsApp con IA. Configuras el prompt, las herramientas, los disparadores y la ventana de contexto.",
  },
  "Novo agente": { es: "Nuevo agente" },
  "Nenhum agent corresponde aos filtros atuais.": {
    es: "Ningún agente coincide con los filtros actuales.",
  },
  "Buscar por nome…": { es: "Buscar por nombre…" },
  "Buscar agents": { es: "Buscar agentes" },
  "Filtrar por status": { es: "Filtrar por estado" },
  Status: { es: "Estado" },
  status: { es: "estado" },
  Todos: { es: "Todos" },
  Publicado: { es: "Publicado" },
  Rascunho: { es: "Borrador" },
  Pausado: { es: "Pausado" },
  Arquivado: { es: "Archivado" },
  Inválido: { es: "Inválido" },
  default: { es: "predeterminado" },
  "Incluir arquivados": { es: "Incluir archivados" },
  "Menu de ações": { es: "Menú de acciones" },
  Duplicar: { es: "Duplicar" },
  Renomear: { es: "Renombrar" },
  Despausar: { es: "Reanudar" },
  Pausar: { es: "Pausar" },
  Arquivar: { es: "Archivar" },
  "Agent duplicado.": { es: "Agente duplicado." },
  "Agent reativado.": { es: "Agente reactivado." },
  "Agent pausado.": { es: "Agente pausado." },
  "Agent arquivado.": { es: "Agente archivado." },
  Falha: { es: "Error" },
  "Erro ao executar ação.": { es: "Error al ejecutar la acción." },
  "O agent deixa de responder gatilhos e some das listas ativas. Versões publicadas são preservadas para auditoria. Não é possível desarquivar pela UI nesta versão.": {
    es: "El agente deja de responder disparadores y desaparece de las listas activas. Las versiones publicadas se conservan para auditoría. No es posible desarchivar desde la interfaz en esta versión.",
  },
  "Renomear agent": { es: "Renombrar agente" },
  "Apenas o nome interno muda. Versões publicadas e histórico são preservados.": {
    es: "Solo cambia el nombre interno. Las versiones publicadas y el historial se conservan.",
  },
  "Renomeado.": { es: "Renombrado." },
  "Modelo da versão publicada — é o que atende o cliente.": {
    es: "Modelo de la versión publicada — es el que atiende al cliente.",
  },
  "Modelo do cadastro; nenhuma versão publicada ainda.": {
    es: "Modelo del registro; todavía no hay versión publicada.",
  },
  Tipo: { es: "Tipo" },
  Prioridade: { es: "Prioridad" },
  Visualizar: { es: "Ver" },
};

/**
 * Traduz, ou devolve o próprio texto.
 *
 * Nunca lança e nunca devolve vazio: um texto sem tradução aparece em
 * português, que é exatamente o comportamento de antes desta feature. Uma
 * tradução parcial não pode deixar a tela PIOR do que estava.
 */
export function traduzir(texto: string, idioma: Idioma): string {
  if (idioma === "pt-BR") return texto;
  return DICIONARIO[texto]?.[idioma] ?? texto;
}
