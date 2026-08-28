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
  Agenda: { es: "Agenda" },
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
  "Tipos de agendamento": { es: "Tipos de cita" },
  Automação: { es: "Automatización" },
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
  "Escreva uma mensagem…": { es: "Escribí un mensaje…" },
  "Escreva uma nota interna… (só o time vê)": {
    es: "Escribí una nota interna… (solo la ve el equipo)",
  },
  Enviar: { es: "Enviar" },
  "Enviar modelo": { es: "Enviar plantilla" },
  "Escolha um modelo aprovado…": { es: "Elegí una plantilla aprobada…" },

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

  // ─── Agenda (módulo inteiro: grade, marcação, histórico, tipos, Google) ───
  //
  // A Agenda nasceu depois do inventário de telas que guiou a tradução do resto
  // do produto, então nunca teve uma linha aqui: ~3.500 linhas de tela em
  // português, com o item já visível na barra lateral.
  //
  // Os CATÁLOGOS fechados que ela lê (`ROTULO_DA_SITUACAO` em lib/agenda/tipos.ts,
  // `DESFECHOS` do retorno do OAuth, as categorias de tipo de agendamento) são
  // traduzidos no ponto de render — os módulos não mudam, mesma fronteira dos
  // outros vocabulários deste arquivo.
  //
  // ⚠️ VOZ: tuteo, que é o padrão decidido para o espanhol deste produto. Três
  // entradas do composer logo acima ainda estão em voseo ("Escribí", "Elegí");
  // elas NÃO são corrigidas aqui de propósito — o conserto já existe no ramo de
  // i18n e mexer nas mesmas linhas por dois lados só produziria conflito.
  "O que está marcado, com quem, e quem atende — seu e da equipe.": { es: "Lo que está agendado, con quién, y quién atiende — tuyo y del equipo." },
  "Hoje": { es: "Hoy" },
  "Cadastre um tipo de agendamento para começar": { es: "Crea un tipo de cita para empezar" },
  "Novo agendamento": { es: "Nueva cita" },
  "Próximo período": { es: "Período siguiente" },
  "Remarcar agendamento": { es: "Reagendar cita" },
  "Tipo de agendamento": { es: "Tipo de cita" },
  "Cancelar agendamento": { es: "Cancelar cita" },
  "Este agendamento não está mais na lista.": { es: "Esta cita ya no está en la lista." },
  "Por que está cancelando?": { es: "¿Por qué la cancelas?" },
  "O paciente pediu para remarcar por telefone": { es: "El paciente pidió reagendar por teléfono" },
  "Agendamento": { es: "Cita" },
  "d 'de' MMMM 'às' HH:mm": { es: "d 'de' MMMM 'a las' HH:mm" },
  "EEEE, d 'de' MMMM 'às' HH:mm": { es: "EEEE, d 'de' MMMM 'a las' HH:mm" },
  "Conectar de novo": { es: "Conectar de nuevo" },
  "Fechar aviso": { es: "Cerrar aviso" },
  "Sincronizar com o Google ainda não está disponível": { es: "Sincronizar con Google todavía no está disponible" },
  "Falta cadastrar o aplicativo do Google desta instalação. Leva um minuto e você faz por aqui mesmo.": { es: "Falta registrar la aplicación de Google de esta instalación. Toma un minuto y lo haces desde aquí mismo." },
  "Esta instalação não tem as credenciais do Google cadastradas — não é nada que você tenha feito. Quem instalou o sistema precisa configurar": { es: "Esta instalación no tiene las credenciales de Google registradas — no es nada que hayas hecho. Quien instaló el sistema debe configurar" },
  // A conjunção da lista de credenciais que faltam ("client_id e client_secret").
  // Estado vazio da Agenda (components/empty/variants.tsx, via EmptyState).
  "Sua agenda está livre esta semana": { es: "Tu agenda está libre esta semana" },
  "Agendamentos aparecem aqui quando alguém marca pela tela, quando o agente marca por você, ou quando chegam da agenda do Google conectada.":
    {
      es: "Las citas aparecen aquí cuando alguien agenda desde la pantalla, cuando el agente agenda por ti, o cuando llegan de la agenda de Google conectada.",
    },
  "e": { es: "y" },
  "as credenciais": { es: "las credenciales" },
  "Cadastrar as credenciais do Google": { es: "Registrar las credenciales de Google" },
  "E, no console do Google, registrar este endereço de retorno —": { es: "Y, en la consola de Google, registrar esta dirección de retorno —" },
  "exatamente assim": { es: "exactamente así" },
  "Até lá a agenda funciona normalmente, só não troca compromissos com o Google.": { es: "Mientras tanto la agenda funciona normalmente, solo que no intercambia citas con Google." },
  "Conecte sua agenda do Google para ver aqui o que já está marcado lá — e enviar para lá o que for marcado aqui.": { es: "Conecta tu agenda de Google para ver aquí lo que ya está agendado allá — y enviar allá lo que se agende aquí." },
  "Agenda do Google conectada.": { es: "Agenda de Google conectada." },
  "Os compromissos que já estão lá aparecem aqui, e o que você marcar vai para lá.": { es: "Las citas que ya están allá aparecen aquí, y lo que agendes va para allá." },
  "Você cancelou a conexão.": { es: "Cancelaste la conexión." },
  "Nada mudou. Quando quiser, é só conectar de novo.": { es: "No cambió nada. Cuando quieras, solo conecta de nuevo." },
  "Esta instalação ainda não tem a conexão com o Google configurada": { es: "Esta instalación todavía no tiene configurada la conexión con Google" },
  "Não consegui guardar a conexão com segurança": { es: "No pude guardar la conexión de forma segura" },
  "A conexão demorou demais e expirou": { es: "La conexión tardó demasiado y expiró" },
  "Isso acontece quando a página fica aberta muito tempo. Conectar de novo resolve.": { es: "Esto pasa cuando la página queda abierta mucho tiempo. Conectar de nuevo lo resuelve." },
  "O Google devolveu uma resposta incompleta": { es: "Google devolvió una respuesta incompleta" },
  "Não deu para concluir a conexão. Tentar de novo costuma resolver.": { es: "No se pudo concluir la conexión. Intentar de nuevo suele resolverlo." },
  "O Google não confirmou a conexão": { es: "Google no confirmó la conexión" },
  "Não consegui ler os dados da conta do Google": { es: "No pude leer los datos de la cuenta de Google" },
  "A conexão foi autorizada, mas o Google não respondeu quem é a conta. Tente de novo.": { es: "La conexión fue autorizada, pero Google no respondió de qué cuenta se trata. Intenta de nuevo." },
  "A conexão funcionou, mas não consegui salvar": { es: "La conexión funcionó, pero no pude guardarla" },
  "Faltou permissão para ler e escrever na sua agenda": { es: "Faltó permiso para leer y escribir en tu agenda" },
  "Na tela do Google, algumas permissões ficaram desmarcadas. Sem elas eu não consigo ver seus horários ocupados nem enviar os agendamentos. Conecte de novo e mantenha as caixas marcadas.": { es: "En la pantalla de Google, algunos permisos quedaron sin marcar. Sin ellos no puedo ver tus horarios ocupados ni enviar las citas. Conecta de nuevo y deja las casillas marcadas." },
  "Não consegui conectar sua agenda do Google": { es: "No pude conectar tu agenda de Google" },
  "O resto da agenda continua funcionando normalmente. Tentar de novo costuma resolver.": { es: "El resto de la agenda sigue funcionando normalmente. Intentar de nuevo suele resolverlo." },
  "Tipo de agendamento criado.": { es: "Tipo de cita creado." },
  "Retorno": { es: "Seguimiento" },
  "Categoria": { es: "Categoría" },
  "Duração (minutos)": { es: "Duración (minutos)" },
  "Onde acontece": { es: "Dónde ocurre" },
  "Definir depois": { es: "Definir después" },
  "Criando…": { es: "Creando…" },
  "Criar tipo": { es: "Crear tipo" },
  "Novo tipo de agendamento": { es: "Nuevo tipo de cita" },
  "sem responsável — definir quem atende": { es: "sin responsable — define quién atiende" },
  "sem responsável — não aparece para marcar": { es: "sin responsable — no aparece para agendar" },
  "desativado": { es: "desactivado" },
  "Salvando…": { es: "Guardando…" },
  "Procedimento": { es: "Procedimiento" },
  "Vistoria": { es: "Inspección" },
  "Reunião": { es: "Reunión" },
  "Orçamento": { es: "Presupuesto" },
  "Demonstração": { es: "Demostración" },
  "Outro": { es: "Otro" },
  "Mostrar todos (agora só": { es: "Mostrar todos (ahora solo" },
  "Ver só a agenda de": { es: "Ver solo la agenda de" },
  "às": { es: "a las" },
  "com": { es: "con" },
  "ocupado na agenda do Google": { es: "ocupado en la agenda de Google" },
  "Dia": { es: "Día" },
  "Mês": { es: "Mes" },
  "Filtrar o histórico": { es: "Filtrar el historial" },
  "Próximos": { es: "Próximas" },
  "Aguardando confirmação": { es: "Esperando confirmación" },
  "Passados": { es: "Pasadas" },
  "Cancelados": { es: "Canceladas" },
  "Nada marcado daqui para a frente.": { es: "Nada agendado de aquí en adelante." },
  "Ninguém esperando confirmação.": { es: "Nadie esperando confirmación." },
  "Ainda não há atendimentos concluídos.": { es: "Todavía no hay atenciones concluidas." },
  "Nenhum cancelamento.": { es: "Ninguna cancelación." },
  "Disponível quando a agenda estiver conectada": { es: "Disponible cuando la agenda esté conectada" },
  "Remarcar": { es: "Reagendar" },
  "Realizado": { es: "Realizada" },
  "Faltou": { es: "No asistió" },
  "Confirmado": { es: "Confirmada" },
  "Cancelado": { es: "Cancelada" },
  "Não compareceu": { es: "No se presentó" },
  "fora deste mês": { es: "fuera de este mes" },
  "você ainda não publicou seus horários": { es: "todavía no publicaste tus horarios" },
  "não consegui carregar os horários": { es: "no pude cargar los horarios" },
  "nenhum horário livre neste dia": { es: "ningún horario libre en este día" },
  "Marcado.": { es: "Agendado." },
  "Sem lembrete automático —": { es: "Sin recordatorio automático —" },
  "pediu para não receber mensagens.": { es: "pidió no recibir mensajes." },
  "Marcar outro": { es: "Agendar otro" },
  "Ver na agenda": { es: "Ver en la agenda" },
  "Mês anterior": { es: "Mes anterior" },
  "Próximo mês": { es: "Mes siguiente" },
  "Configurar meus horários de atendimento": { es: "Configurar mis horarios de atención" },
  "Não consegui carregar os horários": { es: "No pude cargar los horarios" },
  "Os dias ficam bloqueados até eu conseguir — é mais seguro que oferecer um horário que talvez não exista. Numa instalação nova, isso costuma ser a jornada de atendimento que ainda não foi publicada.": { es: "Los días quedan bloqueados hasta que lo logre — es más seguro que ofrecer un horario que quizá no exista. En una instalación nueva, suele ser la jornada de atención que todavía no se publicó." },
  "Nenhum horário livre em": { es: "Ningún horario libre en" },
  "Os próximos 30 dias são o que está publicado hoje — meses adiante aparecem conforme a data se aproxima.": { es: "Los próximos 30 días son lo que está publicado hoy — los meses siguientes aparecen conforme se acerca la fecha." },
  "horários": { es: "horarios" },
  "O lembrete não será enviado — combine por telefone.": { es: "El recordatorio no se enviará — acuerden por teléfono." },
  "Carregando a agenda": { es: "Cargando la agenda" },
  "Não consegui carregar a agenda": { es: "No pude cargar la agenda" },
  "Tentar de novo": { es: "Intentar de nuevo" },
  "Você": { es: "Tú" },
  "(sem texto)": { es: "(sin texto)" },
  "Cancelar resposta": { es: "Cancelar respuesta" },
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
