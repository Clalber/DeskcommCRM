// `OutboundMedia` é reusado, não redefinido: um segundo tipo com os mesmos 4
// campos diverge em silêncio na primeira vez que um lado ganhar um campo. Só o
// TIPO atravessa (`import type` some na compilação) — o seam não carrega código
// do provider. Quando a Fase 3 absorver `lib/waha/`, este é o único ponteiro a
// mudar de casa.
import type { SendMessageInput } from "@/lib/schemas";
import type { FetchedMedia } from "@/lib/messaging/media/types";
import type { OutboundMedia } from "@/lib/waha/media-send";

export type { OutboundMedia };

export type ChannelProvider = "waha" | "meta_cloud" | "zernio" | "meta_instagram";

/**
 * O que existe, fora da janela, para voltar a falar com quem parou de responder.
 *
 * Existe porque os três primeiros canais eram todos WhatsApp, e no WhatsApp a
 * resposta é sempre a MESMA: template aprovado. O gate de janela chegou a
 * hardcodar essa saída na `reason` do veto — instruindo o modelo a chamar
 * `send_template`. Num canal sem template isso é uma instrução impossível.
 *
 * Não é `requiresTemplates` invertido, e é por isso que é um campo próprio:
 * `requiresTemplates` diz o que a PLATAFORMA hospeda; este diz o que RESTA
 * fazer quando a janela fecha — e as duas respostas divergem justamente no
 * canal que motivou o campo.
 *
 * - `template`       — existe forma aprovada de reabrir. Mudar a mensagem resolve.
 * - `agente_humano`  — não há forma de mensagem que resolva; só uma PESSOA pode
 *                      responder, sob permissão própria da plataforma. O agente
 *                      de IA não tem saída: o caminho é escalar.
 * - `sem_janela`     — o canal não tem janela; a pergunta não se aplica.
 *
 * Invariante 2 da doutrina (`docs/doctrine/restricao-de-canal.md`): capability
 * não é booleano solto — ela diz de que família é, porque isso decide o que
 * fazer quando ela barra.
 */
export type MecanismoDeReengajamento = "template" | "agente_humano" | "sem_janela";

export interface ChannelCapabilities {
  /** Pode enviar texto livre a qualquer momento? false = exige template fora da janela. */
  freeformOutsideWindow: boolean;
  /**
   * O que resta fazer quando a janela fecha. Ver `MecanismoDeReengajamento`.
   *
   * Quem lê isto NÃO deve derivá-lo de `freeformOutsideWindow` nem de
   * `requiresTemplates`: a combinação `freeformOutsideWindow: false` +
   * `requiresTemplates: false` é real (Instagram) e nenhuma das duas sozinha
   * distingue "use template" de "chame uma pessoa".
   */
  reengajamento: MecanismoDeReengajamento;
  /** A plataforma hospeda definições de mensagem que precisam de aprovação prévia. */
  requiresTemplates: boolean;
  /**
   * O canal permite CRIAR e EDITAR essas definições pela API — ou só lê as que
   * já existem?
   *
   * Distinta de `requiresTemplates`, e a diferença não é sutil: um canal pode
   * exigir template (e portanto travar o envio fora da janela) e ainda assim
   * não deixar ninguém criar um sem entrar no painel da plataforma. Quem só lê
   * precisa mandar o operador para fora do CRM; quem escreve não. É a pergunta
   * que a tela faz para decidir se mostra o botão "criar", e sem ela a tela
   * teria que perguntar QUAL canal é — que é o que o invariante 1 proíbe.
   */
  canManageTemplates: boolean;
  /** Há risco de banimento por volume/padrão → arma throttle, warm-up e cap. */
  banRisk: boolean;
  /** Intervalo mínimo imposto PELA PLATAFORMA entre msgs ao mesmo destinatário (ms). */
  minIntervalMs: number | null;
  /** 'server-convert' = o canal converte áudio; 'opus-only' = precisamos entregar ogg/opus. */
  voiceNote: "server-convert" | "opus-only";
  groups: "full" | "limited" | "none";
  /** Mensagem entregue gera custo → decisões de envio precisam considerar orçamento. */
  costPerMessage: boolean;
}

/**
 * O vocabulário de tipo de mensagem de saída tem UMA fonte: o schema de entrada
 * da API. A Task 3 escreveu aqui uma lista à mão de 5 valores, mas o handler
 * passa `input.type`, que tem 8 (`document`, `sticker`, `location`, `contact`
 * também chegam) — a lista curta não compilava contra o chamador real. Derivar
 * evita a divergência silenciosa na próxima vez que o schema crescer.
 */
export type OutboundKind = SendMessageInput["type"];

/** O que o CRM sabe sobre o destinatário. Quem traduz para o endereço do canal é o adapter. */
export interface RecipientInput {
  isGroup: boolean;
  groupChatId: string | null;
  phoneNumber: string | null | undefined;
  /** `contacts.wa_identity` (migration 0027): 'phone:+E164' | 'lid:<digits>' | null. */
  waIdentity: string | null | undefined;
  /**
   * `contacts.wa_lid` (0122). Separado de `waIdentity` porque esta é GERADA com
   * o telefone na frente: contato @lid que ganha número deixa de casar em
   * `waIdentity.startsWith("lid:")` — justo o caso que a regra protege.
   */
  waLid?: string | null | undefined;
  /**
   * O id que o PROVIDER dá a esta pessoa NESTA sessão de canal
   * (`channel_contact_identities.provider_user_id`, migration 0202).
   *
   * Existe para os canais que endereçam por id opaco em vez de telefone. Ele é
   * ESCOPADO À SESSÃO, e não ao contato, por uma razão que custou uma tabela
   * inteira para ser respeitada: a mesma pessoa falando com duas contas da
   * mesma organização tem DOIS ids, e ids de contas diferentes não são
   * comparáveis. Resolver por contato mandaria a resposta pela conta errada —
   * e mensagem que sai errada não volta.
   *
   * Não confundir com `OutboundEnvelope.providerConversationId`, que é a
   * THREAD. Aqui é a PESSOA.
   *
   * `undefined` = o chamador não resolveu identidade para esta sessão; o
   * adapter que precisa dela devolve `null` em `resolveRecipient`.
   */
  providerUserId?: string | null | undefined;
}

/** Contato compartilhado (vcard) — só `kind: "contact"`. */
export interface OutboundContact {
  fullName: string;
  phoneNumber: string;
  whatsappId: string;
  vcard: string;
}

/**
 * A organização em nome de quem a operação de canal acontece.
 *
 * Existe porque `sessionRef` sozinho NÃO identifica uma linha: ele é um
 * identificador do PROVIDER (número da Cloud API, conta do intermediado), e nada
 * impedia duas organizações de terem o mesmo. Quem resolvia credencial por ele
 * fazia `.eq("<ref>", ...)` num client de service role — que bypassa RLS — e o
 * `maybeSingle()` com duas linhas devolve `data: null` **com erro**
 * (`PGRST116`), não a linha errada. Como o erro era descartado, o desfecho era o
 * fallback do env: a mensagem saía pela conta do `.env`, não pela da organização
 * (issue #236).
 *
 * O campo é OBRIGATÓRIO de propósito. Opcional deixaria o chamador esquecê-lo em
 * silêncio, que é exatamente a classe de defeito que ele fecha — assim o
 * typecheck cobra em todo call site.
 *
 * O valor vem de FONTE CONFIÁVEL (sessão do cookie, linha já escopada, token do
 * webhook), **nunca do corpo** de um payload externo.
 */
export interface ChannelTenantScope {
  organizationId: string;
}

export interface OutboundEnvelope extends ChannelTenantScope {
  /** Identificador da sessão/número no provider (WAHA: nome da sessão). */
  sessionRef: string;
  /**
   * Quem está falando: a IA ou uma pessoa. Mesmo vocabulário da coluna
   * `messages.sent_via`, que o handler deriva de `ctx.actor.type`.
   *
   * Existe porque há canal cuja permissão de reengajamento fora da janela é
   * EXCLUSIVA de atendimento humano; aplicá-la a um turno de IA afirmaria à
   * plataforma algo que não é verdade.
   *
   * OPCIONAL, e a ausência tem leitura segura: quem não sabe quem fala trata
   * como IA e NÃO reivindica atendimento humano. Errar para este lado atrasa
   * uma mensagem; errar para o outro faz uma declaração falsa à plataforma, no
   * app de um cliente, sob revisão dela.
   *
   * Foi obrigatório numa primeira versão, citando o precedente de
   * `ChannelTenantScope` acima. O precedente não se aplica: `organizationId` é
   * LIDO pelos adapters e não tem default seguro, enquanto este campo ainda não
   * tem leitor nenhum e tem. A obrigatoriedade custou 27 linhas em quatro
   * arquivos de teste que não exercitam distinção alguma.
   */
  sentVia?: "ai" | "user";
  /** Endereço já resolvido por `resolveRecipient`. */
  to: string;
  kind: OutboundKind;
  body?: string;
  media?: OutboundMedia;
  /** Cartão de contato — preenchido quando `kind === "contact"`. */
  contact?: OutboundContact;
  /**
   * Id que o PROVIDER dá a esta thread, quando ele endereça por thread própria
   * em vez de por telefone (`conversations.provider_conversation_id`).
   *
   * OPCIONAL porque a maioria dos canais não precisa: quem deriva o
   * destinatário do contato (chatId, E.164) ignora este campo, e os adapters
   * existentes não mudam uma linha por causa dele.
   *
   * Existe porque `resolveRecipient` recebe o CONTATO, e há provider cujo
   * endereço não sai do contato: é um id que ele mesmo inventa e entrega pelo
   * webhook. Sem carregá-lo aqui, o adapter teria que ir ao banco buscá-lo — e
   * adapter que consulta banco deixa de ser tradutor de formato, que é a única
   * coisa que `docs/doctrine/restricao-de-canal.md` permite que ele seja.
   *
   * `undefined` = não há id conhecido para esta thread. Não é erro: é o estado
   * normal antes do primeiro contato, e o adapter que precisa dele decide o que
   * fazer (tipicamente, abrir a conversa com template).
   */
  providerConversationId?: string | null;
  /**
   * A mensagem que ESTA responde, pelo id que o PROVIDER conhece.
   *
   * É o `external_id` da linha citada (para WhatsApp, o `wamid`) — não o `id`
   * da nossa tabela, que o provider nunca viu. Quem monta o envelope resolve
   * essa tradução; o adapter só repassa.
   *
   * OPCIONAL, e canal que não sabe citar simplesmente ignora: a citação é
   * enfeite da conversa, nunca condição de envio. Um canal recusar a mensagem
   * inteira porque não sabe citar seria trocar a mensagem pelo enfeite.
   *
   * `undefined` = envio solto, que é o caso comum.
   */
  replyToExternalId?: string | null;
}

/**
 * O tradutor de formato de UM canal — e nada mais.
 *
 * Adapter NÃO decide se pode enviar: janela de 24h, cap diário, horário
 * comercial, retry e throttle são da cadeia `before_send`. Um `if` de negócio
 * aqui dentro é o defeito que `docs/doctrine/restricao-de-canal.md` existe para
 * evitar — quem quiser saber o que o canal permite pergunta a `capabilitiesOf`.
 */
export interface ChannelAdapter {
  provider: ChannelProvider;
  /** null = não há endereço possível para este contato neste canal. */
  resolveRecipient(input: RecipientInput): string | null;
  /**
   * O canal tem credencial para enviar? Perguntado ANTES de `send` porque
   * `{externalId: null}` colapsa "não tentei" com "tentei e a resposta não
   * trouxe id" — desfechos que o chamador grava de forma diferente.
   */
  isConfigured(): boolean;
  /** externalId null = canal não configurado (noop) ou resposta sem id reconhecível. */
  send(envelope: OutboundEnvelope): Promise<{ externalId: string | null }>;
  /**
   * Códigos que o chamador grava em `metadata`/`error_code`. Vivem NO ADAPTER
   * porque carregam nome de provider, e o lint da Task 7 proíbe esse nome fora
   * de `lib/channels/`. Quem chama escreve o que o adapter disser.
   */
  readonly codes: { notConfigured: string; sendFailed: string; unknownError: string };

  /**
   * URL da foto de perfil do contato, ou null quando não há (sem foto,
   * privacidade fechada, canal fora do ar).
   *
   * OPCIONAL de propósito: nem todo canal expõe isso. Quem chama testa a
   * presença do método antes de usar, em vez de perguntar QUAL provider é —
   * que é justamente o que o lint de canal proíbe fora daqui.
   *
   * A URL devolvida costuma ser ASSINADA E TEMPORÁRIA (no WhatsApp, ~9 dias
   * medidos). Quem chama deve BAIXAR e persistir, nunca guardar a URL.
   */
  fetchProfilePictureUrl?(input: ChannelTenantScope & {
    sessionRef: string;
    recipient: string;
  }): Promise<string | null>;

  /**
   * Todas as formas sob as quais ESTE canal pode ter registrado a MESMA mensagem
   * que acabou de ser enviada — para reconhecer o eco do próprio envio quando ele
   * volta pelo webhook.
   *
   * Existe porque alguns canais são assimétricos: a resposta do envio e o
   * webhook do eco trazem pontas diferentes do mesmo identificador, e comparar
   * as duas strings direto nunca casa. Que formas são essas é conhecimento do
   * canal, não de quem envia — por isso mora aqui e não no handler, que é
   * justamente o que o lint de canal impede.
   *
   * OPCIONAL: um canal simétrico (mesmo id nos dois lados) não implementa, e
   * quem chama cai no próprio `externalId`.
   */
  echoExternalIds?(input: { externalId: string; recipient: string }): string[];

  /**
   * O telefone por trás de um identificador opaco, quando o canal souber.
   *
   * OPCIONAL: nem todo canal tem identidade opaca, e nem todo que tem sabe
   * traduzir. `null` significa "ainda não sei" — não "não existe" —, então quem
   * chama pode tentar de novo depois sem tratar como erro.
   *
   * Existe porque um contato identificado só por id opaco fica sem número na
   * tela, e o atendente não sabe para quem está falando. Quem pergunta não
   * precisa saber QUAL canal traduz: testa a presença do método.
   */
  resolvePhoneForIdentity?(
    input: ChannelTenantScope & { sessionRef: string; identity: string },
  ): Promise<string | null>;

  /**
   * Gestão das definições aprovadas — criar, editar, apagar.
   *
   * OPCIONAL pelo mesmo motivo dos dois métodos acima: nem todo canal expõe
   * isso, e quem chama testa a presença em vez de perguntar QUAL provider é.
   * A capability `canManageTemplates` é a resposta declarativa da mesma
   * pergunta, para quem precisa decidir ANTES de ter um adapter em mãos (uma
   * tela, por exemplo).
   *
   * O adapter continua burro: traduz formato e devolve o que a plataforma
   * disse. Ele NÃO decide se um template é válido, não espelha no banco e não
   * conhece `contract_hash` — isso é de quem sincroniza.
   */
  templates?: ChannelTemplateOps;

  /**
   * A conexão está de pé AGORA? Pergunta feita ao transporte, não ao banco.
   *
   * Existe porque o banco guarda o último estado que alguém CONTOU, e a falha
   * que mais dói é justamente a que ninguém conta: o transporte cai, para de
   * mandar evento, e a coluna segue dizendo `WORKING` para sempre. Silêncio e
   * saúde ficam idênticos — foi assim que uma desconexão real passou horas
   * despercebida, descoberta só quando o dono foi olhar por conta própria.
   *
   * `reachable: false` NÃO é o mesmo que o canal estar desconectado: significa
   * que não deu para perguntar (transporte fora do ar, rede caída). A diferença
   * importa porque a ação é outra — reiniciar o serviço, não escanear um QR — e
   * porque sobrescrever o status com um erro de rede transitório trocaria uma
   * informação boa por ruído.
   *
   * OPCIONAL como os demais: canal sem sessão para consultar não implementa, e
   * quem chama testa a presença em vez de perguntar QUAL provider é.
   */
  checkHealth?(input: ChannelTenantScope & { sessionRef: string }): Promise<ChannelHealth>;

  /**
   * Envia uma DEFINIÇÃO APROVADA — o único caminho de volta quando a janela de
   * 24h fechou.
   *
   * Existe porque o envio de template não passava pelo seam: `_handler.ts`
   * desviava `type:'template'` para uma função que lê `META_PHONE_NUMBER_ID` e
   * `META_SYSTEM_USER_TOKEN` do ambiente e fala com a Graph API. Medido: com os
   * três canais configurados, template de QUALQUER um saía pelo número da Meta,
   * com o token da Meta. Para o canal intermediado isso não é "falha de envio":
   * é a mensagem saindo pelo número ERRADO, para o cliente certo.
   *
   * `providerConversationId` vem junto porque alguns canais abrem a conversa e
   * mandam o template no MESMO pedido quando ainda não há thread — e reaproveitam
   * a thread quando já há.
   *
   * OPCIONAL como os demais: quem não implementa continua pelo caminho antigo,
   * e quem chama testa a presença em vez de perguntar QUAL provider é.
   */
  /**
   * Baixa a mídia que o cliente MANDOU, para persistir os bytes.
   *
   * Existe porque `workers/media-persist-worker.ts` chamava `fetchWahaMedia`
   * fixo: a mídia recebida por qualquer outro canal era gravada como linha SEM
   * bytes, e o atendente via "imagem" sem imagem. Medido em produção: 423
   * persistências no canal por QR, ZERO no intermediado.
   *
   * O worker não pode perguntar QUAL canal é — o invariante 1 proíbe, e o
   * `lint:channels` reprova. Ele pede o adapter e chama isto.
   *
   * A URL é ponteiro para algo que EXPIRA e quase nunca é pública: um canal
   * assina com Bearer, outro resolve host próprio. O que cada um faz é
   * conhecimento do canal, não de quem persiste.
   *
   * OPCIONAL: canal sem mídia de entrada não implementa, e quem chama testa a
   * presença em vez de perguntar quem é.
   */
  fetchInboundMedia?(input: ChannelTenantScope & {
    sessionRef: string;
    /** A URL como o provider a anunciou. Cada canal sabe o que fazer com ela. */
    url: string;
    /** Mime declarado no webhook, quando houve. Dica, não verdade. */
    hintMime?: string | null;
  }): Promise<FetchedMedia>;

  sendTemplate?(input: ChannelTenantScope & {
    sessionRef: string;
    to: string;
    providerConversationId?: string | null;
    name: string;
    language: string;
    /** Valores dos `{{n}}`, na ordem em que a definição os declara. */
    values: Record<string, string>;
  }): Promise<{ externalId: string | null }>;

  /**
   * Mostra (ou tira) o "digitando…" na conversa de quem está do outro lado.
   *
   * `typing: true` liga; `false` desliga. O retorno diz se o canal ACEITOU o
   * sinal — não se o cliente viu.
   *
   * ─── Efêmero por natureza, e o contrato assume isso ────────────────────────
   *
   * Nenhum canal mantém o indicador aceso indefinidamente: ele expira sozinho em
   * segundos. Quem quer que ele dure renova, e quem renova é o chamador — o
   * adapter é disparo único, como todo o resto desta interface.
   *
   * ─── Nunca REJEITA ────────────────────────────────────────────────────────
   *
   * `Promise<boolean>` e não `Promise<void>` que lança, ao contrário de `send`.
   * A diferença é de consequência: uma falha de envio precisa virar status na
   * tela e retentativa; uma falha de presença não precisa virar nada. Se este
   * método pudesse rejeitar, um `await` sem `try` no meio de uma cadeia de envio
   * derrubaria a mensagem por causa do enfeite.
   *
   * OPCIONAL como os demais: canal que não sabe sinalizar simplesmente não
   * implementa, e quem chama testa a presença do método em vez de perguntar QUAL
   * provider é — que é o que o invariante 1 da doutrina proíbe.
   */
  setTyping?(input: ChannelTenantScope & {
    sessionRef: string;
    /** Endereço já resolvido por `resolveRecipient`. */
    recipient: string;
    typing: boolean;
  }): Promise<boolean>;
}

/** O que o transporte respondeu quando perguntamos se está de pé. */
export interface ChannelHealth {
  /** Deu para perguntar? `false` = transporte inalcançável, não canal caído. */
  reachable: boolean;
  /** Estado relatado pelo transporte; `null` quando não deu para perguntar. */
  status: string | null;
  /** Detalhe do erro, para o corpo do aviso. Nunca credencial. */
  detail: string | null;
}

/** Definição aprovada, na forma NEUTRA — sem o vocabulário de nenhum provider. */
export interface ChannelTemplate {
  name: string;
  language: string;
  /** Vocabulário ABERTO: a plataforma cria estado novo sem avisar. */
  status: string;
  category: string | null;
  /** Payload cru como a plataforma o devolveu — a entrada de quem deriva contrato. */
  components: unknown[];
  rejectedReason?: string | null;
  parameterFormat?: string | null;
}

export interface ChannelTemplateDraft {
  name: string;
  language: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  components: unknown[];
  parameterFormat?: "POSITIONAL" | "NAMED";
}

export interface ChannelTemplateOps {
  list(input: ChannelTenantScope & { sessionRef: string }): Promise<ChannelTemplate[]>;
  create(
    input: ChannelTenantScope & { sessionRef: string; draft: ChannelTemplateDraft },
  ): Promise<ChannelTemplate>;
  /**
   * Edição é PARCIAL e limitada pela plataforma: nome, idioma e categoria de um
   * template já aprovado normalmente não mudam — o que se edita é o corpo, e a
   * edição joga o template de volta para revisão. Quem chama não precisa saber
   * disso; a plataforma recusa e o erro sobe com o código dela.
   */
  update(input: ChannelTenantScope & {
    sessionRef: string;
    name: string;
    patch: Partial<Pick<ChannelTemplateDraft, "components" | "category">>;
  }): Promise<ChannelTemplate>;
  remove(
    input: ChannelTenantScope & { sessionRef: string; name: string; language?: string },
  ): Promise<void>;
}
