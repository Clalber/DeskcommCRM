/**
 * O ÚNICO lugar do sistema que pode conhecer a diferença entre os canais.
 *
 * Feature nenhuma pergunta *com quem* falamos — pergunta *o que o canal permite*
 * (invariante 1 de `docs/doctrine/restricao-de-canal.md`). Cada capability abaixo
 * nasce de uma diferença real e medida entre WAHA e Meta Cloud; capability que
 * ninguém consome é código morto, e o teste de matriz reprova.
 */
import type { ChannelCapabilities, ChannelProvider } from "./types";

export type { ChannelProvider, ChannelCapabilities };

export const CHANNEL_CAPABILITIES: Record<ChannelProvider, ChannelCapabilities> = {
  // Auto-restrição: falo quando quiser, mas o WhatsApp me bane se eu abusar.
  waha: {
    freeformOutsideWindow: true,
    // Sem janela, não há o que reengajar — a pergunta não se aplica.
    reengajamento: "sem_janela",
    requiresTemplates: false,
    // Não há WABA por trás: não existe definição aprovada para gerir.
    canManageTemplates: false,
    banRisk: true,
    minIntervalMs: null,
    voiceNote: "server-convert",
    groups: "full",
    costPerMessage: false,
  },
  // Hetero-restrição: não me banem, mas a Meta me proíbe e me cobra.
  meta_cloud: {
    freeformOutsideWindow: false,
    // Template aprovado é a saída — e o próprio `reason` do veto de janela já
    // mandava usá-lo. Aqui a instrução deixa de ser texto hardcodado e passa a
    // ser dado, para que o canal que NÃO tem template possa dizer outra coisa.
    reengajamento: "template",
    requiresTemplates: true,
    // A Graph API cria e edita definições; o repo hoje só ESPELHA, e é essa
    // lacuna que a capability torna visível em vez de deixar implícita.
    canManageTemplates: true,
    banRisk: false,
    minIntervalMs: 6000,
    voiceNote: "opus-only",
    groups: "limited",
    costPerMessage: true,
  },
  // Mesma hetero-restrição do canal oficial, por baixo: é um BSP: a WABA é da
  // Meta, os templates são aprovados pela Meta e a janela de 24h é da Meta. O
  // intermediário muda o TRANSPORTE (quem endereça, como se autentica), não o
  // que o WhatsApp permite — e capability descreve o permitido, não o encanamento.
  //
  // As duas diferenças reais, medidas na doc do provider, não na intuição:
  //
  //  - `voiceNote: "opus-only"`. O provider tem um `voiceNote: true` no envio,
  //    mas exige ogg/opus mono explicitamente e NÃO converte — mesma restrição
  //    do canal oficial. Ler o campo booleano como "ele resolve para mim" é o
  //    erro que manda mp3 e entrega anexo de música.
  //  - `groups: "limited"`. Existe API de grupos, mas só em plano de uso e só
  //    para números fora de coexistência. Capability é o que a instalação MÉDIA
  //    pode fazer; prometer "full" aqui quebraria em quem não paga o plano.
  // `freeformOutsideWindow: false` está MEDIDO, não deduzido. A API aceita o
  // envio livre (200 + wamid) e a Meta recusa a ENTREGA depois, pelo webhook:
  //
  //   131047 Re-engagement message — "The 24-hour customer service window for
  //   this contact is closed. Send an approved template to re-open the
  //   conversation, or wait for the contact to message you first."
  //
  // O detalhe que engana: mandar um template NÃO abre a janela. Só o cliente
  // abre, respondendo. Quem ler o 200 como "enviado" acha que funciona.
  zernio: {
    freeformOutsideWindow: false,
    // Mesma WABA, mesmos templates da Meta por baixo.
    reengajamento: "template",
    requiresTemplates: true,
    canManageTemplates: true,
    banRisk: false,
    minIntervalMs: 6000,
    voiceNote: "opus-only",
    groups: "limited",
    costPerMessage: true,
  },
  // O PRIMEIRO canal que não é WhatsApp — e é isso que torna a linha abaixo
  // diferente de tudo que veio antes, não o nome do provider.
  //
  // A combinação que não existia: `freeformOutsideWindow: false` COM
  // `requiresTemplates: false`. Nos três canais acima, "não posso falar livre"
  // implicava "então mando template". Aqui não implica: a plataforma não hospeda
  // definição de mensagem nenhuma. Fora da janela, a única saída é uma PESSOA
  // responder, sob permissão própria — por isso `reengajamento: 'agente_humano'`.
  //
  // Consequência de produto, e ela não é um defeito a consertar depois: fora da
  // janela o agente de IA não tem jogada. O turno dele acaba em escalação.
  meta_instagram: {
    freeformOutsideWindow: false,
    reengajamento: "agente_humano",
    requiresTemplates: false,
    canManageTemplates: false,
    // ⚠️ NÃO MEDIDO — declarado conservador de propósito.
    //
    // `banRisk: false` desarma, de uma vez, warm-up + cap diário + throttle
    // (`lib/agent-engine/guardrails/pacing/engine.ts`), e o `return` que o
    // desarma fica ACIMA do teto diário que o OPERADOR configura na tela — ou
    // seja, `false` também ignora o limite que a pessoa pediu.
    //
    // A régua deste repo é "medido, não deduzido", e não há medição de conta
    // nova de Instagram de cliente sendo limitada. Enquanto não houver, o valor
    // fica `true`: errar para cá custa envio mais lento; errar para o outro lado
    // custa a conta do cliente. Trocar exige medição, não opinião.
    banRisk: true,
    minIntervalMs: null,
    // ⚠️ NÃO MEDIDO. O comentário do `zernio` acima explica por que este campo
    // não se deduz da documentação: ler um booleano de "suporta áudio" como
    // "ele converte para mim" é o erro que entrega anexo de música ao cliente.
    // `opus-only` é a suposição conservadora: entregamos já convertido.
    voiceNote: "opus-only",
    groups: "none",
    // Mensagem de Instagram não é cobrada por unidade como a da Cloud API.
    costPerMessage: false,
  },
};

/**
 * O que assumir quando o banco NÃO diz qual é o canal — só quando a linha de
 * `channel_sessions` não pôde ser lida (a coluna é `not null default 'waha'`,
 * então uma sessão que existe sempre responde).
 *
 * Espelha o default da coluna de propósito: é o que mantém o comportamento
 * idêntico ao dos literais que as Tasks 4b/5 deixaram no código. E é o canal
 * CONSERVADOR dos dois — banRisk armado, throttle e warm-up ligados; errar para
 * o lado do meta_cloud desarmaria o anti-ban num número que pode ser banido.
 */
export const DEFAULT_CHANNEL_PROVIDER: ChannelProvider = "waha";

/**
 * Constantes nomeadas dos providers. Existem para que nenhum arquivo fora deste
 * módulo precise escrever a string — é o que o `scripts/lint-channels.ts` cobra.
 */
export const CHANNEL_PROVIDER_WAHA: ChannelProvider = "waha";
export const CHANNEL_PROVIDER_META: ChannelProvider = "meta_cloud";
export const CHANNEL_PROVIDER_ZERNIO: ChannelProvider = "zernio";
export const CHANNEL_PROVIDER_INSTAGRAM: ChannelProvider = "meta_instagram";

export function capabilitiesOf(provider: ChannelProvider): ChannelCapabilities {
  const caps = CHANNEL_CAPABILITIES[provider];
  // Fail-closed: provider fora da matriz não herda o default do WAHA. O tipo
  // barra em compilação; isto barra o que vem do banco em runtime.
  if (!caps) throw new Error(`unknown_channel_provider: ${provider}`);
  return caps;
}
