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
