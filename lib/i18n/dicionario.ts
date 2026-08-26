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
  // ─── Agentes de IA: editor de detalhe (AgentForm) ───
  "Dê um nome para este agente.": { es: "Ponle un nombre a este agente." },
  "O nome pode ter até 120 caracteres.": { es: "El nombre puede tener hasta 120 caracteres." },
  "Escreva as instruções do agente (pelo menos uma frase).": {
    es: "Escribe las instrucciones del agente (al menos una frase).",
  },
  "As instruções têm": { es: "Las instrucciones tienen" },
  "caracteres, e o máximo é 20.000. Corte": {
    es: "caracteres, y el máximo es 20.000. Recorta",
  },
  "para conseguir salvar.": { es: "para poder guardar." },
  "Escolha o modelo de inteligência artificial.": {
    es: "Elige el modelo de inteligencia artificial.",
  },
  "Escolha a chave de acesso da empresa de inteligência artificial.": {
    es: "Elige la clave de acceso de la empresa de inteligencia artificial.",
  },
  "Esta instalação não tem chave de": { es: "Esta instalación no tiene clave de" },
  "Escolha outra empresa de IA ou cadastre uma chave.": {
    es: "Elige otra empresa de IA o registra una clave.",
  },
  "Escolha por qual número de WhatsApp ele atende.": {
    es: "Elige por cuál número de WhatsApp atiende.",
  },
  "Máximo de": { es: "Máximo de" },
  "capacidades por agente.": { es: "capacidades por agente." },
  "Campo inválido.": { es: "Campo inválido." },
  "Salve o agent antes de publicar.": { es: "Guarda el agente antes de publicar." },
  "Sem rascunho para publicar.": { es: "No hay borrador para publicar." },
  "Resolva os erros do formulário.": { es: "Resuelve los errores del formulario." },
  "Salve o rascunho antes de publicar.": { es: "Guarda el borrador antes de publicar." },
  Credencial: { es: "Credencial" },
  "ainda não validada": { es: "todavía no validada" },
  inválida: { es: "inválida" },
  "Número WhatsApp não está conectado (status:": {
    es: "Número de WhatsApp no está conectado (estado:",
  },
  "Formulário inválido.": { es: "Formulario inválido." },
  "salvo.": { es: "guardado." },
  "Validação falhou.": { es: "La validación falló." },
  "Agent criado.": { es: "Agente creado." },
  "Falha ao publicar:": { es: "Error al publicar:" },
  "publicada e ativa.": { es: "publicada y activa." },
  Novo: { es: "Nuevo" },
  "O rascunho v": { es: "El borrador v" },
  " é anterior a esta versão e foi superado por ela — ele continua no Histórico.": {
    es: " es anterior a esta versión y fue superada por ella — sigue en el Historial.",
  },
  "(rascunho v": { es: "(borrador v" },
  " superado)": { es: " superado)" },
  "· editando a v": { es: "· editando la v" },
  "Sem versão": { es: "Sin versión" },
  "Descartar alterações": { es: "Descartar cambios" },
  "Salvar rascunho": { es: "Guardar borrador" },
  "Criar agente": { es: "Crear agente" },
  "Publicar v": { es: "Publicar v" },
  Publicar: { es: "Publicar" },
  "Publicando…": { es: "Publicando…" },
  "Papéis do agente": { es: "Roles del agente" },
  "Conversa com o cliente": { es: "Conversa con el cliente" },
  "Organiza o sistema": { es: "Organiza el sistema" },
  "Confere antes de enviar": { es: "Revisa antes de enviar" },
  "Quem é este agente": { es: "Quién es este agente" },
  "Ordem de preferência (0 a 1000)": { es: "Orden de preferencia (0 a 1000)" },
  "Quando mais de um agente puder atender a mesma conversa, o de número maior tenta primeiro. Se você só tem um agente, pode deixar como está.": {
    es: "Cuando más de un agente pueda atender la misma conversación, el de número mayor lo intenta primero. Si solo tienes un agente, puedes dejarlo como está.",
  },
  "A inteligência que ele usa": { es: "La inteligencia que usa" },
  "Empresa de inteligência artificial": { es: "Empresa de inteligencia artificial" },
  "Credencial selecionada está com status": {
    es: "La credencial seleccionada tiene el estado",
  },
  ". Publish bloqueado até validar.": { es: ". Publicación bloqueada hasta validar." },
  "Por qual número ele atende": { es: "Por cuál número atiende" },
  "Este agente é acionado pelo roteador": { es: "Este agente se activa mediante el enrutador" },
  "— o campo de número abaixo não se aplica.": {
    es: "— el campo de número de abajo no aplica.",
  },
  "Número conectado": { es: "Número conectado" },
  "Selecione um número": { es: "Selecciona un número" },
  "Nenhum número conectado": { es: "Ningún número conectado" },
  "Freios de segurança": { es: "Frenos de seguridad" },
  "Ações por atendimento (1 a 25)": { es: "Acciones por atención (1 a 25)" },
  "Volume de texto por atendimento": { es: "Volumen de texto por atención" },
  "Custo máximo por atendimento (centavos)": { es: "Costo máximo por atención (centavos)" },
  "Mensagens anteriores que ele lê": { es: "Mensajes anteriores que lee" },
  "Tamanho máximo desse histórico": { es: "Tamaño máximo de ese historial" },
  "As instruções dele": { es: "Sus instrucciones" },
  "Estilo de resposta": { es: "Estilo de respuesta" },
  "Responder em várias mensagens curtas (como uma pessoa digita)": {
    es: "Responder en varios mensajes cortos (como escribe una persona)",
  },
  "Em vez de um bloco único, a resposta sai em bolhas separadas, espaçadas pelo mesmo ritmo anti-banimento do envio. O agente também é instruído a escrever em parágrafos curtos.": {
    es: "En vez de un solo bloque, la respuesta sale en burbujas separadas, espaciadas con el mismo ritmo anti-bloqueo del envío. Al agente también se le indica que escriba en párrafos cortos.",
  },
  "Tamanho máximo por bolha (80–4000)": { es: "Tamaño máximo por burbuja (80–4000)" },
  "O que o agente pode fazer": { es: "Lo que el agente puede hacer" },
  "Ligue por jornada de trabalho. O agente só consegue fazer o que estiver ligado aqui — e o que estiver ligado, ele fará sozinho durante o atendimento.": {
    es: "Actívalo según la jornada de trabajo. El agente solo puede hacer lo que esté activado aquí — y lo que esté activado, lo hará solo durante la atención.",
  },
  "Quando ele entra em ação": { es: "Cuándo entra en acción" },
  "Passar para uma pessoa": { es: "Pasar a una persona" },
  "Deixar o agente chamar uma pessoa quando perceber que não é caso dele": {
    es: "Dejar que el agente llame a una persona cuando note que no es un caso suyo",
  },
  "Pedir ajuda sem sair da conversa": { es: "Pedir ayuda sin salir de la conversación" },
  "Deixar o agente pedir uma tarefa a alguém e seguir conversando": {
    es: "Dejar que el agente pida una tarea a alguien y siga conversando",
  },
  "Diferente de passar a conversa: aqui o agente continua atendendo. Quando esbarra em algo que só uma pessoa resolve — aprovar um desconto, por exemplo — ele abre um pedido interno e retoma assim que for respondido.": {
    es: "A diferencia de transferir la conversación: aquí el agente sigue atendiendo. Cuando se topa con algo que solo una persona puede resolver — aprobar un descuento, por ejemplo — abre un pedido interno y retoma en cuanto se lo respondan.",
  },
  "Follow-up": { es: "Seguimiento" },
  "Retomar sozinho quem parou de responder, para o interessado não sumir sem ninguém perceber.": {
    es: "Retomar solo a quien dejó de responder, para que el interesado no desaparezca sin que nadie lo note.",
  },
  "Habilitar gatilhos automáticos de follow-up": {
    es: "Habilitar disparadores automáticos de seguimiento",
  },
  "Os fluxos abaixo só entram em ação para um cliente se este agente estiver publicado com follow-up habilitado.": {
    es: "Los flujos de abajo solo entran en acción para un cliente si este agente está publicado con el seguimiento habilitado.",
  },
  // ─── Agentes de IA: seletor de modelo, capacidades, credencial, handoff ───
  Modelo: { es: "Modelo" },
  "Selecione um modelo": { es: "Selecciona un modelo" },
  "Nenhum modelo disponível": { es: "Ningún modelo disponible" },
  "Nenhuma capacidade disponível ainda para esta jornada.": {
    es: "Todavía no hay capacidades disponibles para esta jornada.",
  },
  "capacidade ligada": { es: "capacidad activada" },
  "capacidades ligadas": { es: "capacidades activadas" },
  de: { es: "de" },
  "Carregando as capacidades…": { es: "Cargando las capacidades…" },
  "Não foi possível carregar as capacidades. Recarregue a página.": {
    es: "No se pudieron cargar las capacidades. Recarga la página.",
  },
  "Limite atingido. Desligue algo para ligar outra coisa.": {
    es: "Alcanzaste el límite. Desactiva algo para activar otra cosa.",
  },
  "Acima disso o agente erra na hora de escolher o que usar.": {
    es: "Por encima de esto, el agente se equivoca al elegir qué usar.",
  },
  "Ligar este pacote passaria de": { es: "Activar este paquete pasaría de" },
  "capacidades (faltam": { es: "capacidades (faltan" },
  vaga: { es: "cupo" },
  vagas: { es: "cupos" },
  "). Desligue um pacote que você usa menos antes.": {
    es: "). Desactiva un paquete que uses menos antes.",
  },
  "Você já ligou": { es: "Ya activaste" },
  "capacidades. Desligue uma antes de ligar outra.": {
    es: "capacidades. Desactiva una antes de activar otra.",
  },
  "Só ligando uma a uma — o pacote não liga por você:": {
    es: "Solo activándolas una por una — el paquete no las activa por ti:",
  },
  "Esconder a lista completa": { es: "Ocultar la lista completa" },
  "Escolher uma a uma (modo avançado)": { es: "Elegir una por una (modo avanzado)" },
  "Cada linha é uma capacidade. O nome em cinza é como ela aparece para quem integra o sistema por fora.": {
    es: "Cada línea es una capacidad. El nombre en gris es como aparece para quien integra el sistema por fuera.",
  },
  "Uma capacidade ligada não existe mais": { es: "Una capacidad activada ya no existe" },
  "capacidades ligadas não existem mais": { es: "capacidades activadas ya no existen" },
  "nesta versão do sistema (": { es: "en esta versión del sistema (" },
  "). Elas continuam salvas, mas o agente não consegue usá-las.": {
    es: "). Siguen guardadas, pero el agente no puede usarlas.",
  },
  Desligar: { es: "Desactivar" },
  "essa capacidade": { es: "esa capacidad" },
  "essas capacidades": { es: "esas capacidades" },
  parcial: { es: "parcial" },
  "Chave de acesso": { es: "Clave de acceso" },
  "Escolha uma chave": { es: "Elige una clave" },
  "A chave desta instalação": { es: "La clave de esta instalación" },
  validada: { es: "validada" },
  validando: { es: "validando" },
  inativa: { es: "inactiva" },
  "Nenhuma credencial": { es: "Ninguna credencial" },
  cadastrada: { es: "registrada" },
  "Cadastrar credencial": { es: "Registrar credencial" },
  "na aba Credenciais.": { es: "en la pestaña Credenciales." },
  "Palavras que chamam uma pessoa na hora": { es: "Palabras que llaman a una persona al instante" },
  Remover: { es: "Quitar" },
  "Sem palavras-chave.": { es: "Sin palabras clave." },
  "Digite uma expressão e aperte Enter": { es: "Escribe una expresión y presiona Enter" },
  Adicionar: { es: "Agregar" },
  // ─── Agentes de IA: funis do agente, fluxos de follow-up ───
  "Em que negócios ele pode mexer": { es: "En qué negocios puede intervenir" },
  "Marque os funis que este assistente cuida. Ele conversa com qualquer cliente, mas só move, edita ou encerra negócio dos funis marcados aqui.": {
    es: "Marca los embudos que este asistente gestiona. Conversa con cualquier cliente, pero solo mueve, edita o cierra negocios de los embudos marcados aquí.",
  },
  "Você ainda não tem nenhum funil. Crie um em Funis para poder liberar o assistente.": {
    es: "Todavía no tienes ningún embudo. Crea uno en Embudos para poder habilitar al asistente.",
  },
  "(é para cá que vão as conversas novas)": {
    es: "(aquí es donde van las conversaciones nuevas)",
  },
  "— ele não sabe organizar este funil ainda": {
    es: "— todavía no sabe organizar este embudo",
  },
  "Sem nenhum funil marcado, ele conversa com os clientes normalmente, mas não mexe em negócio nenhum — nem move, nem encerra, nem marca.": {
    es: "Sin ningún embudo marcado, conversa con los clientes con normalidad, pero no interviene en ningún negocio — no mueve, no cierra, no marca.",
  },
  "Você marcou": { es: "Marcaste" },
  ", mas ninguém disse ao assistente o que cada etapa desse funil significa — ele vai atender e deixar os negócios parados onde estão.": {
    es: ", pero nadie le dijo al asistente qué significa cada etapa de ese embudo — va a atender y va a dejar los negocios detenidos donde están.",
  },
  "funis em que ninguém disse ao assistente o que cada etapa significa — ele vai atender e deixar os negócios parados onde estão.": {
    es: "embudos en los que nadie le dijo al asistente qué significa cada etapa — va a atender y va a dejar los negocios detenidos donde están.",
  },
  " Isso se configura em Configurações › Funis.": {
    es: " Esto se configura en Configuración › Embudos.",
  },
  "As conversas novas viram negócio em": {
    es: "Las conversaciones nuevas se convierten en negocio en",
  },
  ", que não está marcado. O assistente vai atender e os negócios vão se acumular ali sem que ele possa organizá-los.": {
    es: ", que no está marcado. El asistente va a atender y los negocios se van a acumular ahí sin que pueda organizarlos.",
  },
  "Carregando fluxos publicados…": { es: "Cargando flujos publicados…" },
  "Erro ao carregar fluxos.": { es: "Error al cargar los flujos." },
  "Nenhum fluxo publicado ainda.": { es: "Todavía no hay ningún flujo publicado." },
  "Publique um fluxo de follow-up": { es: "Publica un flujo de seguimiento" },
  "para vinculá-lo.": { es: "para vincularlo." },
  "Fluxos publicados": { es: "Flujos publicados" },
  "Máximo de 20 fluxos por agent.": { es: "Máximo de 20 flujos por agente." },
  // ─── Agentes de IA: gatilhos e painel de segurança ───
  "O que faz ele responder": { es: "Qué hace que responda" },
  "Uma mensagem nova do cliente": { es: "Un mensaje nuevo del cliente" },
  "Não responder em grupos": { es: "No responder en grupos" },
  "Não responder às mensagens que saem do seu próprio número": {
    es: "No responder a los mensajes que salen de su propio número",
  },
  "Só responder quando a mensagem falar de algo específico (opcional)": {
    es: "Solo responder cuando el mensaje hable de algo específico (opcional)",
  },
  "Ex.: pedido|status|orçamento": { es: "Ej.: pedido|estado|presupuesto" },
  "Deixe em branco para o agente responder a tudo. Se preencher, ele só entra quando a mensagem contiver uma dessas palavras — separe por barra vertical (|). Aceita expressão regular, para quem já conhece.": {
    es: "Déjalo en blanco para que el agente responda a todo. Si lo completas, solo interviene cuando el mensaje contenga alguna de esas palabras — sepáralas con una barra vertical (|). Acepta expresión regular, para quien ya la conozca.",
  },
  "Quantos atendimentos ao mesmo tempo": { es: "Cuántas atenciones al mismo tiempo" },
  "Um de cada vez por conversa": { es: "Una a la vez por conversación" },
  "Um de cada vez por cliente": { es: "Una a la vez por cliente" },
  "Só atender em horário de funcionamento": { es: "Solo atender en horario de funcionamiento" },
  Início: { es: "Inicio" },
  Fim: { es: "Fin" },
  Dias: { es: "Días" },
  Dom: { es: "Dom" },
  Seg: { es: "Lun" },
  Ter: { es: "Mar" },
  Qua: { es: "Mié" },
  Qui: { es: "Jue" },
  Sex: { es: "Vie" },
  Sáb: { es: "Sáb" },
  "Isto não se desliga.": { es: "Esto no se puede desactivar." },
  "carregando…": { es: "cargando…" },
  Ligada: { es: "Activada" },
  Desligada: { es: "Desactivada" },
  "— vem da configuração do servidor": { es: "— viene de la configuración del servidor" },
  "Ligada por você": { es: "Activada por ti" },
  "Desligada por você": { es: "Desactivada por ti" },
  Custa: { es: "Cuesta" },
  ". O modelo usado se escolhe em": { es: ". El modelo usado se elige en" },
  "Provedores de IA": { es: "Proveedores de IA" },
  "Antes de cada mensagem sair": { es: "Antes de que cada mensaje salga" },
  "O assistente escreve, e o sistema confere. São": {
    es: "El asistente escribe, y el sistema revisa. Son",
  },
  "verificações, nesta ordem — a primeira que barra interrompe as seguintes, e o assistente recebe de volta o motivo para reescrever.": {
    es: "verificaciones, en este orden — la primera que bloquea interrumpe las siguientes, y el asistente recibe de vuelta el motivo para reescribir.",
  },
  "Antes de o assistente ler": { es: "Antes de que el asistente lea" },
  "Esta roda sobre a mensagem que chega, antes das outras — por isso aparece separada.": {
    es: "Esta corre sobre el mensaje que llega, antes que las demás — por eso aparece por separado.",
  },
  // ─── Agentes de IA: papel Operador, propostas, diálogo de publicação ───
  "Nenhuma conversa passou por aqui nos últimos": {
    es: "Ninguna conversación pasó por aquí en los últimos",
  },
  "dias. Assim que o assistente atender alguém, o que ele organizar aparece nesta área.": {
    es: "días. En cuanto el asistente atienda a alguien, lo que organice aparece en esta área.",
  },
  "Como está indo (últimos": { es: "Cómo va (últimos" },
  "dias)": { es: "días)" },
  "Organizou o sistema em": { es: "Organizó el sistema en" },
  "conversas.": { es: "conversaciones." },
  De: { es: "De" },
  "promessas feitas ao cliente,": { es: "promesas hechas al cliente," },
  "ficaram com um responsável": { es: "quedaron con un responsable" },
  " — e ": { es: " — y " },
  " não.": { es: " no." },
  "Elas aparecem na Central de avisos, uma por conversa.": {
    es: "Aparecen en la Central de avisos, una por conversación.",
  },
  Em: { es: "En" },
  "delas o assistente tinha algo a registrar e nenhuma capacidade marcada para isso — o que resolve é marcar abaixo o que ele pode fazer.": {
    es: "de ellas el asistente tenía algo que registrar y ninguna capacidad marcada para eso — lo que lo resuelve es marcar abajo lo que puede hacer.",
  },
  "Deixar o agente organizar o sistema depois de cada conversa": {
    es: "Dejar que el agente organice el sistema después de cada conversación",
  },
  "Quem conversa com o cliente é uma coisa; quem mantém o sistema em dia é outra. Separar os dois evita que o assistente comente com o cliente o que está fazendo por dentro — e é o que faz ele realmente registrar, em vez de só responder bem.": {
    es: "Quien conversa con el cliente es una cosa; quien mantiene el sistema al día es otra. Separar los dos evita que el asistente le comente al cliente lo que está haciendo por dentro — y es lo que hace que realmente registre, en vez de solo responder bien.",
  },
  "Com isto desligado:": { es: "Con esto desactivado:" },
  "o assistente continua atendendo e o básico continua sendo registrado sozinho — a etapa do cliente, o retorno que ele prometeu e o histórico da conversa.": {
    es: "el asistente sigue atendiendo y lo básico se sigue registrando solo — la etapa del cliente, el retorno que prometió y el historial de la conversación.",
  },
  "O que ele deixa de fazer é": { es: "Lo que deja de hacer es" },
  "decidir sobre a operação": { es: "decidir sobre la operación" },
  ": abrir chamados, distribuir para a pessoa certa, organizar marcadores e etapas. Isso passa a ser trabalho de alguém do time.": {
    es: ": abrir tickets, distribuir a la persona correcta, organizar etiquetas y etapas. Eso pasa a ser trabajo de alguien del equipo.",
  },
  "A inteligência que ele usa para organizar": { es: "La inteligencia que usa para organizar" },
  "Pode ser diferente da que conversa. Organizar o sistema é uma tarefa mais mecânica que atender uma pessoa — costuma sair bem com um modelo mais barato.": {
    es: "Puede ser diferente de la que conversa. Organizar el sistema es una tarea más mecánica que atender a una persona — suele funcionar bien con un modelo más barato.",
  },
  "A mesma que conversa": { es: "El mismo que conversa" },
  "Usar a mesma que conversa": { es: "Usar el mismo que conversa" },
  "O que ele pode mexer no sistema": { es: "Lo que puede modificar en el sistema" },
  "Esta lista é só deste papel — nada aqui é usado enquanto ele conversa com o cliente. Ligue por jornada de trabalho.": {
    es: "Esta lista es solo de este rol — nada aquí se usa mientras conversa con el cliente. Actívalo según la jornada de trabajo.",
  },
  "Sem nada marcado, ele ainda avisa você quando o assistente prometer algo a um cliente e ninguém cumprir — mas não consegue resolver sozinho.": {
    es: "Sin nada marcado, igual te avisa cuando el asistente le prometa algo a un cliente y nadie lo cumpla — pero no puede resolverlo solo.",
  },
  "Regra de playbook": { es: "Regla de playbook" },
  "Caso exemplar": { es: "Caso ejemplar" },
  "Gatilho de reengajamento": { es: "Disparador de reenganche" },
  "Memória da organização": { es: "Memoria de la organización" },
  "Proposta aplicada como memória da organização.": {
    es: "Propuesta aplicada como memoria de la organización.",
  },
  "Proposta aplicada como versão nova do agente.": {
    es: "Propuesta aplicada como versión nueva del agente.",
  },
  "Não foi possível aplicar a proposta.": { es: "No se pudo aplicar la propuesta." },
  "Nenhuma proposta ainda": { es: "Todavía no hay propuestas" },
  "O assistente aprende com as conversas reais e propõe melhorias aqui. Você decide o que entra — nada é aplicado sozinho.": {
    es: "El asistente aprende de las conversaciones reales y propone mejoras aquí. Tú decides qué se aplica — nada se aplica solo.",
  },
  aplicada: { es: "aplicada" },
  pendente: { es: "pendiente" },
  proposta: { es: "propuesta" },
  "Aplicar como memória da org": { es: "Aplicar como memoria de la org" },
  "Aplicar como versão nova": { es: "Aplicar como versión nueva" },
  "Esta versão se tornará a ativa no atendimento. A versão atual (": {
    es: "Esta versión se convertirá en la activa en la atención. La versión actual (",
  },
  ") será marcada como superseded.": { es: ") quedará marcada como reemplazada." },
  nenhuma: { es: "ninguna" },
  "Provider:": { es: "Proveedor:" },
  "Modelo:": { es: "Modelo:" },
  "Tools adicionadas:": { es: "Herramientas agregadas:" },
  "Tools removidas:": { es: "Herramientas eliminadas:" },
  "Prompt:": { es: "Prompt:" },
  chars: { es: "caracteres" },
  "sem alteração": { es: "sin cambios" },
  // ─── Agentes de IA: execuções e trace ───
  Execução: { es: "Ejecución" },
  Iniciado: { es: "Iniciado" },
  Concluído: { es: "Concluido" },
  "Tokens (in/out)": { es: "Tokens (entrada/salida)" },
  Custo: { es: "Costo" },
  Latência: { es: "Latencia" },
  Steps: { es: "Pasos" },
  error: { es: "error" },
  "Ver conversa": { es: "Ver conversación" },
  "Ver inbound": { es: "Ver mensaje entrante" },
  Trace: { es: "Traza" },
  "Selecione uma execução.": { es: "Selecciona una ejecución." },
  "Sem trace disponível.": { es: "Sin traza disponible." },
  "(sem nome)": { es: "(sin nombre)" },
  erro: { es: "error" },
  Args: { es: "Argumentos" },
  Result: { es: "Resultado" },
  Error: { es: "Error" },
  "Mensagem que SERIA enviada": { es: "Mensaje que SE enviaría" },
  "Sem tool calls (resposta direta do LLM).": {
    es: "Sin llamadas a herramientas (respuesta directa del LLM).",
  },
  "execuções recentes": { es: "ejecuciones recientes" },
  "Atualizando…": { es: "Actualizando…" },
  Atualizar: { es: "Actualizar" },
  "Erro ao carregar execuções.": { es: "Error al cargar las ejecuciones." },
  Ações: { es: "Acciones" },
  "Nenhuma execução ainda.": { es: "Todavía no hay ejecuciones." },
  teste: { es: "prueba" },
  produção: { es: "producción" },
  Detalhes: { es: "Detalles" },
  // ─── Agentes de IA: painel de teste ───
  "A resposta não usa palavras internas do sistema.": {
    es: "La respuesta no usa palabras internas del sistema.",
  },
  "Esta resposta usa palavras que o cliente não deveria ver.": {
    es: "Esta respuesta usa palabras que el cliente no debería ver.",
  },
  "Em produção ela seria barrada e o assistente teria que reescrever. Encontrado:": {
    es: "En producción sería bloqueada y el asistente tendría que reescribir. Encontrado:",
  },
  "O teste não consegue verificar tudo (": { es: "La prueba no puede verificarlo todo (" },
  "verificações ficam de fora)": { es: "verificaciones quedan afuera)" },
  "Estas só acontecem numa conversa real, com um cliente de verdade do outro lado. Para ver a lista inteira do que é conferido — e o que cada verificação protege — abra a aba": {
    es: "Esto solo ocurre en una conversación real, con un cliente de verdad del otro lado. Para ver la lista completa de lo que se verifica — y qué protege cada verificación — abre la pestaña",
  },
  "Configure e salve uma versão antes de testar.": {
    es: "Configura y guarda una versión antes de probar.",
  },
  "(publicada)": { es: "(publicada)" },
  "(rascunho)": { es: "(borrador)" },
  "Informe uma mensagem de teste.": { es: "Ingresa un mensaje de prueba." },
  "Teste executado.": { es: "Prueba ejecutada." },
  "Erro inesperado.": { es: "Error inesperado." },
  "Versão alvo": { es: "Versión de destino" },
  "⚠ Modo teste consome créditos do provider.": {
    es: "⚠ El modo de prueba consume créditos del proveedor.",
  },
  "Nenhuma mensagem é enviada via WhatsApp. O run é registrado como dry-run.": {
    es: "No se envía ningún mensaje por WhatsApp. La ejecución se registra como dry-run.",
  },
  "Mensagem do cliente (sample)": { es: "Mensaje del cliente (ejemplo)" },
  "Oi, quanto custa X?": { es: "Hola, ¿cuánto cuesta X?" },
  "Nome (opcional)": { es: "Nombre (opcional)" },
  "Telefone (opcional)": { es: "Teléfono (opcional)" },
  "Executando…": { es: "Ejecutando…" },
  "Executar teste": { es: "Ejecutar prueba" },
  Resultado: { es: "Resultado" },
  "Nenhum teste executado ainda.": { es: "Todavía no se ejecutó ninguna prueba." },
  "Executando dry-run…": { es: "Ejecutando dry-run…" },
  "Stub: o runtime real é entregue na S-13.08. O trace abaixo é simulado.": {
    es: "Stub: el runtime real se entrega en S-13.08. La traza de abajo es simulada.",
  },
  "Tokens in/out": { es: "Tokens entrada/salida" },
  "Custo (cents)": { es: "Costo (centavos)" },
  // ─── Agentes de IA: diff e histórico de versões, uso das capacidades ───
  Provider: { es: "Proveedor" },
  Model: { es: "Modelo" },
  Canal: { es: "Canal" },
  Configuração: { es: "Configuración" },
  Tools: { es: "Herramientas" },
  "Handoff keywords": { es: "Palabras clave de transferencia" },
  "System prompt": { es: "Prompt del sistema" },
  "Sem mudanças.": { es: "Sin cambios." },
  Campo: { es: "Campo" },
  Adicionadas: { es: "Agregadas" },
  Removidas: { es: "Eliminadas" },
  "Habilitado:": { es: "Habilitado:" },
  "Fluxos adicionados": { es: "Flujos agregados" },
  "Fluxos removidos": { es: "Flujos eliminados" },
  "Nenhuma versão criada ainda.": { es: "Todavía no se creó ninguna versión." },
  "Não há outra versão para comparar.": { es: "No hay otra versión para comparar." },
  "Revertido para versão equivalente a v": { es: "Revertido a una versión equivalente a v" },
  " (publicada como v": { es: " (publicada como v" },
  Substituída: { es: "Reemplazada" },
  "publicada em": { es: "publicada el" },
  "Diff v": { es: "Comparar v" },
  " ↔ v": { es: " ↔ v" },
  Diff: { es: "Comparar" },
  Reverter: { es: "Revertir" },
  "Reverter para v": { es: "Revertir a v" },
  "Uma nova versão idêntica a v": { es: "Se creará una versión idéntica a v" },
  " será criada e publicada imediatamente. A versão atualmente publicada vira superseded.": {
    es: " y se publicará de inmediato. La versión actualmente publicada queda reemplazada.",
  },
  "Revertendo…": { es: "Revirtiendo…" },
  "Confirmar revert": { es: "Confirmar reversión" },
  "falhando sempre": { es: "fallando siempre" },
  falhas: { es: "fallas" },
  "usada sem estar ligada": { es: "usada sin estar activada" },
  "nunca usada": { es: "nunca usada" },
  "ligada agora": { es: "activada ahora" },
  "só em teste": { es: "solo en prueba" },
  funcionando: { es: "funcionando" },
  "que você está editando": { es: "que estás editando" },
  "que está no ar": { es: "que está activa" },
  antiga: { es: "antigua" },
  "Carregando o uso das capacidades…": { es: "Cargando el uso de las capacidades…" },
  "Não foi possível carregar o uso das capacidades.": {
    es: "No se pudo cargar el uso de las capacidades.",
  },
  uso: { es: "uso" },
  usos: { es: "usos" },
  "nos últimos": { es: "en los últimos" },
  dias: { es: "días" },
  falha: { es: "falla" },
  "capacidade pede uma decisão sua": { es: "capacidad necesita una decisión tuya" },
  "capacidades pedem uma decisão sua": { es: "capacidades necesitan una decisión tuya" },
  "Nada pedindo decisão no momento.": { es: "Nada requiere una decisión por ahora." },
  " O que está ligado vem da versão": { es: " Lo que está activado viene de la versión" },
  "Este agente ainda não tem nenhuma capacidade ligada, e nenhuma foi usada. Ligue o que ele pode fazer na aba Configuração.": {
    es: "Este agente todavía no tiene ninguna capacidad activada, y ninguna fue usada. Activa lo que puede hacer en la pestaña Configuración.",
  },
  desligada: { es: "desactivada" },
  "em teste": { es: "en prueba" },
  "última vez": { es: "última vez" },
  nunca: { es: "nunca" },
  // ─── Agentes de IA: abas do editor ───
  Teste: { es: "Prueba" },
  Capacidades: { es: "Capacidades" },
  Execuções: { es: "Ejecuciones" },
  Histórico: { es: "Historial" },
  Propostas: { es: "Propuestas" },
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
