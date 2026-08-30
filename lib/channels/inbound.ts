/**
 * Entrada de webhook, do lado de dentro do seam.
 *
 * A rota não pode saber QUAL canal é — o invariante 1 da doutrina proíbe, e o
 * `lint:channels` reprovou a primeira versão desta rota exatamente por isso,
 * que é a catraca funcionando. Então a rota entrega o que sabe (a sessão, o
 * corpo cru, o header de assinatura) e recebe um desfecho; toda a decisão
 * específica de canal mora aqui.
 *
 * Um canal seguinte entra com um `case` neste arquivo e zero linhas na rota.
 *
 * ─── Por que a assinatura é verificada AQUI, e não na rota ──────────────────
 *
 * Porque o esquema é do canal: header, algoritmo e formato mudam por provider
 * (um assina SHA-512 com um nome de header, outro SHA-256 com outro). Uma rota
 * que verificasse teria que perguntar de quem é o payload — o `if (provider ===
 * ...)` que a doutrina existe para impedir.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { CHANNEL_PROVIDER_INSTAGRAM, CHANNEL_PROVIDER_ZERNIO } from "./capabilities";
import { sincronizarSaudeDaConexao } from "./health";
import {
  atualizarEspelhoDoTemplate,
  avisoDoEvento,
  registrarAviso,
  saudeDoEvento,
} from "./zernio/avisos";
import { ingerirEntradaDoInstagram } from "./instagram/ingest";
import { sessaoDaConta } from "./instagram/sessao-da-conta";
import {
  INSTAGRAM_SIGNATURE_HEADER,
  parseInstagramWebhook,
  verifyInstagramSignature,
} from "./instagram/webhook";
import { aplicarEdicaoZernio, ingestZernioInbound } from "./zernio/ingest";
import { lerEnvelopeZernio } from "./zernio/envelope";
import { parseZernioEdicao, verifyZernioSignature } from "./zernio/webhook";
import type { ChannelProvider } from "./types";

/** Curto demais para ser segredo — placeholder ou lixo de decrypt. */
const MIN_SECRET_LEN = 16;

export interface InboundWebhookInput {
  session: {
    id: string;
    organization_id: string;
    provider: string;
    /** Como o operador chama esta conexão. Entra no título do aviso: com dois
     *  números ligados, "WhatsApp fora do ar" não diz QUAL. */
    display_name?: string | null;
    phone_number?: string | null;
  };
  rawBody: string;
  /** Todos os headers da requisição — cada canal lê o SEU. */
  headers: Headers;
  /** Segredo já decifrado pela rota, ou null quando não foi possível. */
  secret: string | null;
}

export type InboundWebhookOutcome =
  | { ok: true; body: Record<string, unknown> }
  | {
      ok: false;
      /**
       * `contrato_violado` é distinto de `invalid_json` de propósito: um diz
       * que o corpo não é JSON, o outro que é JSON com um campo do tipo errado.
       * Quem investiga procura em lugares diferentes, e o segundo significa que
       * o fio mudou — a única causa possível num payload que passou pelo HMAC.
       */
      code: "unauthorized" | "provider_mismatch" | "invalid_json" | "contrato_violado";
      message: string;
    };

/**
 * Este canal sabe receber webhook? Perguntado pela rota ANTES de qualquer
 * trabalho — e respondido sem nomear provider do lado de fora.
 */
export function acceptsInboundWebhook(provider: string): boolean {
  return provider === CHANNEL_PROVIDER_ZERNIO || provider === CHANNEL_PROVIDER_INSTAGRAM;
}

export async function handleInboundWebhook(
  admin: SupabaseClient,
  input: InboundWebhookInput,
): Promise<InboundWebhookOutcome> {
  const provider = input.session.provider as ChannelProvider;

  switch (provider) {
    case CHANNEL_PROVIDER_ZERNIO:
      return zernioInbound(admin, input);
    case CHANNEL_PROVIDER_INSTAGRAM:
      return instagramInbound(admin, input);
    default:
      // Token de um canal que não entra por aqui. É configuração trocada, não
      // ataque — mas processar seria ler o payload com o parser errado.
      return { ok: false, code: "provider_mismatch", message: "canal não recebe por esta rota" };
  }
}

async function zernioInbound(
  admin: SupabaseClient,
  input: InboundWebhookInput,
): Promise<InboundWebhookOutcome> {
  // Fail-closed, sem a exceção que virou regra no canal por QR: lá, "não
  // consegui verificar" virava "processa assim mesmo", e isso deixou toda
  // instalação aceitando mensagem forjada de quem soubesse a URL. Este provider
  // assina sempre, então não há dilema a herdar.
  if (!input.secret || input.secret.length < MIN_SECRET_LEN) {
    return { ok: false, code: "unauthorized", message: "webhook_secret_unavailable" };
  }

  const assinatura = input.headers.get("x-zernio-signature");
  if (!verifyZernioSignature(input.rawBody, assinatura, input.secret)) {
    return { ok: false, code: "unauthorized", message: "bad_signature" };
  }

  // ─── O contrato do fio, ANTES de qualquer leitura ─────────────────────────
  //
  // Aqui o payload era `unknown` e cada leitor se defendia sozinho com `str()`,
  // que devolve `null` para o que não é string. Nunca estourava — e era esse o
  // problema: um `conversationId` numérico virava `null`, o parser devolvia
  // `null`, e a rota respondia 200 `evento_sem_interesse`, exatamente como
  // responde a um evento que de fato não interessa. A mensagem do cliente sumia
  // com carimbo de normalidade.
  //
  // A recusa nomeia os CAMPOS e nunca os valores (dado de cliente), e a rota a
  // fecha no arquivo do webhook com `status: "error"` — onde alguém procura.
  const leitura = lerEnvelopeZernio(input.rawBody);
  if (!leitura.ok) {
    if (leitura.motivo === "json_invalido") {
      return { ok: false, code: "invalid_json", message: "invalid_json" };
    }
    return {
      ok: false,
      code: "contrato_violado",
      message: `payload fora do contrato do canal: ${leitura.campos.join(", ")}`,
    };
  }
  const payload = leitura.envelope;

  // ─── O que a plataforma decide sozinha ───────────────────────────────────
  //
  // Revisão de modelo e mudança de estado do número não são mensagens, mas são
  // o tipo de coisa que só se descobre no disparo que não sai — com a campanha
  // montada e o cliente esperando. Vira aviso na Central, onde o humano já
  // procura o que está errado.
  const aviso = avisoDoEvento(payload);
  if (aviso) {
    // O espelho local também: o aviso empurra para olhar, e a tela de modelos
    // precisa mostrar o estado novo. Ver o estado velho depois de ler o aviso é
    // pior que não ter avisado.
    const espelhado = await atualizarEspelhoDoTemplate(admin, input.session.organization_id, payload);

    // ─── Evento de CONEXÃO passa pelo vigia, não por um insert cru ──────────
    //
    // `sincronizarSaudeDaConexao` é quem grava o episódio, carimba
    // `ref_kind`+`ref_id` no ítem e — a metade que faltava — RESOLVE o aviso
    // quando a conta volta. Chamando `registrarAviso` direto, o crítico ficava
    // aberto para sempre e a reconexão abria um `info` novo ao lado dele.
    //
    // Um caminho só: quem entra aqui NÃO passa também pelo insert cru, senão a
    // Central mostraria o mesmo problema duas vezes.
    const saude = saudeDoEvento(payload);
    if (saude) {
      const desfecho = await sincronizarSaudeDaConexao(
        admin,
        // O `status` que vai para `channel_session_health` é o OBSERVADO agora,
        // não o guardado: quem acabou de falar foi o provedor, e a linha do
        // episódio serve justamente para registrar o que ele disse.
        { id: input.session.id, organization_id: input.session.organization_id, status: saude.status },
        saude,
        // O APELIDO da conexão, não o texto do evento. Passar `aviso.title` aqui
        // produzia `WhatsApp "Número SUSPENSO — não é possível enviar." fora do
        // ar (FAILED)`: título quebrado que não identifica a conexão — exatamente
        // o que o apelido existe para resolver. E fica gravado na linha.
        input.session.display_name ?? input.session.phone_number ?? "sem nome",
        // Empurrão do provedor: ele é a autoridade sobre o estado do NÚMERO, e
        // por isso a varredura não fecha o que ele abriu.
        "empurrao",
      );
      return { ok: true, body: { status: "saude", kind: aviso.kind, desfecho, espelhado } };
    }

    const desfecho = await registrarAviso(admin, input.session.organization_id, aviso);
    return { ok: true, body: { status: "aviso", kind: aviso.kind, desfecho, espelhado } };
  }

  // ─── Edição e apagamento ────────────────────────────────────────────────
  //
  // Vêm ANTES da ingestão, como os avisos: são correções de linha que já
  // existe, não mensagens novas. Deixá-los cair no `ingest` faria uma edição
  // criar uma conversa do nada, com um texto sem nada antes dele.
  const edicao = parseZernioEdicao(payload);
  if (edicao) {
    const desfecho = await aplicarEdicaoZernio(admin, input.session.organization_id, edicao);
    return { ok: true, body: { status: "edicao", tipo: edicao.tipo, desfecho } };
  }

  const r = await ingestZernioInbound(admin, {
    organizationId: input.session.organization_id,
    channelSessionId: input.session.id,
    payload,
  });
  return { ok: true, body: { ...r } };
}


/**
 * O webhook do Instagram.
 *
 * A ordem é a mesma de todo canal que recebe: prova de origem ANTES de olhar o
 * conteúdo. Sem HMAC, quem descobrir a URL cria conversa, injeta mensagem e
 * dispara o agente — e o `verify_token` não protege disso, porque só é conferido
 * uma vez, no cadastro.
 *
 * Devolve 200 mesmo quando um evento do lote falha, e isso é deliberado: a Meta
 * REENVIA o lote inteiro por até 36 horas quando não recebe 200, e reenviar por
 * causa de um evento ruim traria de volta os bons — que já entraram e seriam
 * descartados como duplicata, mas gastando a janela de reentrega que existe para
 * falhas de verdade.
 */
async function instagramInbound(
  admin: SupabaseClient,
  input: InboundWebhookInput,
): Promise<InboundWebhookOutcome> {
  if (!input.secret) {
    return { ok: false, code: "unauthorized", message: "canal sem segredo gravado" };
  }

  const assinatura = input.headers.get(INSTAGRAM_SIGNATURE_HEADER);
  if (!verifyInstagramSignature(input.rawBody, assinatura, input.secret)) {
    return { ok: false, code: "unauthorized", message: "assinatura inválida" };
  }

  let envelope: unknown;
  try {
    envelope = JSON.parse(input.rawBody);
  } catch {
    return { ok: false, code: "invalid_json", message: "corpo não é JSON" };
  }

  const { eventos, ignorados } = parseInstagramWebhook(envelope);

  let entraram = 0;
  let repetidos = 0;
  let deOutraConta = 0;
  const falhas: string[] = [];

  // ─── A conexão sai da CONTA que recebeu, não do token da URL ──────────────
  //
  // A Meta entrega por APLICATIVO, não por conexão: um aplicativo tem uma
  // callback URL, e todas as contas ligadas a ele mandam eventos para lá. Numa
  // organização com duas contas de Instagram, as mensagens das duas chegam no
  // mesmo token — e gravar tudo debaixo da conexão que o token resolve amarra a
  // identidade à sessão errada. Quando alguém responde, o IGSID de uma conta sai
  // pelo TOKEN da outra, e a resposta não chega a quem devia.
  //
  // O cache é por lote: a Meta manda várias mensagens num POST só, e quase
  // sempre da mesma conta.
  const conexaoPorConta = new Map<string, string | null>();
  const conexaoDe = async (contaId: string): Promise<string | null> => {
    const jaSabido = conexaoPorConta.get(contaId);
    if (jaSabido !== undefined) return jaSabido;
    const achada = await sessaoDaConta(admin, {
      organizationId: input.session.organization_id,
      instagramUserId: contaId,
    });
    conexaoPorConta.set(contaId, achada?.id ?? null);
    return achada?.id ?? null;
  };

  for (const evento of eventos) {
    try {
      const channelSessionId = await conexaoDe(evento.contaId);
      if (!channelSessionId) {
        // Conta que esta organização não atende. Ignorar é o desfecho certo —
        // cair de volta na conexão do token refaria o defeito com um passo a
        // mais, e é exatamente assim que a resposta sairia pela conta errada.
        deOutraConta += 1;
        continue;
      }

      const r = await ingerirEntradaDoInstagram(admin, {
        organizationId: input.session.organization_id,
        channelSessionId,
        evento,
      });
      if (r.status === "ingested") entraram += 1;
      else if (r.status === "duplicate") repetidos += 1;
      else falhas.push(r.reason);
    } catch (e) {
      // Um evento que estoura NÃO derruba os outros do lote. É a mesma razão do
      // parser que nunca lança: a Meta manda várias mensagens num POST só.
      falhas.push(e instanceof Error ? e.message : "erro desconhecido");
    }
  }

  // ─── Evento que a Meta mandou e nós não entendemos deixa RASTRO ───────────
  //
  // A contagem de ignorados só existia no corpo da resposta — que a Meta lê e
  // descarta. Quem for investigar "o cliente diz que mandou e não chegou" não
  // tinha onde olhar. Não é erro (é o contrato: nem todo evento nos interessa),
  // então é `info`, não `warn`.
  if (ignorados > 0 || deOutraConta > 0) {
    logger.info("[instagram] eventos não ingeridos no lote", {
      channelSessionId: input.session.id,
      ignorados,
      // Separado de `ignorados` de propósito: "não entendi o evento" e "esta
      // conta não é atendida aqui" pedem investigações diferentes. O segundo,
      // se for grande, quer dizer que falta conectar uma conta.
      deOutraConta,
      entraram,
    });
  }

  // ─── Falha de ESCRITA precisa de 500, e o motivo é a reentrega ────────────
  //
  // Devolver 200 aqui era perda DEFINITIVA de mensagem: a Meta só reenvia o que
  // não recebeu 200, e por até 36 horas. Um engasgo de dez segundos no Postgres
  // virava "o cliente escreveu e ninguém nunca viu" — com o arquivo do webhook
  // gravando `processed` e erro nulo, porque estas falhas nunca chegavam a lugar
  // nenhum além do corpo HTTP que a Meta descarta.
  //
  // Reentregar é seguro: o que já entrou volta como 23505 e é lido como
  // duplicata. Trocamos uma reentrega barata por uma mensagem perdida.
  //
  // O cabeçalho da rota já prometia este comportamento — "500 fica reservado
  // para falha de ESCRITA" —, e o canal intermediado o cumpre lançando. Este
  // caminho é que não cumpria.
  if (falhas.length > 0) {
    throw new Error(
      `instagram_ingest_failed: ${falhas.length} de ${eventos.length} evento(s) — ${falhas.join("; ")}`,
    );
  }

  return { ok: true, body: { entraram, repetidos, ignorados, deOutraConta, falhas } };
}
