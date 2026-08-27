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
  // ─── Follow-up: lista de fluxos ───
  "Fluxos automáticos de reengajamento — silêncio, mudança de etapa ou fim de conversa disparam mensagens sem intervenção manual.": {
    es: "Flujos automáticos de reenganche — el silencio, un cambio de etapa o el fin de la conversación disparan mensajes sin intervención manual.",
  },
  Fluxos: { es: "Flujos" },
  "Novo fluxo": { es: "Nuevo flujo" },
  "Nenhum fluxo de follow-up ainda": { es: "Todavía no hay ningún flujo de seguimiento" },
  "Follow-ups reengajam contatos automaticamente após silêncio, mudança de etapa ou fim de conversa — sem depender de alguém lembrar de mandar mensagem.": {
    es: "Los seguimientos reenganchan contactos automáticamente tras un silencio, un cambio de etapa o el fin de la conversación — sin depender de que alguien se acuerde de escribir.",
  },
  publicada: { es: "publicada" },
  Handoff: { es: "Transferencia" },
  "Atualizado em": { es: "Actualizado el" },
  Ativo: { es: "Activo" },
  Desativado: { es: "Desactivado" },
  // ─── Follow-up: fila e estados de enrollment/promessa ───
  "Não consegui criar o fluxo. Tente de novo.": {
    es: "No pude crear el flujo. Intenta de nuevo.",
  },
  "Novo fluxo de follow-up": { es: "Nuevo flujo de seguimiento" },
  "Nasce como rascunho. Você monta as etapas no editor visual em seguida.": {
    es: "Nace como borrador. Armas las etapas en el editor visual después.",
  },
  "Ex: Recuperação de carrinho abandonado": { es: "Ej: Recuperación de carrito abandonado" },
  "Criando…": { es: "Creando…" },
  "Criar fluxo": { es: "Crear flujo" },
  "Buscar contato…": { es: "Buscar contacto…" },
  "Buscar contato": { es: "Buscar contacto" },
  "Todos os status": { es: "Todos los estados" },
  "Filtrar por fluxo": { es: "Filtrar por flujo" },
  "Todos os fluxos": { es: "Todos los flujos" },
  "Nenhum item na fila": { es: "Ningún elemento en la cola" },
  "Enrollments ativos e promessas de retorno agendadas pela IA aparecem aqui.": {
    es: "Las inscripciones activas y las promesas de retorno agendadas por la IA aparecen aquí.",
  },
  Contato: { es: "Contacto" },
  "Fluxo / Promessa": { es: "Flujo / Promesa" },
  "Nó atual / Motivo": { es: "Nodo actual / Motivo" },
  "Próximo disparo": { es: "Próximo disparo" },
  Promessa: { es: "Promesa" },
  agente: { es: "agente" },
  "Cancelar retorno": { es: "Cancelar retorno" },
  "Cancelar follow-up": { es: "Cancelar seguimiento" },
  "Carregando...": { es: "Cargando..." },
  "Carregar mais": { es: "Cargar más" },
  "Cancelar este retorno?": { es: "¿Cancelar este retorno?" },
  "Cancelar este follow-up?": { es: "¿Cancelar este seguimiento?" },
  "O agente não voltará a falar com esta pessoa no horário combinado, e vai saber que você desmarcou.": {
    es: "El agente no volverá a hablar con esta persona en el horario acordado, y sabrá que cancelaste.",
  },
  "O lead não receberá mais mensagens deste fluxo. Essa ação não pode ser desfeita.": {
    es: "El lead no recibirá más mensajes de este flujo. Esta acción no se puede deshacer.",
  },
  "Aguardando resposta": { es: "Esperando respuesta" },
  "Pausado (atendimento humano)": { es: "Pausado (atención humana)" },
  "Pausado por uma pessoa": { es: "Pausado por una persona" },
  "Parou de tentar": { es: "Dejó de intentar" },
  Cancelado: { es: "Cancelado" },
  Agendada: { es: "Agendada" },
  "Concluída": { es: "Concluida" },
  Cancelada: { es: "Cancelada" },
  "Fluxo criado.": { es: "Flujo creado." },
  "Follow-up cancelado.": { es: "Seguimiento cancelado." },
  "Retorno cancelado.": { es: "Retorno cancelado." },
  "Rascunho salvo.": { es: "Borrador guardado." },
  "Fluxo publicado.": { es: "Flujo publicado." },
  "Fluxo desativado.": { es: "Flujo desactivado." },
  "Fluxo revertido para a versão anterior.": { es: "Flujo revertido a la versión anterior." },
  "Gatilho atualizado.": { es: "Disparador actualizado." },
  "Política de handoff atualizada.": { es: "Política de transferencia actualizada." },
  "Follow-up pausado.": { es: "Seguimiento pausado." },
  "Follow-up retomado.": { es: "Seguimiento reanudado." },
  "Follow-up adiado.": { es: "Seguimiento aplazado." },
  "Passo pulado.": { es: "Paso omitido." },
  pausar: { es: "pausar" },
  cancelar: { es: "cancelar" },
  permitir: { es: "permitir" },
  "Adicionar nó": { es: "Añadir nodo" },
  "Início do fluxo": { es: "Inicio del flujo" },
  min: { es: "min" },
  adaptativo: { es: "adaptativo" },
  "regras · uma saída por regra": { es: "reglas · una salida por regla" },
  "condição(ões)": { es: "condición(es)" },
  E: { es: "Y" },
  OU: { es: "O" },
  classes: { es: "clases" },
  "Template fixo": { es: "Plantilla fija" },
  Convertido: { es: "Convertido" },
  Esgotado: { es: "Agotado" },
  Personalizado: { es: "Personalizado" },
  Gatilho: { es: "Disparador" },
  Aguardar: { es: "Esperar" },
  Condição: { es: "Condición" },
  "Classificar (IA)": { es: "Clasificar (IA)" },
  "Ação": { es: "Acción" },
  "Verificar condição": { es: "Verificar condición" },
  "Classificar resposta": { es: "Clasificar respuesta" },
  "Enviar mensagem": { es: "Enviar mensaje" },
  "Fim do fluxo": { es: "Fin del flujo" },
  "Rótulo precisa ter 1 a 60 caracteres.": { es: "La etiqueta debe tener entre 1 y 60 caracteres." },
  "Alterações aplicam no rascunho ao digitar — salve na barra de publicação.": {
    es: "Los cambios se aplican al borrador mientras escribes — guarda en la barra de publicación.",
  },
  "Rótulo": { es: "Etiqueta" },
  "Início do fluxo — sem configuração adicional. O disparo (manual, mudança de etapa, silêncio ou fim de conversa) é definido nas configurações do fluxo.":
    {
      es: "Inicio del flujo — sin configuración adicional. El disparo (manual, cambio de etapa, silencio o fin de conversación) se define en la configuración del flujo.",
    },
  "Condição da aresta": { es: "Condición de la arista" },
  "Quando seguir por esta aresta": { es: "Cuándo seguir por esta arista" },
  "São as saídas do nó": { es: "Son las salidas del nodo" },
  "as mesmas que aparecem no card.": { es: "las mismas que aparecen en la tarjeta." },
  "Configuração inválida.": { es: "Configuración inválida." },
  "Tempo fixo": { es: "Tiempo fijo" },
  "A IA escolhe a hora": { es: "La IA elige el momento" },
  "Como calcular a espera": { es: "Cómo calcular la espera" },
  "Duração (minutos)": { es: "Duración (minutos)" },
  "Mínimo (min)": { es: "Mínimo (min)" },
  "Máximo (min)": { es: "Máximo (min)" },
  "Orientação (opcional)": { es: "Orientación (opcional)" },
  "Classes (separadas por vírgula)": { es: "Clases (separadas por coma)" },
  "Esperar a resposta por (minutos)": { es: "Esperar la respuesta por (minutos)" },
  "O que a IA vai ler": { es: "Qué va a leer la IA" },
  "Última resposta": { es: "Última respuesta" },
  Resumo: { es: "Resumen" },
  "Instrução (opcional)": { es: "Instrucción (opcional)" },
  "interessado, sem interesse": { es: "interesado, sin interés" },
  "Como as regras decidem o caminho": { es: "Cómo deciden el camino las reglas" },
  "Avaliar as regras juntas (uma saída de sim e uma de não)": {
    es: "Evaluar las reglas juntas (una salida de sí y una de no)",
  },
  "Uma saída por regra": { es: "Una salida por regla" },
  "Trocar de modo deixa": { es: "Cambiar de modo deja" },
  "ligação sem saída": { es: "conexión sin salida" },
  "ligações sem saída": { es: "conexiones sin salida" },
  "neste nó. Elas continuam desenhadas, mas param de levar a lugar nenhum até você religá-las.": {
    es: "en este nodo. Siguen dibujadas, pero dejan de llevar a ningún lugar hasta que las vuelvas a conectar.",
  },
  "Trocar mesmo assim": { es: "Cambiar de todas formas" },
  "Seguir por aqui quando": { es: "Seguir por aquí cuando" },
  "Todas as condições": { es: "Todas las condiciones" },
  "Qualquer uma das condições": { es: "Cualquiera de las condiciones" },
  "Remover condição": { es: "Eliminar condición" },
  "Nome da saída": { es: "Nombre de la salida" },
  "Nome desta saída (opcional)": { es: "Nombre de esta salida (opcional)" },
  Operador: { es: "Operador" },
  "Etapa do funil": { es: "Etapa del embudo" },
  "Etiqueta do contato": { es: "Etiqueta del contacto" },
  "Passos já dados no fluxo": { es: "Pasos ya dados en el flujo" },
  "Desfecho do passo anterior": { es: "Desenlace del paso anterior" },
  "está na etapa": { es: "está en la etapa" },
  "não está na etapa": { es: "no está en la etapa" },
  "contém": { es: "contiene" },
  "é pelo menos": { es: "es al menos" },
  "é no máximo": { es: "es como máximo" },
  "tem a etiqueta": { es: "tiene la etiqueta" },
  "não tem a etiqueta": { es: "no tiene la etiqueta" },
  "é exatamente": { es: "es exactamente" },
  "não é": { es: "no es" },
  foi: { es: "fue" },
  "não foi": { es: "no fue" },
  Valor: { es: "Valor" },
  "Ex.: 3": { es: "Ej.: 3" },
  "Comparar maior/menor só funciona com número. Do jeito que está, esta condição nunca é verdadeira.": {
    es: "Comparar mayor/menor solo funciona con número. Tal como está, esta condición nunca es verdadera.",
  },
  "“Contém” só funciona com texto. Em número, esta condição nunca é verdadeira.": {
    es: "“Contiene” solo funciona con texto. En número, esta condición nunca es verdadera.",
  },
  "Carregando seus modelos…": { es: "Cargando tus plantillas…" },
  "Não consegui carregar seus modelos de mensagem. Recarregue a página.": {
    es: "No pude cargar tus plantillas de mensaje. Recarga la página.",
  },
  "Você ainda não tem modelos de mensagem. Crie um em Ajustes → Modelos e ele aparece aqui.": {
    es: "Todavía no tienes plantillas de mensaje. Créala en Ajustes → Plantillas y aparecerá aquí.",
  },
  "Escolha um modelo": { es: "Elige una plantilla" },
  Nenhum: { es: "Ninguno" },
  "Como escrever a mensagem": { es: "Cómo escribir el mensaje" },
  "Mensagem escrita pela IA": { es: "Mensaje escrito por la IA" },
  "Modelo de mensagem pronto": { es: "Plantilla de mensaje lista" },
  "Instrução para a IA": { es: "Instrucción para la IA" },
  "Se a IA não conseguir escrever, mandar este modelo": { es: "Si la IA no logra escribir, enviar esta plantilla" },
  "Modelo de mensagem": { es: "Plantilla de mensaje" },
  "Nota (opcional)": { es: "Nota (opcional)" },
  "Fluxo reprovado na validação — corrija os nós destacados.": {
    es: "El flujo no pasó la validación — corrige los nodos resaltados.",
  },
  "Alterações não salvas": { es: "Cambios sin guardar" },
  "Pausar durante handoff": { es: "Pausar durante la transferencia" },
  "Cancelar durante handoff": { es: "Cancelar durante la transferencia" },
  "Permitir durante handoff": { es: "Permitir durante la transferencia" },
  "Política de handoff": { es: "Política de transferencia" },
  Desativar: { es: "Desactivar" },
  Rollback: { es: "Revertir" },
  Silêncio: { es: "Silencio" },
  "entrou em": { es: "entró en" },
  em: { es: "en" },
  "Agente pediu ajuda": { es: "El agente pidió ayuda" },
  "quando o agente pede ajuda": { es: "cuando el agente pide ayuda" },
  Manual: { es: "Manual" },
  "indisponível": { es: "no disponible" },
  "Tipo de gatilho": { es: "Tipo de disparador" },
  "Etapa que dispara o fluxo": { es: "Etapa que dispara el flujo" },
  "Carregando etapas…": { es: "Cargando etapas…" },
  "Escolha a etapa": { es: "Elige la etapa" },
  "Nenhuma etapa ativa encontrada — crie o funil antes de armar este gatilho.": {
    es: "No se encontró ninguna etapa activa — crea el embudo antes de configurar este disparador.",
  },
  "O fluxo começa quando um negócio entra nesta etapa, por arrasto no quadro ou por automação. A entrada na fila leva poucos minutos, não é instantânea.":
    {
      es: "El flujo empieza cuando un negocio entra en esta etapa, por arrastre en el tablero o por automatización. La entrada en la cola tarda unos minutos, no es instantánea.",
    },
  "O fluxo começa quando o agente abre um caso — o momento em que ele diz que precisa de uma pessoa. Não há o que escolher aqui: vale para qualquer caso desta conta.":
    {
      es: "El flujo empieza cuando el agente abre un caso — el momento en que dice que necesita a una persona. No hay nada que elegir aquí: vale para cualquier caso de esta cuenta.",
    },
  "Comece o fluxo por uma espera.": { es: "Empieza el flujo con una espera." },
  "O agente continua conversando depois de abrir o caso — sem espera, o cliente recebe duas mensagens ao mesmo tempo.":
    {
      es: "El agente sigue conversando después de abrir el caso — sin espera, el cliente recibe dos mensajes al mismo tiempo.",
    },
  "Se o caso for resolvido antes, o follow-up é cancelado sozinho.": {
    es: "Si el caso se resuelve antes, el seguimiento se cancela solo.",
  },
  "Minutos de silêncio": { es: "Minutos de silencio" },
  "Mínimo de": { es: "Mínimo de" },
  "minutos.": { es: "minutos." },
  "Segmentos (tags, opcional)": { es: "Segmentos (tags, opcional)" },
  "ex: vip, carrinho-abandonado": { es: "ej: vip, carrito-abandonado" },
  "Cancelar se o lead responder": { es: "Cancelar si el lead responde" },
  "Salvar gatilho": { es: "Guardar disparador" },
  "Fila de follow-ups": { es: "Cola de seguimientos" },
  "Fluxo removido": { es: "Flujo eliminado" },
  Agente: { es: "Agente" },
  "Nenhum agente fixado": { es: "Ningún agente fijado" },
  "Começou": { es: "Empezó" },
  "Passos dados": { es: "Pasos dados" },
  "Onde está agora": { es: "Dónde está ahora" },
  passo: { es: "paso" },
  "não existe mais na versão publicada deste fluxo": { es: "ya no existe en la versión publicada de este flujo" },
  "Volta a andar": { es: "Vuelve a avanzar" },
  "Parado até alguém retomar": { es: "Detenido hasta que alguien lo reanude" },
  "Encerrado em": { es: "Finalizado el" },
  "Sem próximo passo agendado": { es: "Sin próximo paso programado" },
  "Desfecho": { es: "Desenlace" },
  Motivo: { es: "Motivo" },
  "Última falha": { es: "Último error" },
  tentativa: { es: "intento" },
  "O automático está executando este follow-up agora — as ações abaixo podem ser recusadas por alguns instantes.": {
    es: "El automático está ejecutando este seguimiento ahora — las acciones de abajo pueden ser rechazadas por unos instantes.",
  },
  Retomar: { es: "Reanudar" },
  "Pular este passo": { es: "Saltar este paso" },
  "O que já aconteceu": { es: "Lo que ya pasó" },
  "Adiar o próximo passo": { es: "Aplazar el próximo paso" },
  "O follow-up continua no mesmo passo e volta a andar no horário que você escolher.": {
    es: "El seguimiento sigue en el mismo paso y vuelve a avanzar en el horario que elijas.",
  },
  "Novo horário": { es: "Nuevo horario" },
  "O lead não receberá mais mensagens deste fluxo. Diferente de pausar, isto não pode ser desfeito.": {
    es: "El lead no recibirá más mensajes de este flujo. A diferencia de pausar, esto no se puede deshacer.",
  },
  "Por onde seguir?": { es: "¿Por dónde seguir?" },
  "Este passo tem mais de um caminho no fluxo. Escolher por você seria decidir o rumo do atendimento sem perguntar.": {
    es: "Este paso tiene más de un camino en el flujo. Elegir por ti sería decidir el rumbo de la atención sin preguntar.",
  },
  "O tempo que o agente escolheu": { es: "El tiempo que eligió el agente" },
  Decidido: { es: "Decidido" },
  "no início do follow-up": { es: "al inicio del seguimiento" },
  esperar: { es: "esperar" },
  "bateu no seu limite": { es: "llegó a tu límite" },
  "a IA pediu": { es: "la IA pidió" },
  Sim: { es: "Sí" },
  "Não": { es: "No" },
  Sempre: { es: "Siempre" },
  "Nenhuma delas": { es: "Ninguna de ellas" },
  "Sem resposta": { es: "Sin respuesta" },
  Salvo: { es: "Guardado" },
  "Reindexação enfileirada — atualizando em segundo plano.": {
    es: "Reindexación en cola — actualizando en segundo plano.",
  },
  "Fontes de Conhecimento": { es: "Fuentes de Conocimiento" },
  "Configure as fontes de RAG do agent default da organização.": {
    es: "Configura las fuentes de RAG del agente default de la organización.",
  },
  "Nenhum agent default encontrado. Crie um agent default em": {
    es: "No se encontró ningún agente default. Crea un agente default en",
  },
  "primeiro.": { es: "primero." },
  "Ir para Agents": { es: "Ir a Agentes" },
  "Status e ações sobre as fontes RAG do agent": { es: "Estado y acciones sobre las fuentes RAG del agente" },
  Pronto: { es: "Listo" },
  Falhou: { es: "Falló" },
  Parcial: { es: "Parcial" },
  "Não indexado": { es: "No indexado" },
  "Citações da resposta IA": { es: "Citas de la respuesta IA" },
  "Resposta sem RAG hits — modelo respondeu sem usar a base de conhecimento.": {
    es: "Respuesta sin RAG hits — el modelo respondió sin usar la base de conocimiento.",
  },
  FAQ: { es: "FAQ" },
  "Política": { es: "Política" },
  "Conversa": { es: "Conversación" },
  "Catálogo": { es: "Catálogo" },
  Fonte: { es: "Fuente" },
  "Mostrar citações da resposta": { es: "Mostrar citas de la respuesta" },
  "Perguntas frequentes do tenant.": { es: "Preguntas frecuentes del tenant." },
  "Documento PDF de políticas (troca, devolução, privacidade).": {
    es: "Documento PDF de políticas (cambios, devoluciones, privacidad).",
  },
  "Conversas opt-in": { es: "Conversaciones opt-in" },
  "Conversas anonimizadas para aprendizado.": { es: "Conversaciones anonimizadas para aprendizaje." },
  "Entra sozinha: conversas resolvidas que alguém marcar como aproveitáveis pela IA são anonimizadas e indexadas em lote. Não há conteúdo para colar aqui.":
    {
      es: "Entra sola: las conversaciones resueltas que alguien marque como aprovechables por la IA se anonimizan y se indexan en lote. No hay contenido para pegar aquí.",
    },
  "Produtos sincronizados do e-commerce.": { es: "Productos sincronizados del e-commerce." },
  "Os produtos vêm da sincronização com o e-commerce, não de conteúdo digitado aqui.": {
    es: "Los productos vienen de la sincronización con el e-commerce, no de contenido escrito aquí.",
  },
  "Nunca indexado": { es: "Nunca indexado" },
  "agora há pouco": { es: "hace un momento" },
  "há": { es: "hace" },
  "Nenhuma fonte configurada.": { es: "Ninguna fuente configurada." },
  Configurar: { es: "Configurar" },
  "Última indexação": { es: "Última indexación" },
  "Chunks indexados": { es: "Chunks indexados" },
  "Detalhes do erro": { es: "Detalles del error" },
  "Reindexando...": { es: "Reindexando..." },
  "Re-indexar": { es: "Re-indexar" },
  "Editar conteúdo": { es: "Editar contenido" },
  "Editor de FAQ em breve.": { es: "Editor de FAQ próximamente." },
  "Upload novo arquivo": { es: "Subir nuevo archivo" },
  "Upload de política em breve.": { es: "Subida de política próximamente." },
  "da loja": { es: "de la tienda" },
  "Cole o conteúdo antes de criar.": { es: "Pega el contenido antes de crear." },
  "Não consegui criar a fonte.": { es: "No pude crear la fuente." },
  "Fonte criada. A indexação começa em instantes.": { es: "Fuente creada. La indexación empieza en instantes." },
  "Não consegui falar com o servidor.": { es: "No pude comunicarme con el servidor." },
  "Cadastrar": { es: "Registrar" },
  "Cole as perguntas e respostas. O agente passa a consultar isso antes de responder.": {
    es: "Pega las preguntas y respuestas. El agente empieza a consultarlas antes de responder.",
  },
  "Nome da fonte": { es: "Nombre de la fuente" },
  "Conteúdo": { es: "Contenido" },
  "Uma linha": { es: "Una línea" },
  "e uma": { es: "y una" },
  "por item, separados por uma linha em branco.": { es: "por elemento, separados por una línea en blanco." },
  "Criar fonte": { es: "Crear fuente" },
  "Você é um assistente da loja. Responda com clareza e cordialidade…": {
    es: "Eres un asistente de la tienda. Responde con claridad y cordialidad…",
  },
  "Mínimo 20 caracteres, máximo 10.000. Use placeholders para injetar contexto dinâmico.": {
    es: "Mínimo 20 caracteres, máximo 10.000. Usa placeholders para inyectar contexto dinámico.",
  },
  "Placeholders": { es: "Placeholders" },
  "Inserir": { es: "Insertar" },
  "Vocabulário do tenant para 'lead' (ex: cliente)": { es: "Vocabulario del tenant para 'lead' (ej: cliente)" },
  "Vocabulário do tenant para 'deal' (ex: pedido)": { es: "Vocabulario del tenant para 'deal' (ej: pedido)" },
  "Vocabulário do tenant para 'won' (ex: pago)": { es: "Vocabulario del tenant para 'won' (ej: pagado)" },
  "Vocabulário do tenant para 'lost' (ex: cancelado)": { es: "Vocabulario del tenant para 'lost' (ej: cancelado)" },
  "Nome do contato em atendimento": { es: "Nombre del contacto en atención" },
  "Locale do contato (ex: pt-BR)": { es: "Locale del contacto (ej: pt-BR)" },
  "Últimas N mensagens da conversa": { es: "Últimos N mensajes de la conversación" },
  "Trechos da base de conhecimento (RAG)": { es: "Fragmentos de la base de conocimiento (RAG)" },
  "Janela horária": { es: "Ventana horaria" },
  "Bloquear conteúdo sensível na resposta": { es: "Bloquear contenido sensible en la respuesta" },
  "Exigir citação da base": { es: "Exigir cita de la base" },
  "Bloquear input com termo proibido": { es: "Bloquear input con término prohibido" },
  "Janela operacional 7h-22h": { es: "Ventana operativa 7h-22h" },
  "Skip se contato pediu humano": { es: "Omitir si el contacto pidió humano" },
  "Tipo do novo guardrail": { es: "Tipo del nuevo guardrail" },
  "Adicionar guardrail": { es: "Añadir guardrail" },
  "Nenhum guardrail definido. O agent responde sem restrições adicionais.": {
    es: "Ningún guardrail definido. El agente responde sin restricciones adicionales.",
  },
  "Campos inválidos. Ajuste antes de salvar.": { es: "Campos inválidos. Ajusta antes de guardar." },
  "Citações mínimas": { es: "Citas mínimas" },
  "Hora início (0-23)": { es: "Hora inicio (0-23)" },
  "Hora fim (0-23)": { es: "Hora fin (0-23)" },
  "Valor esperado": { es: "Valor esperado" },
  "Carregando agent…": { es: "Cargando agente…" },
  "Guardrails inválidos.": { es: "Guardrails inválidos." },
  "Guardrails inválidos": { es: "Guardrails inválidos" },
  "Nada para salvar.": { es: "Nada que guardar." },
  "Campos inválidos.": { es: "Campos inválidos." },
  "Erro ao salvar": { es: "Error al guardar" },
  "Agent default": { es: "Agente default" },
  "Criado em": { es: "Creado el" },
  "Geral": { es: "General" },
  "Descrição interna do agent": { es: "Descripción interna del agente" },
  "Agent ativo": { es: "Agente activo" },
  "read-only — gerenciado pelo backend": { es: "solo lectura — gestionado por el backend" },
  "Janela de contexto (msgs, 1–50)": { es: "Ventana de contexto (msgs, 1–50)" },
  "Top K = quantos trechos buscar. Similarity threshold = mínimo de relevância (cosine). Confidence = limiar abaixo do qual o agent escala para humano.":
    {
      es: "Top K = cuántos fragmentos buscar. Similarity threshold = relevancia mínima (cosine). Confidence = umbral por debajo del cual el agente escala a un humano.",
    },
  "Chaves de acesso à IA": { es: "Claves de acceso a la IA" },
  "A conta de inteligência artificial é sua: você contrata direto na Anthropic, OpenAI ou Google e cola a chave aqui. Ela é guardada criptografada e nunca mais aparece na tela depois de salva — nem para você.":
    {
      es: "La cuenta de inteligencia artificial es tuya: la contratas directo con Anthropic, OpenAI o Google y pegas la clave aquí. Se guarda cifrada y nunca vuelve a aparecer en la pantalla después de guardada — ni siquiera para ti.",
    },
  "Nenhuma chave cadastrada ainda": { es: "Todavía no hay ninguna clave registrada" },
  "Seus agentes só conseguem pensar depois que você cola aqui uma chave da Anthropic, da OpenAI ou do Google. A cobrança vai direto para a sua conta no provedor, e a chave fica guardada criptografada.":
    {
      es: "Tus agentes solo pueden pensar después de que pegues aquí una clave de Anthropic, de OpenAI o de Google. El cobro va directo a tu cuenta en el proveedor, y la clave queda guardada cifrada.",
    },
  "Adicionar credencial": { es: "Añadir credencial" },
  Validada: { es: "Validada" },
  Inválida: { es: "Inválida" },
  Inativa: { es: "Inactiva" },
  "Revalidando…": { es: "Revalidando…" },
  "Credencial removida.": { es: "Credencial eliminada." },
  "Excluir credencial": { es: "Eliminar credencial" },
  Modelos: { es: "Modelos" },
  "Em uso por": { es: "En uso por" },
  publicado: { es: "publicado" },
  "Revalidar credencial": { es: "Revalidar credencial" },
  "Remover credencial": { es: "Quitar credencial" },
  "Agents que usam esta credencial vão falhar ao executar. Esta ação não pode ser desfeita.": {
    es: "Los agentes que usan esta credencial fallarán al ejecutarse. Esta acción no se puede deshacer.",
  },
  "A chave é cifrada (AES-GCM) antes de gravar e nunca é retornada em texto claro.": {
    es: "La clave se cifra (AES-GCM) antes de guardarse y nunca se devuelve en texto plano.",
  },
  Label: { es: "Etiqueta" },
  "Ex: Produção": { es: "Ej: Producción" },
  "Credencial salva. Validando…": { es: "Credencial guardada. Validando…" },
  "Credencial salva. Validação em segundo plano.": { es: "Credencial guardada. Validación en segundo plano." },
  "modelos disponíveis.": { es: "modelos disponibles." },
  "Validação falhou": { es: "La validación falló" },
  "Salvar e validar": { es: "Guardar y validar" },
  "Obrigatório": { es: "Obligatorio" },
  "API key muito curta": { es: "API key demasiado corta" },
  Casos: { es: "Casos" },
  "Quando a IA trava em algo que só um humano resolve, ela abre um caso aqui — e continua conversando com o cliente enquanto espera sua resposta.":
    {
      es: "Cuando la IA se traba en algo que solo un humano resuelve, abre un caso aquí — y sigue conversando con el cliente mientras espera tu respuesta.",
    },
  Abertos: { es: "Abiertos" },
  "Concluídos": { es: "Concluidos" },
  "Nenhum caso aberto": { es: "Ningún caso abierto" },
  "Nenhum caso concluído": { es: "Ningún caso concluido" },
  "Quando a IA precisar de você, aparece aqui.": { es: "Cuando la IA te necesite, aparece aquí." },
  "Casos concluídos, cancelados ou repassados ficam aqui.": {
    es: "Los casos concluidos, cancelados o transferidos quedan aquí.",
  },
  "Contato sem nome": { es: "Contacto sin nombre" },
  "Selecione um caso à esquerda": { es: "Selecciona un caso a la izquierda" },
  "Os detalhes e a resposta aparecem aqui.": { es: "Los detalles y la respuesta aparecen aquí." },
  "Sem telefone": { es: "Sin teléfono" },
  "Aberto automaticamente": { es: "Abierto automáticamente" },
  "Aberto automaticamente pelo sistema — a IA prometeu passar pra humano mas não abriu o caso, então o sistema abriu por ela.":
    {
      es: "Abierto automáticamente por el sistema — la IA prometió pasar a un humano pero no abrió el caso, así que el sistema lo abrió por ella.",
    },
  "O que o cliente precisa": { es: "Qué necesita el cliente" },
  "Por que a IA travou": { es: "Por qué se trabó la IA" },
  "O que você quer fazer?": { es: "¿Qué quieres hacer?" },
  "Resposta enviada.": { es: "Respuesta enviada." },
  "Escreva sua resposta para a IA...": { es: "Escribe tu respuesta para la IA..." },
  "Escolha uma das opções acima para enviar.": { es: "Elige una de las opciones de arriba para enviar." },
  "Enviando...": { es: "Enviando..." },
  "Um roteador entende o que o cliente quer e entrega a conversa para o agente certo — plugado em um número de WhatsApp.":
    {
      es: "Un enrutador entiende lo que el cliente quiere y entrega la conversación al agente correcto — conectado a un número de WhatsApp.",
    },
  "Novo roteador": { es: "Nuevo enrutador" },
  "Um roteador entende o que o cliente quer e entrega a conversa para o agente certo — um número de vendas fala com quem quer comprar, um de suporte com quem já é cliente, tudo no mesmo WhatsApp. Crie um para o seu número e escolha quais agentes ele aciona.":
    {
      es: "Un enrutador entiende lo que el cliente quiere y entrega la conversación al agente correcto — un número de ventas habla con quien quiere comprar, uno de soporte con quien ya es cliente, todo en el mismo WhatsApp. Crea uno para tu número y elige qué agentes activa.",
    },
  "Criar meu primeiro roteador": { es: "Crear mi primer enrutador" },
  "Número removido": { es: "Número eliminado" },
  "Sem intenções configuradas": { es: "Sin intenciones configuradas" },
  "intenção": { es: "intención" },
  "intenções": { es: "intenciones" },
  "Roteador criado — agora escolha as intenções.": {
    es: "Enrutador creado — ahora elige las intenciones.",
  },
  "Escolha o número de WhatsApp que ele vai atender. Depois de criado, você define as intenções e para qual agente cada uma vai.":
    {
      es: "Elige el número de WhatsApp que va a atender. Después de creado, defines las intenciones y a qué agente va cada una.",
    },
  "Número de WhatsApp": { es: "Número de WhatsApp" },
  "Só é possível ter um roteador ativo por número.": { es: "Solo es posible tener un enrutador activo por número." },
  "Criar roteador": { es: "Crear enrutador" },
  ativo: { es: "activo" },
  inativo: { es: "inactivo" },
  "Excluir roteador": { es: "Eliminar enrutador" },
  "Identificação": { es: "Identificación" },
  "O número não pode ser trocado depois de criado — crie outro roteador para um número diferente.": {
    es: "El número no se puede cambiar después de creado — crea otro enrutador para un número diferente.",
  },
  "Ativo — está roteando as conversas deste número": { es: "Activo — está enrutando las conversaciones de este número" },
  "Inativo — não roteia nada": { es: "Inactivo — no enruta nada" },
  "Modelo que identifica a intenção": { es: "Modelo que identifica la intención" },
  "Modelo do classificador": { es: "Modelo del clasificador" },
  "Automático — usa o provedor da organização": { es: "Automático — usa el proveedor de la organización" },
  "chave desta instalação": { es: "clave de esta instalación" },
  "Nenhuma chave de IA utilizável nesta organização — cadastre uma em Agentes IA › Credenciais para poder escolher o modelo.":
    {
      es: "No hay ninguna clave de IA utilizable en esta organización — registra una en Agentes IA › Credenciales para poder elegir el modelo.",
    },
  "Só aparecem modelos de provedores com chave cadastrada aqui. Se a conta do provedor estiver sem crédito, a identificação falha e tudo cai no fallback.":
    {
      es: "Solo aparecen modelos de proveedores con clave registrada aquí. Si la cuenta del proveedor se queda sin crédito, la identificación falla y todo cae en el fallback.",
    },
  "Se nenhuma intenção casar": { es: "Si ninguna intención coincide" },
  "Agente de fallback": { es: "Agente de fallback" },
  "Nenhum — responde com o atendimento padrão": { es: "Ninguno — responde con la atención estándar" },
  "Quando a IA não tem certeza do que o cliente quer, ela chama este agente em vez de travar a conversa.": {
    es: "Cuando la IA no está segura de lo que quiere el cliente, llama a este agente en vez de trabar la conversación.",
  },
  "Intenções": { es: "Intenciones" },
  "Cada intenção descreve uma situação e diz qual agente deve assumir a conversa quando o cliente quer aquilo.": {
    es: "Cada intención describe una situación y dice qué agente debe asumir la conversación cuando el cliente quiere eso.",
  },
  "Intenção": { es: "Intención" },
  "Nenhuma intenção ainda. Sem intenções, toda conversa cai direto no agente de fallback (ou fica sem resposta automática, se você não escolher um).":
    {
      es: "Todavía no hay ninguna intención. Sin intenciones, toda conversación cae directo en el agente de fallback (o se queda sin respuesta automática, si no eliges uno).",
    },
  "O número volta a ser atendido pelos gatilhos normais dos agentes (sem roteamento por intenção). As intenções deste roteador são apagadas junto. Não é possível desfazer.":
    {
      es: "El número vuelve a ser atendido por los disparadores normales de los agentes (sin enrutamiento por intención). Las intenciones de este enrutador se borran junto. No se puede deshacer.",
    },
  "Nome da intenção": { es: "Nombre de la intención" },
  "Ex.: quer comprar": { es: "Ej.: quiere comprar" },
  "Agente que atende": { es: "Agente que atiende" },
  "Selecione o agente": { es: "Selecciona el agente" },
  "Remover intenção": { es: "Quitar intención" },
  "Quando escolher esta intenção": { es: "Cuándo elegir esta intención" },
  "Escreva como explicaria para um atendente novo: em que situação o cliente cai aqui.": {
    es: "Escribe como se lo explicarías a un atendente nuevo: en qué situación cae aquí el cliente.",
  },
  "Já existe outra intenção com este nome.": { es: "Ya existe otra intención con este nombre." },
  "Frases de exemplo (opcional)": { es: "Frases de ejemplo (opcional)" },
  "Remover exemplo": { es: "Quitar ejemplo" },
  "Sem frases de exemplo.": { es: "Sin frases de ejemplo." },
  "Ex.: quanto custa? (Enter)": { es: "Ej.: ¿cuánto cuesta? (Enter)" },
  "Testar classificação": { es: "Probar clasificación" },
  "Escreva uma frase como um cliente escreveria e veja qual intenção e qual agente o roteador escolheria — sem afetar nenhuma conversa real.":
    {
      es: "Escribe una frase como la escribiría un cliente y mira qué intención y qué agente elegiría el enrutador — sin afectar ninguna conversación real.",
    },
  "Ative o roteador para poder testar a classificação.": { es: "Activa el enrutador para poder probar la clasificación." },
  "Ex.: oi, quero saber o preço do plano premium": { es: "Ej.: hola, quiero saber el precio del plan premium" },
  "Testando…": { es: "Probando…" },
  "nenhuma casou": { es: "ninguna coincidió" },
  "confiança": { es: "confianza" },
  "Confiança": { es: "Confianza" },
  "abaixo do mínimo de": { es: "por debajo del mínimo de" },
  "cairia no atendimento padrão em produção.": { es: "caería en la atención estándar en producción." },
  "Agente que atenderia": { es: "Agente que atendería" },
  "nenhum (sem fallback)": { es: "ninguno (sin fallback)" },
  "Resolva os campos destacados antes de salvar.": { es: "Resuelve los campos resaltados antes de guardar." },
  "Roteador salvo.": { es: "Enrutador guardado." },
  "Roteador removido.": { es: "Enrutador eliminado." },
  "Escolha o agente que atende esta intenção.": { es: "Elige el agente que atiende esta intención." },
  "Dê um nome curto para a intenção.": { es: "Dale un nombre corto a la intención." },
  "Descreva quando a IA deve escolher esta intenção.": { es: "Describe cuándo la IA debe elegir esta intención." },
  "1 ponto deste grupo precisa da sua atenção.": { es: "1 punto de este grupo necesita tu atención." },
  "A IA nunca para por gasto. Você vê o número nesta tela e decide o que fazer.": {
    es: "La IA nunca se detiene por gasto. Ves el número en esta pantalla y decides qué hacer.",
  },
  "A IA para de responder ao chegar em": { es: "La IA deja de responder al llegar a" },
  "A parada começa a valer": { es: "La parada empieza a valer" },
  "A parada começa a valer em": { es: "La parada empieza a valer el" },
  "A proteção de gasto está desligada nesta instalação (AI_BUDGET_ENFORCEMENT=off). O que estiver escolhido aqui não vale enquanto quem cuida do servidor não religar.": {
    es: "La protección de gasto está apagada en esta instalación (AI_BUDGET_ENFORCEMENT=off). Lo que esté elegido aquí no vale hasta que quien administra el servidor la vuelva a encender.",
  },
  "Abrimos um aviso na Central de avisos. A IA continua respondendo normalmente.": {
    es: "Abrimos un aviso en la Central de avisos. La IA sigue respondiendo normalmente.",
  },
  "Aguardando decisão": { es: "Esperando decisión" },
  "Aprendizado adicionado.": { es: "Aprendizaje añadido." },
  "Aprendizado arquivado.": { es: "Aprendizaje archivado." },
  "Aprendizado reativado.": { es: "Aprendizaje reactivado." },
  Aprendizados: { es: "Aprendizajes" },
  Aprovada: { es: "Aprobada" },
  Aprovar: { es: "Aprobar" },
  "Aprovar e ignorar viram registro — os dois. Quando você decidir a primeira, ela fica aqui.": {
    es: "Aprobar e ignorar quedan registrados — los dos. Cuando decidas el primero, queda aquí.",
  },
  "As conversas em andamento vão para a fila de atendimento humano — ninguém fica sem resposta, mas alguém precisa responder. Cada uma volta ao automático pelo botão \"Devolver ao automático\" no cabeçalho dela.": {
    es: "Las conversaciones en curso van a la fila de atención humana — nadie se queda sin respuesta, pero alguien tiene que responder. Cada una vuelve al automático con el botón \"Devolver al automático\" en su encabezado.",
  },
  "Assuntos mais procurados": { es: "Temas más buscados" },
  "Atendimentos com IA": { es: "Atenciones con IA" },
  Até: { es: "Hasta" },
  "Até lá, só avisamos.": { es: "Hasta entonces, solo avisamos." },
  "Avisamos ao passar de": { es: "Avisamos al pasar de" },
  "Avisar ao chegar em (% do limite)": { es: "Avisar al llegar a (% del límite)" },
  "Avisos que você marcar como resolvidos ficam aqui.": { es: "Los avisos que marques como resueltos quedan aquí." },
  "Cada linha aqui é uma coisa que está limitando seu agente, e o que fazer a respeito — às vezes você mesmo, às vezes quem cuida da sua instalação.": {
    es: "Cada línea aquí es algo que está limitando a tu agente, y qué hacer al respecto — a veces tú mismo, a veces quien administra tu instalación.",
  },
  "Cada linha é uma coisa nova que o agente passou a saber, na ordem em que aconteceu.": {
    es: "Cada línea es algo nuevo que el agente aprendió, en el orden en que ocurrió.",
  },
  "Cadastrar assuntos": { es: "Registrar asuntos" },
  "Cadastrar uma chave": { es: "Registrar una clave" },
  "Carregando orçamento...": { es: "Cargando presupuesto..." },
  "Casos que precisaram de uma pessoa": { es: "Casos que necesitaron una persona" },
  Chave: { es: "Clave" },
  "Começar a valer agora, sem esperar as 72 horas": { es: "Empezar a valer ahora, sin esperar las 72 horas" },
  "Configurar no agente": { es: "Configurar en el agente" },
  "Configurar um roteador": { es: "Configurar un enrutador" },
  "Configuração avançada": { es: "Configuración avanzada" },
  "Consultas aos seus materiais": { es: "Consultas a tus materiales" },
  "Conteúdo da": { es: "Contenido de la" },
  "Conversas encaminhadas": { es: "Conversaciones encaminadas" },
  "Custo da IA no período": { es: "Costo de la IA en el período" },
  "Custo no período": { es: "Costo en el período" },
  "Deixe em branco para usar o endereço oficial do provedor. Use isto para apontar para um gateway compatível com a API da OpenAI — inclusive um modelo rodando na sua própria máquina.": {
    es: "Déjalo en blanco para usar la dirección oficial del proveedor. Usa esto para apuntar a un gateway compatible con la API de OpenAI — incluso un modelo corriendo en tu propia máquina.",
  },
  "Descreva a regra ou o aprendizado em texto simples.": {
    es: "Describe la regla o el aprendizaje en texto simple.",
  },
  Desinstalar: { es: "Desinstalar" },
  "Disponível depois de salvar \"Me avisar\" — e, quando você armar a parada, ela só começa a valer 72 horas depois.": {
    es: "Disponible después de guardar \"Avisarme\" — y, cuando configures la parada, solo empieza a valer 72 horas después.",
  },
  "Documento da organização": { es: "Documento de la organización" },
  "Editar limite": { es: "Editar límite" },
  "Endereço próprio (opcional)": { es: "Dirección propia (opcional)" },
  "Enviando…": { es: "Enviando…" },
  "Enviar skill (.zip)": { es: "Enviar skill (.zip)" },
  "Escolha o que acontece quando o gasto do mês chega no limite. Os valores são em dólar — é a moeda em que o provedor de IA cobra.": {
    es: "Elige qué pasa cuando el gasto del mes llega al límite. Los valores son en dólares — es la moneda en la que cobra el proveedor de IA.",
  },
  "Este ponto usa o modelo definido na versão publicada do agente.": {
    es: "Este punto usa el modelo definido en la versión publicada del agente.",
  },
  "Ex.: Nunca prometa desconto sem confirmar com um humano. Horário de atendimento: 9h–18h, seg-sex. Sempre chame o cliente pelo primeiro nome.": {
    es: "Ej.: Nunca prometas un descuento sin confirmar con un humano. Horario de atención: 9h–18h, lun-vie. Llama siempre al cliente por su primer nombre.",
  },
  "Ex.: Não oferecer frete grátis no primeiro contato": { es: "Ej.: No ofrecer envío gratis en el primer contacto" },
  "Execuções de IA": { es: "Ejecuciones de IA" },
  "Fatos e correções pontuais que os agentes também levam em conta — adicionados à mão ou aprendidos automaticamente pelo sistema a partir de conversas reais.": {
    es: "Hechos y correcciones puntuales que los agentes también toman en cuenta — añadidos a mano o aprendidos automáticamente por el sistema a partir de conversaciones reales.",
  },
  "Gasto de": { es: "Gasto de" },
  "Habilidades especializadas que seus agentes carregam só quando a conversa pede — instale prontas do catálogo ou envie a sua.": {
    es: "Habilidades especializadas que tus agentes cargan solo cuando la conversación lo pide — instala unas listas del catálogo o envía la tuya.",
  },
  "Habilidades instaladas": { es: "Habilidades instaladas" },
  "Habilidades mais usadas": { es: "Habilidades más usadas" },
  "Habilidades usadas": { es: "Habilidades usadas" },
  "Histórico de versões": { es: "Historial de versiones" },
  "IA parada por gasto": { es: "IA detenida por gasto" },
  Ignorada: { es: "Ignorada" },
  Ignorar: { es: "Ignorar" },
  "Instalando…": { es: "Instalando…" },
  Instalar: { es: "Instalar" },
  "Instalar uma habilidade": { es: "Instalar una habilidad" },
  "Instruções publicadas na Memória da IA. Valem para toda conversa, de todos os agentes.": {
    es: "Instrucciones publicadas en la Memoria de la IA. Valen para toda conversación, de todos los agentes.",
  },
  "Isto é só acompanhamento. A IA não vai parar sozinha por gasto.": {
    es: "Esto es solo seguimiento. La IA no se va a detener sola por gasto.",
  },
  "Já decididas": { es: "Ya decididas" },
  "Limite mensal (US$)": { es: "Límite mensual (US$)" },
  "Linha do tempo do aprendizado": { es: "Línea de tiempo del aprendizaje" },
  "Marcar resolvido": { es: "Marcar resuelto" },
  "Me avisar ao passar de": { es: "Avisarme al pasar de" },
  "Melhorias que você aprovou": { es: "Mejoras que aprobaste" },
  "Memória da IA": { es: "Memoria de la IA" },
  "Mensagem técnica do provedor": { es: "Mensaje técnico del proveedor" },
  "Mostrando só as falhas": { es: "Mostrando solo las fallas" },
  "Mudanças de passo no atendimento": { es: "Cambios de paso en la atención" },
  "Negócios fechados pelo agente": { es: "Negocios cerrados por el agente" },
  "Negócios perdidos pelo agente": { es: "Negocios perdidos por el agente" },
  "Nenhum aprendizado ainda. Use \"+ Novo aprendizado\" para ensinar algo que os agentes devem lembrar em toda conversa — ou aguarde o sistema sugerir aprendizados automaticamente a partir do atendimento real.": {
    es: "Todavía no hay ningún aprendizaje. Usa \"+ Nuevo aprendizaje\" para enseñar algo que los agentes deben recordar en toda conversación — o espera a que el sistema sugiera aprendizajes automáticamente a partir de la atención real.",
  },
  "Nenhum aprendizado arquivado.": { es: "Ningún aprendizaje archivado." },
  "Nenhum aviso em aberto": { es: "Ningún aviso abierto" },
  "Nenhum aviso resolvido": { es: "Ningún aviso resuelto" },
  "Nenhuma conversa foi classificada por assunto. Os assuntos são os que você cadastra no roteador do seu número.": {
    es: "Ninguna conversación fue clasificada por asunto. Los asuntos son los que registras en el enrutador de tu número.",
  },
  "Nenhuma conversa foi encaminhada. Isso só acontece em números que têm um roteador configurado — sem ele, tudo cai no atendimento padrão.": {
    es: "Ninguna conversación fue encaminada. Esto solo pasa en números que tienen un enrutador configurado — sin él, todo cae en la atención estándar.",
  },
  "Nenhuma decisão registrada ainda": { es: "Ninguna decisión registrada todavía" },
  "Nenhuma execução ainda. Assim que o agente atender alguém, aparece aqui.": {
    es: "Todavía no hay ninguna ejecución. En cuanto el agente atienda a alguien, aparece aquí.",
  },
  "Nenhuma falha": { es: "Ninguna falla" },
  "Nenhuma falha registrada.": { es: "Ninguna falla registrada." },
  "Nenhuma habilidade foi usada neste período, então não há o que ranquear.": {
    es: "Ninguna habilidad fue usada en este período, así que no hay nada que rankear.",
  },
  "Nenhuma habilidade foi usada. Ou o agente ainda não tem nenhuma instalada, ou as conversas do período não pediram nenhuma.": {
    es: "Ninguna habilidad fue usada. O el agente todavía no tiene ninguna instalada, o las conversaciones del período no pidieron ninguna.",
  },
  "Nenhuma proposta esperando você": { es: "Ninguna propuesta esperándote" },
  "Nenhuma skill instalada ainda. Instale uma pronta do catálogo abaixo ou envie a sua em \"Enviar skill (.zip)\".": {
    es: "Todavía no hay ninguna skill instalada. Instala una lista del catálogo de abajo o envía la tuya en \"Enviar skill (.zip)\".",
  },
  "Nenhuma skill nova no catálogo — você já instalou tudo que a plataforma oferece hoje.": {
    es: "Ninguna skill nueva en el catálogo — ya instalaste todo lo que la plataforma ofrece hoy.",
  },
  "Nenhuma versão publicada ainda": { es: "Ninguna versión publicada todavía" },
  "Nesta instalação a proteção só avisa (AI_BUDGET_ENFORCEMENT=avisar): mesmo com \"Parar a IA\" escolhido, ela vai continuar respondendo.": {
    es: "En esta instalación la protección solo avisa (AI_BUDGET_ENFORCEMENT=avisar): incluso con \"Detener la IA\" elegido, ella va a seguir respondiendo.",
  },
  "Novo aprendizado": { es: "Nuevo aprendizaje" },
  "Não consegui carregar a configuração de IA": { es: "No pude cargar la configuración de IA" },
  "Não consegui carregar as execuções": { es: "No pude cargar las ejecuciones" },
  "Não conseguimos carregar os números agora. Recarregue a página em alguns instantes — se continuar assim, avise quem cuida da sua instalação.": {
    es: "No pudimos cargar los números ahora. Recarga la página en unos instantes — si sigue así, avisa a quien administra tu instalación.",
  },
  "O agente não consultou seus materiais. Ou não há nada publicado na base de conhecimento, ou as conversas não chegaram a precisar.": {
    es: "El agente no consultó tus materiales. O no hay nada publicado en la base de conocimiento, o las conversaciones no llegaron a necesitarlo.",
  },
  "O catálogo deste provedor ainda não foi baixado. Digite o identificador do modelo como o provedor o nomeia — a lista completa aparece sozinha depois da primeira sincronização.": {
    es: "El catálogo de este proveedor todavía no se descargó. Escribe el identificador del modelo tal como el proveedor lo nombra — la lista completa aparece sola después de la primera sincronización.",
  },
  "O que aconteceu:": { es: "Qué pasó:" },
  "O que ele fez": { es: "Lo que hizo" },
  "O que está travando": { es: "Lo que está trabando" },
  "O que fazer:": { es: "Qué hacer:" },
  "O que mudou no resultado": { es: "Lo que cambió en el resultado" },
  "O que o agente deve saber": { es: "Lo que el agente debe saber" },
  "O que o assistente precisou escalar para o time: conexões caídas, tarefas que falharam, atendimentos passados a humanos.": {
    es: "Lo que el asistente necesitó escalar al equipo: conexiones caídas, tareas que fallaron, atenciones pasadas a humanos.",
  },
  "O que os clientes mais quiseram, segundo o que o roteador entendeu de cada conversa.": {
    es: "Lo que los clientes más quisieron, según lo que el enrutador entendió de cada conversación.",
  },
  "O que seu agente aprendeu": { es: "Lo que tu agente aprendió" },
  "O que seu agente aprendeu no período, o que ele fez com isso, o que mudou no seu resultado — e o que ainda está travando.": {
    es: "Lo que tu agente aprendió en el período, qué hizo con eso, qué cambió en tu resultado — y qué sigue trabando.",
  },
  "O que seus agentes já sabem fazer além da conversa comum — cada skill só entra em ação quando o assunto pede.": {
    es: "Lo que tus agentes ya saben hacer además de la conversación común — cada skill solo entra en acción cuando el tema lo pide.",
  },
  "O que você pagou aos provedores de IA para tudo isto acontecer.": {
    es: "Lo que pagaste a los proveedores de IA para que todo esto pasara.",
  },
  "O texto-base que qualquer agente de IA lê antes de responder — como a \"política da casa\" que todo atendente novo teria que decorar.": {
    es: "El texto base que cualquier agente de IA lee antes de responder — como la \"política de la casa\" que todo atendente nuevo tendría que memorizar.",
  },
  "O trabalho do dia a dia: quantas vezes ele usou cada recurso que você deu a ele.": {
    es: "El trabajo del día a día: cuántas veces usó cada recurso que le diste.",
  },
  Ocultar: { es: "Ocultar" },
  "Onde o agente mais precisou de conhecimento especializado.": {
    es: "Dónde el agente más necesitó conocimiento especializado.",
  },
  "Orçamento de IA": { es: "Presupuesto de IA" },
  "Orçamento mensal de IA": { es: "Presupuesto mensual de IA" },
  "Para avisar ou parar no limite, ele precisa ser de pelo menos": {
    es: "Para avisar o detenerse en el límite, tiene que ser de al menos",
  },
  "Para personalizar uma skill instalada, basta reenviar um .zip com o mesmo nome — a sua versão passa a valer no lugar da do catálogo. Não há editor dentro do sistema nesta fase.": {
    es: "Para personalizar una skill instalada, basta con reenviar un .zip con el mismo nombre — tu versión pasa a valer en lugar de la del catálogo. No hay editor dentro del sistema en esta fase.",
  },
  "Parar a IA ao chegar em": { es: "Detener la IA al llegar a" },
  "Passaram para uma pessoa": { es: "Pasaron a una persona" },
  "Passou do limite": { es: "Pasó del límite" },
  "Período analisado": { es: "Período analizado" },
  Provedor: { es: "Proveedor" },
  "Próximos passos que o assistente sugeriu e esperam sua decisão. Aprovar e ignorar são registrados — ignorar é uma decisão, não a falta dela.": {
    es: "Próximos pasos que el asistente sugirió y esperan tu decisión. Aprobar e ignorar quedan registrados — ignorar es una decisión, no la falta de ella.",
  },
  "Publicada em": { es: "Publicada el" },
  "Publicar material": { es: "Publicar material" },
  "Publicar uma regra": { es: "Publicar una regla" },
  "Publicar versão": { es: "Publicar versión" },
  "Quando isso acontecer, as conversas em andamento vão para a fila de atendimento humano e voltam ao automático uma a uma, pelo cabeçalho de cada conversa.": {
    es: "Cuando eso pase, las conversaciones en curso van a la fila de atención humana y vuelven al automático una a una, por el encabezado de cada conversación.",
  },
  "Quando o assistente precisar de você, o aviso aparece aqui.": {
    es: "Cuando el asistente te necesite, el aviso aparece aquí.",
  },
  "Quando o assistente sugerir um próximo passo, ele aparece aqui — e some daqui assim que você decidir.": {
    es: "Cuando el asistente sugiera un próximo paso, aparece aquí — y desaparece de aquí en cuanto decidas.",
  },
  "Quantas vezes o agente foi procurar a resposta no que você escreveu, em vez de improvisar.": {
    es: "Cuántas veces el agente fue a buscar la respuesta en lo que escribiste, en vez de improvisar.",
  },
  "Quantas vezes o agente puxou uma habilidade especializada para dar conta da conversa.": {
    es: "Cuántas veces el agente usó una habilidad especializada para resolver la conversación.",
  },
  "Quantas vezes o sistema leu o que o cliente queria e escolheu qual atendimento devia responder.": {
    es: "Cuántas veces el sistema leyó lo que el cliente quería y eligió qué atención debía responder.",
  },
  "Quanto a inteligência artificial custou, quantos atendimentos ela fez, quanto demorou para responder e quantas vezes precisou chamar uma pessoa — nos últimos 30 dias.": {
    es: "Cuánto costó la inteligencia artificial, cuántas atenciones hizo, cuánto tardó en responder y cuántas veces necesitó llamar a una persona — en los últimos 30 días.",
  },
  "Quanto foi para uma pessoa (%)": { es: "Cuánto pasó a una persona (%)" },
  "Quanto gastou por dia (R$)": { es: "Cuánto gastaste por día (R$)" },
  Reabrir: { es: "Reabrir" },
  Reativar: { es: "Reactivar" },
  "Regras e aprendizados que TODOS os agentes de IA desta organização seguem em qualquer conversa — não é uma configuração de um agente específico.": {
    es: "Reglas y aprendizajes que TODOS los agentes de IA de esta organización siguen en cualquier conversación — no es una configuración de un agente específico.",
  },
  "Regras que você ensinou": { es: "Reglas que enseñaste" },
  Resolvidos: { es: "Resueltos" },
  "Restaurar como nova versão": { es: "Restaurar como nueva versión" },
  "Salvando...": { es: "Guardando..." },
  "Salvar aprendizado": { es: "Guardar aprendizaje" },
  "Se falhar:": { es: "Si falla:" },
  "Sem dados no período": { es: "Sin datos en el período" },
  "Sem limite definido — a IA não vai parar sozinha por gasto.": {
    es: "Sin límite definido — la IA no se va a detener sola por gasto.",
  },
  "Seu agente ainda não aprendeu nada neste período. Ele aprende de três jeitos: você publica uma regra na Memória da IA, aprova uma sugestão de melhoria na aba Propostas do agente, ou instala uma habilidade em Skills da IA.": {
    es: "Tu agente todavía no aprendió nada en este período. Aprende de tres formas: publicas una regla en la Memoria de la IA, apruebas una sugerencia de mejora en la pestaña Propuestas del agente, o instalas una habilidad en Skills de la IA.",
  },
  "Seu sistema usa inteligência artificial em": { es: "Tu sistema usa inteligencia artificial en" },
  "Skills da IA": { es: "Skills de la IA" },
  "Skills instaladas": { es: "Skills instaladas" },
  "Skills prontas, mantidas pela plataforma, disponíveis para instalar com um clique.": {
    es: "Skills listas, mantenidas por la plataforma, disponibles para instalar con un clic.",
  },
  "Skills que o agente passou a carregar quando a conversa pede — por exemplo, fechar um agendamento.": {
    es: "Skills que el agente pasó a cargar cuando la conversación lo pide — por ejemplo, cerrar una cita.",
  },
  "Somente admins podem publicar uma nova versão.": { es: "Solo los admins pueden publicar una nueva versión." },
  "Sugestões que o sistema tirou dos próprios atendimentos e que você revisou e aceitou.": {
    es: "Sugerencias que el sistema sacó de las propias atenciones y que revisaste y aceptaste.",
  },
  "Só acompanhar": { es: "Solo seguimiento" },
  "Tempo de resposta": { es: "Tiempo de respuesta" },
  "Tempo de resposta por dia (segundos)": { es: "Tiempo de respuesta por día (segundos)" },
  "Tentar de novo": { es: "Intentar de nuevo" },
  "Tipo de uso": { es: "Tipo de uso" },
  "Todos os números desta página são só deste intervalo. Mude as datas para comparar um mês com o outro.": {
    es: "Todos los números de esta página son solo de este intervalo. Cambia las fechas para comparar un mes con otro.",
  },
  Tokens: { es: "Tokens" },
  "Tudo o que entrou na cabeça dele neste período, e de onde veio.": {
    es: "Todo lo que entró en su cabeza en este período, y de dónde vino.",
  },
  "Tudo que a inteligência artificial fez por aqui — e, quando algo falhou, o que aconteceu e o que fazer.": {
    es: "Todo lo que la inteligencia artificial hizo por aquí — y, cuando algo falló, qué pasó y qué hacer.",
  },
  "Usando:": { es: "Usando:" },
  "Uso de IA": { es: "Uso de IA" },
  "Ver aprendizados arquivados": { es: "Ver aprendizajes archivados" },
  "Ver aprendizados ativos": { es: "Ver aprendizajes activos" },
  "Ver habilidades disponíveis": { es: "Ver habilidades disponibles" },
  "Ver sugestões de melhoria": { es: "Ver sugerencias de mejora" },
  "Ver só as falhas": { es: "Ver solo las fallas" },
  "Você ainda não cadastrou nenhuma chave de provedor. Enquanto isso, tudo usa a chave que veio na instalação.": {
    es: "Todavía no registraste ninguna clave de proveedor. Mientras tanto, todo usa la clave que vino con la instalación.",
  },
  "Volume de texto processado por dia": { es: "Volumen de texto procesado por día" },
  "a cada 100": { es: "cada 100" },
  "a maioria responde em": { es: "la mayoría responde en" },
  "agora usa": { es: "ahora usa" },
  "aprendido automaticamente": { es: "aprendido automáticamente" },
  ativa: { es: "activa" },
  "atualizada em": { es: "actualizada el" },
  caracteres: { es: "caracteres" },
  "carregado no editor. Clique em \"Publicar versão\" para confirmar.": {
    es: "cargado en el editor. Haz clic en \"Publicar versión\" para confirmar.",
  },
  código: { es: "código" },
  "da instalação": { es: "de la instalación" },
  "depois de salvar. É o tempo de você ver o aviso chegar antes que alguma conversa pare.": {
    es: "después de guardar. Es el tiempo para que veas llegar el aviso antes de que alguna conversación se detenga.",
  },
  "desinstalada.": { es: "desinstalada." },
  "do catálogo": { es: "del catálogo" },
  "do limite": { es: "del límite" },
  "do limite. A IA não para.": { es: "del límite. La IA no se detiene." },
  "enviada e instalada com sucesso.": { es: "enviada e instalada con éxito." },
  escolha: { es: "elige" },
  "este é o pior caso comum": { es: "este es el peor caso común" },
  "execuções falharam.": { es: "ejecuciones fallaron." },
  "execuções.": { es: "ejecuciones." },
  falhou: { es: "falló" },
  fixo: { es: "fijo" },
  "gastos de": { es: "gastados de" },
  "gastos este mês": { es: "gastados este mes" },
  horas: { es: "horas" },
  "instalada — já vale para os agentes desta organização.": {
    es: "instalada — ya vale para los agentes de esta organización.",
  },
  "lugares diferentes. Aqui você vê qual está atendendo cada um — e troca, se quiser.": {
    es: "lugares diferentes. Aquí ves cuál está atendiendo cada uno — y lo cambias, si quieres.",
  },
  manual: { es: "manual" },
  "menos de 0,1 a cada 100": { es: "menos de 0,1 cada 100" },
  "nas últimas": { es: "en las últimas" },
  "no dia": { es: "en el día" },
  "no período": { es: "en el período" },
  "não consegui carregar": { es: "no pude cargar" },
  "não consegui carregar a configuração": { es: "no pude cargar la configuración" },
  "não consegui falar com o servidor": { es: "no pude comunicarme con el servidor" },
  "não consegui salvar": { es: "no pude guardar" },
  "não definido": { es: "no definido" },
  "pior caso comum": { es: "peor caso común" },
  ponto: { es: "punto" },
  pontos: { es: "puntos" },
  "pontos deste grupo precisam da sua atenção.": { es: "puntos de este grupo necesitan tu atención." },
  por: { es: "por" },
  "por mês. Abaixo disso não é orçamento de": { es: "por mes. Por debajo de eso no es presupuesto de" },
  "precisa de ferramentas": { es: "necesita herramientas" },
  "publicada — já vale para todos os agentes.": { es: "publicada — ya vale para todos los agentes." },
  "quanto mais alto, mais a IA precisou de ajuda": { es: "cuanto más alto, más ayuda necesitó la IA" },
  "resposta inesperada do servidor": { es: "respuesta inesperada del servidor" },
  "sem ferramentas": { es: "sin herramientas" },
  "um atendimento — é erro de digitação. Se você só quer acompanhar o gasto sem limite, escolha \"Só acompanhar\".": {
    es: "una atención — es un error de tipeo. Si solo quieres seguir el gasto sin límite, elige \"Solo seguimiento\".",
  },
  "valores em dólar (é a moeda em que o provedor de IA cobra)": {
    es: "valores en dólares (es la moneda en la que cobra el proveedor de IA)",
  },
  "⚠️ Atenção: o produto ainda não sabe o preço do modelo em uso, então o gasto medido é menor que o real e esta parada pode não disparar.": {
    es: "⚠️ Atención: el producto todavía no sabe el precio del modelo en uso, así que el gasto medido es menor que el real y esta parada puede no dispararse.",
  },
  "O que aconteceu com os seus negócios neste período. Para saber se melhorou, mude as datas acima e compare com o mês anterior.": {
    es: "Lo que pasó con tus negocios en este período. Para saber si mejoró, cambia las fechas de arriba y compara con el mes anterior.",
  },
  "Clientes que o agente marcou como fechados. Negócio que a sua equipe fechou na mão, movendo o cartão no quadro, não entra aqui.": {
    es: "Clientes que el agente marcó como cerrados. El negocio que tu equipo cerró a mano, moviendo la tarjeta en el tablero, no entra aquí.",
  },
  "Clientes que o agente marcou como perdidos — contraponto necessário, porque ganhos sem perdidos ao lado enganam. Também não conta o que a sua equipe marcou na mão.": {
    es: "Clientes que el agente marcó como perdidos — contrapunto necesario, porque los cierres sin las pérdidas al lado engañan. Tampoco cuenta lo que tu equipo marcó a mano.",
  },
  "Quantas vezes o agente registrou que um cliente mudou de passo no atendimento — o sinal de que a conversa andou, e não só aconteceu. Inclui as mudanças para fechado e para perdido, então não leia como só progresso. Cartão movido à mão no quadro não entra aqui.": {
    es: "Cuántas veces el agente registró que un cliente cambió de paso en la atención — la señal de que la conversación avanzó, y no solo ocurrió. Incluye los cambios a cerrado y a perdido, así que no lo leas como solo progreso. La tarjeta movida a mano en el tablero no entra aquí.",
  },
  "Conversas que o agente passou para um atendente humano, a cada 100 mensagens recebidas. Leia como estimativa: no geral o mesmo caso conta uma vez só, mesmo que o cliente peça ajuda várias vezes, mas em parte dos atendimentos ele pode contar mais de uma.": {
    es: "Conversaciones que el agente pasó a una persona, cada 100 mensajes recibidos. Léelo como estimación: en general el mismo caso cuenta una sola vez, aunque el cliente pida ayuda varias veces, pero en parte de las atenciones puede contar más de una.",
  },
  "Não houve atendimento neste período, então os zeros abaixo querem dizer \"nada aconteceu\", e não \"foi mal\". Mude as datas acima para um período com movimento.": {
    es: "No hubo atención en este período, así que los ceros de abajo quieren decir \"no pasó nada\", y no \"salió mal\". Cambia las fechas de arriba a un período con movimiento.",
  },
  "Parte do que a IA gastou este mês não entra nesta conta: o produto ainda não sabe o preço do modelo que está em uso, então o número abaixo é MENOR que o real e a parada no limite pode não acontecer. Enquanto isso, acompanhe o gasto direto no painel do seu provedor de IA.": {
    es: "Parte de lo que la IA gastó este mes no entra en esta cuenta: el producto todavía no sabe el precio del modelo que está en uso, así que el número de abajo es MENOR que el real y la parada en el límite puede no ocurrir. Mientras tanto, sigue el gasto directo en el panel de tu proveedor de IA.",
  },
  "Atender o cliente": {
    es: "Atender al cliente",
  },
  "Escrever o que o cliente lê e agir no funil durante a conversa.": {
    es: "Escribir lo que el cliente lee y actuar en el embudo durante la conversación.",
  },
  "Entender a conversa": {
    es: "Entender la conversación",
  },
  "Ler o que chegou e decidir o que aquilo significa para o negócio.": {
    es: "Leer lo que llegó y decidir qué significa eso para el negocio.",
  },
  "Proteger a operação": {
    es: "Proteger la operación",
  },
  "Barrar manipulação e promessa que a empresa não pode cumprir.": {
    es: "Frenar la manipulación y las promesas que la empresa no puede cumplir.",
  },
  "Lembrar e buscar": {
    es: "Recordar y buscar",
  },
  "Guardar o essencial da conversa e achar o material certo do seu negócio.": {
    es: "Guardar lo esencial de la conversación y encontrar el material correcto de tu negocio.",
  },
  "Ver e ouvir": {
    es: "Ver y oír",
  },
  "Transformar áudio, imagem e vídeo do cliente em texto que o agente entende.": {
    es: "Transformar audio, imagen y video del cliente en texto que el agente entiende.",
  },
  "Melhorar e testar": {
    es: "Mejorar y probar",
  },
  "Avaliar o próprio desempenho e conferir se a configuração está de pé.": {
    es: "Evaluar el propio desempeño y comprobar que la configuración esté en pie.",
  },
  "Responder o cliente": {
    es: "Responder al cliente",
  },
  "Escreve a resposta que o cliente lê no WhatsApp, consultando o material do seu negócio e usando as ferramentas do CRM.": {
    es: "Escribe la respuesta que el cliente lee en WhatsApp, consultando el material de tu negocio y usando las herramientas del CRM.",
  },
  "O cliente manda mensagem e ninguém responde. A conversa fica parada na Caixa de entrada sem aviso.": {
    es: "El cliente manda un mensaje y nadie responde. La conversación queda detenida en la Bandeja de entrada sin aviso.",
  },
  "Trabalhar o funil": {
    es: "Trabajar el embudo",
  },
  "Cria o lead, move de etapa e registra o que ficou combinado, enquanto a conversa acontece.": {
    es: "Crea el lead, lo mueve de etapa y registra lo que quedó acordado, mientras la conversación ocurre.",
  },
  "O cliente é atendido normalmente, mas nada aparece no funil — nenhum lead criado, nenhuma etapa movida.": {
    es: "El cliente es atendido normalmente, pero nada aparece en el embudo — ningún lead creado, ninguna etapa movida.",
  },
  "Abordar quem preencheu o formulário": {
    es: "Abordar a quien completó el formulario",
  },
  "Escreve a primeira mensagem para quem acabou de preencher um formulário, usando os campos que a pessoa respondeu e a orientação que você deu na automação.": {
    es: "Escribe el primer mensaje para quien acaba de completar un formulario, usando los campos que la persona respondió y la orientación que diste en la automatización.",
  },
  "O lead entra pelo formulário, a automação roda, e a mensagem de abordagem nunca é escrita — o contato fica no funil sem ninguém falar com ele.": {
    es: "El lead entra por el formulario, la automatización corre, y el mensaje de abordaje nunca se escribe — el contacto queda en el embudo sin que nadie le hable.",
  },
  "Sugerir resposta ao atendente": {
    es: "Sugerir respuesta al agente humano",
  },
  "Escreve um rascunho de resposta para o atendente humano revisar antes de enviar.": {
    es: "Escribe un borrador de respuesta para que el agente humano lo revise antes de enviarlo.",
  },
  "O botão de sugerir resposta não traz nada, e o atendente escreve do zero sem saber por quê.": {
    es: "El botón de sugerir respuesta no trae nada, y el agente humano escribe desde cero sin saber por qué.",
  },
  "Responder (motor antigo)": {
    es: "Responder (motor antiguo)",
  },
  "Caminho de resposta anterior ao motor de agentes atual, mantido para instalações que ainda o usam.": {
    es: "Camino de respuesta anterior al motor de agentes actual, mantenido para instalaciones que todavía lo usan.",
  },
  "Nas instalações que ainda dependem dele, o cliente fica sem resposta e a conversa não avança.": {
    es: "En las instalaciones que todavía dependen de él, el cliente se queda sin respuesta y la conversación no avanza.",
  },
  "Escolher qual agente atende": {
    es: "Elegir qué agente atiende",
  },
  "Lê a mensagem que chegou e decide qual dos seus agentes deve pegar aquela conversa.": {
    es: "Lee el mensaje que llegó y decide cuál de tus agentes debe tomar esa conversación.",
  },
  "A conversa cai sempre no mesmo agente, ou em nenhum — como se os roteadores que você configurou não existissem.": {
    es: "La conversación cae siempre en el mismo agente, o en ninguno — como si los enrutadores que configuraste no existieran.",
  },
  "Identificar a etapa do lead": {
    es: "Identificar la etapa del lead",
  },
  "Lê a conversa e sugere em que etapa do funil aquele cliente está de verdade.": {
    es: "Lee la conversación y sugiere en qué etapa del embudo está realmente ese cliente.",
  },
  "Os leads param de andar sozinhos pelo funil e ficam todos na etapa em que entraram.": {
    es: "Los leads dejan de avanzar solos por el embudo y quedan todos en la etapa en la que entraron.",
  },
  "Medir o clima da conversa": {
    es: "Medir el clima de la conversación",
  },
  "Avalia se o cliente está satisfeito ou irritado, para escalar ao humano antes de perder a venda.": {
    es: "Evalúa si el cliente está satisfecho o molesto, para escalar a una persona antes de perder la venta.",
  },
  "Cliente irritado não é mais escalado para um humano, e a insatisfação só aparece quando ele já sumiu.": {
    es: "El cliente molesto ya no se escala a una persona, y la insatisfacción solo aparece cuando ya desapareció.",
  },
  "Ler a resposta ao follow-up": {
    es: "Leer la respuesta al seguimiento",
  },
  "Entende se o cliente aceitou, recusou ou pediu para falar depois, e encaminha o fluxo conforme isso.": {
    es: "Entiende si el cliente aceptó, rechazó o pidió hablar después, y encamina el flujo según eso.",
  },
  "O follow-up trava no mesmo passo: o cliente respondeu, mas o fluxo não segue para lugar nenhum.": {
    es: "El seguimiento se traba en el mismo paso: el cliente respondió, pero el flujo no avanza a ningún lado.",
  },
  "Escolher a hora do follow-up": {
    es: "Elegir la hora del seguimiento",
  },
  "Decide o melhor momento para retomar uma conversa que esfriou.": {
    es: "Decide el mejor momento para retomar una conversación que se enfrió.",
  },
  "As retomadas saem todas no mesmo horário fixo, sem respeitar o ritmo de cada cliente.": {
    es: "Las retomas salen todas en el mismo horario fijo, sin respetar el ritmo de cada cliente.",
  },
  "Barrar tentativa de manipulação": {
    es: "Frenar intento de manipulación",
  },
  "Percebe quando alguém tenta enganar o agente para ele fugir das suas regras.": {
    es: "Detecta cuando alguien intenta engañar al agente para que se salga de sus reglas.",
  },
  "O agente passa a aceitar instruções de estranhos e pode falar em nome da empresa coisas que você nunca autorizou.": {
    es: "El agente pasa a aceptar instrucciones de extraños y puede decir en nombre de la empresa cosas que nunca autorizaste.",
  },
  "Impedir promessa que não se cumpre": {
    es: "Impedir promesas que no se cumplen",
  },
  "Confere se a resposta promete prazo, desconto ou condição que a empresa não pode honrar.": {
    es: "Verifica si la respuesta promete un plazo, descuento o condición que la empresa no puede cumplir.",
  },
  "O agente promete ao cliente coisas que a operação não entrega, e a cobrança chega depois.": {
    es: "El agente le promete al cliente cosas que la operación no entrega, y el reclamo llega después.",
  },
  "Resumir a conversa longa": {
    es: "Resumir la conversación larga",
  },
  "Condensa uma conversa comprida no essencial, para o agente não perder o fio nem encarecer cada resposta.": {
    es: "Condensa una conversación larga en lo esencial, para que el agente no pierda el hilo ni encarezca cada respuesta.",
  },
  "Em conversas longas o agente esquece o que já foi combinado e começa a repetir perguntas.": {
    es: "En conversaciones largas el agente olvida lo que ya se acordó y empieza a repetir preguntas.",
  },
  "Guardar o combinado": {
    es: "Guardar lo acordado",
  },
  "Extrai da conversa os compromissos, objeções e dados do cliente antes de fechar o atendimento.": {
    es: "Extrae de la conversación los compromisos, objeciones y datos del cliente antes de cerrar la atención.",
  },
  "O que foi combinado com o cliente não fica registrado, e o próximo atendimento começa do zero.": {
    es: "Lo que se acordó con el cliente no queda registrado, y la próxima atención empieza de cero.",
  },
  "Fechar o atendimento": {
    es: "Cerrar la atención",
  },
  "Escreve o resumo de encerramento do turno, que o próximo atendimento lê ao abrir.": {
    es: "Escribe el resumen de cierre del turno, que la próxima atención lee al abrir.",
  },
  "Cada retomada de conversa parece a primeira: o agente não sabe o que aconteceu antes.": {
    es: "Cada retoma de conversación parece la primera: el agente no sabe qué pasó antes.",
  },
  "Indexar o seu material": {
    es: "Indexar tu material",
  },
  "Prepara os documentos do seu negócio para que o agente consiga encontrá-los na hora de responder.": {
    es: "Prepara los documentos de tu negocio para que el agente pueda encontrarlos al momento de responder.",
  },
  "O material indexado e a busca precisam usar exatamente o mesmo modelo — são coordenadas de um mesmo mapa. Trocar só um dos lados não dá erro: o agente simplesmente para de achar o seu conteúdo, sem avisar. Para mudar de modelo aqui é preciso reindexar tudo de uma vez.": {
    es: "El material indexado y la búsqueda necesitan usar exactamente el mismo modelo — son coordenadas de un mismo mapa. Cambiar solo un lado no da error: el agente simplemente deja de encontrar tu contenido, sin avisar. Para cambiar de modelo aquí hace falta reindexar todo de una vez.",
  },
  "Você sobe um documento e ele nunca fica pronto para uso; o agente responde sem conhecer o seu material.": {
    es: "Subes un documento y nunca queda listo para usar; el agente responde sin conocer tu material.",
  },
  "Buscar no seu material": {
    es: "Buscar en tu material",
  },
  "Encontra, entre os seus documentos, os trechos que respondem à pergunta do cliente.": {
    es: "Encuentra, entre tus documentos, los fragmentos que responden a la pregunta del cliente.",
  },
  "Precisa usar o mesmo modelo com que o material foi indexado. Se divergir, a busca continua funcionando e devolve resultados errados — falha silenciosa, e por isso a troca é feita junto com a reindexação, não aqui.": {
    es: "Necesita usar el mismo modelo con el que se indexó el material. Si difiere, la búsqueda sigue funcionando y devuelve resultados incorrectos — falla silenciosa, y por eso el cambio se hace junto con la reindexación, no aquí.",
  },
  "O agente responde de forma genérica, ignorando o que está escrito nos seus documentos.": {
    es: "El agente responde de forma genérica, ignorando lo que está escrito en tus documentos.",
  },
  "Ouvir o áudio do cliente": {
    es: "Escuchar el audio del cliente",
  },
  "Transforma o áudio que o cliente mandou em texto que o agente lê.": {
    es: "Transforma el audio que envió el cliente en texto que el agente lee.",
  },
  "Usa o padrão de transcrição da OpenAI, que é o formato que os serviços do mercado implementam. Aceita apontar para outro serviço compatível — inclusive um rodando na sua própria máquina — mas exige uma chave desse serviço, separada da chave do modelo de conversa.": {
    es: "Usa el estándar de transcripción de OpenAI, que es el formato que implementan los servicios del mercado. Acepta apuntar a otro servicio compatible — incluso uno corriendo en tu propia máquina — pero exige una clave de ese servicio, separada de la clave del modelo de conversación.",
  },
  "O cliente manda áudio e o agente responde como se não tivesse recebido nada.": {
    es: "El cliente manda audio y el agente responde como si no hubiera recibido nada.",
  },
  "Ver a imagem do cliente": {
    es: "Ver la imagen del cliente",
  },
  "Descreve a foto, o print ou o comprovante que o cliente enviou, para o agente saber do que se trata.": {
    es: "Describe la foto, la captura o el comprobante que envió el cliente, para que el agente sepa de qué se trata.",
  },
  "O cliente manda uma foto do produto ou um comprovante e o agente age como se a imagem não existisse.": {
    es: "El cliente manda una foto del producto o un comprobante y el agente actúa como si la imagen no existiera.",
  },
  "Avaliar o próprio atendimento": {
    es: "Evaluar la propia atención",
  },
  "Revisa atendimentos já concluídos e julga quais foram bons, para o agente aprender com eles.": {
    es: "Revisa atenciones ya concluidas y evalúa cuáles fueron buenas, para que el agente aprenda de ellas.",
  },
  "A tela de Propostas para de sugerir melhorias, e o agente estaciona no desempenho atual.": {
    es: "La pantalla de Propuestas deja de sugerir mejoras, y el agente se estanca en el desempeño actual.",
  },
  "Extrair a lição": {
    es: "Extraer la lección",
  },
  "Transforma os bons atendimentos em orientação prática para o agente aplicar nos próximos.": {
    es: "Transforma las buenas atenciones en orientación práctica para que el agente aplique en las próximas.",
  },
  "As melhorias identificadas não viram instrução, e o mesmo acerto precisa ser redescoberto toda vez.": {
    es: "Las mejoras identificadas no se convierten en instrucción, y el mismo acierto tiene que redescubrirse cada vez.",
  },
  "Testar a conexão com o provedor": {
    es: "Probar la conexión con el proveedor",
  },
  "Faz uma chamada de verdade ao provedor para confirmar que a chave e o modelo escolhidos funcionam.": {
    es: "Hace una llamada real al proveedor para confirmar que la clave y el modelo elegidos funcionan.",
  },
  "O botão de testar não conclui, e você fica sem saber se a configuração está de pé antes de colocar no ar.": {
    es: "El botón de probar no concluye, y te quedas sin saber si la configuración está en pie antes de ponerla en marcha.",
  },
  "Ensaiar o agente antes de publicar": {
    es: "Ensayar el agente antes de publicar",
  },
  "Roda o agente contra uma conversa de mentira, para você ver como ele responderia sem falar com cliente de verdade.": {
    es: "Corre el agente contra una conversación simulada, para que veas cómo respondería sin hablar con un cliente real.",
  },
  "Usa o modelo da versão do agente que você está ensaiando — e é exatamente isso que faz o ensaio valer. Se este ponto tivesse modelo próprio, você testaria uma configuração diferente da que vai publicar, e o ensaio deixaria de prever o comportamento real. Para trocar o modelo, troque na versão do agente.": {
    es: "Usa el modelo de la versión del agente que estás ensayando — y es exactamente eso lo que hace que el ensayo valga la pena. Si este punto tuviera modelo propio, probarías una configuración distinta de la que vas a publicar, y el ensayo dejaría de predecir el comportamiento real. Para cambiar el modelo, cámbialo en la versión del agente.",
  },
  "O ensaio do agente não devolve resposta, e você precisa publicar às cegas para descobrir se ficou bom.": {
    es: "El ensayo del agente no devuelve respuesta, y tienes que publicar a ciegas para descubrir si quedó bien.",
  },
  "Medir o tamanho do contexto": {
    es: "Medir el tamaño del contexto",
  },
  "Calcula quanto do limite do modelo a conversa já ocupa, para decidir a hora de resumir.": {
    es: "Calcula cuánto del límite del modelo ya ocupa la conversación, para decidir el momento de resumir.",
  },
  "Cada família de modelo conta o tamanho do texto de um jeito próprio, então a medida precisa vir do mesmo provedor do modelo em uso — não é uma escolha à parte.": {
    es: "Cada familia de modelo cuenta el tamaño del texto a su manera, así que la medida tiene que venir del mismo proveedor del modelo en uso — no es una elección aparte.",
  },
  "O sistema erra a hora de resumir a conversa: resume cedo demais e perde contexto, ou tarde demais e a resposta é recusada.": {
    es: "El sistema se equivoca en el momento de resumir la conversación: resume demasiado pronto y pierde contexto, o demasiado tarde y la respuesta es rechazada.",
  },
  "O provedor não aceitou a chave. Confira se ela ainda é válida em Credenciais — chaves são revogadas ou expiram.": {
    es: "El proveedor no aceptó la clave. Revisa si todavía es válida en Credenciales — las claves se revocan o expiran.",
  },
  "O modelo escolhido não existe mais nesse provedor. Escolha outro no painel de Provedores.": {
    es: "El modelo elegido ya no existe en ese proveedor. Elige otro en el panel de Proveedores.",
  },
  "O provedor recusou por limite de uso ou saldo. Verifique o faturamento na conta do provedor.": {
    es: "El proveedor rechazó por límite de uso o saldo. Revisa la facturación en la cuenta del proveedor.",
  },
  "O provedor está fora do ar ou demorou demais. Costuma se resolver sozinho; se persistir, troque de provedor nesse ponto.": {
    es: "El proveedor está caído o tardó demasiado. Suele resolverse solo; si persiste, cambia de proveedor en ese punto.",
  },
  "O modelo escolhido não sabe usar as ferramentas do CRM. Troque por um que saiba, no painel de Provedores.": {
    es: "El modelo elegido no sabe usar las herramientas del CRM. Cámbialo por uno que sepa, en el panel de Proveedores.",
  },
  "A IA parou porque o gasto do mês atingiu o limite que você definiu. Ajuste o limite (ou desligue a parada) em Uso de IA › Orçamento.": {
    es: "La IA se detuvo porque el gasto del mes llegó al límite que definiste. Ajusta el límite (o apaga la parada) en Uso de IA › Presupuesto.",
  },
  "Não conseguimos classificar esta falha. A mensagem original do provedor está abaixo.": {
    es: "No pudimos clasificar esta falla. El mensaje original del proveedor está abajo.",
  },
  "Definido na versão publicada do agente.": {
    es: "Definido en la versión publicada del agente.",
  },
  "Escolhido por você no painel de provedores.": {
    es: "Elegido por ti en el panel de proveedores.",
  },
  "Definido em variável de ambiente na instalação.": {
    es: "Definido en variable de entorno en la instalación.",
  },
  "Herdado de quem disparou a chamada — o agente publicado, ou o roteador de intenção.": {
    es: "Heredado de quien disparó la llamada — el agente publicado, o el enrutador de intención.",
  },
  "Usando o padrão da organização.": {
    es: "Usando el valor predeterminado de la organización.",
  },
  "Default:": { es: "Predeterminado:" },
  "API key": { es: "Clave de API" },

  // ─── Admin de plataforma: casca (shell, sidebar, banner, impersonate) ───
  "Acesso negado": { es: "Acceso denegado" },
  "Esta área é restrita a administradores da plataforma com MFA ativo. Se você acredita que isso é um erro, contate o time de operações.": {
    es: "Esta área está restringida a administradores de la plataforma con MFA activo. Si crees que esto es un error, contacta al equipo de operaciones.",
  },
  "Voltar para /app": { es: "Volver a /app" },
  "Menu de navegação": { es: "Menú de navegación" },
  "Abrir menu de navegação": { es: "Abrir menú de navegación" },
  "Admin Plataforma": { es: "Admin de la plataforma" },
  "MODO PLATAFORMA": { es: "MODO PLATAFORMA" },
  "— operação cross-tenant": { es: "— operación cross-tenant" },
  "Modo Plataforma": { es: "Modo Plataforma" },
  "Sair pra app pessoal": { es: "Salir a la app personal" },
  "Navegação plataforma": { es: "Navegación de la plataforma" },
  "Voltar pra app": { es: "Volver a la app" },
  Dashboard: { es: "Panel" },
  Tenants: { es: "Tenants" },
  Audit: { es: "Auditoría" },
  Incidents: { es: "Incidentes" },
  Usage: { es: "Uso" },
  Users: { es: "Usuarios" },
  "Platform Admins": { es: "Administradores de la plataforma" },
  Marca: { es: "Marca" },
  LGPD: { es: "LGPD" },
  "Não foi possível iniciar impersonate": { es: "No se pudo iniciar el impersonate" },
  "Erro de rede ao iniciar impersonate": { es: "Error de red al iniciar el impersonate" },
  "Impersonate indisponível": { es: "Impersonate no disponible" },
  Impersonar: { es: "Impersonar" },
  "Impersonar tenant": { es: "Impersonar tenant" },
  "Iniciar impersonate?": { es: "¿Iniciar el impersonate?" },
  "Você está prestes a entrar como o tenant": { es: "Estás a punto de entrar como el tenant" },
  "Toda ação será registrada com a flag": { es: "Toda acción quedará registrada con el flag" },
  "A sessão expira em 1 hora. Confirma?": { es: "La sesión expira en 1 hora. ¿Confirmas?" },
  "Entrando…": { es: "Entrando…" },
  "Confirmar e entrar": { es: "Confirmar y entrar" },

  // ─── Admin de plataforma: Dashboard ───
  "Visão cross-tenant — atualiza a cada 30 segundos.": {
    es: "Visión cross-tenant — se actualiza cada 30 segundos.",
  },
  "IA Budget": { es: "Presupuesto IA" },
  Overflow: { es: "Desborde" },
  Crítico: { es: "Crítico" },
  Atenção: { es: "Atención" },
  Info: { es: "Info" },
  "Nenhum alerta crítico no momento. Tudo certo!": {
    es: "Ninguna alerta crítica en este momento. ¡Todo en orden!",
  },
  "Alertas ativos": { es: "Alertas activas" },
  alerta: { es: "alerta" },
  alertas: { es: "alertas" },
  "alertas adicionais": { es: "alertas adicionales" },
  "Tenants Ativos": { es: "Tenants Activos" },
  "organizações ativas": { es: "organizaciones activas" },
  "Pendentes >10min": { es: "Pendientes >10min" },
  "conversas sem resposta": { es: "conversaciones sin respuesta" },
  "Alertas WAHA": { es: "Alertas WAHA" },
  "sessões com problema": { es: "sesiones con problema" },
  "LGPD em Risco": { es: "LGPD en Riesgo" },
  "requisições próximas do prazo": { es: "solicitudes próximas al plazo" },
  "Budgets IA": { es: "Presupuestos IA" },
  "tenants com gasto acumulado ≥80% do teto": {
    es: "tenants con gasto acumulado ≥80% del tope",
  },

  // ─── Admin de plataforma: Tenants (lista + criação) ───
  "Novo tenant": { es: "Nuevo tenant" },
  "Buscar por nome, slug ou CNPJ...": { es: "Buscar por nombre, slug o CNPJ..." },
  "Buscar tenants": { es: "Buscar tenants" },
  Onboarding: { es: "Onboarding" },
  Suspenso: { es: "Suspendido" },
  Redigido: { es: "Redactado" },
  Conversas: { es: "Conversaciones" },
  "Nenhum tenant encontrado": { es: "Ningún tenant encontrado" },
  "Ajuste os filtros ou crie um novo tenant.": {
    es: "Ajusta los filtros o crea un nuevo tenant.",
  },
  Ver: { es: "Ver" },
  "Tenant criado com sucesso!": { es: "¡Tenant creado con éxito!" },
  "Este slug já está em uso": { es: "Este slug ya está en uso" },
  "Erro ao criar tenant:": { es: "Error al crear el tenant:" },
  "Erro inesperado ao criar tenant": { es: "Error inesperado al crear el tenant" },
  "Novo Tenant": { es: "Nuevo Tenant" },
  "Cria um novo tenant com status": { es: "Crea un nuevo tenant con estado" },
  "Dados do tenant": { es: "Datos del tenant" },
  "Loja da Maria": { es: "Tienda de María" },
  "Mínimo 2 caracteres": { es: "Mínimo 2 caracteres" },
  "Máximo 120 caracteres": { es: "Máximo 120 caracteres" },
  "Máximo 40 caracteres": { es: "Máximo 40 caracteres" },
  "Apenas letras minúsculas, números e hífens": {
    es: "Solo letras minúsculas, números y guiones",
  },
  "Apenas letras minúsculas, números e hífens. Gerado automaticamente.": {
    es: "Solo letras minúsculas, números y guiones. Se genera automáticamente.",
  },
  "Maria da Silva LTDA": { es: "María García LTDA" },
  "E-mail inválido": { es: "Email inválido" },
  Plano: { es: "Plan" },
  "E-mail do responsável": { es: "Email del responsable" },
  "Criando...": { es: "Creando..." },
  "Criar tenant": { es: "Crear tenant" },

  // ─── Admin de plataforma: Tenant detail (layout, overview, ações) ───
  "Visão Geral": { es: "Vista general" },
  Saúde: { es: "Salud" },
  "em breve": { es: "próximamente" },
  "Não foi possível carregar os dados do tenant. Tente recarregar a página.": {
    es: "No se pudieron cargar los datos del tenant. Intenta recargar la página.",
  },
  Conectando: { es: "Conectando" },
  Conectado: { es: "Conectado" },
  "Token expirado": { es: "Token expirado" },
  "Permissão faltando": { es: "Permiso faltante" },
  Desconectado: { es: "Desconectado" },
  "Limitado (rate limit)": { es: "Limitado (rate limit)" },
  "Com erro": { es: "Con error" },
  "Não integrado": { es: "No integrado" },
  Informações: { es: "Información" },
  "Onboarding concluído": { es: "Onboarding concluido" },
  "Suspenso em": { es: "Suspendido el" },
  Volumes: { es: "Volúmenes" },
  Usuários: { es: "Usuarios" },
  Mensagens: { es: "Mensajes" },
  Leads: { es: "Leads" },
  Pedidos: { es: "Pedidos" },
  Integrações: { es: "Integraciones" },
  "Conectado em": { es: "Conectado el" },
  "Compliance & IA": { es: "Compliance y IA" },
  "Solicitações LGPD pendentes": { es: "Solicitudes LGPD pendientes" },
  "Pendências LGPD": { es: "Pendencias LGPD" },
  "Invocações IA (30d)": { es: "Invocaciones IA (30d)" },
  "Tenant redigido — ação não disponível": { es: "Tenant redactado — acción no disponible" },
  "Suspender tenant": { es: "Suspender tenant" },
  "Reativar tenant": { es: "Reactivar tenant" },
  "Tenant redigido — ações de gestão não disponíveis.": {
    es: "Tenant redactado — acciones de gestión no disponibles.",
  },
  hoje: { es: "hoy" },
  ontem: { es: "ayer" },
  semana: { es: "semana" },
  semanas: { es: "semanas" },
  "mês": { es: "mes" },
  meses: { es: "meses" },
  ano: { es: "año" },
  anos: { es: "años" },
  "Tenant Suspenso": { es: "Tenant Suspendido" },
  "Tenant suspenso": { es: "Tenant suspendido" },
  "Sem razão registrada.": { es: "Sin motivo registrado." },
  "Mínimo 10 caracteres": { es: "Mínimo 10 caracteres" },
  "Máximo 500 caracteres": { es: "Máximo 500 caracteres" },
  "Razão inválida": { es: "Motivo inválido" },
  "A suspensão bloqueará o acesso dos usuários deste tenant à plataforma. Esta ação pode ser revertida.": {
    es: "La suspensión bloqueará el acceso de los usuarios de este tenant a la plataforma. Esta acción se puede revertir.",
  },
  "Motivo da suspensão": { es: "Motivo de la suspensión" },
  "Descreva o motivo da suspensão (mínimo 10 caracteres)...": {
    es: "Describe el motivo de la suspensión (mínimo 10 caracteres)...",
  },
  "Suspendendo...": { es: "Suspendiendo..." },
  "Confirmar suspensão": { es: "Confirmar suspensión" },
  "A reativação restabelece o acesso dos usuários deste tenant à plataforma. Informe o motivo da reativação para o registro de auditoria.": {
    es: "La reactivación restablece el acceso de los usuarios de este tenant a la plataforma. Indica el motivo de la reactivación para el registro de auditoría.",
  },
  "Motivo da reativação": { es: "Motivo de la reactivación" },
  "Descreva o motivo da reativação (mínimo 10 caracteres)...": {
    es: "Describe el motivo de la reactivación (mínimo 10 caracteres)...",
  },
  "Reativando...": { es: "Reactivando..." },
  "Confirmar reativação": { es: "Confirmar reactivación" },

  // ─── Admin de plataforma: Tenant health ───
  "Não foi possível carregar o status de saúde do tenant. Tente recarregar a página.": {
    es: "No se pudo cargar el estado de salud del tenant. Intenta recargar la página.",
  },
  "Status de Saúde": { es: "Estado de Salud" },
  "Atualizado às": { es: "Actualizado a las" },
  "Sem sessões": { es: "Sin sesiones" },
  conectada: { es: "conectada" },
  conectadas: { es: "conectadas" },
  "Não conectado": { es: "No conectado" },
  "Última sync": { es: "Última sync" },
  "Expira em": { es: "Expira en" },
  "Token expira": { es: "Token expira" },
  usado: { es: "usado" },
  "Sem orçamento": { es: "Sin presupuesto" },
  Consumido: { es: "Consumido" },
  "Orçamento": { es: "Presupuesto" },
  Ilimitado: { es: "Ilimitado" },
  Limite: { es: "Límite" },
  "Não aplicado": { es: "No aplicado" },
  "Só avisa": { es: "Solo avisa" },
  "Para a IA no limite": { es: "Detiene la IA en el límite" },
  "Último evento": { es: "Último evento" },
  "Orçamento IA": { es: "Presupuesto IA" },

  // ─── Admin de plataforma: Users (lista + detalhe) ───
  "Buscar por email ou nome...": { es: "Buscar por email o nombre..." },
  "Buscar usuários": { es: "Buscar usuarios" },
  "Filtrar por tenant": { es: "Filtrar por tenant" },
  "Todos os tenants": { es: "Todos los tenants" },
  "Filtrar por role": { es: "Filtrar por role" },
  "Todos os roles": { es: "Todos los roles" },
  "Nenhum usuário encontrado": { es: "Ningún usuario encontrado" },
  "Ajuste os filtros para refinar a busca.": {
    es: "Ajusta los filtros para refinar la búsqueda.",
  },
  "Revogado": { es: "Revocado" },
  "Usuário não encontrado": { es: "Usuario no encontrado" },
  "Usuário sem nome": { es: "Usuario sin nombre" },
  "Informações do usuário": { es: "Información del usuario" },
  "Email confirmado": { es: "Email confirmado" },
  "Pendente": { es: "Pendiente" },
  Inativo: { es: "Inactivo" },
  "Sem memberships registrados.": { es: "Sin memberships registrados." },
  "Aceito em": { es: "Aceptado el" },
  "Audit recente": { es: "Auditoría reciente" },
  "Nenhuma entrada de auditoria encontrada para este usuário.": {
    es: "No se encontró ninguna entrada de auditoría para este usuario.",
  },
  "usuário": { es: "usuario" },
  "usuários": { es: "usuarios" },

  // ─── Admin de plataforma: LGPD (lista + detalhe) ───
  "LGPD — Cross-tenant": { es: "LGPD — Cross-tenant" },
  "solicitação": { es: "solicitud" },
  "solicitações": { es: "solicitudes" },
  Recebido: { es: "Recibido" },
  Processando: { es: "Procesando" },
  "Revisão": { es: "Revisión" },
  "Anonimização cliente": { es: "Anonimización cliente" },
  "Solicitação de dados": { es: "Solicitud de datos" },
  "Anonimização tenant": { es: "Anonimización tenant" },
  Vencido: { es: "Vencido" },
  "Crítico (<24h)": { es: "Crítico (<24h)" },
  "Alerta (>50%)": { es: "Alerta (>50%)" },
  "Limpar filtros": { es: "Limpiar filtros" },
  "solicitação vencendo em menos de 24h ou já vencida": {
    es: "solicitud venciendo en menos de 24h o ya vencida",
  },
  "solicitações vencendo em menos de 24h ou já vencidas": {
    es: "solicitudes venciendo en menos de 24h o ya vencidas",
  },
  "ação imediata requerida.": { es: "acción inmediata requerida." },
  "Ver detalhes": { es: "Ver detalles" },
  "em atraso": { es: "de atraso" },
  restantes: { es: "restantes" },
  "Recebido em": { es: "Recibido el" },
  "Vence em": { es: "Vence el" },
  Risco: { es: "Riesgo" },
  "Nenhuma solicitação encontrada": { es: "Ninguna solicitud encontrada" },
  "Ajuste os filtros para ver solicitações.": { es: "Ajusta los filtros para ver solicitudes." },
  "Revisão intermediária": { es: "Revisión intermedia" },
  "Entrega ao titular": { es: "Entrega al titular" },
  "Processamento": { es: "Procesamiento" },
  "Anonimização concluída": { es: "Anonimización concluida" },
  "vence hoje": { es: "vence hoy" },
  "Nenhuma entrada de auditoria registrada para esta solicitação.": {
    es: "No hay ninguna entrada de auditoría registrada para esta solicitud.",
  },
  "Falha ao carregar solicitação.": { es: "No se pudo cargar la solicitud." },
  "LGPD Cross-tenant": { es: "LGPD Cross-tenant" },
  Urgente: { es: "Urgente" },
  "Somente leitura — aprovação é feita pelo operador no contexto do tenant.": {
    es: "Solo lectura — la aprobación la hace el operador en el contexto del tenant.",
  },
  "Linha do tempo SLA": { es: "Línea de tiempo SLA" },
  "SLA não definido.": { es: "SLA no definido." },
  "ID completo": { es: "ID completo" },
  Origem: { es: "Origen" },
  Escopo: { es: "Alcance" },
  Tentativas: { es: "Intentos" },
  "Concluído em": { es: "Concluido el" },
  "Trilha de auditoria": { es: "Traza de auditoría" },
  "Revisão pendente": { es: "Revisión pendiente" },
  "Todos os tipos": { es: "Todos los tipos" },
  "Todos os riscos": { es: "Todos los riesgos" },

  // ─── Admin de plataforma: Incidents (lista + detalhe) ───
  incidente: { es: "incidente" },
  incidentes: { es: "incidentes" },
  Reconhecidos: { es: "Reconocidos" },
  Severidade: { es: "Severidad" },
  "Todas severidades": { es: "Todas las severidades" },
  Aberto: { es: "Abierto" },
  Reconhecido: { es: "Reconocido" },
  Resolvido: { es: "Resuelto" },
  Quando: { es: "Cuándo" },
  "Nenhum incidente encontrado": { es: "Ningún incidente encontrado" },
  "Ajuste os filtros para ver outros incidentes.": {
    es: "Ajusta los filtros para ver otros incidentes.",
  },
  "Incidente não encontrado": { es: "Incidente no encontrado" },
  "Criado": { es: "Creado" },
  "Nenhuma entrada de auditoria encontrada.": {
    es: "No se encontró ninguna entrada de auditoría.",
  },
  "Resolução": { es: "Resolución" },
  "Resolvido em": { es: "Resuelto el" },
  "Resolver incidente": { es: "Resolver incidente" },
  "Descreva como o incidente foi resolvido. Esta ação é registrada no audit log e não pode ser desfeita.": {
    es: "Describe cómo se resolvió el incidente. Esta acción queda registrada en el audit log y no se puede deshacer.",
  },
  "Nota de resolução": { es: "Nota de resolución" },
  "mín. 10 caracteres": { es: "mín. 10 caracteres" },
  "Descreva a causa raiz e as ações tomadas para resolver o incidente...": {
    es: "Describe la causa raíz y las acciones tomadas para resolver el incidente...",
  },
  "Mínimo de 10 caracteres": { es: "Mínimo de 10 caracteres" },
  "Resolvendo...": { es: "Resolviendo..." },
  "Confirmar resolução": { es: "Confirmar resolución" },

  // ─── Admin de plataforma: Audit Log (lista + detalhe) ───
  evento: { es: "evento" },
  eventos: { es: "eventos" },
  "Buscar...": { es: "Buscar..." },
  "Limpar seleção": { es: "Limpiar selección" },
  "Filtrar por actor user ID": { es: "Filtrar por actor user ID" },
  "Data de início": { es: "Fecha de inicio" },
  "Data de fim": { es: "Fecha de fin" },
  "Limpar": { es: "Limpiar" },
  "Recurso": { es: "Recurso" },
  "Nenhum evento encontrado": { es: "Ningún evento encontrado" },
  "Ajuste os filtros para ver entradas do audit log.": {
    es: "Ajusta los filtros para ver entradas del audit log.",
  },
  "Entrada de audit não encontrada.": { es: "No se encontró la entrada de audit." },
  "Sem actor registrado": { es: "Sin actor registrado" },
  "Ver tenant": { es: "Ver tenant" },
  "Abrir recurso": { es: "Abrir recurso" },

  // ─── Admin de plataforma: Platform Admins ───
  "Administradores com acesso privilegiado à plataforma": {
    es: "Administradores con acceso privilegiado a la plataforma",
  },
  "Erro ao carregar platform admins. Tente recarregar.": {
    es: "Error al cargar los platform admins. Intenta recargar.",
  },
  "Gerenciamento de Platform Admins é restrito ao DBA": {
    es: "La gestión de Platform Admins está restringida al DBA",
  },
  "Conforme Spec 01 §3.4 T-04: adição, remoção ou alteração de": {
    es: "Según la Spec 01 §3.4 T-04: la adición, eliminación o modificación de",
  },
  "é feita exclusivamente via SQL pelo DBA, com nota explicativa em": {
    es: "se hace exclusivamente vía SQL por el DBA, con una nota explicativa en",
  },
  ". Esta página é informativa e read-only — nenhum botão de modificação está disponível por design.": {
    es: ". Esta página es informativa y de solo lectura — ningún botón de modificación está disponible por diseño.",
  },
  "Ver runbook →": { es: "Ver runbook →" },
  "Usuário": { es: "Usuario" },
  "Concedido em": { es: "Concedido el" },
  "Concedido por": { es: "Concedido por" },
  "Nenhum platform admin encontrado": { es: "Ningún platform admin encontrado" },
  "Platform admins são configurados exclusivamente via DBA.": {
    es: "Los platform admins se configuran exclusivamente vía DBA.",
  },

  // ─── Admin de plataforma: Usage & Custo ───
  "Uso & Custo": { es: "Uso y Costo" },
  "Consumo de mensagens, conversas e AI por tenant": {
    es: "Consumo de mensajes, conversaciones e IA por tenant",
  },
  "Período": { es: "Período" },
  "Últimos 7 dias": { es: "Últimos 7 días" },
  "Últimos 30 dias": { es: "Últimos 30 días" },
  "Últimos 90 dias": { es: "Últimos 90 días" },
  "Erro ao carregar dados de uso. Tente recarregar.": {
    es: "Error al cargar los datos de uso. Intenta recargar.",
  },
  "Mensagens / dia": { es: "Mensajes / día" },
  "Custo AI / dia (R$)": { es: "Costo IA / día (R$)" },
  "AI Tokens / dia": { es: "AI Tokens / día" },
  "Não há dados de uso no período selecionado.": {
    es: "No hay datos de uso en el período seleccionado.",
  },
  "Uso por tenant": { es: "Uso por tenant" },
  "Exportar CSV": { es: "Exportar CSV" },
  "Invoc. AI": { es: "Invoc. IA" },
  "Custo AI": { es: "Costo IA" },

  // ─── Admin de plataforma: Marca (page.tsx, _form.tsx, _estado.tsx) ───
  "O nome e a cor que este sistema mostra para todo mundo que usa esta instalação.": {
    es: "El nombre y el color que este sistema muestra a todo el mundo que usa esta instalación.",
  },
  "Sua cor": { es: "Tu color" },
  "fora da escala — fica só no logo": { es: "fuera de la escala — solo queda en el logo" },
  "Botões no modo claro": { es: "Botones en el modo claro" },
  "Botões no modo escuro": { es: "Botones en el modo oscuro" },
  "Confira os campos: algum valor não está no formato esperado.": {
    es: "Revisa los campos: algún valor no está en el formato esperado.",
  },
  "Marca salva.": { es: "Marca guardada." },
  "Nome do sistema": { es: "Nombre del sistema" },
  "Deixe em branco para voltar ao nome padrão. Este nome já aparece no título da aba do navegador, nos menus laterais, nos e-mails que o sistema envia (para as empresas que não definiram um nome próprio), no aplicativo de verificação em duas etapas e no arquivo de códigos de recuperação que o usuário baixa. Ainda NÃO chega às telas de entrada e cadastro nem às da configuração inicial: essas continuam com o nome gravado no arquivo de instalação do servidor até a próxima atualização da stack.": {
    es: "Déjalo en blanco para volver al nombre predeterminado. Este nombre ya aparece en el título de la pestaña del navegador, en los menús laterales, en los emails que el sistema envía (para las empresas que no definieron un nombre propio), en la app de verificación en dos pasos y en el archivo de códigos de recuperación que el usuario descarga. Todavía NO llega a las pantallas de entrada y registro ni a las de la configuración inicial: esas siguen con el nombre grabado en el archivo de instalación del servidor hasta la próxima actualización del stack.",
  },
  "Cor da marca": { es: "Color de la marca" },
  "Escolher a cor visualmente": { es: "Elegir el color visualmente" },
  "Use um código de cor como #7a5cd6.": { es: "Usa un código de color como #7a5cd6." },
  "Deixe em branco para voltar à cor padrão do sistema.": {
    es: "Déjalo en blanco para volver al color predeterminado del sistema.",
  },
  "A partir da sua cor o sistema monta esta escala e escolhe, dentro dela, o tom que vai nos botões:": {
    es: "A partir de tu color el sistema arma esta escala y elige, dentro de ella, el tono que va en los botones:",
  },
  "No modo escuro o sistema usa naturalmente um tom mais claro da escala, para a cor não se perder no fundo escuro.": {
    es: "En el modo oscuro el sistema usa naturalmente un tono más claro de la escala, para que el color no se pierda en el fondo oscuro.",
  },
  "Sem cor definida, o sistema usa a cor padrão dele.": {
    es: "Sin color definido, el sistema usa su color predeterminado.",
  },
  "passa em AA": { es: "pasa en AA" },
  "abaixo do mínimo AA": { es: "por debajo del mínimo AA" },
  "definido nesta tela": { es: "definido en esta pantalla" },
  "veio do arquivo de instalação do servidor": { es: "viene del archivo de instalación del servidor" },
  "padrão do sistema": { es: "predeterminado del sistema" },
  "Como está agora": { es: "Cómo está ahora" },
  "O que o sistema está usando, o que ele mediu e o que ele ajustou sozinho.": {
    es: "Lo que el sistema está usando, lo que midió y lo que ajustó por su cuenta.",
  },
  "A sua marca não está sendo aplicada.": { es: "Tu marca no se está aplicando." },
  "Desde": { es: "Desde" },
  "o sistema voltou a usar as cores padrão dele.": {
    es: "el sistema volvió a usar sus colores predeterminados.",
  },
  "Salvar uma cor válida aqui apaga este alerta.": {
    es: "Guardar un color válido aquí borra esta alerta.",
  },
  "De onde vem cada coisa": { es: "De dónde viene cada cosa" },
  "Logo": { es: "Logo" },
  "O logo ainda é trocado no arquivo de instalação do servidor. Esta tela mostra de onde ele vem para que o valor não pareça ter sumido.": {
    es: "El logo todavía se cambia en el archivo de instalación del servidor. Esta pantalla muestra de dónde viene para que el valor no parezca haber desaparecido.",
  },
  "O texto em cima dos botões": { es: "El texto encima de los botones" },
  "Quanto maior o número, mais fácil de ler. AA é o mínimo recomendado internacionalmente para texto.": {
    es: "Cuanto más alto el número, más fácil de leer. AA es el mínimo recomendado internacionalmente para texto.",
  },
  "No modo claro": { es: "En el modo claro" },
  "No modo escuro": { es: "En el modo oscuro" },
  "O que o sistema ajustou": { es: "Lo que el sistema ajustó" },
  "Nada foi ajustado — a escala acima mostra onde a sua cor entra.": {
    es: "No se ajustó nada — la escala de arriba muestra dónde entra tu color.",
  },
  "Do jeito que está, esta cor não chegaria à tela: o sistema continuaria com as cores padrão dele.": {
    es: "Tal como está, este color no llegaría a la pantalla: el sistema seguiría con sus colores predeterminados.",
  },
  "Logo atualizado.": { es: "Logo actualizado." },
  "Logo removido.": { es: "Logo eliminado." },
  "PNG ou JPG, até": { es: "PNG o JPG, hasta" },
  "KB. Prefira fundo transparente. SVG não é aceito: ele pode executar código quando aberto direto pelo endereço da imagem.": {
    es: "KB. Preferí fondo transparente. SVG no se acepta: puede ejecutar código cuando se abre directo por la dirección de la imagen.",
  },
  "Como o logo aparece nas duas aparências do sistema:": {
    es: "Cómo se ve el logo en las dos apariencias del sistema:",
  },
  "Sem logo próprio, o sistema usa o logo": { es: "Sin logo propio, el sistema usa el logo" },
  "Assim ele aparece:": { es: "Así se ve:" },

  // ─── Marca: linguagem.ts (só os avisos de texto FIXO — os compostos
  // dinamicamente com interpolação, ex. "No modo X, os botões usam..." e
  // "Sua cor ficou parecida com...", ficam deliberadamente em português, mesma
  // categoria de `montaLacunas`/`boaNoticia` já deferida na área ai) ───
  "O valor gravado para a cor não está na forma que o sistema entende.": {
    es: "El valor grabado para el color no está en la forma que el sistema entiende.",
  },
  "A cor gravada não é um código de cor válido.": {
    es: "El color grabado no es un código de color válido.",
  },
  "A cor foi gravada por uma versão mais nova do sistema, e esta não sabe lê-la.": {
    es: "El color fue grabado por una versión más nueva del sistema, y esta no sabe leerlo.",
  },
  "A cor foi salva por outra versão do sistema. Ela continua valendo — esta versão recalcula os tons a partir dela.": {
    es: "El color fue guardado por otra versión del sistema. Sigue valiendo — esta versión recalcula los tonos a partir de él.",
  },
  "Esta versão do sistema não sabe onde aplicar a cor gravada, então ela não pinta a interface.": {
    es: "Esta versión del sistema no sabe dónde aplicar el color grabado, así que no pinta la interfaz.",
  },
  "A cor está guardada só como identidade: ela aparece no logo, mas não pinta os botões.": {
    es: "El color está guardado solo como identidad: aparece en el logo, pero no pinta los botones.",
  },
  "O cálculo dos tons a partir dessa cor não terminou.": {
    es: "El cálculo de los tonos a partir de ese color no terminó.",
  },
  "Sua cor é um tom neutro (cinza, preto ou branco), e uma cor assim não destaca nada na tela. Os botões seguem com a cor padrão do sistema, e a sua fica reservada ao logo.": {
    es: "Tu color es un tono neutro (gris, negro o blanco), y un color así no resalta nada en la pantalla. Los botones siguen con el color predeterminado del sistema, y el tuyo queda reservado al logo.",
  },
  "Não existe tom desta cor que deixe todos os elementos legíveis. Alguns detalhes — como o contorno que marca o campo em foco — ficam difíceis de enxergar.": {
    es: "No existe un tono de este color que deje todos los elementos legibles. Algunos detalles — como el contorno que marca el campo en foco — quedan difíciles de ver.",
  },
  "A verificação de segurança barrou o resultado antes de ele chegar à tela, e a marca não foi aplicada.": {
    es: "La verificación de seguridad bloqueó el resultado antes de que llegara a la pantalla, y la marca no se aplicó.",
  },
  "O sistema recusou a cor gravada por um motivo que esta versão não sabe explicar.": {
    es: "El sistema rechazó el color grabado por un motivo que esta versión no sabe explicar.",
  },
  "A sua cor original continua no logo e nos destaques.": {
    es: "Tu color original sigue en el logo y en los destacados.",
  },
  "Algum campo não está no formato esperado.": {
    es: "Algún campo no está en el formato esperado.",
  },
  "Sua sessão expirou. Entre de novo para salvar.": {
    es: "Tu sesión expiró. Vuelve a entrar para guardar.",
  },
  "Só quem administra a instalação pode mudar a marca.": {
    es: "Solo quien administra la instalación puede cambiar la marca.",
  },
  "Sua sessão expirou. Entre de novo para trocar o logo.": {
    es: "Tu sesión expiró. Vuelve a entrar para cambiar el logo.",
  },
  "Você não tem permissão para trocar este logo.": {
    es: "No tienes permiso para cambiar este logo.",
  },
  "Nenhuma empresa ativa nesta sessão.": {
    es: "No hay ninguna empresa activa en esta sesión.",
  },
  "Confirme o segundo fator nesta sessão e tente de novo.": {
    es: "Confirma el segundo factor en esta sesión e intenta de nuevo.",
  },
  "Muitas trocas seguidas. Tente de novo em alguns minutos.": {
    es: "Demasiados cambios seguidos. Intenta de nuevo en unos minutos.",
  },
  "Não consegui trocar o logo agora.": {
    es: "No pude cambiar el logo ahora.",
  },
  Cor: { es: "Color" },
  "do arquivo de instalação do servidor": {
    es: "del archivo de instalación del servidor",
  },
  "Aparência clara": { es: "Apariencia clara" },
  "Aparência escura": { es: "Apariencia oscura" },
  // ─── Webhooks ───
  "Receba contatos de fora (landing pages, formulários) e crie automações que agem sozinhas.": {
    es: "Recibe contactos de afuera (landing pages, formularios) y crea automatizaciones que actúan solas.",
  },
  "Receber dados": { es: "Recibir datos" },
  "Leads recebidos": { es: "Leads recibidos" },
  Automações: { es: "Automatizaciones" },
  Atividade: { es: "Actividad" },
  Funil: { es: "Embudo" },
  "Escolha o funil": { es: "Elige el embudo" },
  "Escolha o funil primeiro": { es: "Elige primero el embudo" },
  desconectado: { es: "desconectado" },
  "Números desconectados aparecem desabilitados — reconecte em Conexões antes de usar.": {
    es: "Los números desconectados aparecen deshabilitados — reconéctalos en Conexiones antes de usarlos.",
  },
  "Oi {{nome}}, tudo bem?": { es: "Hola {{nome}}, ¿todo bien?" },
  "Respeitamos a janela de envio e o limite diário configurados para esse número em Conexões — fora da janela, a mensagem espera a próxima.": {
    es: "Respetamos la ventana de envío y el límite diario configurados para ese número en Conexiones — fuera de la ventana, el mensaje espera a la próxima.",
  },
  "Qual agente escreve": { es: "Qué agente escribe" },
  "não publicado": { es: "no publicado" },
  "Nenhum agente está publicado. Publique um em Agentes de IA para poder usá-lo aqui.": {
    es: "Ningún agente está publicado. Publica uno en Agentes de IA para poder usarlo aquí.",
  },
  "Ele escreve com o mesmo tom e o mesmo conhecimento que usa no atendimento.": {
    es: "Escribe con el mismo tono y el mismo conocimiento que usa en la atención.",
  },
  "O que a IA deve fazer com os dados": { es: "Qué debe hacer la IA con los datos" },
  "Ex.: Agradeça o interesse citando o segmento que a pessoa informou, mostre em uma frase como a gente resolve a dificuldade que ela descreveu, e pergunte qual o melhor horário para conversar.": {
    es: "Ej.: Agradece el interés mencionando el rubro que la persona indicó, muestra en una frase cómo resolvemos la dificultad que describió, y pregunta cuál es el mejor horario para conversar.",
  },
  "O agente já sabe que é a PRIMEIRA mensagem, logo depois de a pessoa preencher o formulário, e recebe todos os campos que ela respondeu. Aqui você diz o que fazer com eles — quanto mais concreto, melhor a mensagem.": {
    es: "El agente ya sabe que es el PRIMER mensaje, justo después de que la persona complete el formulario, y recibe todos los campos que ella respondió. Aquí le dices qué hacer con ellos — cuanto más concreto, mejor el mensaje.",
  },
  Atendente: { es: "Agente" },
  "Escolha o atendente": { es: "Elige el agente" },
  "Endereço (URL)": { es: "Dirección (URL)" },
  "Segredo (opcional)": { es: "Secreto (opcional)" },
  "•••••••• (definido — digite para trocar)": {
    es: "•••••••• (definido — escribe para cambiarlo)",
  },
  "uma senha só sua": { es: "una contraseña solo tuya" },
  "Já existe um segredo guardado com segurança. Digitar aqui substitui; limpar remove.": {
    es: "Ya existe un secreto guardado con seguridad. Escribir aquí lo reemplaza; borrar lo elimina.",
  },
  "Se preencher, enviaremos uma assinatura para o outro sistema conferir que fomos nós.": {
    es: "Si lo completas, enviaremos una firma para que el otro sistema confirme que fuimos nosotros.",
  },
  Sucesso: { es: "Éxito" },
  "Aguardando envio": { es: "Esperando envío" },
  "Essa ação não funcionou.": { es: "Esta acción no funcionó." },
  "Reenviado.": { es: "Reenviado." },
  Reenviar: { es: "Reenviar" },
  "Nova tentativa em": { es: "Nuevo intento a las" },
  "Nenhuma automação rodou ainda. Assim que uma regra ligada disparar, o histórico aparece aqui.": {
    es: "Ninguna automatización corrió todavía. En cuanto una regla activada se dispare, el historial aparece aquí.",
  },
  "Automação removida": { es: "Automatización eliminada" },
  Captação: { es: "Captación" },
  "Chegou pela fonte": { es: "Llegó por la fuente" },
  "O que o formulário trouxe": { es: "Lo que trajo el formulario" },
  "Nenhum campo além dos acima.": { es: "Ningún campo además de los de arriba." },
  "De onde veio": { es: "De dónde vino" },
  Página: { es: "Página" },
  "não informada": { es: "no informada" },
  "Endereço IP": { es: "Dirección IP" },
  "não identificado — sua instalação não está atrás de um proxy que informe a origem": {
    es: "no identificado — tu instalación no está detrás de un proxy que informe el origen",
  },
  Navegador: { es: "Navegador" },
  "Ver o lead no funil": { es: "Ver el lead en el embudo" },
  "(sem identificação)": { es: "(sin identificación)" },
  "Nome, telefone ou e-mail": { es: "Nombre, teléfono o correo" },
  "quem você procura": { es: "a quién buscas" },
  "Filtrar por fonte": { es: "Filtrar por fuente" },
  "Todas as fontes": { es: "Todas las fuentes" },
  "Filtrar por resultado": { es: "Filtrar por resultado" },
  "Não foi possível carregar o histórico.": { es: "No se pudo cargar el historial." },
  "Isto é uma falha ao consultar — não quer dizer que ninguém preencheu.": {
    es: "Esto es una falla al consultar — no significa que nadie haya completado el formulario.",
  },
  "Nenhuma captação com esses filtros. Tente ampliar o período.": {
    es: "Ninguna captación con esos filtros. Intenta ampliar el período.",
  },
  "Ninguém preencheu seus formulários ainda. Assim que o primeiro envio chegar, ele aparece aqui — com os dados, o horário e a origem.": {
    es: "Todavía nadie completó tus formularios. En cuanto llegue el primer envío, aparece aquí — con los datos, el horario y el origen.",
  },
  "Escolha o funil e o estágio de entrada.": { es: "Elige el embudo y la etapa de entrada." },
  "Fonte criada. Agora é só conectar seu site.": {
    es: "Fuente creada. Ahora solo falta conectar tu sitio.",
  },
  "Nova fonte de captação": { es: "Nueva fuente de captación" },
  "Dê um nome e diga em qual funil o contato deve entrar quando alguém preencher seu formulário.": {
    es: "Dale un nombre y di en qué embudo debe entrar el contacto cuando alguien complete tu formulario.",
  },
  "Landing page de Black Friday": { es: "Landing page de Black Friday" },
  "Funil de entrada": { es: "Embudo de entrada" },
  "Estágio de entrada": { es: "Etapa de entrada" },
  "Escolha o estágio": { es: "Elige la etapa" },
  "URL de obrigado (opcional)": { es: "URL de agradecimiento (opcional)" },
  "Para onde enviar a pessoa depois que ela preencher seu formulário.": {
    es: "A dónde enviar a la persona después de que complete tu formulario.",
  },
  "Automação atualizada.": { es: "Automatización actualizada." },
  "Automação criada — ligue quando estiver pronta.": {
    es: "Automatización creada — actívala cuando esté lista.",
  },
  "Editar automação": { es: "Editar automatización" },
  "Nova automação": { es: "Nueva automatización" },
  "Monte a regra em três passos: quando algo acontece, opcionalmente confira uma condição, e então dispare uma ou mais ações.": {
    es: "Arma la regla en tres pasos: cuando algo sucede, opcionalmente revisa una condición, y entonces dispara una o más acciones.",
  },
  "Nome da automação": { es: "Nombre de la automatización" },
  "Boas-vindas a contato novo": { es: "Bienvenida a contacto nuevo" },
  QUANDO: { es: "CUANDO" },
  "Escolha o gatilho": { es: "Elige el disparador" },
  "SE (opcional)": { es: "SI (opcional)" },
  "ex: lead.custom_fields.minha_chave": { es: "ej: lead.custom_fields.mi_clave" },
  "usar campo da lista": { es: "usar campo de la lista" },
  "usar campo avançado": { es: "usar campo avanzado" },
  "Adicionar condição": { es: "Agregar condición" },
  ENTÃO: { es: "ENTONCES" },
  "Mover ação para cima": { es: "Mover acción hacia arriba" },
  "Mover ação para baixo": { es: "Mover acción hacia abajo" },
  "Remover ação": { es: "Eliminar acción" },
  "Adicionar ação": { es: "Agregar acción" },
  "A automação nasce pausada. Revise e ligue quando estiver pronta.": {
    es: "La automatización nace pausada. Revísala y actívala cuando esté lista.",
  },
  "Salvar alterações": { es: "Guardar cambios" },
  "Criar automação": { es: "Crear automatización" },
  "Automação ligada.": { es: "Automatización activada." },
  "Automação pausada.": { es: "Automatización pausada." },
  "Crie sua primeira automação": { es: "Crea tu primera automatización" },
  "Ex.: quando entrar um contato novo, enviar uma mensagem de boas-vindas.": {
    es: "Ej.: cuando entre un contacto nuevo, enviar un mensaje de bienvenida.",
  },
  Ativa: { es: "Activa" },
  Pausada: { es: "Pausada" },
  "Excluir automação": { es: "Eliminar automatización" },
  "Excluir esta automação?": { es: "¿Eliminar esta automatización?" },
  "para de rodar imediatamente. Essa ação não pode ser desfeita.": {
    es: "deja de correr de inmediato. Esta acción no se puede deshacer.",
  },
  "Automação excluída.": { es: "Automatización eliminada." },
  "Seu WhatsApp": { es: "Tu WhatsApp" },
  "Seu e-mail": { es: "Tu correo" },
  "Quero receber contato": { es: "Quiero que me contacten" },
  "Não foi possível copiar — selecione e copie manualmente.": {
    es: "No se pudo copiar — selecciona y copia manualmente.",
  },
  "Funcionou! Um lead de teste entrou no seu funil.": {
    es: "¡Funcionó! Un lead de prueba entró en tu embudo.",
  },
  "Não conseguimos falar com o endereço. Confira sua internet e tente de novo.": {
    es: "No pudimos comunicarnos con la dirección. Revisa tu conexión e intenta de nuevo.",
  },
  "Cada envio para o endereço abaixo vira um lead no seu funil, automaticamente.": {
    es: "Cada envío a la dirección de abajo se convierte en un lead en tu embudo, automáticamente.",
  },
  "Endereço da fonte": { es: "Dirección de la fuente" },
  "Endereço copiado.": { es: "Dirección copiada." },
  "Formulário pronto para colar no seu site": { es: "Formulario listo para pegar en tu sitio" },
  "Formulário copiado.": { es: "Formulario copiado." },
  "Copiar formulário": { es: "Copiar formulario" },
  "Como conectar no seu caso": { es: "Cómo conectarlo en tu caso" },
  "Formulário próprio": { es: "Formulario propio" },
  "Use o HTML pronto logo acima — já aponta para o endereço certo.": {
    es: "Usa el HTML de arriba — ya apunta a la dirección correcta.",
  },
  "Para desenvolvedores": { es: "Para desarrolladores" },
  "Enviar lead de teste": { es: "Enviar lead de prueba" },
  "Ver no Kanban": { es: "Ver en el Kanban" },
  "Últimos recebimentos": { es: "Últimas recepciones" },
  "Ainda não chegou nada por aqui.": { es: "Todavía no llegó nada por aquí." },
  "assinatura inválida": { es: "firma inválida" },
  "Fonte ativa": { es: "Fuente activa" },
  "Pausada, ela para de aceitar novos envios.": { es: "Pausada, deja de aceptar nuevos envíos." },
  "Fonte ativada.": { es: "Fuente activada." },
  "Fonte pausada.": { es: "Fuente pausada." },
  "Excluir fonte": { es: "Eliminar fuente" },
  "Excluir esta fonte?": { es: "¿Eliminar esta fuente?" },
  "O endereço para de funcionar imediatamente. Leads já recebidos continuam no seu funil — só a captação futura é interrompida. Essa ação não pode ser desfeita.": {
    es: "La dirección deja de funcionar de inmediato. Los leads ya recibidos siguen en tu embudo — solo se interrumpe la captación futura. Esta acción no se puede deshacer.",
  },
  "Fonte excluída.": { es: "Fuente eliminada." },
  "nunca recebeu": { es: "nunca recibió" },
  "último recebimento": { es: "última recepción" },
  "Conecte sua landing page em 2 minutos": { es: "Conecta tu landing page en 2 minutos" },
  "1. Crie uma fonte e diga em qual funil o contato entra.": {
    es: "1. Crea una fuente y di en qué embudo entra el contacto.",
  },
  "2. Copie o endereço ou o formulário pronto.": {
    es: "2. Copia la dirección o el formulario listo.",
  },
  "3. Cole no seu site — cada envio vira um lead aqui dentro.": {
    es: "3. Pégalo en tu sitio — cada envío se convierte en un lead aquí.",
  },
  "Criar primeira fonte": { es: "Crear primera fuente" },
  "Nova fonte": { es: "Nueva fuente" },
  "Ver no histórico o que foi alterado": { es: "Ver en el historial qué se cambió" },
  "— ver o que mudou": { es: "— ver qué cambió" },
  "O envio não trazia nome, telefone nem e-mail reconhecíveis — confira os nomes dos campos do formulário.": {
    es: "El envío no traía nombre, teléfono ni correo reconocibles — revisa los nombres de los campos del formulario.",
  },
  "A assinatura não conferiu. Quem enviou não usou o segredo configurado nesta fonte.": {
    es: "La firma no coincidió. Quien envió no usó el secreto configurado en esta fuente.",
  },
  "Os dados chegaram, mas o lead não pôde ser criado — confira se o funil e a etapa da fonte ainda existem.": {
    es: "Los datos llegaron, pero el lead no pudo crearse — revisa si el embudo y la etapa de la fuente todavía existen.",
  },
  "Virou lead": { es: "Se convirtió en lead" },
  Reenvio: { es: "Reenvío" },
  "Não entrou": { es: "No entró" },
  "Criar/mover lead no funil": { es: "Crear/mover lead en el embudo" },
  "Enviar mensagem no WhatsApp": { es: "Enviar mensaje por WhatsApp" },
  "Adicionar tag": { es: "Agregar etiqueta" },
  "Atribuir a um atendente": { es: "Asignar a un agente" },
  "Avisar outro sistema (webhook)": { es: "Avisar a otro sistema (webhook)" },
  "Esse lead entrou sem contato vinculado, então não havia para quem escrever.": {
    es: "Ese lead entró sin contacto vinculado, así que no había a quién escribirle.",
  },
  "O contato pediu para não receber mensagens (opt-out).": {
    es: "El contacto pidió no recibir mensajes (opt-out).",
  },
  "O contato não tem telefone cadastrado.": { es: "El contacto no tiene teléfono registrado." },
  "Falta preencher alguma configuração desta ação — abra a automação e revise.": {
    es: "Falta completar alguna configuración de esta acción — abre la automatización y revísala.",
  },
  "Está fora da janela de envio configurada para esse número. A mensagem sai sozinha quando ela reabrir.": {
    es: "Está fuera de la ventana de envío configurada para ese número. El mensaje sale solo cuando la ventana reabra.",
  },
  "A mensagem está na fila e sai assim que o canal aceitar.": {
    es: "El mensaje está en la cola y sale en cuanto el canal lo acepte.",
  },
  "O agente escolhido não tem versão publicada. Publique-o em Agentes de IA para a automação poder usá-lo.": {
    es: "El agente elegido no tiene versión publicada. Publícalo en Agentes de IA para que la automatización pueda usarlo.",
  },
  "A IA não está configurada nesta instalação — cadastre uma chave em Provedores de IA.": {
    es: "La IA no está configurada en esta instalación — registra una clave en Proveedores de IA.",
  },
  "A IA não devolveu texto. Revise o contexto que você escreveu para ela.": {
    es: "La IA no devolvió texto. Revisa el contexto que le escribiste.",
  },
  "Título do lead": { es: "Título del lead" },
  "Nome do lead": { es: "Nombre del lead" },
  "Tags do lead": { es: "Etiquetas del lead" },
  "Origem (utm_source)": { es: "Origen (utm_source)" },
  "Etapa de destino": { es: "Etapa de destino" },
  "Texto da mensagem": { es: "Texto del mensaje" },
  "Tags do contato": { es: "Etiquetas del contacto" },
  "Tag adicionada": { es: "Etiqueta agregada" },
  "Quando entrar um contato novo (webhook)": { es: "Cuando entre un contacto nuevo (webhook)" },
  "Quando um lead mudar de etapa": { es: "Cuando un lead cambie de etapa" },
  "Quando chegar mensagem no WhatsApp": { es: "Cuando llegue un mensaje por WhatsApp" },
  "Quando um lead ganhar uma tag": { es: "Cuando un lead reciba una etiqueta" },
  "Quando um contato ganhar uma tag": { es: "Cuando un contacto reciba una etiqueta" },
  "alterado pelo assistente": { es: "cambiado por el asistente" },
  "alterado automaticamente pelo sistema": { es: "cambiado automáticamente por el sistema" },
  é: { es: "es" },
  "Revise os campos da automação.": { es: "Revisa los campos de la automatización." },
  "Não funcionou. Confira se a fonte está ativa e se o funil/estágio ainda existem.": {
    es: "No funcionó. Revisa si la fuente está activa y si el embudo/etapa todavía existen.",
  },
  // ─── Conexões / Integrações ───
  "Por onde seu negócio fala com o cliente. Conecte números por QR ou o número oficial da Meta, e acompanhe a saúde de cada um.": {
    es: "Por dónde tu negocio habla con el cliente. Conecta números por QR o el número oficial de Meta, y sigue la salud de cada uno.",
  },
  "Redirecionando…": { es: "Redirigiendo…" },
  "Conectar com Nuvemshop": { es: "Conectar con Nuvemshop" },
  "Nuvemshop desconectada.": { es: "Nuvemshop desconectada." },
  "Desconectando…": { es: "Desconectando…" },
  "Nuvemshop conectada com sucesso.": { es: "Nuvemshop conectada con éxito." },
  "Sincroniza pedidos, produtos e clientes via OAuth + webhooks.": {
    es: "Sincroniza pedidos, productos y clientes vía OAuth + webhooks.",
  },
  "Integração não configurada": { es: "Integración no configurada" },
  Configure: { es: "Configura" },
  e: { es: "y" },
  "para ativar a integração.": { es: "para activar la integración." },
  "Obtenha as credenciais em": { es: "Obtén las credenciales en" },
  "Conectar Nuvemshop": { es: "Conectar Nuvemshop" },
  "Você será redirecionado para autorizar o app na sua loja.": {
    es: "Serás redirigido para autorizar la app en tu tienda.",
  },
  "Somente administradores podem conectar integrações.": {
    es: "Solo los administradores pueden conectar integraciones.",
  },
  Loja: { es: "Tienda" },
  "última sync:": { es: "última sync:" },
  "Escopos:": { es: "Alcances:" },
  "Webhooks registrados:": { es: "Webhooks registrados:" },
  "Proteção de envio atualizada.": { es: "Protección de envío actualizada." },
  "Não foi possível salvar.": { es: "No se pudo guardar." },
  "Proteção de envio —": { es: "Protección de envío —" },
  "Estes limites protegem o número contra bloqueio do WhatsApp. Campo vazio usa o padrão seguro do sistema (mostrado no campo).": {
    es: "Estos límites protegen el número contra el bloqueo de WhatsApp. Campo vacío usa el valor seguro predeterminado del sistema (que se muestra en el campo).",
  },
  "Este número é usado desde": { es: "Este número se usa desde" },
  "A conexão pode ser nova sem que o número seja. O aquecimento conta a idade do NÚMERO — se você deixar em branco, ele é tratado como recém-criado e começa liberando pouco por dia.": {
    es: "La conexión puede ser nueva sin que el número lo sea. El calentamiento cuenta la antigüedad del NÚMERO — si lo dejas en blanco, se trata como recién creado y empieza liberando poco por día.",
  },
  "Este número já está aquecido — pular o aquecimento": {
    es: "Este número ya está calentado — saltar el calentamiento",
  },
  "Vale só o teto diário abaixo. Use apenas se o número já envia há semanas: pular o aquecimento num número novo é o caminho mais rápido para o bloqueio.": {
    es: "Vale solo el tope diario de abajo. Úsalo solo si el número ya envía hace semanas: saltar el calentamiento en un número nuevo es el camino más rápido al bloqueo.",
  },
  "Número com": { es: "Número con" },
  "dia(s) de uso — já formado. Vale só o teto diário abaixo.": {
    es: "día(s) de uso — ya formado. Vale solo el tope diario de abajo.",
  },
  "Hoje o aquecimento libera": { es: "Hoy el calentamiento libera" },
  "envio(s) — o número tem": { es: "envío(s) — el número tiene" },
  "dia(s) de uso. Enquanto esse número for menor que o teto diário, é ELE que limita, e mexer no teto diário não muda nada.": {
    es: "día(s) de uso. Mientras ese número sea menor que el tope diario, es ÉL quien limita, y cambiar el tope diario no cambia nada.",
  },
  "Janela de envio (horário local)": { es: "Ventana de envío (horario local)" },
  "Hora de início da janela": { es: "Hora de inicio de la ventana" },
  "h até": { es: "h hasta" },
  "Hora de fim da janela": { es: "Hora de fin de la ventana" },
  "O assistente só envia mensagens dentro desta janela. Fora dela, a resposta fica agendada para a próxima abertura — você vê o motivo na conversa.": {
    es: "El asistente solo envía mensajes dentro de esta ventana. Fuera de ella, la respuesta queda programada para la próxima apertura — ves el motivo en la conversación.",
  },
  "Enviar aos domingos": { es: "Enviar los domingos" },
  "Ligado por padrão: quem escreve no domingo espera resposta no domingo. Desligue se você faz prospecção ativa e prefere não incomodar no fim de semana.": {
    es: "Activado por defecto: quien escribe un domingo espera respuesta el domingo. Desactívalo si haces prospección activa y prefieres no molestar el fin de semana.",
  },
  "Ritmo entre envios (segundos)": { es: "Ritmo entre envíos (segundos)" },
  "Intervalo mínimo entre envios em segundos": {
    es: "Intervalo mínimo entre envíos en segundos",
  },
  "+ variação de até": { es: "+ variación de hasta" },
  "Variação aleatória máxima em segundos": { es: "Variación aleatoria máxima en segundos" },
  "Intervalo mínimo entre mensagens do mesmo número, mais uma variação aleatória — ritmo cravado parece robô para o WhatsApp.": {
    es: "Intervalo mínimo entre mensajes del mismo número, más una variación aleatoria — un ritmo fijo parece un robot para WhatsApp.",
  },
  "Teto diário de envios": { es: "Tope diario de envíos" },
  "sem teto definido": { es: "sin tope definido" },
  "Teto diário de mensagens": { es: "Tope diario de mensajes" },
  "Máximo de mensagens que este número envia por dia. Números novos também respeitam o aquecimento automático abaixo, o que for menor.": {
    es: "Máximo de mensajes que este número envía por día. Los números nuevos también respetan el calentamiento automático de abajo, lo que sea menor.",
  },
  "Fuso horário IANA": { es: "Zona horaria IANA" },
  "Usar o padrão": { es: "Usar el predeterminado" },
  "A janela de envio é avaliada neste fuso (ex.: America/Sao_Paulo).": {
    es: "La ventana de envío se evalúa en esta zona horaria (ej.: America/Sao_Paulo).",
  },
  "Aquecimento automático de número novo": { es: "Calentamiento automático de número nuevo" },
  "a partir de": { es: "a partir de" },
  "dias: sem limite de aquecimento": { es: "días: sin límite de calentamiento" },
  "dias: até": { es: "días: hasta" },
  dia: { es: "día" },
  "Número recém-conectado envia pouco e sobe aos poucos — enviar demais no início é a causa nº 1 de bloqueio.": {
    es: "Un número recién conectado envía poco y sube de a poco — enviar demasiado al principio es la causa nº 1 de bloqueo.",
  },
  "Salvar proteção": { es: "Guardar protección" },
  "não configurado nesta instalação — defina no servidor antes de continuar": {
    es: "no configurado en esta instalación — defínelo en el servidor antes de continuar",
  },
  "Copiado.": { es: "Copiado." },
  Copiar: { es: "Copiar" },
  "Conectado:": { es: "Conectado:" },
  "credencial guardada": { es: "credencial guardada" },
  "sem credencial": { es: "sin credencial" },
  número: { es: "número" },
  "Cole isto no painel da Meta": { es: "Pega esto en el panel de Meta" },
  ", na seção de Webhook. Sem esse passo o canal envia, mas": {
    es: ", en la sección de Webhook. Sin este paso el canal envía, pero",
  },
  "não recebe": { es: "no recibe" },
  " — as respostas do cliente não chegam e a janela de 24 horas nunca abre.": {
    es: " — las respuestas del cliente no llegan y la ventana de 24 horas nunca se abre.",
  },
  "URL de callback": { es: "URL de callback" },
  "Token de verificação": { es: "Token de verificación" },
  "Campos a assinar": { es: "Campos a suscribir" },
  "Trocar credencial": { es: "Cambiar credencial" },
  "Conectar canal oficial": { es: "Conectar canal oficial" },
  "Os três valores vêm do seu app na Meta (": { es: "Los tres valores vienen de tu app en Meta (" },
  "Configuração da API": { es: "Configuración de la API" },
  "). A credencial é": { es: "). La credencial es" },
  "validada com a Meta antes de ser gravada": { es: "validada con Meta antes de guardarse" },
  " — se o número não responder, nada é salvo.": {
    es: " — si el número no responde, nada se guarda.",
  },
  "ID do número de telefone": { es: "ID del número de teléfono" },
  "ID da conta do WhatsApp Business": { es: "ID de la cuenta de WhatsApp Business" },
  "Token de acesso": { es: "Token de acceso" },
  "•••• (já guardado — preencha para trocar)": {
    es: "•••• (ya guardado — completa para cambiarlo)",
  },
  "Guardado cifrado. Não é exibido de volta em nenhum momento.": {
    es: "Guardado cifrado. No se muestra de vuelta en ningún momento.",
  },
  "Validando com a Meta…": { es: "Validando con Meta…" },
  "Validar e conectar": { es: "Validar y conectar" },
  "Canal conectado.": { es: "Canal conectado." },
  "Não foi possível conectar.": { es: "No se pudo conectar." },
  "provedor parceiro": { es: "proveedor asociado" },
  "Conectar por": { es: "Conectar por" },
  "Um número oficial (WhatsApp Business) conectado através do seu provedor. As mensagens entram e saem pelo CRM, e os modelos aprovados são os mesmos da sua conta.": {
    es: "Un número oficial (WhatsApp Business) conectado a través de tu proveedor. Los mensajes entran y salen por el CRM, y las plantillas aprobadas son las mismas de tu cuenta.",
  },
  "sem número informado": { es: "sin número informado" },
  Conta: { es: "Cuenta" },
  "id da conta conectada no provedor": { es: "id de la cuenta conectada en el proveedor" },
  "É o identificador do número no painel do provedor — não o da Meta.": {
    es: "Es el identificador del número en el panel del proveedor — no el de Meta.",
  },
  "Chave de API": { es: "Clave de API" },
  "gravada — preencha para trocar": { es: "guardada — completa para cambiarla" },
  "cole a chave": { es: "pega la clave" },
  "Guardada cifrada. Depois de gravar ela não é mostrada de novo — para trocar, cole a nova.": {
    es: "Guardada cifrada. Después de guardarla no se muestra de nuevo — para cambiarla, pega la nueva.",
  },
  "Verificando…": { es: "Verificando…" },
  "A credencial é testada contra o provedor antes de ser gravada.": {
    es: "La credencial se prueba contra el proveedor antes de guardarse.",
  },
  "Falta ligar a volta": { es: "Falta conectar la vuelta" },
  "Cole os dois valores abaixo no webhook do seu provedor. Sem isso o CRM": {
    es: "Pega los dos valores de abajo en el webhook de tu proveedor. Sin esto el CRM",
  },
  "envia mas não recebe": { es: "envía pero no recibe" },
  ": a resposta do cliente não chega, e nada na tela avisa. O segredo aparece": {
    es: ": la respuesta del cliente no llega, y nada en la pantalla avisa. El secreto aparece",
  },
  "uma única vez": { es: "una única vez" },
  " — se sair desta tela sem copiá-lo, reconecte para gerar outro.": {
    es: " — si sales de esta pantalla sin copiarlo, reconecta para generar otro.",
  },
  "URL do webhook": { es: "URL del webhook" },
  "Segredo (assinatura)": { es: "Secreto (firma)" },
  "Qualidade do número segundo a plataforma:": { es: "Calidad del número según la plataforma:" },
  "O endereço que o provedor usa para entregar as mensagens. O segredo não é mostrado de novo — para obter um novo, reconecte.": {
    es: "La dirección que el proveedor usa para entregar los mensajes. El secreto no se muestra de nuevo — para obtener uno nuevo, reconecta.",
  },
  "Conectar novo WhatsApp": { es: "Conectar nuevo WhatsApp" },
  "WhatsApp conectado!": { es: "¡WhatsApp conectado!" },
  "Não foi possível carregar seus números.": { es: "No se pudieron cargar tus números." },
  "Nenhum número conectado ainda.": { es: "Ningún número conectado todavía." },
  "número conectado": { es: "número conectado" },
  "números conectados": { es: "números conectados" },
  "Atualizar saúde": { es: "Actualizar salud" },
  "O serviço do WhatsApp não está configurado.": {
    es: "El servicio de WhatsApp no está configurado.",
  },
  "Faltam o endereço e a chave do serviço (": { es: "Faltan la dirección y la clave del servicio (" },
  ") nas variáveis de ambiente desta instalação. Enquanto isso, não dá para conectar, reconectar nem excluir os números pareados por QR — excluir um número também o desconecta do aparelho, e sem o serviço isso não acontece.": {
    es: ") en las variables de entorno de esta instalación. Mientras tanto, no se puede conectar, reconectar ni eliminar los números emparejados por QR — eliminar un número también lo desconecta del dispositivo, y sin el servicio eso no ocurre.",
  },
  "Se você roda tudo na mesma máquina, o container sobe com": {
    es: "Si corres todo en la misma máquina, el contenedor se levanta con",
  },
  ". Já apareceu aqui o caso oposto: o container no ar e o endereço configurado apontando para um lugar que não existe — subir o container de novo não conserta isso.": {
    es: ". Ya se dio aquí el caso opuesto: el contenedor arriba y la dirección configurada apuntando a un lugar que no existe — levantar el contenedor de nuevo no arregla esto.",
  },
  "Esta instalação está com o banco atrasado.": {
    es: "Esta instalación tiene la base de datos atrasada.",
  },
  "Falta aplicar a migration que registra canal excluído. Até lá, um número que você excluir continua aparecendo nesta lista.": {
    es: "Falta aplicar la migration que registra el canal eliminado. Hasta entonces, un número que elimines sigue apareciendo en esta lista.",
  },
  "Carregando conexões…": { es: "Cargando conexiones…" },
  "Não foi possível carregar seus números — esta lista não está mostrando o que existe.": {
    es: "No se pudieron cargar tus números — esta lista no está mostrando lo que existe.",
  },
  "Não conecte um número novo por causa disto: recarregue a página. Se persistir, o servidor do sistema está fora do ar.": {
    es: "No conectes un número nuevo por esto: recarga la página. Si persiste, el servidor del sistema está caído.",
  },
  "Conecte seu primeiro número de WhatsApp para começar a atender.": {
    es: "Conecta tu primer número de WhatsApp para empezar a atender.",
  },
  Verificado: { es: "Verificado" },
  "Ainda não verificado": { es: "Todavía no verificado" },
  "Proteção de envio": { es: "Protección de envío" },
  "indisponível enquanto o serviço do WhatsApp não estiver ativo": {
    es: "no disponible mientras el servicio de WhatsApp no esté activo",
  },
  "Este número não tem conversa, mensagem nem configuração ligada a ele.": {
    es: "Este número no tiene conversación, mensaje ni configuración ligada a él.",
  },
  "Continua no inbox:": { es: "Sigue en el inbox:" },
  "Fica salvo, mas sem número — para de atender:": {
    es: "Queda guardado, pero sin número — deja de atender:",
  },
  "Este canal tem registros internos, por isso ele é arquivado em vez de apagado.": {
    es: "Este canal tiene registros internos, por eso se archiva en vez de borrarse.",
  },
  "Canal excluído.": { es: "Canal eliminado." },
  "Canal removido.": { es: "Canal eliminado." },
  "no inbox.": { es: "en el inbox." },
  "Canal removido. O que estava ligado a ele continua guardado.": {
    es: "Canal eliminado. Lo que estaba ligado a él sigue guardado.",
  },
  "O número será desconectado do WhatsApp e sai desta lista.": {
    es: "El número se desconectará de WhatsApp y sale de esta lista.",
  },
  "Verificando o que está ligado a este número…": {
    es: "Verificando qué está ligado a este número…",
  },
  "Não foi possível verificar o que está ligado a este número. A exclusão continua possível — quem decide apagar ou arquivar é o servidor, e ele preserva o histórico quando existe.": {
    es: "No se pudo verificar qué está ligado a este número. La eliminación sigue siendo posible — quien decide borrar o archivar es el servidor, y preserva el historial cuando existe.",
  },
  "Para usar este número de novo, será preciso conectá-lo outra vez.": {
    es: "Para usar este número de nuevo, habrá que conectarlo otra vez.",
  },
  "No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → escaneie o código.": {
    es: "En el celular: WhatsApp → Dispositivos vinculados → Vincular un dispositivo → escanea el código.",
  },
  "QR Code para conectar WhatsApp": { es: "Código QR para conectar WhatsApp" },
  "Conectado!": { es: "¡Conectado!" },
  "Este número foi desvinculado do WhatsApp. Para usá-lo de novo é preciso parear outra vez.": {
    es: "Este número fue desvinculado de WhatsApp. Para usarlo de nuevo hay que emparejarlo otra vez.",
  },
  "Gerar novo QR": { es: "Generar nuevo QR" },
  "Preparando o código…": { es: "Preparando el código…" },
  "Como o cliente vai ver": { es: "Cómo lo va a ver el cliente" },
  "Preencha o texto para ver a prévia.": { es: "Completa el texto para ver la vista previa." },
  Cabeçalho: { es: "Encabezado" },
  Falta: { es: "Falta" },
  "no texto.": { es: "en el texto." },
  "A numeração é sequencial e a plataforma recusa quando há buraco.": {
    es: "La numeración es secuencial y la plataforma rechaza cuando hay un hueco.",
  },
  "Sincronizado:": { es: "Sincronizado:" },
  "novo(s),": { es: "nuevo(s)," },
  "atualizado(s),": { es: "actualizado(s)," },
  "desativado(s).": { es: "desactivado(s)." },
  "Canal oficial não conectado": { es: "Canal oficial no conectado" },
  "Os templates vivem na sua conta do WhatsApp Business (Meta) — esta tela é um espelho deles. Conecte o canal oficial em": {
    es: "Las plantillas viven en tu cuenta de WhatsApp Business (Meta) — esta pantalla es un espejo de ellas. Conecta el canal oficial en",
  },
  "Conexões WhatsApp": { es: "Conexiones WhatsApp" },
  "para começar a sincronizar.": { es: "para empezar a sincronizar." },
  "Espelho da conta": { es: "Espejo de la cuenta" },
  "template(s)": { es: "plantilla(s)" },
  "Sincronizando…": { es: "Sincronizando…" },
  "Sincronizar com a Meta": { es: "Sincronizar con Meta" },
  "Nenhum template ainda": { es: "Ninguna plantilla todavía" },
  "Crie templates no Gerenciador do WhatsApp e clique em": {
    es: "Crea plantillas en el Administrador de WhatsApp y haz clic en",
  },
  "Só templates aprovados podem ser enviados fora da janela de 24 horas.": {
    es: "Solo las plantillas aprobadas se pueden enviar fuera de la ventana de 24 horas.",
  },
  "sem parâmetros": { es: "sin parámetros" },
  "parâmetro(s)": { es: "parámetro(s)" },
  "Recusado:": { es: "Rechazado:" },
  "arquivo de": { es: "archivo de" },
  "enviado no disparo": { es: "enviado en el disparo" },
  "sincronizada(s).": { es: "sincronizada(s)." },
  "Não consegui falar com a plataforma.": { es: "No pude comunicarme con la plataforma." },
  "O que a plataforma aprovou para este número. É daqui que sai a mensagem quando a janela de 24h fecha.": {
    es: "Lo que la plataforma aprobó para este número. De aquí sale el mensaje cuando la ventana de 24h se cierra.",
  },
  "Nome do modelo": { es: "Nombre de la plantilla" },
  Idioma: { es: "Idioma" },
  Categoria: { es: "Categoría" },
  "Utilidade — aviso de pedido, agendamento, cobrança": {
    es: "Utilidad — aviso de pedido, turno, cobro",
  },
  "Marketing — promoção, novidade, reengajamento": {
    es: "Marketing — promoción, novedad, reenganche",
  },
  "Autenticação — código de verificação": { es: "Autenticación — código de verificación" },
  "Cabeçalho de texto (opcional)": { es: "Encabezado de texto (opcional)" },
  "Cabeçalho de texto": { es: "Encabezado de texto" },
  "Subindo…": { es: "Subiendo…" },
  "Trocar imagem": { es: "Cambiar imagen" },
  "Subir imagem (JPG/PNG)": { es: "Subir imagen (JPG/PNG)" },
  "Imagem do cabeçalho": { es: "Imagen del encabezado" },
  "Texto da mensagem. Use {{1}}, {{2}} para os valores que mudam.": {
    es: "Texto del mensaje. Usa {{1}}, {{2}} para los valores que cambian.",
  },
  "Rodapé (opcional) — texto pequeno no fim da mensagem": {
    es: "Pie (opcional) — texto pequeño al final del mensaje",
  },
  Rodapé: { es: "Pie" },
  "Tipo do botão": { es: "Tipo de botón" },
  "Resposta rápida": { es: "Respuesta rápida" },
  "Abrir link": { es: "Abrir enlace" },
  "Texto do botão": { es: "Texto del botón" },
  "URL do botão": { es: "URL del botón" },
  "Telefone do botão": { es: "Teléfono del botón" },
  "Remover botão": { es: "Eliminar botón" },
  remover: { es: "eliminar" },
  "Adicionar botão": { es: "Agregar botón" },
  "A revisão exige um exemplo de cada valor. Sem eles o modelo é recusado.": {
    es: "La revisión exige un ejemplo de cada valor. Sin ellos la plantilla es rechazada.",
  },
  "ex.: María": { es: "ej.: María" },
  "Exemplo do valor": { es: "Ejemplo del valor" },
  "A plataforma revisa antes de aprovar — o modelo nasce pendente e some da lista de envio até ela decidir.": {
    es: "La plataforma revisa antes de aprobar — la plantilla nace pendiente y desaparece de la lista de envío hasta que ella decida.",
  },
  "Nenhum modelo espelhado ainda. Clique em": { es: "Ninguna plantilla espejada todavía. Haz clic en" },
  "para trazer os que já existem na plataforma.": {
    es: "para traer las que ya existen en la plataforma.",
  },
  "valor(es)": { es: "valor(es)" },
  mídia: { es: "media" },
  "Sem corpo espelhado — sincronize para trazer o conteúdo.": {
    es: "Sin cuerpo espejado — sincroniza para traer el contenido.",
  },
  "Sincronizado em": { es: "Sincronizado en" },
  // ─── Fusos horários oferecidos (compartilhado com Team/Attendants) ───
  "Assunção (Paraguai)": { es: "Asunción (Paraguay)" },
  "Buenos Aires (Argentina)": { es: "Buenos Aires (Argentina)" },
  "Montevidéu (Uruguai)": { es: "Montevideo (Uruguay)" },
  "Santiago (Chile)": { es: "Santiago (Chile)" },
  "La Paz (Bolívia)": { es: "La Paz (Bolivia)" },
  "Lima (Peru)": { es: "Lima (Perú)" },
  "Bogotá (Colômbia)": { es: "Bogotá (Colombia)" },
  "Cidade do México (México)": { es: "Ciudad de México (México)" },
  "São Paulo (Brasil)": { es: "São Paulo (Brasil)" },
  "Manaus (Brasil)": { es: "Manaus (Brasil)" },
  "Belém (Brasil)": { es: "Belém (Brasil)" },
  "Recife (Brasil)": { es: "Recife (Brasil)" },
  "Fortaleza (Brasil)": { es: "Fortaleza (Brasil)" },
  // ─── Idiomas de definição de template (canal parceiro) ───
  Espanhol: { es: "Español" },
  "Espanhol (Argentina)": { es: "Español (Argentina)" },
  "Espanhol (México)": { es: "Español (México)" },
  "Espanhol (Espanha)": { es: "Español (España)" },
  "Português (Brasil)": { es: "Portugués (Brasil)" },
  "Português (Portugal)": { es: "Portugués (Portugal)" },
  Inglês: { es: "Inglés" },
  "Inglês (EUA)": { es: "Inglés (EE. UU.)" },
  "Inglês (Reino Unido)": { es: "Inglés (Reino Unido)" },
  // ─── Configurações: API Tokens ───
  "Selecione ao menos um escopo.": { es: "Selecciona al menos un alcance." },
  "Criar token": { es: "Crear token" },
  "Nenhum token criado ainda.": { es: "Ningún token creado todavía." },
  Prefixo: { es: "Prefijo" },
  Escopos: { es: "Alcances" },
  Expira: { es: "Expira" },
  "Token revogado.": { es: "Token revocado." },
  Revogar: { es: "Revocar" },
  "Criar novo token": { es: "Crear nuevo token" },
  "O plaintext será mostrado apenas uma vez.": {
    es: "El plaintext se mostrará solo una vez.",
  },
  "Worker de import": { es: "Worker de import" },
  "Expira em (dias) — opcional": { es: "Expira en (días) — opcional" },
  Criar: { es: "Crear" },
  "Token criado": { es: "Token creado" },
  "Copie e guarde agora — não conseguiremos exibir novamente.": {
    es: "Cópialo y guárdalo ahora — no podremos mostrarlo de nuevo.",
  },
  "Token copiado.": { es: "Token copiado." },
  "Não foi possível copiar — selecione o token acima.": {
    es: "No se pudo copiar — selecciona el token de arriba.",
  },
  "Copiar para clipboard": { es: "Copiar al portapapeles" },
  "Tokens server-to-server. Plaintext exibido": {
    es: "Tokens server-to-server. El plaintext se muestra",
  },
  "na criação.": { es: "en la creación." },
  "Agentes de IA podem LER o CRM (MCP)": { es: "Los agentes de IA pueden LEER el CRM (MCP)" },
  "Agentes de IA podem AGIR no CRM (MCP)": {
    es: "Los agentes de IA pueden ACTUAR en el CRM (MCP)",
  },
  "Tratar o token como gerente (necessário p/ criar e atribuir)": {
    es: "Tratar el token como gerente (necesario para crear y asignar)",
  },
  "Ler contatos": { es: "Leer contactos" },
  "Criar e editar contatos": { es: "Crear y editar contactos" },
  "Ler leads": { es: "Leer leads" },
  "Criar e editar leads": { es: "Crear y editar leads" },
  "Ler mensagens": { es: "Leer mensajes" },
  "Enviar mensagens": { es: "Enviar mensajes" },
  "Ler o log de auditoria": { es: "Leer el registro de auditoría" },
  // ─── Configurações: Distribuição de atendimento ───
  "Distribuição de atendimento salva.": { es: "Distribución de atención guardada." },
  "Não consegui salvar.": { es: "No pude guardar." },
  "Quem recebe o cliente novo": { es: "Quién recibe al cliente nuevo" },
  "Vale para conversa que chega sem dono.": { es: "Vale para conversación que llega sin dueño." },
  "Tentativas antes de desistir": { es: "Intentos antes de desistir" },
  "Quando não há ninguém disponível, o sistema tenta de novo mais tarde. Ao estourar, a conversa fica na fila esperando alguém.": {
    es: "Cuando no hay nadie disponible, el sistema lo intenta de nuevo más tarde. Al agotarse, la conversación queda en la fila esperando a alguien.",
  },
  "Espera entre tentativas (segundos)": { es: "Espera entre intentos (segundos)" },
  "O que cada atendente enxerga": { es: "Qué ve cada agente" },
  "Restringe apenas quem tem o papel": { es: "Restringe solo a quien tiene el rol" },
  "Gerente e administrador continuam vendo a operação inteira.": {
    es: "Gerente y administrador siguen viendo toda la operación.",
  },
  Com: { es: "Con" },
  "só os seus": { es: "solo los tuyos" },
  "e distribuição manual, ninguém enxerga a fila para pegar — e nenhum cliente é atendido. Ligue o rodízio para que alguém receba.": {
    es: "y distribución manual, nadie ve la fila para tomar — y ningún cliente es atendido. Activa la rotación para que alguien reciba.",
  },
  "Há mudanças não salvas.": { es: "Hay cambios sin guardar." },
  "Cada um pega o que quiser": { es: "Cada uno toma el que quiera" },
  "Todo cliente novo cai numa fila aberta e o primeiro atendente que clicar assume. Simples, e é onde nasce a discussão de quem furou a fila.": {
    es: "Todo cliente nuevo cae en una fila abierta y el primer agente que hace clic lo toma. Simple, y es donde nace la discusión de quién se coló en la fila.",
  },
  "Rodízio automático entre os atendentes": { es: "Rotación automática entre los agentes" },
  "Cliente 1 vai para o atendente A, cliente 2 para o B, e ao acabar a lista volta ao primeiro. Quem recebe é sempre quem está há mais tempo sem receber — entre os que estão disponíveis e dentro do horário. Ninguém escolhe, então não há fila furada.": {
    es: "El cliente 1 va al agente A, el cliente 2 al B, y al terminar la lista vuelve al primero. Quien recibe siempre es quien lleva más tiempo sin recibir — entre los que están disponibles y dentro del horario. Nadie elige, así que no hay quien se cuele.",
  },
  "Todos veem tudo": { es: "Todos ven todo" },
  "Qualquer atendente abre a conversa e o negócio de qualquer colega.": {
    es: "Cualquier agente abre la conversación y el negocio de cualquier colega.",
  },
  "Os seus, mais os que ainda não têm dono": {
    es: "Los tuyos, más los que todavía no tienen dueño",
  },
  "O atendente vê a própria carteira e a fila de quem chegou agora. Não vê o que já é de um colega.": {
    es: "El agente ve su propia cartera y la fila de quien acaba de llegar. No ve lo que ya es de un colega.",
  },
  "Só os seus": { es: "Solo los tuyos" },
  "O atendente vê apenas o que foi direcionado a ele — nem a fila. Combine com o rodízio: sem alguém distribuindo, ninguém recebe nada e as telas ficam vazias.": {
    es: "El agente ve solo lo que le fue asignado — ni la fila. Combínalo con la rotación: sin alguien distribuyendo, nadie recibe nada y las pantallas quedan vacías.",
  },
  "Quem recebe cada cliente novo, e o que cada atendente enxerga. As duas decisões andam juntas: distribuir sem restringir deixa todo mundo vendo a carteira do colega; restringir sem distribuir deixa o funil de cada um vazio.": {
    es: "Quién recibe a cada cliente nuevo, y qué ve cada agente. Las dos decisiones van juntas: distribuir sin restringir deja a todos viendo la cartera del colega; restringir sin distribuir deja el embudo de cada uno vacío.",
  },
  // ─── Configurações: Atualização do sistema ───
  "Não consegui iniciar a atualização. Tente de novo em instantes.": {
    es: "No pude iniciar la actualización. Intenta de nuevo en instantes.",
  },
  "Atualizando para a versão": { es: "Actualizando a la versión" },
  "O sistema sai do ar por alguns instantes e volta sozinho. Pode deixar esta página aberta.": {
    es: "El sistema se apaga por unos instantes y vuelve solo. Puedes dejar esta página abierta.",
  },
  "A atualização para a versão": { es: "La actualización a la versión" },
  "não deu certo": { es: "no funcionó" },
  "Voltei o sistema para a versão": { es: "Volví el sistema a la versión" },
  "que é a que está no ar agora, e os seus dados estão intactos. O banco de dados já tinha sido atualizado e permanece assim — isso é seguro, a versão": {
    es: "que es la que está activa ahora, y tus datos están intactos. La base de datos ya había sido actualizada y sigue así — eso es seguro, la versión",
  },
  "funciona com ele. Se quiser desfazer também o banco, use a cópia de segurança feita antes da tentativa (": {
    es: "funciona con ella. Si quieres deshacer también la base de datos, usa la copia de seguridad hecha antes del intento (",
  },
  "Para deixar o servidor inteiro de volta na versão": {
    es: "Para dejar el servidor entero de vuelta en la versión",
  },
  "— inclusive o código, que já foi trocado —, quem tem acesso pode rodar:": {
    es: "— incluyendo el código, que ya fue cambiado —, quien tenga acceso puede ejecutar:",
  },
  "E eu": { es: "Y yo" },
  "não consegui": { es: "no pude" },
  "voltar sozinho para a versão": { es: "volver solo a la versión" },
  "o sistema pode estar rodando a versão": { es: "el sistema puede estar corriendo la versión" },
  "com defeito, ou fora do ar. Seus dados estão intactos e a cópia de segurança feita antes da tentativa continua guardada no servidor.": {
    es: "con defecto, o caído. Tus datos están intactos y la copia de seguridad hecha antes del intento sigue guardada en el servidor.",
  },
  "Para colocar o sistema de volta no ar na versão": {
    es: "Para poner el sistema de vuelta en marcha en la versión",
  },
  ", quem tem acesso ao servidor precisa rodar:": {
    es: ", quien tenga acceso al servidor necesita ejecutar:",
  },
  "Não sei dizer como terminou": { es: "No sé decir cómo terminó" },
  "Comecei a atualização para a versão": { es: "Empecé la actualización a la versión" },
  "mas perdi contato com o servidor antes do fim. Confira se o sistema está funcionando normalmente — se estiver, provavelmente deu certo.": {
    es: "pero perdí contacto con el servidor antes del final. Revisa si el sistema está funcionando normalmente — si es así, probablemente funcionó.",
  },
  "Para conferir pelo servidor, quem tem acesso pode rodar:": {
    es: "Para confirmarlo por el servidor, quien tenga acceso puede ejecutar:",
  },
  "Atualização automática indisponível": { es: "Actualización automática no disponible" },
  "Não estou conseguindo falar com o servidor onde o sistema está instalado, então não posso atualizar sozinho. Quem tem acesso ao servidor pode entrar na pasta onde o sistema foi instalado e rodar este comando — se for a primeira vez, rode duas vezes: a primeira baixa o programa novo e a segunda liga o botão desta tela.": {
    es: "No estoy pudiendo hablar con el servidor donde el sistema está instalado, así que no puedo actualizar solo. Quien tenga acceso al servidor puede entrar en la carpeta donde el sistema fue instalado y ejecutar este comando — si es la primera vez, ejecútalo dos veces: la primera baja el programa nuevo y la segunda activa el botón de esta pantalla.",
  },
  "Versão instalada:": { es: "Versión instalada:" },
  "Não consegui checar se há versão nova": { es: "No pude comprobar si hay una versión nueva" },
  "O servidor não conseguiu comparar a sua versão (": {
    es: "El servidor no pudo comparar tu versión (",
  },
  ") com a última publicada — normalmente é internet instável ou falta de espaço em disco na hora da checagem.": {
    es: ") con la última publicada — normalmente es internet inestable o falta de espacio en disco al momento de la comprobación.",
  },
  "Não quer dizer que esteja desatualizado, nem que esteja em dia": {
    es: "No quiere decir que esté desactualizado, ni que esté al día",
  },
  "quer dizer que eu não sei.": { es: "quiere decir que yo no sé." },
  "Vou tentar de novo sozinho a cada poucos minutos. Se continuar assim, quem tem acesso ao servidor pode conferir na hora com:": {
    es: "Voy a intentarlo de nuevo solo cada pocos minutos. Si sigue así, quien tenga acceso al servidor puede confirmarlo al instante con:",
  },
  "Você está na versão": { es: "Estás en la versión" },
  "É a mais recente. Não há nada a fazer.": { es: "Es la más reciente. No hay nada que hacer." },
  "Ainda não há nenhuma versão publicada": { es: "Todavía no hay ninguna versión publicada" },
  "Este projeto ainda não tem nenhuma versão publicada para comparar com a sua instalação — normal em um fork novo ou recém-criado a partir do código-fonte.": {
    es: "Este proyecto todavía no tiene ninguna versión publicada para comparar con tu instalación — normal en un fork nuevo o recién creado a partir del código fuente.",
  },
  "Não há nada a atualizar agora": { es: "No hay nada que actualizar ahora" },
  "e isso não é um problema.": { es: "y eso no es un problema." },
  "Quando sair a primeira versão publicada, ela aparece aqui sozinha. Quem tem acesso ao servidor pode conferir a qualquer momento com o comando abaixo — ele não muda nada sem avisar:": {
    es: "Cuando salga la primera versión publicada, aparece aquí sola. Quien tenga acceso al servidor puede confirmarlo en cualquier momento con el comando de abajo — no cambia nada sin avisar:",
  },
  "Você está à frente da versão publicada": { es: "Estás por delante de la versión publicada" },
  "Seu sistema roda uma versão mais nova do que a última publicada, então": {
    es: "Tu sistema corre una versión más nueva que la última publicada, entonces",
  },
  "não há nada a atualizar": { es: "no hay nada que actualizar" },
  "É assim mesmo quando a instalação acompanha o desenvolvimento, e nada aqui está errado por causa disso — a marca da sua versão é": {
    es: "Es así cuando la instalación acompaña el desarrollo, y nada aquí está mal por eso — la marca de tu versión es",
  },
  "Quando sair uma versão publicada mais nova que a sua, ela aparece aqui sozinha. Quem tem acesso ao servidor pode conferir a qualquer momento com o comando abaixo — ele não muda nada sem avisar:": {
    es: "Cuando salga una versión publicada más nueva que la tuya, aparece aquí sola. Quien tenga acceso al servidor puede confirmarlo en cualquier momento con el comando de abajo — no cambia nada sin avisar:",
  },
  "Sua instalação está numa versão de desenvolvimento. Atualizar vai levá-la para a versão publicada": {
    es: "Tu instalación está en una versión de desarrollo. Actualizar la llevará a la versión publicada",
  },
  "Requer atenção": { es: "Requiere atención" },
  "O que muda": { es: "Qué cambia" },
  "Iniciando…": { es: "Iniciando…" },
  "Atualizar agora": { es: "Actualizar ahora" },
  "O sistema sai do ar por cerca de 2 minutos e volta sozinho. Faço uma cópia de segurança dos seus dados antes.": {
    es: "El sistema se apaga por cerca de 2 minutos y vuelve solo. Hago una copia de seguridad de tus datos antes.",
  },
  "Detalhes técnicos (útil se for pedir ajuda)": {
    es: "Detalles técnicos (útil si vas a pedir ayuda)",
  },
  "Atualização do sistema": { es: "Actualización del sistema" },
  "Reiniciando…": { es: "Reiniciando…" },
  "O sistema está voltando. Esta página se atualiza sozinha em alguns instantes.": {
    es: "El sistema está volviendo. Esta página se actualiza sola en unos instantes.",
  },
  Copiado: { es: "Copiado" },
  // ─── Configurações: Billing ───
  "Planos, faturas e cobrança.": { es: "Planes, facturas y cobros." },
  "Em breve — Fase 2": { es: "Próximamente — Fase 2" },
  "Billing entra na Fase 2 do roadmap.": { es: "Billing entra en la Fase 2 del roadmap." },
  "Para questões de pagamento, contate": { es: "Para temas de pago, contacta a" },
  "Para questões de pagamento, fale com quem administra este sistema.": {
    es: "Para temas de pago, habla con quien administra este sistema.",
  },
  // ─── Configurações: Marca da organização ───
  "você definiu aqui": { es: "tú lo definiste aquí" },
  "é o padrão do sistema": { es: "es el predeterminado del sistema" },
  "veio de quem instalou o sistema": { es: "vino de quien instaló el sistema" },
  "Como sua empresa aparece": { es: "Cómo aparece tu empresa" },
  "Nome da sua empresa": { es: "Nombre de tu empresa" },
  "Aparece no menu lateral, para quem trabalha aqui. Deixe em branco para usar": {
    es: "Aparece en el menú lateral, para quien trabaja aquí. Déjalo en blanco para usar",
  },
  "Cor da sua marca": { es: "Color de tu marca" },
  "Deixe em branco para voltar à cor que o sistema já usa.": {
    es: "Déjalo en blanco para volver al color que el sistema ya usa.",
  },
  "Considerando o que está nos campos acima.": {
    es: "Considerando lo que está en los campos de arriba.",
  },
  "Do jeito que está, esta cor não chegaria à tela: o sistema continuaria com a cor que já usa.": {
    es: "Tal como está, este color no llegaría a la pantalla: el sistema seguiría con el color que ya usa.",
  },
  "O que isto ainda não muda": { es: "Lo que esto todavía no cambia" },
  "O título da aba do navegador continua com o nome do sistema, e não com o da sua empresa.": {
    es: "El título de la pestaña del navegador sigue con el nombre del sistema, y no con el de tu empresa.",
  },
  "A tela de entrada é sempre a do sistema: quando alguém digita a senha, ainda não dá para saber de qual empresa ele é.": {
    es: "La pantalla de entrada siempre es la del sistema: cuando alguien escribe la contraseña, todavía no se puede saber de qué empresa es.",
  },
  "Os e-mails que este sistema envia (convite de time, pedidos de LGPD) já saem com o nome da sua empresa.": {
    es: "Los correos que este sistema envía (invitación de equipo, solicitudes de LGPD) ya salen con el nombre de tu empresa.",
  },
  "O aplicativo de verificação em duas etapas continua registrando o nome do sistema: o cadastro acontece antes de saber de qual empresa a pessoa é.": {
    es: "La app de verificación en dos pasos sigue registrando el nombre del sistema: el registro ocurre antes de saber de qué empresa es la persona.",
  },
  "O logo que você subir aqui aparece no menu lateral, para quem trabalha nesta empresa. A tela de entrada continua com o logo de quem instalou o sistema: ali ainda não dá para saber de qual empresa a pessoa é.": {
    es: "El logo que subas aquí aparece en el menú lateral, para quien trabaja en esta empresa. La pantalla de entrada sigue con el logo de quien instaló el sistema: ahí todavía no se puede saber de qué empresa es la persona.",
  },
  "O nome e a cor que a sua empresa mostra para quem trabalha aqui dentro.": {
    es: "El nombre y el color que tu empresa muestra para quien trabaja aquí dentro.",
  },
  // ─── Configurações: Notificações ───
  "Canais e categorias.": { es: "Canales y categorías." },
  "Preferências de notificação em breve. Por enquanto, alertas críticos são enviados por email.": {
    es: "Preferencias de notificación próximamente. Por ahora, las alertas críticas se envían por correo.",
  },
  "Lead atribuído a você": { es: "Lead asignado a ti" },
  "Lead ganho": { es: "Lead ganado" },
  "Lead perdido": { es: "Lead perdido" },
  "Você foi mencionado": { es: "Te mencionaron" },
  Email: { es: "Correo" },
  "In-app": { es: "En la app" },
  Push: { es: "Push" },
  // ─── Configurações: Segurança ───
  "Gerar novos códigos invalida TODOS os atuais. Tem certeza?": {
    es: "Generar nuevos códigos invalida TODOS los actuales. ¿Estás seguro?",
  },
  "Novos códigos gerados.": { es: "Nuevos códigos generados." },
  "Erro:": { es: "Error:" },
  "Sair de TODOS os dispositivos? Você precisará fazer login de novo.": {
    es: "¿Salir de TODOS los dispositivos? Vas a tener que iniciar sesión de nuevo.",
  },
  "Verificação em duas etapas": { es: "Verificación en dos pasos" },
  "Além da senha, o sistema pede um código de 6 dígitos que só existe no seu celular. É a proteção que segura uma senha vazada.": {
    es: "Además de la contraseña, el sistema pide un código de 6 dígitos que solo existe en tu celular. Es la protección que frena una contraseña filtrada.",
  },
  Ativada: { es: "Activada" },
  Desativada: { es: "Desactivada" },
  "Ela é obrigatória para administradores desta empresa, então não dá para desligar aqui. Um administrador pode mudar essa regra abaixo.": {
    es: "Es obligatoria para los administradores de esta empresa, así que no se puede desactivar aquí. Un administrador puede cambiar esta regla abajo.",
  },
  "Desligar a verificação em duas etapas desta conta?": {
    es: "¿Desactivar la verificación en dos pasos de esta cuenta?",
  },
  "Verificação desligada.": { es: "Verificación desactivada." },
  "Desligando…": { es: "Desactivando…" },
  Ativar: { es: "Activar" },
  "Exigir de quem administra": { es: "Exigir a quien administra" },
  "Agora os administradores precisam da verificação.": {
    es: "Ahora los administradores necesitan la verificación.",
  },
  "A verificação deixou de ser obrigatória.": { es: "La verificación dejó de ser obligatoria." },
  "Todo administrador desta empresa precisa configurar a verificação em duas etapas.": {
    es: "Todo administrador de esta empresa necesita configurar la verificación en dos pasos.",
  },
  "Quando ligado, quem administra vê uma tela pedindo a configuração antes de usar o sistema. Ligue se a sua equipe mexe com dados de clientes — é a diferença entre uma senha vazada virar um susto ou virar um vazamento.": {
    es: "Cuando está activado, quien administra ve una pantalla pidiendo la configuración antes de usar el sistema. Actívalo si tu equipo maneja datos de clientes — es la diferencia entre que una contraseña filtrada sea un susto o una filtración.",
  },
  "Códigos de recuperação": { es: "Códigos de recuperación" },
  "Use se perder acesso ao autenticador. Cada código é de uso único.": {
    es: "Úsalos si pierdes acceso al autenticador. Cada código es de un solo uso.",
  },
  "Gerando…": { es: "Generando…" },
  "Regenerar códigos de recuperação": { es: "Regenerar códigos de recuperación" },
  "Habilite MFA antes de gerar códigos.": { es: "Habilita MFA antes de generar códigos." },
  "Sessões ativas": { es: "Sesiones activas" },
  "Listagem de sessões — em breve. Por enquanto, deslogue todos os dispositivos:": {
    es: "Listado de sesiones — próximamente. Por ahora, cierra sesión en todos los dispositivos:",
  },
  "Saindo…": { es: "Saliendo…" },
  "Sair de todos os dispositivos": { es: "Salir de todos los dispositivos" },
  "A verificação em duas etapas da sua conta, os códigos de recuperação e as sessões abertas.": {
    es: "La verificación en dos pasos de tu cuenta, los códigos de recuperación y las sesiones abiertas.",
  },
  // ─── Configurações: Funis (etapas + mapeamento do assistente) ───
  "Você ainda não tem nenhum funil. Enquanto for assim, o agente atende normalmente, mas não tem para onde levar o card de ninguém — não há etapas para onde mover. Criar o funil é feito por quem instalou o sistema, direto no banco; depois ele aparece aqui para você escolher a etapa de cada passo.": {
    es: "Todavía no tienes ningún embudo. Mientras sea así, el agente atiende normalmente, pero no tiene adónde llevar la tarjeta de nadie — no hay etapas adonde mover. Crear el embudo lo hace quien instaló el sistema, directo en la base de datos; después aparece aquí para que elijas la etapa de cada paso.",
  },
  "Custom fields: JSON inválido. Esperado um array.": {
    es: "Custom fields: JSON inválido. Se esperaba un array.",
  },
  "atualizado.": { es: "actualizado." },
  "Vocabulário e campos": { es: "Vocabulario y campos" },
  "Motivos de perda (separados por vírgula)": { es: "Motivos de pérdida (separados por coma)" },
  "Ex:": { es: "Ej:" },
  "Salvar vocabulário e campos": { es: "Guardar vocabulario y campos" },
  "As etapas que serviriam para este passo já estão sendo usadas por outros passos. Libere uma delas para poder escolhê-la aqui.": {
    es: "Las etapas que servirían para este paso ya están siendo usadas por otros pasos. Libera una de ellas para poder elegirla aquí.",
  },
  "Este funil não tem nenhuma etapa marcada como fechamento, então não há para onde levar o card quando a pessoa fecha. Marque uma etapa como «aqui o cliente fecha» em «Etapas deste funil».": {
    es: "Este embudo no tiene ninguna etapa marcada como cierre, así que no hay adónde llevar la tarjeta cuando la persona cierra. Marca una etapa como «aquí el cliente cierra» en «Etapas de este embudo».",
  },
  "Este funil não tem nenhuma etapa marcada como perda, então não há para onde levar o card quando a pessoa desiste. Marque uma etapa como «aqui o cliente desiste» em «Etapas deste funil».": {
    es: "Este embudo no tiene ninguna etapa marcada como pérdida, así que no hay adónde llevar la tarjeta cuando la persona desiste. Marca una etapa como «aquí el cliente desiste» en «Etapas de este embudo».",
  },
  "Este funil só tem etapas de fechamento e de perda, então não há etapa comum para receber o card neste passo. Crie as etapas do meio do caminho em «Etapas deste funil».": {
    es: "Este embudo solo tiene etapas de cierre y de pérdida, así que no hay una etapa común para recibir la tarjeta en este paso. Crea las etapas intermedias en «Etapas de este embudo».",
  },
  "Sua sessão expirou. Entre de novo para salvar suas escolhas.": {
    es: "Tu sesión expiró. Vuelve a entrar para guardar tus elecciones.",
  },
  "Você não tem permissão para mudar a configuração deste funil.": {
    es: "No tienes permiso para cambiar la configuración de este embudo.",
  },
  "Não deu para salvar agora. Tente de novo em instantes.": {
    es: "No se pudo guardar ahora. Intenta de nuevo en instantes.",
  },
  "Não foi possível carregar as etapas deste funil agora. Recarregue a página.": {
    es: "No se pudieron cargar las etapas de este embudo ahora. Recarga la página.",
  },
  "Carregando as etapas deste funil…": { es: "Cargando las etapas de este embudo…" },
  "Escolhas salvas.": { es: "Elecciones guardadas." },
  "Para onde o card vai em cada passo": { es: "Adónde va la tarjeta en cada paso" },
  "Quando o agente avança no atendimento, o card do cliente pode andar sozinho no seu funil. Escolha para qual etapa ele vai em cada momento. Deixar em «não mover» é uma escolha válida — o card fica onde está e o agente segue trabalhando.": {
    es: "Cuando el agente avanza en la atención, la tarjeta del cliente puede moverse sola en tu embudo. Elige a qué etapa va en cada momento. Dejarlo en «no mover» es una elección válida — la tarjeta se queda donde está y el agente sigue trabajando.",
  },
  "Ir para as etapas do funil": { es: "Ir a las etapas del embudo" },
  "Etapa para": { es: "Etapa para" },
  "Não mover o card": { es: "No mover la tarjeta" },
  "As escolhas voltaram para o que está gravado agora — confira e escolha de novo.": {
    es: "Las elecciones volvieron a lo que está guardado ahora — revisa y elige de nuevo.",
  },
  "Salvar estas escolhas": { es: "Guardar estas elecciones" },
  negócio: { es: "negocio" },
  negócios: { es: "negocios" },
  "Etapa atualizada.": { es: "Etapa actualizada." },
  "Só uma etapa pode ser a de fechamento. Marcar esta desmarca": {
    es: "Solo una etapa puede ser la de cierre. Marcar esta desmarca",
  },
  "Só uma etapa pode ser a de perda. Marcar esta desmarca": {
    es: "Solo una etapa puede ser la de pérdida. Marcar esta desmarca",
  },
  "saiu do quadro.": { es: "salió del tablero." },
  "entrou no fim do funil.": { es: "entró al final del embudo." },
  "Etapas deste funil": { es: "Etapas de este embudo" },
  "Estas são as colunas do seu quadro, na ordem em que o cliente avança. Você pode renomear, criar, reordenar e arquivar.": {
    es: "Estas son las columnas de tu tablero, en el orden en que el cliente avanza. Puedes renombrar, crear, reordenar y archivar.",
  },
  "Duas colunas têm papel especial: a": { es: "Dos columnas tienen un rol especial: la" },
  "de fechamento": { es: "de cierre" },
  "é onde o negócio vira venda, e a": { es: "es donde el negocio se convierte en venta, y la" },
  "de perda": { es: "de pérdida" },
  "é onde ele se perde. Cada funil precisa de uma de cada — por isso a marcação se muda de lugar, não se apaga.": {
    es: "es donde se pierde. Cada embudo necesita una de cada — por eso la marca se cambia de lugar, no se borra.",
  },
  Mover: { es: "Mover" },
  "uma coluna para trás": { es: "una columna hacia atrás" },
  "uma coluna para frente": { es: "una columna hacia adelante" },
  "Papel de": { es: "Rol de" },
  "no funil": { es: "en el embudo" },
  "O assistente usa esta etapa para": { es: "El asistente usa esta etapa para" },
  "Mudar isso": { es: "Cambiar esto" },
  "Marcar mesmo assim": { es: "Marcar de todas formas" },
  "A coluna sai do quadro e para de receber negócios novos. Nada é apagado — o histórico de quem passou por ela continua guardado —, mas": {
    es: "La columna sale del tablero y deja de recibir negocios nuevos. Nada se borra — el historial de quien pasó por ella sigue guardado —, pero",
  },
  "não dá para trazer a coluna de volta por aqui": {
    es: "no se puede traer la columna de vuelta por aquí",
  },
  "está nesta etapa e não há outra coluna em aberto para recebê-lo.": {
    es: "está en esta etapa y no hay otra columna abierta para recibirlo.",
  },
  "estão nesta etapa e não há outra coluna em aberto para recebê-los.": {
    es: "están en esta etapa y no hay otra columna abierta para recibirlos.",
  },
  "Crie uma etapa antes de arquivar": { es: "Crea una etapa antes de archivar" },
  "está nesta etapa. Para onde ele vai?": { es: "está en esta etapa. ¿Adónde va?" },
  "estão nesta etapa. Para onde eles vão?": { es: "están en esta etapa. ¿Adónde van?" },
  "Para onde vão os negócios de": { es: "Adónde van los negocios de" },
  "Esta etapa é a que o assistente usa para": { es: "Esta es la etapa que el asistente usa para" },
  "Arquivando, ele para de mover o card nesse passo até você escolher outra etapa em": {
    es: "Al archivar, deja de mover la tarjeta en ese paso hasta que elijas otra etapa en",
  },
  "Mover os negócios e arquivar": { es: "Mover los negocios y archivar" },
  "Ir para o mapeamento do assistente": { es: "Ir al mapeo del asistente" },
  "Acrescentar etapa ao fim": { es: "Agregar etapa al final" },
  "Nome da nova coluna": { es: "Nombre de la nueva columna" },
  "Nome da nova etapa": { es: "Nombre de la nueva etapa" },
  "Nome da etapa": { es: "Nombre de la etapa" },
  "Para onde o agente leva o card em cada passo do atendimento": {
    es: "Adónde lleva el agente la tarjeta en cada paso de la atención",
  },
  ", vocabulário, custom fields e motivos de perda": {
    es: ", vocabulario, custom fields y motivos de pérdida",
  },
  "Nada especial": { es: "Nada especial" },
  "Aqui o cliente fecha": { es: "Aquí el cliente cierra" },
  "Aqui o cliente desiste": { es: "Aquí el cliente desiste" },
  "Nome da coluna (clique para renomear)": {
    es: "Nombre de la columna (haz clic para renombrar)",
  },
  Ordem: { es: "Orden" },
  "O que acontece nesta coluna": { es: "Qué pasa en esta columna" },
  "a pessoa acabou de chamar e ninguém respondeu ainda": {
    es: "la persona acaba de escribir y todavía nadie respondió",
  },
  "o agente já respondeu pela primeira vez": { es: "el agente ya respondió por primera vez" },
  "o agente está entendendo o que a pessoa precisa": {
    es: "el agente está entendiendo qué necesita la persona",
  },
  "o agente já entendeu a necessidade": { es: "el agente ya entendió la necesidad" },
  "conversa de preço, proposta ou agendamento": { es: "conversación de precio, propuesta o turno" },
  "a pessoa fechou": { es: "la persona cerró" },
  "a pessoa desistiu ou parou de responder": { es: "la persona desistió o dejó de responder" },
  "Novo lead": { es: "Lead nuevo" },
  "Primeiro contato": { es: "Primer contacto" },
  "Em qualificação": { es: "En calificación" },
  Qualificado: { es: "Calificado" },
  "Em negociação": { es: "En negociación" },
  Ganho: { es: "Ganado" },
  Perdido: { es: "Perdido" },
  // ─── Achados: chamadas com aspas simples (ponto cego do checker por regex) ───
  "O relatório de LGPD entregue ao cliente traz a RAZÃO SOCIAL da sua empresa, e não o nome aqui de cima — é ela que responde legalmente pelos dados. Confira o campo \"Razão social\" em Configurações → Organização.": {
    es: "El informe de LGPD entregado al cliente trae la RAZÓN SOCIAL de tu empresa, y no el nombre de aquí arriba — es ella la que responde legalmente por los datos. Revisa el campo \"Razón social\" en Configuración → Organización.",
  },
  "Use a ação \"Webhooks\" → POST, apontando para o endereço acima.": {
    es: "Usa la acción \"Webhooks\" → POST, apuntando a la dirección de arriba.",
  },
  // ─── Gaps reais achados na varredura completa do codebase (áreas ai/admin já fechadas) ───
  Incidentes: { es: "Incidentes" },
  "Último acesso": { es: "Último acceso" },
  "Este follow-up ainda não deu nenhum passo.": {
    es: "Este seguimiento todavía no dio ningún paso.",
  },
  "Mostrando os primeiros passos — este follow-up tem histórico maior que o desta tela.": {
    es: "Mostrando los primeros pasos — este seguimiento tiene un historial más grande que el de esta pantalla.",
  },
  "Carregando o follow-up…": { es: "Cargando el seguimiento…" },
  "Não consegui carregar este follow-up. Recarregue a página; se persistir, ele pode ter sido removido.": {
    es: "No pude cargar este seguimiento. Recarga la página; si persiste, puede haber sido eliminado.",
  },
  "Voltar para a fila": { es: "Volver a la cola" },
  Fluxo: { es: "Flujo" },
  Adiar: { es: "Posponer" },
  "Ex.: Roteador de vendas": { es: "Ej.: Enrutador de ventas" },
  Perfil: { es: "Perfil" },
  CNPJ: { es: "CNPJ" },
  "Cole o endereço acima no campo \"Action\" (ou \"URL de envio\") do seu formulário.": {
    es: "Pega la dirección de arriba en el campo \"Action\" (o \"URL de envío\") de tu formulario.",
  },
  Descartar: { es: "Descartar" },
  Você: { es: "Tú" },
  Cliente: { es: "Cliente" },
  "(sem texto)": { es: "(sin texto)" },
  "Cancelar resposta": { es: "Cancelar respuesta" },
  // ─── Saúde do canal (bolinha da sidebar + estado do canal) ───
  "Todas as conexões ativas": { es: "Todas las conexiones activas" },
  "Conectando…": { es: "Conectando…" },
  "Uma conexão caiu": { es: "Una conexión se cayó" },
  "Nenhuma conexão": { es: "Ninguna conexión" },
  "Não foi possível verificar as conexões": { es: "No se pudieron verificar las conexiones" },
  "Escaneie o QR": { es: "Escanea el QR" },
  Parado: { es: "Detenido" },
  Caiu: { es: "Se cayó" },
  "Situação desconhecida": { es: "Situación desconocida" },
  "Número sem nome": { es: "Número sin nombre" },
  Etapa: { es: "Etapa" },
  "Escolha o número": { es: "Elige el número" },
  Mensagem: { es: "Mensaje" },
  "Escolha o agente": { es: "Elige el agente" },
  "E-mail": { es: "Correo" },
  Quem: { es: "Quién" },
  "ação": { es: "acción" },
  "ações": { es: "acciones" },
  Ligar: { es: "Activar" },
  "Seu nome": { es: "Tu nombre" },
  "Selecione uma conversa para visualizar": {
    es: "Selecciona una conversación para visualizar",
  },
  "Modo somente-leitura. Use “Impersonate” para responder como atendente do tenant.": {
    es: "Modo de solo lectura. Usa “Impersonate” para responder como agente del tenant.",
  },
  "Sem nome": { es: "Sin nombre" },
  "Buscar mensagem...": { es: "Buscar mensaje..." },
  "Falha ao carregar conversas.": { es: "No se pudieron cargar las conversaciones." },
  "Nenhuma conversa encontrada.": { es: "No se encontró ninguna conversación." },
  "Falha ao carregar conversa.": { es: "No se pudo cargar la conversación." },
  "Sem mensagens nesta conversa.": { es: "No hay mensajes en esta conversación." },
  "Modo somente-leitura.": { es: "Modo de solo lectura." },
  "Use “Impersonate” (em breve, S-11.07) para responder.": {
    es: "Usa “Impersonate” (próximamente, S-11.07) para responder.",
  },
  "Contato anonimizado": { es: "Contacto anonimizado" },
  "Sem contato vinculado.": { es: "Sin contacto vinculado." },
  "Abrir tenant": { es: "Abrir tenant" },
  "Sem organização vinculada.": { es: "Sin organización vinculada." },
  "Status:": { es: "Estado:" },
  Carregando: { es: "Cargando" },
  Admin: { es: "Administrador" },
  Manager: { es: "Gerente" },
  Viewer: { es: "Visualizador" },

  // ─── Inbox (lado tenant): lista, filtros, cabeçalho da conversa ───
  Aguardando: { es: "Esperando" },
  "Erro ao carregar conversas.": { es: "Error al cargar las conversaciones." },
  "Tentar novamente": { es: "Intentar de nuevo" },
  "Buscar conversas": { es: "Buscar conversaciones" },
  "Filtrar por número de WhatsApp": { es: "Filtrar por número de WhatsApp" },
  "Filtrar por tag": { es: "Filtrar por etiqueta" },
  Anonimizado: { es: "Anonimizado" },
  "Entrou por": { es: "Entró por" },
  "Posição": { es: "Posición" },
  "na fila": { es: "en la cola" },
  Arquivada: { es: "Archivada" },
  "Aguardando o cliente": { es: "Esperando al cliente" },

  // ─── Inbox: painel lateral CRM (demandas, leads, pedidos, atividade) ───
  "Nenhuma demanda aberta.": { es: "No hay demandas abiertas." },
  "Demandas abertas": { es: "Demandas abiertas" },
  "Leads recentes": { es: "Leads recientes" },
  "Pedidos recentes": { es: "Pedidos recientes" },
  "O que acontece a seguir?": { es: "¿Qué pasa a continuación?" },
  "Próximo passo desta demanda": { es: "Próximo paso de esta demanda" },
  "Não consegui salvar o próximo passo. Tente de novo.": {
    es: "No pude guardar el próximo paso. Intenta de nuevo.",
  },
  "Nenhum funil configurado nesta organização.": {
    es: "No hay ningún embudo configurado en esta organización.",
  },
  "Não consegui ler estes dados.": { es: "No pude leer estos datos." },
  "Selecione uma conversa para ver detalhes do contato.": {
    es: "Selecciona una conversación para ver los detalles del contacto.",
  },

  // ─── Inbox: layout, cabeçalho de conversa e thread ───
  "Conversa não encontrada ou fora do seu acesso.": {
    es: "Conversación no encontrada o fuera de tu acceso.",
  },
  "Selecione uma conversa": { es: "Selecciona una conversación" },
  Ficha: { es: "Ficha" },
  "Ficha do contato": { es: "Ficha del contacto" },
  Hoje: { es: "Hoy" },
  Ontem: { es: "Ayer" },
  "Erro ao carregar mensagens.": { es: "Error al cargar los mensajes." },
  "Nenhuma mensagem nesta conversa.": { es: "No hay mensajes en esta conversación." },
  "Carregar mais antigas": { es: "Cargar más antiguas" },
  Lida: { es: "Leído" },
  Entregue: { es: "Entregado" },
  Enviada: { es: "Enviado" },
  "Responder a esta mensagem": { es: "Responder a este mensaje" },
  "Esta mensagem foi apagada": { es: "Este mensaje fue eliminado" },
  editada: { es: "editado" },
  "O autor editou esta mensagem": { es: "El autor editó este mensaje" },
  "Erro desconhecido": { es: "Error desconocido" },
  "Você passa a responder esta conversa e o atendimento automático para aqui.": {
    es: "Pasas a responder esta conversación y la atención automática se detiene aquí.",
  },
  "Religa o atendimento automático para este cliente — vale para todas as conversas dele.": {
    es: "Reactiva la atención automática para este cliente — vale para todas sus conversaciones.",
  },
  "Devolve esta conversa ao atendimento automático.": {
    es: "Devuelve esta conversación a la atención automática.",
  },
  "Devolvendo...": { es: "Devolviendo..." },
  "O atendimento automático para nesta conversa. O dono não muda.": {
    es: "La atención automática se detiene en esta conversación. El dueño no cambia.",
  },
  "Pausando...": { es: "Pausando..." },
  "Fechar esta conversa?": { es: "¿Cerrar esta conversación?" },
  Automático: { es: "Automático" },
  Alguém: { es: "Alguien" },
  "Nota interna · só o time vê": { es: "Nota interna · solo la ve el equipo" },
  "Excluir nota": { es: "Eliminar nota" },

  // ─── Inbox: transferir conversa / atalhos de teclado ───
  "Transferir conversa": { es: "Transferir conversación" },
  "A transferência é imediata: o atendente escolhido vira o responsável agora e a mudança fica registrada no histórico.": {
    es: "La transferencia es inmediata: el agente elegido se vuelve responsable ahora y el cambio queda registrado en el historial.",
  },
  "Transferir para": { es: "Transferir a" },
  "Carregando atendentes…": { es: "Cargando agentes…" },
  "Nenhum outro atendente disponível nesta organização.": {
    es: "No hay ningún otro agente disponible en esta organización.",
  },
  "Motivo (opcional)": { es: "Motivo (opcional)" },
  "Ex.: cliente pediu falar com o financeiro": { es: "Ej.: el cliente pidió hablar con finanzas" },
  "Transferindo…": { es: "Transfiriendo…" },
  Gestor: { es: "Gestor" },
  "Atalhos de teclado": { es: "Atajos de teclado" },
  "Próxima conversa": { es: "Siguiente conversación" },
  "Conversa anterior": { es: "Conversación anterior" },
  "Focar resposta": { es: "Enfocar respuesta" },
  "Enviar a mensagem": { es: "Enviar el mensaje" },
  "Quebrar linha sem enviar": { es: "Salto de línea sin enviar" },
  "Assumir conversa": { es: "Asumir conversación" },
  "Fechar conversa": { es: "Cerrar conversación" },
  "Mostrar atalhos": { es: "Mostrar atajos" },

  // ─── Inbox: tags de contato/conversa ───
  "Sem tags no contato.": { es: "Sin etiquetas en el contacto." },
  "Adicionar tag ao contato": { es: "Agregar etiqueta al contacto" },
  "Remover tag": { es: "Quitar etiqueta" },
  "Tags da conversa": { es: "Etiquetas de la conversación" },

  // ─── Inbox: janela de 24h fechada / seletor de modelo aprovado ───
  "Modelo enviado — a janela reabre quando o cliente responder.": {
    es: "Modelo enviado — la ventana se reabre cuando el cliente responda.",
  },
  "Não consegui enviar o modelo.": { es: "No pude enviar el modelo." },
  "Nenhum modelo aprovado ainda. Crie um em": { es: "Todavía no hay ningún modelo aprobado. Crea uno en" },
  "Conexões → Templates": { es: "Conexiones → Plantillas" },
  "e envie quando a plataforma aprovar.": { es: "y envíalo cuando la plataforma lo apruebe." },
  "Modelo aprovado": { es: "Modelo aprobado" },
  "Este modelo pede": { es: "Este modelo pide" },
  "valor(es) e ainda não dá para preenchê-los aqui — envie por": {
    es: "valor(es) y todavía no se pueden completar aquí — envía por",
  },
  "ou escolha um modelo sem parâmetros.": { es: "o elige un modelo sin parámetros." },
  "O cliente nunca escreveu": { es: "El cliente nunca escribió" },
  "Janela fechada há": { es: "Ventana cerrada hace" },
  "só modelo": { es: "solo modelo" },
  "Passaram 24h desde a última mensagem do cliente. Só um modelo aprovado sai daqui — texto livre é recusado pela plataforma.": {
    es: "Pasaron 24h desde el último mensaje del cliente. Solo un modelo aprobado sale de aquí — el texto libre es rechazado por la plataforma.",
  },
  "Tempo restante para escrever texto livre. Depois disso, só modelo aprovado.": {
    es: "Tiempo restante para escribir texto libre. Después de eso, solo modelo aprobado.",
  },
  Janela: { es: "Ventana" },
  "Lembrete ativo": { es: "Recordatorio activo" },
  "Cancelar lembrete": { es: "Cancelar recordatorio" },
  "Em 1 hora": { es: "En 1 hora" },
  "Em 3 horas": { es: "En 3 horas" },
  "Em 24 horas": { es: "En 24 horas" },

  // ─── Inbox: composer (anexos, áudio, contato, templates) ───
  Anexar: { es: "Adjuntar" },
  "Fotos e vídeos": { es: "Fotos y vídeos" },
  Documento: { es: "Documento" },
  "Enviar anexo": { es: "Enviar adjunto" },
  "Legenda (opcional)": { es: "Descripción (opcional)" },
  Legenda: { es: "Descripción" },
  "Gravar áudio": { es: "Grabar audio" },
  "Cancelar gravação": { es: "Cancelar grabación" },
  "Enviar áudio": { es: "Enviar audio" },
  "Não consegui acessar o microfone. Verifique a permissão do navegador.": {
    es: "No pude acceder al micrófono. Verifica el permiso del navegador.",
  },
  "Enviar contato": { es: "Enviar contacto" },
  "Escolha alguém da base ou informe nome e telefone — como no WhatsApp.": {
    es: "Elige a alguien de la base o indica nombre y teléfono — como en WhatsApp.",
  },
  "Buscar por nome ou telefone…": { es: "Buscar por nombre o teléfono…" },
  "Nenhum contato encontrado na base.": { es: "No se encontró ningún contacto en la base." },
  "Nenhum contato com telefone na base.": { es: "No hay ningún contacto con teléfono en la base." },
  "Enviar número informado": { es: "Enviar número indicado" },
  "Ou informe um contato": { es: "O indica un contacto" },
  "Como aparece no cartão": { es: "Cómo aparece en la tarjeta" },
  "Sugerir resposta": { es: "Sugerir respuesta" },
  Emoji: { es: "Emoji" },
  "Templates de script": { es: "Plantillas de guion" },
  "Nenhum template. Crie em Configurações.": { es: "Ningún modelo. Crea uno en Configuración." },

  // ─── Inbox: mídia (áudio, imagem, figurinha, vídeo, documento) ───
  "Mídia indisponível": { es: "Contenido no disponible" },
  Áudio: { es: "Audio" },
  Imagem: { es: "Imagen" },
  Figurinha: { es: "Figurita" },
  Vídeo: { es: "Vídeo" },
  "Pausar áudio": { es: "Pausar audio" },
  "Reproduzir áudio": { es: "Reproducir audio" },
  "Progresso do áudio": { es: "Progreso del audio" },
  "Velocidade de reprodução": { es: "Velocidad de reproducción" },
  "Ampliar imagem": { es: "Ampliar imagen" },
  "Imagem recebida": { es: "Imagen recibida" },
  Baixar: { es: "Descargar" },
  "Abrir conversa com este contato": { es: "Abrir conversación con este contacto" },
  "Não foi possível abrir a conversa.": { es: "No se pudo abrir la conversación." },
  "Enter salva a nota · Shift+Enter quebra linha": { es: "Enter guarda la nota · Shift+Enter salta de línea" },
  "Enter envia · Shift+Enter quebra linha": { es: "Enter envía · Shift+Enter salta de línea" },

  // ─── Inbox: aviso de retenção (before_send) ───
  "sem domingo": { es: "sin domingo" },
  "Fora da janela de envio": { es: "Fuera de la ventana de envío" },
  "A resposta fica agendada para a próxima abertura da janela, às": {
    es: "La respuesta queda programada para la próxima apertura de la ventana, a las",
  },
  "isso protege o número contra bloqueio do WhatsApp.": {
    es: "esto protege el número contra el bloqueo de WhatsApp.",
  },
  "Este número ainda está em aquecimento e o limite diário de envios dele foi atingido. Enviar além disso arriscaria bloqueio pelo WhatsApp — libera de novo amanhã, a partir das": {
    es: "Este número todavía está en calentamiento y se alcanzó su límite diario de envíos. Enviar más arriesgaría el bloqueo por WhatsApp — se libera de nuevo mañana, a partir de las",
  },
  "O limite diário de envios do número foi atingido — proteção contra bloqueio do WhatsApp. Libera de novo amanhã, a partir das": {
    es: "Se alcanzó el límite diario de envíos del número — protección contra el bloqueo de WhatsApp. Se libera de nuevo mañana, a partir de las",
  },
  "A mesma mensagem estava se repetindo em massa por este número. O envio foi segurado para variar o texto e não parecer robô para o WhatsApp.": {
    es: "El mismo mensaje se estaba repitiendo en masa por este número. El envío se retuvo para variar el texto y no parecer un robot para WhatsApp.",
  },
  "O contato pediu para não receber mensagens (opt-out). Nada será enviado a ele.": {
    es: "El contacto pidió no recibir mensajes (opt-out). No se le enviará nada.",
  },
  "Este contato foi anonimizado (LGPD) — é proibido enviar qualquer mensagem a ele.": {
    es: "Este contacto fue anonimizado (LGPD) — está prohibido enviarle cualquier mensaje.",
  },
  "Não há base legal (LGPD) para o primeiro contato de prospecção com este lead. O time precisa regularizar o cadastro antes de abordar.": {
    es: "No hay base legal (LGPD) para el primer contacto de prospección con este lead. El equipo necesita regularizar el registro antes de contactarlo.",
  },
  "A resposta prometia um preço ou condição fora da tabela aprovada. O assistente foi orientado a corrigir antes de enviar.": {
    es: "La respuesta prometía un precio o condición fuera de la tabla aprobada. Se orientó al asistente a corregir antes de enviar.",
  },
  "A resposta continha uma promessa não autorizada. O assistente foi orientado a reescrever antes de enviar.": {
    es: "La respuesta contenía una promesa no autorizada. Se orientó al asistente a reescribir antes de enviar.",
  },
  "A primeira mensagem a um contato novo precisa se apresentar como assistente virtual. O assistente foi orientado a corrigir antes de enviar.": {
    es: "El primer mensaje a un contacto nuevo debe presentarse como asistente virtual. Se orientó al asistente a corregir antes de enviar.",
  },
  "Uma trava de segurança segurou esta resposta": { es: "Un bloqueo de seguridad retuvo esta respuesta" },
  "Ela não foi enviada ao contato.": { es: "No se le envió al contacto." },
  "Resposta segurada pela proteção do número": { es: "Respuesta retenida por la protección del número" },
  "Resposta bloqueada por conformidade": { es: "Respuesta bloqueada por cumplimiento" },
  "Resposta retida para correção": { es: "Respuesta retenida para corrección" },

  // ─── Inbox: gaps achados na varredura completa (ambas as aspas) ───
  "Você não tem nenhuma organização ativa. Aceite um convite ou contate o admin.": {
    es: "No tienes ninguna organización activa. Acepta una invitación o contacta al admin.",
  },
  "Adicionar tag à conversa": { es: "Agregar etiqueta a la conversación" },
  "Fechar conversa?": { es: "¿Cerrar conversación?" },
  "O cliente ainda não escreveu — a janela de 24h nunca abriu. Só um modelo aprovado sai daqui.": {
    es: "El cliente todavía no escribió — la ventana de 24h nunca se abrió. Solo un modelo aprobado sale de aquí.",
  },
  "A janela de 24h fechou há": { es: "La ventana de 24h se cerró hace" },
  "Só um modelo aprovado sai daqui — texto livre é recusado pela plataforma.": {
    es: "Solo un modelo aprobado sale de aquí — el texto libre es rechazado por la plataforma.",
  },
  "Contato bloqueado — envio de mensagens desabilitado.": {
    es: "Contacto bloqueado — envío de mensajes deshabilitado.",
  },
  "Contato anonimizado — não é possível enviar mensagens.": {
    es: "Contacto anonimizado — no es posible enviar mensajes.",
  },
  "Responsável": { es: "Responsable" },

  // ─── Onboarding: welcome ───
  "Boas-vindas ao": { es: "Bienvenido a" },
  "Vamos montar quem vai atender seus clientes — e onde ele vai trabalhar.": {
    es: "Vamos a armar quién va a atender a tus clientes — y dónde va a trabajar.",
  },
  "Você já instalou o sistema. Isto aqui já está de pé:": {
    es: "Ya instalaste el sistema. Esto ya está en pie:",
  },
  "Servidor no ar e banco de dados instalado": { es: "Servidor en línea y base de datos instalada" },
  "Inteligência contratada:": { es: "Inteligencia contratada:" },
  "Chave cadastrada — conferindo com a empresa de IA": {
    es: "Clave registrada — verificando con la empresa de IA",
  },
  "Falta a chave da inteligência artificial": { es: "Falta la clave de la inteligencia artificial" },
  "WhatsApp pronto para conectar seu número": { es: "WhatsApp listo para conectar tu número" },
  "O WhatsApp desta instalação ainda não subiu": { es: "El WhatsApp de esta instalación todavía no arrancó" },
  "Funil de vendas criado:": { es: "Embudo de ventas creado:" },
  "Nenhum funil de vendas ainda": { es: "Ningún embudo de ventas todavía" },
  "Agora é montar quem vai atender por você.": { es: "Ahora es armar quién va a atender por ti." },
  "O que falta a gente resolve nos próximos passos.": {
    es: "Lo que falta lo resolvemos en los próximos pasos.",
  },
  "Pular tudo (DEV)": { es: "Saltar todo (DEV)" },
  "Como se chama o seu negócio?": { es: "¿Cómo se llama tu negocio?" },
  "É o nome que aparece para o seu time e nos relatórios. Pode ser clínica, loja, escritório — o que for seu.": {
    es: "Es el nombre que aparece para tu equipo y en los reportes. Puede ser clínica, tienda, oficina — lo que sea tuyo.",
  },
  "O que vocês fazem?": { es: "¿A qué se dedican?" },
  "Ex.: clínica odontológica, ou venda de roupa fitness pelo WhatsApp": {
    es: "Ej.: clínica dental, o venta de ropa deportiva por WhatsApp",
  },
  "Uma linha basta. É com isso que seu funcionário aprende com quem ele está falando — e que a gente monta o quadro de clientes do seu jeito.": {
    es: "Con una línea basta. Con eso tu empleado aprende con quién está hablando — y armamos el tablero de clientes a tu manera.",
  },
  "Onde você atende": { es: "Dónde atiendes" },
  "Decide o horário em que seu funcionário pode falar com clientes.": {
    es: "Decide el horario en el que tu empleado puede hablar con los clientes.",
  },
  "Li e aceito os": { es: "Leí y acepto los" },
  "Termos de Uso": { es: "Términos de Uso" },
  "e a": { es: "y la" },
  "Política de Privacidade": { es: "Política de Privacidad" },
  "Continuar": { es: "Continuar" },
  "Aceite os termos para continuar.": { es: "Acepta los términos para continuar." },

  // ─── Onboarding: connect-whatsapp ───
  "Dê um telefone a ele": { es: "Dale un teléfono" },
  "É por este número que ele vai atender seus clientes. Se você conecta pelo celular, tenha ele por perto.": {
    es: "Es por este número que va a atender a tus clientes. Si conectas por el celular, tenlo cerca.",
  },
  "Pronto para conectar": { es: "Listo para conectar" },
  "O código expirou": { es: "El código expiró" },
  "Não consegui falar com o WhatsApp": { es: "No pude comunicarme con WhatsApp" },
  "Escaneie o código abaixo com o celular que vai atender.": {
    es: "Escanea el código de abajo con el celular que va a atender.",
  },
  "Isso leva alguns segundos. O código aparece aqui sozinho.": {
    es: "Esto toma unos segundos. El código aparece aquí solo.",
  },
  "O número está no ar. Seguindo para o próximo passo.": {
    es: "El número está en línea. Avanzando al próximo paso.",
  },
  "É normal — ele vale poucos minutos. Dá para gerar outro.": {
    es: "Es normal — vale solo unos minutos. Se puede generar otro.",
  },
  "O serviço roda no seu servidor e não respondeu agora.": {
    es: "El servicio corre en tu servidor y no respondió ahora.",
  },
  "Escolher outra forma": { es: "Elegir otra forma" },
  "Falha ao pular:": { es: "Fallo al saltar:" },
  "Pular por enquanto": { es: "Saltar por ahora" },
  "Falha ao marcar passo:": { es: "Fallo al marcar el paso:" },
  "Conectei em outro lugar": { es: "Me conecté en otro lugar" },
  "o servidor respondeu": { es: "el servidor respondió" },
  "Não consegui gerar outro código. Tente de novo em alguns segundos.": {
    es: "No pude generar otro código. Intenta de nuevo en unos segundos.",
  },
  "Não consegui falar com o servidor. Confira sua conexão e tente de novo.": {
    es: "No pude comunicarme con el servidor. Revisa tu conexión e intenta de nuevo.",
  },
  "Como você já usa esse número?": { es: "¿Cómo ya usas ese número?" },
  "Existe mais de um jeito de ter WhatsApp para empresa, e cada um conecta de um jeito. Se você nunca ouviu falar dos outros dois, é o primeiro.": {
    es: "Existe más de una forma de tener WhatsApp para empresa, y cada una se conecta de un modo distinto. Si nunca oíste hablar de las otras dos, es la primera.",
  },
  "Leio um código com o celular": { es: "Leo un código con el celular" },
  "É assim para quase todo mundo. Você abre o WhatsApp no celular que vai atender e aponta para um código que aparece aqui.": {
    es: "Así es para casi todo el mundo. Abres el WhatsApp en el celular que va a atender y apuntas a un código que aparece aquí.",
  },
  "Tenho conta oficial na Meta": { es: "Tengo cuenta oficial en Meta" },
  "Você cadastrou o número na Meta e tem as credenciais em mãos. Não usa o celular para conectar.": {
    es: "Registraste el número en Meta y tienes las credenciales en mano. No usas el celular para conectar.",
  },
  "Contrato de um provedor parceiro": { es: "Contraté un proveedor socio" },
  "Uma empresa parceira cuida do seu WhatsApp e te deu uma chave de acesso.": {
    es: "Una empresa socia se encarga de tu WhatsApp y te dio una clave de acceso.",
  },
  "Este servidor ainda não está pronto para RECEBER por este caminho.": {
    es: "Este servidor todavía no está listo para RECIBIR por este camino.",
  },
  "Dá para conectar e já enviar, mas as respostas do cliente não vão chegar até quem instalou o sistema completar uma configuração no servidor. Se você quer atender hoje, o caminho do código com o celular funciona agora — e dá para trocar depois, sem perder nada.": {
    es: "Se puede conectar y ya enviar, pero las respuestas del cliente no van a llegar hasta que quien instaló el sistema complete una configuración en el servidor. Si quieres atender hoy, el camino del código con el celular funciona ahora — y se puede cambiar después, sin perder nada.",
  },
  "O WhatsApp desta instalação ainda não subiu.": { es: "El WhatsApp de esta instalación todavía no arrancó." },
  "Ele roda no seu próprio servidor. Dá para seguir sem ele agora e conectar o número depois, em": {
    es: "Corre en tu propio servidor. Se puede seguir sin él ahora y conectar el número después, en",
  },
  "Canais › Conexões": { es: "Canales › Conexiones" },
  "seu funcionário fica pronto de qualquer jeito, só não terá por onde atender ainda.": {
    es: "tu empleado queda listo de todas formas, solo que aún no tendrá por dónde atender.",
  },
  "Não consegui carregar o código agora. Ele deve reaparecer sozinho em instantes — se não aparecer, gere outro abaixo.": {
    es: "No pude cargar el código ahora. Debería reaparecer solo en instantes — si no aparece, genera otro abajo.",
  },
  "Código QR para conectar o WhatsApp": { es: "Código QR para conectar el WhatsApp" },
  "Conectado! Avançando…": { es: "¡Conectado! Avanzando…" },
  "O código expirou antes de alguém escanear. É normal — ele vale só alguns minutos.": {
    es: "El código expiró antes de que alguien lo escaneara. Es normal — vale solo unos minutos.",
  },
  "Deixe o WhatsApp já aberto em": { es: "Deja el WhatsApp ya abierto en" },
  "Aparelhos conectados": { es: "Dispositivos vinculados" },
  "antes de gerar o próximo, que aí dá tempo de sobra.": {
    es: "antes de generar el próximo, así te sobra tiempo.",
  },
  "Gerar novo QR Code": { es: "Generar nuevo código QR" },
  "O serviço de WhatsApp desta instalação não respondeu. Ele roda no seu servidor, junto com o resto do sistema — quem instalou consegue religá-lo.": {
    es: "El servicio de WhatsApp de esta instalación no respondió. Corre en tu servidor, junto con el resto del sistema — quien lo instaló puede reactivarlo.",
  },
  "Detalhe técnico:": { es: "Detalle técnico:" },
  "Tentando…": { es: "Intentando…" },

  // ─── Onboarding: connect-nuvemshop ───
  "Importe pedidos, clientes e produtos da sua loja Nuvemshop.": {
    es: "Importa pedidos, clientes y productos de tu tienda Nuvemshop.",
  },
  "Ao clicar em": { es: "Al hacer clic en" },
  "você será redirecionado para autorizar o": { es: "serás redirigido para autorizar a" },
  "na sua conta Nuvemshop.": { es: "en tu cuenta Nuvemshop." },
  "Nuvemshop ainda não configurado neste ambiente.": {
    es: "Nuvemshop todavía no está configurado en este entorno.",
  },
  "Pule por enquanto e configure depois em Integrações.": {
    es: "Sáltalo por ahora y configúralo después en Integraciones.",
  },
  "Já conectei": { es: "Ya conecté" },

  // ─── Onboarding: setup-ai ───
  "Treine seu funcionário": { es: "Entrena a tu empleado" },
  "Quem ele é, como fala e o que pode prometer. Dá para mudar tudo depois.": {
    es: "Quién es, cómo habla y qué puede prometer. Se puede cambiar todo después.",
  },
  "da inteligência escolhida na instalação": { es: "de la inteligencia elegida en la instalación" },
  "da": { es: "de la" },
  "Falha ao criar agente:": { es: "Fallo al crear el agente:" },
  "Atendente criado, mas ainda não está no ar.": { es: "Agente creado, pero todavía no está en línea." },
  "Agente criado, mas ainda não publicado.": { es: "Agente creado, pero todavía no publicado." },
  "Como ele vai se chamar": { es: "Cómo se va a llamar" },
  "É o nome que aparece para o seu time. O cliente vê só a conversa.": {
    es: "Es el nombre que aparece para tu equipo. El cliente ve solo la conversación.",
  },
  "O jeito dele falar": { es: "Su forma de hablar" },
  "As regras da casa (opcional)": { es: "Las reglas de la casa (opcional)" },
  "Nunca prometa desconto sem confirmar com uma pessoa.": {
    es: "Nunca prometas descuento sin confirmar con una persona.",
  },
  "Horário de atendimento: 9h às 18h, de segunda a sexta.": {
    es: "Horario de atención: 9h a 18h, de lunes a viernes.",
  },
  "Sempre chame o cliente pelo primeiro nome.": { es: "Siempre llama al cliente por su primer nombre." },
  "O que vale para qualquer atendimento aqui. Pode deixar em branco agora e escrever depois — ele aprende com você ao longo do tempo.": {
    es: "Lo que vale para cualquier atención aquí. Puedes dejarlo en blanco ahora y escribirlo después — aprende contigo con el tiempo.",
  },
  "Ele já vem sabendo": { es: "Ya viene sabiendo" },
  "E nunca vai fazer": { es: "Y nunca va a hacer" },
  "Essas conferências acontecem antes de cada mensagem sair, e não têm interruptor.": {
    es: "Estas verificaciones ocurren antes de que salga cada mensaje, y no tienen interruptor.",
  },
  "O atendente foi criado, mas as": { es: "El agente fue creado, pero las" },
  "regras da casa": { es: "reglas de la casa" },
  "não foram gravadas. Copie o que você escreveu antes de sair — e salve de novo em": {
    es: "no se guardaron. Copia lo que escribiste antes de salir — y guárdalo de nuevo en",
  },
  "IA › Memória": { es: "IA › Memoria" },
  "Erro do banco de dados:": { es: "Error de la base de datos:" },
  "Seu atendente foi criado, mas ficou como": { es: "Tu agente fue creado, pero quedó como" },
  "rascunho": { es: "borrador" },
  "— ele ainda não tem com o que pensar.": { es: "— todavía no tiene con qué pensar." },
  "Não achei chave de": { es: "No encontré clave de" },
  "nem cadastrada aqui, nem vinda da instalação. Cole a chave no campo acima («o cérebro dele») e crie o atendente de novo — ou cadastre em": {
    es: "ni registrada aquí, ni proveniente de la instalación. Pega la clave en el campo de arriba («su cerebro») y crea el agente de nuevo — o regístrala en",
  },
  "IA › Credenciais": { es: "IA › Credenciales" },
  "Continuar sem publicar": { es: "Continuar sin publicar" },
  "— e rascunho não responde mensagem.": { es: "— y un borrador no responde mensajes." },
  "Os modelos": { es: "Los modelos" },
  "que esta instalação conhece não sabem usar ferramentas — sem isso ele conversaria bem e nunca criaria um cliente nem moveria um negócio no funil. Escolha outra empresa de IA em": {
    es: "que esta instalación conoce no saben usar herramientas — sin eso conversaría bien pero nunca crearía un cliente ni movería un negocio en el embudo. Elige otra empresa de IA en",
  },
  "IA › Provedores": { es: "IA › Proveedores" },
  "Esta instalação ainda não tem a lista de modelos": {
    es: "Esta instalación todavía no tiene la lista de modelos",
  },
  "Ela é baixada automaticamente uma vez por dia; depois disso, publique em": {
    es: "Se descarga automáticamente una vez al día; después de eso, publica en",
  },
  "IA › Agentes": { es: "IA › Agentes" },
  "Seu agente foi criado, mas ficou como": { es: "Tu agente fue creado, pero quedó como" },
  "não consegui ler os números de WhatsApp desta instalação, então não dá pra dizer em qual número ele atenderia — e rascunho não responde mensagem.": {
    es: "no pude leer los números de WhatsApp de esta instalación, así que no se puede decir en qué número atendería — y un borrador no responde mensajes.",
  },
  "Tente de novo no botão abaixo (clicar de novo não cria um segundo agente) ou siga agora e publique depois em": {
    es: "Intenta de nuevo con el botón de abajo (hacer clic de nuevo no crea un segundo agente) o sigue ahora y publica después en",
  },
  "Pular": { es: "Saltar" },
  "Criar e continuar": { es: "Crear y continuar" },

  // ─── Onboarding: setup-ai (o cérebro / chave de IA) ───
  "Ele ainda não tem cérebro": { es: "Todavía no tiene cerebro" },
  "Seu funcionário pensa com a inteligência artificial que você contratar. A instalação não trouxe nenhuma chave — cole a sua aqui e ele já nasce funcionando.": {
    es: "Tu empleado piensa con la inteligencia artificial que contrates. La instalación no trajo ninguna clave — pega la tuya aquí y nace funcionando.",
  },
  "Qual você contratou": { es: "Cuál contrataste" },
  "A chave": { es: "La clave" },
  "Cole aqui a chave que a empresa de IA te deu": { es: "Pega aquí la clave que te dio la empresa de IA" },
  "Chave guardada. Agora ele pode pensar.": { es: "Clave guardada. Ahora puede pensar." },
  "Guardando...": { es: "Guardando..." },
  "Guardar a chave": { es: "Guardar la clave" },
  "Ela é guardada cifrada — nem nós conseguimos lê-la depois.": {
    es: "Se guarda cifrada — ni siquiera nosotros podemos leerla después.",
  },
  "O cérebro dele:": { es: "Su cerebro:" },
  "final": { es: "final" },
  "Conferindo se a chave tem crédito…": { es: "Verificando si la clave tiene crédito…" },
  "Testei agora: a chave respondeu e tem crédito.": { es: "Probé ahora: la clave respondió y tiene crédito." },
  "A chave foi aceita, mas o teste não passou:": { es: "La clave fue aceptada, pero la prueba no pasó:" },
  "Se for falta de crédito, adicione saldo na conta da empresa de IA — sem isso ele não responde a nenhum cliente.": {
    es: "Si es falta de crédito, agrega saldo en la cuenta de la empresa de IA — sin eso no le responde a ningún cliente.",
  },
  "Não consegui testar o crédito agora. Dá para seguir — mas confira o saldo na conta da empresa de IA antes de confiar nele.": {
    es: "No pude probar el crédito ahora. Se puede seguir — pero revisa el saldo en la cuenta de la empresa de IA antes de confiar en él.",
  },
  "Pronta para uso.": { es: "Lista para usar." },

  // ─── Onboarding: funil (quadro de clientes) ───
  "Onde ele organiza seus clientes": { es: "Dónde organiza a tus clientes" },
  "Cada cliente vira um cartão que anda por essas colunas. Ele mesmo move o cartão conforme a conversa avança — por isso cada coluna diz também quando ele deve usá-la.": {
    es: "Cada cliente se vuelve una tarjeta que recorre estas columnas. Él mismo mueve la tarjeta conforme avanza la conversación — por eso cada columna también dice cuándo debe usarla.",
  },
  "Seu funcionário montou este quadro olhando o que você me contou sobre o negócio. Ajuste o que quiser.": {
    es: "Tu empleado armó este tablero mirando lo que me contaste sobre el negocio. Ajusta lo que quieras.",
  },
  "Não consegui pedir uma sugestão para o seu funcionário agora": {
    es: "No pude pedirle una sugerencia a tu empleado ahora",
  },
  "Comecei por um quadro pronto de": { es: "Empecé por un tablero listo de" },
  "Isso não trava nada: escolha outro modelo abaixo ou ajuste as colunas na mão. Dá para mudar tudo depois, quando quiser.": {
    es: "Esto no traba nada: elige otro modelo abajo o ajusta las columnas a mano. Se puede cambiar todo después, cuando quieras.",
  },
  "Nome do quadro": { es: "Nombre del tablero" },
  "Nome da coluna": { es: "Nombre de la columna" },
  "Ele move o cliente para cá quando": { es: "Mueve al cliente para acá cuando" },
  "Coluna que só vocês movem — ele não mexe nesta.": {
    es: "Columna que solo ustedes mueven — él no toca esta.",
  },
  "obrigatória": { es: "obligatoria" },
  "Adicionar coluna": { es: "Agregar columna" },
  "colunas é o máximo — mais que isso não cabe na tela do celular.": {
    es: "columnas es el máximo — más que eso no cabe en la pantalla del celular.",
  },
  "O que veio na instalação": { es: "Lo que vino en la instalación" },
  "Este é o quadro padrão, feito para loja online. Ao continuar, ele é substituído pelo de cima.": {
    es: "Este es el tablero predeterminado, hecho para tienda en línea. Al continuar, se reemplaza por el de arriba.",
  },
  "Prefiro começar de um modelo pronto": { es: "Prefiero empezar desde un modelo listo" },
  "Dê um nome à coluna em branco.": { es: "Dale un nombre a la columna en blanco." },
  "Usar este quadro": { es: "Usar este tablero" },

  // ─── Onboarding: testar ───
  "Veja ele atender": { es: "Míralo atender" },
  "Escreva como se fosse um cliente. Nada é enviado pelo WhatsApp — é só um ensaio, entre você e ele.": {
    es: "Escribe como si fueras un cliente. Nada se envía por WhatsApp — es solo un ensayo, entre tú y él.",
  },
  "seu funcionário": { es: "tu empleado" },
  "O ensaio falhou": { es: "El ensayo falló" },
  "o ensaio terminou como": { es: "el ensayo terminó como" },
  "Ele executou, mas não devolveu texto nenhum.": { es: "Se ejecutó, pero no devolvió ningún texto." },
  "Você ainda não montou seu funcionário.": { es: "Todavía no armaste a tu empleado." },
  "Sem ninguém treinado, não há o que testar. Dá para voltar ao passo anterior agora ou fazer isso depois, em IA › Agentes.": {
    es: "Sin nadie entrenado, no hay qué probar. Se puede volver al paso anterior ahora o hacerlo después, en IA › Agentes.",
  },
  "está como": { es: "está como" },
  "ainda não foi para o ar.": { es: "todavía no salió al aire." },
  "Rascunho não responde mensagem, então não há o que ensaiar. O passo anterior explicou o que falta; você pode resolver depois em IA › Agentes.": {
    es: "Un borrador no responde mensajes, así que no hay qué ensayar. El paso anterior explicó lo que falta; puedes resolverlo después en IA › Agentes.",
  },
  "Escreva como se fosse um cliente": { es: "Escribe como si fueras un cliente" },
  "Ele está pensando...": { es: "Está pensando..." },
  "Mandar mensagem": { es: "Enviar mensaje" },
  "respondeu": { es: "respondió" },
  "Esta conversa não foi enviada a ninguém e não aparece no seu inbox.": {
    es: "Esta conversación no se envió a nadie y no aparece en tu bandeja de entrada.",
  },
  "Ele não conseguiu responder — e é melhor descobrir isso agora do que com um cliente de verdade.": {
    es: "No pudo responder — y es mejor descubrir esto ahora que con un cliente de verdad.",
  },
  "Motivo:": { es: "Motivo:" },
  "As causas mais comuns são a chave da empresa de IA sem saldo ou o modelo indisponível. Dá para conferir em": {
    es: "Las causas más comunes son la clave de la empresa de IA sin saldo o el modelo no disponible. Se puede revisar en",
  },
  "e seguir daqui mesmo — o que você montou está salvo.": {
    es: "y seguir desde aquí mismo — lo que armaste está guardado.",
  },
  "Não consegui salvar este passo.": { es: "No pude guardar este paso." },

  // ─── Onboarding: invite-team ───
  "Quem trabalha com ele": { es: "Quién trabaja con él" },
  "Seu funcionário não trabalha sozinho: quando ele passar uma conversa adiante, é uma dessas pessoas que atende.": {
    es: "Tu empleado no trabaja solo: cuando pase una conversación adelante, es una de estas personas la que atiende.",
  },
  "Esta instalação ainda não envia e-mail.": { es: "Esta instalación todavía no envía correo." },
  "Você recebe um link para cada pessoa e manda por onde quiser — WhatsApp, e-mail, o que preferir. O link é o convite: quem abrir entra na sua empresa.": {
    es: "Recibes un enlace para cada persona y lo mandas por donde quieras — WhatsApp, correo, lo que prefieras. El enlace es la invitación: quien lo abra entra a tu empresa.",
  },
  "Falha:": { es: "Fallo:" },
  "Adicione ao menos um email ou clique em Pular.": { es: "Agrega al menos un correo o haz clic en Saltar." },
  "Máximo 20 emails por convite.": { es: "Máximo 20 correos por invitación." },
  "convite(s) não puderam ser enviados por email. Copie os links abaixo e envie você mesmo.": {
    es: "invitación(es) no se pudieron enviar por correo. Copia los enlaces de abajo y envíalos tú mismo.",
  },
  "E-mail de quem vai trabalhar com ele": { es: "Correo de quien va a trabajar con él" },
  "O que essas pessoas podem fazer": { es: "Qué pueden hacer estas personas" },
  "Esta instalação não envia e-mail. Os convites estão prontos — copie o link de cada pessoa e mande por onde você já fala com ela:": {
    es: "Esta instalación no envía correo. Las invitaciones están listas — copia el enlace de cada persona y mándalo por donde ya hablas con ella:",
  },
  "Link copiado.": { es: "Enlace copiado." },
  "Não consegui copiar — selecione e copie o link manualmente.": {
    es: "No pude copiar — selecciona y copia el enlace manualmente.",
  },
  "Copiar link": { es: "Copiar enlace" },
  "Enviar convites": { es: "Enviar invitaciones" },

  // ─── Onboarding: done (resumo final) ───
  "Tudo pronto!": { es: "¡Todo listo!" },
  "Seu funcionário está montado. Daqui em diante é só acompanhar.": {
    es: "Tu empleado ya está armado. De aquí en adelante es solo acompañar.",
  },
  "Seu funcionário já está de pé. O que ficou para depois continua te esperando.": {
    es: "Tu empleado ya está en pie. Lo que quedó para después sigue esperándote.",
  },
  "você pulou": { es: "lo saltaste" },
  "ainda não": { es: "todavía no" },
  "O que mais tem aqui": { es: "Qué más hay aquí" },
  "Você não precisa mexer em nada disso agora. É só para saber que existe.": {
    es: "No necesitas tocar nada de esto ahora. Es solo para saber que existe.",
  },
  "Como funciona": { es: "Cómo funciona" },
  "Finalizando...": { es: "Finalizando..." },
  "Começar a usar": { es: "Empezar a usar" },

  // ─── Onboarding: "O que mais tem aqui" (lib/onboarding/o-que-mais-existe.ts) ───
  "As conversas": { es: "Las conversaciones" },
  "É aqui que as conversas chegam, com você e ele atendendo lado a lado.": {
    es: "Aquí es donde llegan las conversaciones, contigo y él atendiendo lado a lado.",
  },
  "O cliente manda uma mensagem no WhatsApp": { es: "El cliente manda un mensaje por WhatsApp" },
  "Ele responde sozinho, seguindo as regras da casa que você escreveu": {
    es: "Él responde solo, siguiendo las reglas de la casa que escribiste",
  },
  "Se você entrar na conversa, ele sai da frente e deixa você atender": {
    es: "Si entras a la conversación, él se hace a un lado y te deja atender",
  },
  "O quadro de clientes": { es: "El tablero de clientes" },
  "Cada cliente vira um card, e ele mesmo move o card conforme a conversa anda.": {
    es: "Cada cliente se vuelve una tarjeta, y él mismo mueve la tarjeta conforme avanza la conversación.",
  },
  "Cada cliente vira um cartão, na primeira coluna": {
    es: "Cada cliente se vuelve una tarjeta, en la primera columna",
  },
  "Conforme a conversa avança, ele move o cartão de coluna sozinho": {
    es: "Conforme avanza la conversación, él mueve la tarjeta de columna solo",
  },
  "Você arrasta o cartão na mão quando quiser — o quadro é seu": {
    es: "Tú arrastras la tarjeta a mano cuando quieras — el tablero es tuyo",
  },
  "Voltar a falar com quem sumiu": { es: "Volver a hablar con quien desapareció" },
  "Para nenhum cliente sumir no silêncio — ele volta a falar sozinho, na hora certa.": {
    es: "Para que ningún cliente desaparezca en silencio — él vuelve a hablar solo, en el momento justo.",
  },
  "O cliente para de responder no meio da conversa": {
    es: "El cliente deja de responder en medio de la conversación",
  },
  "Depois do tempo que você definir, ele manda uma mensagem puxando o assunto": {
    es: "Después del tiempo que definas, él manda un mensaje retomando el tema",
  },
  "Se o cliente responder, o retorno para na hora — ninguém é perseguido": {
    es: "Si el cliente responde, el retorno se detiene en el acto — a nadie se le persigue",
  },
  "Se o cliente pedir para parar, ele para e não volta a escrever": {
    es: "Si el cliente pide que se detenga, él para y no vuelve a escribir",
  },
  "E você pode pausar, adiar, pular um passo ou cancelar quando quiser": {
    es: "Y puedes pausar, posponer, saltar un paso o cancelar cuando quieras",
  },
  "O que está esfriando": { es: "Lo que se está enfriando" },
  "Quem esfriou e ainda está aberto, para você agir antes de perder.": {
    es: "Quien se enfrió y todavía está abierto, para que actúes antes de perderlo.",
  },
  "Ele observa há quanto tempo cada negócio em aberto não tem resposta": {
    es: "Observa hace cuánto tiempo cada negocio abierto no tiene respuesta",
  },
  "Os que estão esfriando sobem para o topo desta lista": {
    es: "Los que se están enfriando suben al principio de esta lista",
  },
  "Você decide quem merece um empurrão seu, em vez de descobrir tarde demais": {
    es: "Tú decides quién merece un empujón tuyo, en vez de descubrirlo demasiado tarde",
  },
  "Quando ele pede ajuda": { es: "Cuando pide ayuda" },
  "Quando ele trava em algo que só uma pessoa resolve, o pedido aparece aqui.": {
    es: "Cuando se traba en algo que solo una persona resuelve, el pedido aparece aquí.",
  },
  "Ele encontra algo que não pode decidir sozinho — um desconto, uma exceção, um caso estranho": {
    es: "Encuentra algo que no puede decidir solo — un descuento, una excepción, un caso raro",
  },
  "Em vez de inventar, ele para e abre um pedido aqui": {
    es: "En vez de inventar, se detiene y abre un pedido aquí",
  },
  "Você decide, e ele volta a andar com a sua resposta": {
    es: "Tú decides, y él vuelve a avanzar con tu respuesta",
  },
  "As ideias dele": { es: "Sus ideas" },
  "Com o tempo ele sugere as próprias melhorias — e você decide se entram.": {
    es: "Con el tiempo sugiere sus propias mejoras — y tú decides si entran.",
  },
  "Ele acompanha os próprios atendimentos e percebe o que poderia ir melhor": {
    es: "Sigue sus propias atenciones y nota qué podría ir mejor",
  },
  "Escreve a sugestão aqui, em português, e espera": {
    es: "Escribe la sugerencia aquí, en portugués, y espera",
  },
  "Nada muda sozinho: só entra em vigor quando VOCÊ aprovar": {
    es: "Nada cambia solo: solo entra en vigor cuando TÚ apruebas",
  },

  // ─── Onboarding: setup-ai — JEITOS (jeito de falar) ───
  "Próximo e caloroso": { es: "Cercano y cálido" },
  "Conversa como gente, puxa assunto, tranquiliza. Bom para quem vende no dia a dia.": {
    es: "Conversa como persona, saca tema, tranquiliza. Bueno para quien vende en el día a día.",
  },
  "Objetivo e cordial": { es: "Directo y cordial" },
  "Vai direto ao ponto sem ser seco, e sempre indica o próximo passo.": {
    es: "Va directo al punto sin ser seco, y siempre indica el próximo paso.",
  },
  "Curto e prático": { es: "Corto y práctico" },
  "Frases curtas, pergunta só o essencial e chama uma pessoa cedo.": {
    es: "Frases cortas, pregunta solo lo esencial y llama a una persona pronto.",
  },

  // ─── Onboarding: invite-team — ROTULO_DO_PAPEL (lib/auth/types.ts) ───
  "Somente leitura": { es: "Solo lectura" },
  "Gerente": { es: "Gerente" },
  "Administrador": { es: "Administrador" },

  // ─── Onboarding: funil — EXPLICACAO_DO_PASSO (lib/leads/agent-mapping.ts) ───
  "acabou de chamar e ninguém respondeu ainda": { es: "acaba de llamar y todavía nadie respondió" },
  "já foi respondido": { es: "ya fue respondido" },
  "ele está entendendo o que a pessoa precisa": { es: "está entendiendo lo que la persona necesita" },
  "já dá para saber o que oferecer": { es: "ya se puede saber qué ofrecer" },
  "está fechando preço, horário ou condições": { es: "está cerrando precio, horario o condiciones" },
  "fechou negócio": { es: "cerró el negocio" },
  "não fechou": { es: "no cerró" },
  "seu funcionário ainda não está no ar": { es: "tu empleado todavía no está en línea" },
  "a resposta não veio no formato esperado": { es: "la respuesta no vino en el formato esperado" },

  // ─── Onboarding: funil — pacotes prontos (lib/onboarding/pacotes-de-funil.ts) ───
  "Clínica, consultório ou salão": { es: "Clínica, consultorio o salón" },
  "Imobiliária ou corretor": { es: "Inmobiliaria o corredor" },
  "Serviços, agência ou obra": { es: "Servicios, agencia u obra" },
  "Curso, mentoria ou infoproduto": { es: "Curso, mentoría o infoproducto" },
  "Loja — online ou de rua": { es: "Tienda — en línea o física" },
  "Outro tipo de negócio": { es: "Otro tipo de negocio" },

  // ─── Onboarding: tool catalog (capacidades) usadas em "Ele já vem sabendo" ───
  "Listar oportunidades do funil": { es: "Listar oportunidades del embudo" },
  "Ver uma oportunidade": { es: "Ver una oportunidad" },
  "Listar funis": { es: "Listar embudos" },
  "Criar oportunidade no funil": { es: "Crear oportunidad en el embudo" },
  "Atualizar uma oportunidade": { es: "Actualizar una oportunidad" },
  "Mover oportunidade de etapa": { es: "Mover oportunidad de etapa" },
  "Ver as compras do cliente": { es: "Ver las compras del cliente" },
  "Procurar produto na loja": { es: "Buscar producto en la tienda" },
  "Anotar dado que o cliente informou": { es: "Anotar dato que informó el cliente" },
  "Procurar cliente": { es: "Buscar cliente" },
  "Ver ficha do cliente": { es: "Ver ficha del cliente" },
  "Ver as etapas de um funil": { es: "Ver las etapas de un embudo" },

  // ─── Onboarding: conferências de saída (guardrails), "E nunca vai fazer" ───
  "Respeitar quem pediu para parar": { es: "Respetar a quien pidió parar" },
  "Respeitar dados apagados e a base legal": { es: "Respetar datos borrados y la base legal" },
  "Segurar o ritmo de envio": { es: "Mantener el ritmo de envío" },
  "Respeitar a janela do WhatsApp": { es: "Respetar la ventana de WhatsApp" },
  "Variar o texto das mensagens iguais": { es: "Variar el texto de los mensajes iguales" },
  "Não prometer preço ou prazo por conta própria": { es: "No prometer precio o plazo por cuenta propia" },
  "Conferir promessas em texto livre": { es: "Verificar promesas en texto libre" },
  "Não prometer atendimento humano que não existe": { es: "No prometer atención humana que no existe" },
  "Não falar a nossa língua com o seu cliente": { es: "No hablar nuestro idioma con tu cliente" },
  "Dizer que é um assistente quando perguntam": { es: "Decir que es un asistente cuando preguntan" },
  "Detectar tentativa de manipular o assistente": { es: "Detectar intento de manipular al asistente" },

  // ─── Onboarding: welcome/_form.tsx — cidades do fuso horário ───
  "São Paulo, Rio, Brasília, Sul e Sudeste": { es: "São Paulo, Río, Brasilia, Sur y Sudeste" },
  "Recife, Salvador, Fortaleza e Nordeste": { es: "Recife, Salvador, Fortaleza y Nordeste" },
  "Belém e Pará": { es: "Belém y Pará" },
  "Manaus e Amazonas": { es: "Manaos y Amazonas" },
  "Cuiabá e Mato Grosso": { es: "Cuiabá y Mato Grosso" },
  "Rio Branco e Acre": { es: "Río Branco y Acre" },
  "Buenos Aires": { es: "Buenos Aires" },
  "Lisboa": { es: "Lisboa" },
  "Madri": { es: "Madrid" },
  "Nova York": { es: "Nueva York" },
  "Los Angeles": { es: "Los Ángeles" },
  "Outro (horário universal)": { es: "Otro (horario universal)" },

  // ─── Onboarding: rótulos do Stepper (lib/onboarding/passos.ts) ───
  "Seu negócio": { es: "Tu negocio" },
  "O telefone dele": { es: "Su teléfono" },
  "Sua loja": { es: "Tu tienda" },
  "Treinar": { es: "Entrenar" },
  "Onde ele organiza": { es: "Dónde organiza" },
  "Ver ele atender": { es: "Verlo atender" },

  // ─── Estados vazios compartilhados (components/empty/variants.tsx) ───
  "Sem conversas por aqui": { es: "Sin conversaciones por aquí" },
  "Quando chegarem mensagens, elas aparecem aqui em tempo real.": {
    es: "Cuando lleguen mensajes, aparecerán aquí en tiempo real.",
  },
  "Quadro vazio": { es: "Tablero vacío" },
  "Ainda não há nenhum cliente aqui. Assim que a primeira conversa começar, o cartão aparece nesta coluna.": {
    es: "Todavía no hay ningún cliente aquí. En cuanto empiece la primera conversación, la tarjeta aparece en esta columna.",
  },
  "Nenhum contato ainda": { es: "Ningún contacto todavía" },
  "Contatos chegam automaticamente via WhatsApp ou Nuvemshop.": {
    es: "Los contactos llegan automáticamente vía WhatsApp o Nuvemshop.",
  },
  "Sem eventos no período": { es: "Sin eventos en el período" },
  "Ajuste o filtro de datas ou a busca pra ver eventos.": {
    es: "Ajusta el filtro de fechas o la búsqueda para ver eventos.",
  },
  "Nenhum funil ainda": { es: "Ningún embudo todavía" },
  "Um funil é o caminho que o cliente percorre até fechar. Crie o primeiro para ter um quadro.": {
    es: "Un embudo es el camino que el cliente recorre hasta cerrar. Crea el primero para tener un tablero.",
  },
  "Sem membros no time": { es: "Sin miembros en el equipo" },
  "Convide colegas pra atender em conjunto.": { es: "Invita a colegas para atender en conjunto." },
  "Nenhum token criado": { es: "Ningún token creado" },
  "Tokens permitem integrações server-to-server.": {
    es: "Los tokens permiten integraciones server-to-server.",
  },
  "Sem atividades registradas": { es: "Sin actividades registradas" },
  "A timeline mostra mensagens, mudanças de stage e notas.": {
    es: "La línea de tiempo muestra mensajes, cambios de etapa y notas.",
  },
  "Sem candidatos a merge": { es: "Sin candidatos a fusión" },
  "Contatos duplicados aparecerão aqui pra revisão.": {
    es: "Los contactos duplicados aparecerán aquí para revisión.",
  },
  "Tente ajustar os filtros ou a busca.": { es: "Intenta ajustar los filtros o la búsqueda." },
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
