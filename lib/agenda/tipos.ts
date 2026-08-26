/**
 * O VOCABULÁRIO DA AGENDA — uma lista por conceito, e o banco espelha esta.
 *
 * Cada constante abaixo é a fonte do CHECK correspondente na migration 0176.
 * O emissor usa a CONSTANTE, nunca a string literal: é assim que um valor novo
 * chega ao banco e ao TypeScript no mesmo commit, e é o que
 * `tests/invariants/agenda-vocabulario.test.ts` mede.
 *
 * ⚠️ A FORMA destas declarações não é estilo, é requisito de instrumento.
 * O extrator que lê vocabulário de TypeScript (o de
 * `tests/invariants/vocabulario-banco-x-typescript.test.ts`, que o nosso imita)
 * reconhece exatamente duas formas: `type X = "a" | "b";` e
 * `const X = ["a","b"] as const`. Ele para no primeiro `]`, então uma lista de
 * OBJETOS — que seria o jeito natural de casar valor com rótulo — é ilegível
 * para ele. Daí a separação: a lista de CÓDIGOS é crua, e o rótulo em pt-br
 * mora num `Record` à parte, cuja exaustividade quem cobra é o compilador.
 */

/**
 * O que esta organização marca. Espelha os nichos que o onboarding já usa
 * (`lib/onboarding/pacotes-de-funil.ts`): clínica, imobiliária, serviços,
 * curso, loja, genérico.
 */
export const CATEGORIAS_DE_AGENDAMENTO = [
  "consulta",
  "procedimento",
  "retorno",
  "visita",
  "vistoria",
  "reuniao",
  "call",
  "orcamento",
  "demonstracao",
  "outro",
] as const;
export type CategoriaDeAgendamento = (typeof CATEGORIAS_DE_AGENDAMENTO)[number];

export const ROTULO_DA_CATEGORIA: Record<CategoriaDeAgendamento, string> = {
  consulta: "Consulta",
  procedimento: "Procedimento",
  retorno: "Retorno",
  visita: "Visita",
  vistoria: "Vistoria",
  reuniao: "Reunião",
  call: "Call",
  orcamento: "Orçamento",
  demonstracao: "Demonstração",
  outro: "Outro",
};

/** Onde o compromisso acontece — e é isto que decide o que a tela pergunta. */
export const LOCAIS_DE_AGENDAMENTO = [
  "in_person",
  "phone",
  "whatsapp",
  "video_link",
  "google_meet",
] as const;
export type LocalDeAgendamento = (typeof LOCAIS_DE_AGENDAMENTO)[number];

export const ROTULO_DO_LOCAL: Record<LocalDeAgendamento, string> = {
  in_person: "Presencial",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  video_link: "Link de vídeo",
  google_meet: "Google Meet",
};

/** O que cada local exige que a pessoa preencha ao marcar. */
export const CAMPO_EXIGIDO_PELO_LOCAL: Record<LocalDeAgendamento, "endereco" | "url" | null> = {
  in_person: "endereco",
  phone: null,
  whatsapp: null,
  video_link: "url",
  google_meet: null,
};

/**
 * O estado do compromisso, na língua de quem usa.
 *
 * `no_show` é o único termo que não tem tradução curta em pt-br e por isso o
 * rótulo abaixo diz "Não compareceu" — a tela nunca mostra o código.
 */
export const SITUACOES_DO_AGENDAMENTO = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;
export type SituacaoDoAgendamento = (typeof SITUACOES_DO_AGENDAMENTO)[number];

export const ROTULO_DA_SITUACAO: Record<SituacaoDoAgendamento, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Realizado",
  no_show: "Não compareceu",
};

/**
 * As duas situações em que o compromisso ainda está DE PÉ.
 *
 * É a lista que responde "este lead tem consulta marcada?" — a pergunta que o
 * motor de follow-up e o Radar de Risco fazem antes de cobrar alguém, e que o
 * índice parcial `calendar_appointments_org_vivos_idx` serve. Cobrar "ainda
 * tem interesse?" de quem marcou para amanhã é o tipo de erro que faz
 * desinstalar o produto.
 */
export const SITUACOES_VIVAS: readonly SituacaoDoAgendamento[] = ["pending", "confirmed"];

/**
 * Quem marcou.
 *
 * Os valores seguem `crm_lead_activities.actor_kind` e NÃO o par
 * `human`/`agent` que a outra convenção do repo usa, porque é na timeline do
 * lead que esta autoria aparece na tela: gravar `human` aqui e `user` lá faria
 * a tela mostrar duas palavras para a mesma pessoa. `sync` é o único
 * acréscimo, e não é ator do produto — significa que a linha nasceu de um
 * evento que já existia na agenda externa.
 */
export const AUTORES_DO_AGENDAMENTO = ["user", "ai", "system", "contact", "sync"] as const;
export type AutorDoAgendamento = (typeof AUTORES_DO_AGENDAMENTO)[number];

export const ROTULO_DO_AUTOR: Record<AutorDoAgendamento, string> = {
  user: "Marcado pela equipe",
  ai: "Marcado pelo atendente de IA",
  system: "Marcado pelo sistema",
  contact: "Marcado pelo próprio cliente",
  sync: "Veio da agenda conectada",
};

/** Por qual porta o agendamento entrou. */
export const ORIGENS_DO_AGENDAMENTO = ["ui", "mcp", "google_sync", "public_page"] as const;
export type OrigemDoAgendamento = (typeof ORIGENS_DO_AGENDAMENTO)[number];

/**
 * O estado da agenda conectada.
 *
 * São os MESMOS sete valores de `tenant_integrations.status` — mesma pergunta,
 * mesma palavra. Não inventamos `needs_reauth`: o repo já tem `token_expired`.
 * E `rate_limited` entra porque uma API de calendário o produz o tempo todo,
 * ao contrário da integração de e-commerce que estreou este vocabulário.
 */
export const SITUACOES_DA_CONEXAO = [
  "connecting",
  "healthy",
  "token_expired",
  "scope_missing",
  "disconnected",
  "rate_limited",
  "error",
] as const;
export type SituacaoDaConexao = (typeof SITUACOES_DA_CONEXAO)[number];

export const ROTULO_DA_SITUACAO_DA_CONEXAO: Record<SituacaoDaConexao, string> = {
  connecting: "Conectando",
  healthy: "Conectada",
  token_expired: "Reconecte sua agenda",
  scope_missing: "Falta permissão de calendário",
  disconnected: "Desconectada",
  rate_limited: "O Google pediu para esperar",
  error: "Com erro",
};

/**
 * As situações em que o calendário conectado NÃO deve contar como ocupação.
 *
 * Fonte que não responde é pior que fonte nenhuma: contá-la faria a agenda
 * marcar em cima de compromisso real que ela não consegue mais enxergar.
 */
export const CONEXOES_QUE_NAO_CONTAM: readonly SituacaoDaConexao[] = [
  "token_expired",
  "scope_missing",
  "disconnected",
  "error",
];

/** Quem fornece a agenda conectada. */
export const PROVEDORES_DE_AGENDA = ["google_calendar"] as const;
export type ProvedorDeAgenda = (typeof PROVEDORES_DE_AGENDA)[number];

/** O que o Google diz sobre um evento ocupar ou não a hora. */
export const TRANSPARENCIAS_EXTERNAS = ["opaque", "transparent"] as const;
export type TransparenciaExterna = (typeof TRANSPARENCIAS_EXTERNAS)[number];

/** O estado de um evento na agenda de fora. */
export const SITUACOES_EXTERNAS = ["confirmed", "tentative", "cancelled"] as const;
export type SituacaoExterna = (typeof SITUACOES_EXTERNAS)[number];

/**
 * O vínculo do agendamento com o negócio, em `crm_lead_links`.
 *
 * `target_kind` já aceitava `'appointment'` no CHECK daquela tabela antes desta
 * feature existir. `link_kind`, ao contrário, é coluna SEM CHECK — vocabulário
 * aberto, e é por isso que ela fica fora do invariante de vocabulário, que só
 * cobre coluna que já tem CHECK. O que a prende é esta constante: quem escreve
 * o vínculo usa daqui, nunca a string solta.
 */
export const ALVO_DE_VINCULO_DO_AGENDAMENTO = "appointment" as const;
export const VINCULO_DE_AGENDAMENTO = "scheduled" as const;

/**
 * O tipo de atividade que o agendamento emite na timeline do lead.
 *
 * `crm_lead_activities.type` é vocabulário ABERTO e não tem CHECK — de
 * propósito: um clone com tipo legado quebraria no `update.sh`. O que dá
 * garantia aqui é o compilador, através da união `ActivityType` de
 * `lib/leads/activity-vocabulary.ts`.
 *
 * ⚠️ `crm_lead_activities.lead_id` é NOT NULL, então um agendamento de contato
 * que ainda não virou lead NÃO consegue emitir atividade. O produto já resolveu
 * isso uma vez: `emitAgentActivityForContact` resolve o lead ativo a partir do
 * contato e, quando não consegue rotear, grava em `event_log` em vez de perder
 * o evento. Quem emitir daqui reusa aquele caminho, não inventa um terceiro.
 */
export const ATIVIDADES_DA_AGENDA = [
  "appointment_scheduled",
  "appointment_rescheduled",
  "appointment_cancelled",
  "appointment_completed",
  "appointment_no_show",
] as const;
export type AtividadeDaAgenda = (typeof ATIVIDADES_DA_AGENDA)[number];

/**
 * A TRILHA de cor da pessoa — o número, não a cor.
 *
 * ⚠️ Aqui havia oito hex literais, e estavam errados. A cor mora em
 * `app/globals.css`, nas variáveis `--agenda-pessoa-1..8`, e cada trilha tem
 * hex DIFERENTE por tema — medido: a trilha 1 é `#ac4d40` no claro e `#f89080`
 * noutro bloco. Um hex guardado aqui (ou numa coluna do banco) seria o segundo
 * lugar para a mesma verdade, e o tema escuro ficaria de fora.
 *
 * O argumento é do @VPS, no cabeçalho de `components/agenda/paleta.ts`, e ele
 * está certo: este módulo escolhe QUAL trilha, nunca QUE cor. Quem traduz
 * trilha em cor é `corDaTrilha()`, do lado da tela, que devolve a variável CSS.
 */
export const TRILHAS_DA_AGENDA = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export type TrilhaDaAgenda = (typeof TRILHAS_DA_AGENDA)[number];

/**
 * A trilha de quem ainda não escolheu uma — estável, para a mesma pessoa não
 * trocar de cor entre um carregamento e outro.
 *
 * Deriva do `user_id` e não da posição na lista de membros, e a diferença é
 * concreta: derivar da posição faz todo mundo trocar de cor quando alguém entra
 * na equipe.
 *
 * A pessoa nasce sem trilha escolhida de propósito — ninguém deveria precisar
 * configurar cor antes de ver a própria agenda funcionando.
 */
export function trilhaPadraoDoMembro(userId: string): TrilhaDaAgenda {
  let soma = 0;
  for (let i = 0; i < userId.length; i += 1) {
    soma = (soma * 31 + userId.charCodeAt(i)) % 1_000_003;
  }
  const trilha = TRILHAS_DA_AGENDA[soma % TRILHAS_DA_AGENDA.length];
  // O índice é sempre válido (módulo do tamanho), mas o TypeScript não sabe
  // disso com `noUncheckedIndexedAccess`.
  return trilha ?? TRILHAS_DA_AGENDA[0];
}
