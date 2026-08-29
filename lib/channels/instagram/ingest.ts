/**
 * A mensagem do Instagram entrando no CRM.
 *
 * ─── O que muda em relação ao WhatsApp ──────────────────────────────────────
 *
 * Não há telefone. O caminho canônico do WhatsApp resolve o contato por número
 * — com variantes do nono dígito e tudo — e aqui isso não existe: a pessoa é
 * identificada pelo IGSID, que a CONTA que recebe emitiu. Por isso a resolução
 * passa por `channel_contact_identities`, e o contato nasce sem telefone.
 *
 * ─── A ordem importa, e não é estética ──────────────────────────────────────
 *
 * identidade → contato → conversa → mensagem → carimbo → efeitos.
 *
 * O CARIMBO é o que move `last_inbound_at`, e é ele que abre a janela de 24
 * horas: sem isso o agente seria vetado para responder a alguém que acabou de
 * escrever. Os EFEITOS (opt-out, lead, despacho do agente) vêm por último e por
 * uma função só — a mesma dos outros canais. Pular essa chamada faz o canal
 * receber e nunca responder: um megafone, medido em produção no canal oficial.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";

import { aplicarEfeitosPosEntrada } from "../pos-entrada";
import { contatoPorIdentidade, gravarIdentidade } from "./identidade";
import type { EventoDeEntrada } from "./webhook";

/** O canal, no vocabulário de `conversations.channel` — não o do provider. */
export const CANAL_DA_CONVERSA = "instagram";

export interface EntradaDoInstagram {
  organizationId: string;
  channelSessionId: string;
  evento: EventoDeEntrada;
}

export type DesfechoDaEntrada =
  | { status: "ingested"; messageId: string }
  | { status: "duplicate" }
  | { status: "failed"; reason: string };

/**
 * Dica de mime a partir do tipo que a Meta declara.
 *
 * É DICA, e o worker que baixa os bytes decide de verdade pelo cabeçalho da
 * resposta. Serve para a tela ter o que mostrar enquanto o download não termina
 * — sem isto, a mensagem aparece como arquivo genérico por alguns segundos.
 */
function mimeDaMidia(tipo: string): string | undefined {
  if (tipo === "image") return "image/jpeg";
  if (tipo === "video") return "video/mp4";
  if (tipo === "audio") return "audio/mp4";
  return undefined;
}

/**
 * Encontra ou cria o contato desta pessoa, nesta conta.
 *
 * O contato nasce SEM telefone e com nome provisório. Enriquecer o perfil exige
 * uma chamada à Meta que só funciona depois de a pessoa ter escrito — e fazê-la
 * aqui, dentro do caminho de entrada, atrasaria a gravação da mensagem por uma
 * rede que pode estar lenta.
 *
 * ⚠️ Hoje NINGUÉM faz esse enriquecimento para este canal: o cron de avatares
 * exige `waha_session_name` e desiste sem ele, e o adapter não implementa a
 * busca de perfil. O contato fica `Instagram 384756` até alguém escrever essa
 * peça. Está dito aqui em voz alta porque a versão anterior deste comentário
 * afirmava que "já roda em cron para os outros canais", o que é verdade para os
 * outros e falso para este — e uma promessa falsa no comentário é pior que
 * lacuna nenhuma, porque desliga a busca de quem viria consertar.
 */
async function contatoDaPessoa(
  admin: SupabaseClient,
  entrada: EntradaDoInstagram,
): Promise<string> {
  const { organizationId, channelSessionId, evento } = entrada;

  const existente = await contatoPorIdentidade(admin, {
    organizationId,
    channelSessionId,
    providerUserId: evento.providerUserId,
  });
  if (existente) return existente;

  const { data, error } = await admin
    .from("contacts")
    .insert({
      organization_id: organizationId,
      // O IGSID no nome é provisório e DELIBERADO: um contato sem nome nenhum
      // some na lista, e o operador não consegue nem procurá-lo. Com o id ele ao
      // menos existe e é encontrável até o perfil chegar.
      display_name: `Instagram ${evento.providerUserId.slice(-6)}`,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`instagram_contact_create_failed: ${error?.message ?? "sem id"}`);
  }

  const contactId = (data as { id: string }).id;
  // A amarração é gravada JUNTO com a criação, não depois: se este passo
  // falhasse em silêncio, a próxima mensagem da mesma pessoa não encontraria o
  // contato e criaria outro — e a conversa se partiria em pedaços.
  await gravarIdentidade(admin, {
    organizationId,
    channelSessionId,
    contactId,
    providerUserId: evento.providerUserId,
  });

  // ─── A RELEITURA fecha a corrida, e ela não é paranoia ────────────────────
  //
  // O trecho acima é check-then-act: consulta, não acha, cria. Duas mensagens
  // da mesma pessoa nova chegando em POSTs paralelos — que é o normal quando
  // alguém escreve duas frases seguidas — fazem as duas execuções não acharem
  // identidade e criarem um contato cada. A trava única da 0203 protege a
  // TABELA de identidades (só uma sobrevive), mas `ignoreDuplicates` faz o
  // perdedor seguir em frente com o contato órfão dele: a conversa se parte em
  // duas, com leads separados, que é exatamente o que o comentário acima diz
  // querer impedir.
  //
  // É o mesmo anti-pattern que a 0027 matou no WhatsApp com uma RPC atômica.
  // Aqui a releitura resolve sem migration: quem perdeu o conflito lê a
  // identidade VENCEDORA e passa a usar o contato dela.
  const vencedor = await contatoPorIdentidade(admin, {
    organizationId,
    channelSessionId,
    providerUserId: evento.providerUserId,
  });

  return vencedor ?? contactId;
}

/** Prévia curta para a lista de conversas. */
function previa(evento: EventoDeEntrada): string {
  if (evento.ehApagada) return "(mensagem apagada)";
  if (evento.texto) return evento.texto.slice(0, 120);
  if (evento.midias.length > 0) return `(${evento.midias[0]!.tipo})`;
  return "(sem conteúdo)";
}

export async function ingerirEntradaDoInstagram(
  admin: SupabaseClient,
  entrada: EntradaDoInstagram,
): Promise<DesfechoDaEntrada> {
  const { organizationId, channelSessionId, evento } = entrada;

  // ─── APAGAR é UPDATE, não INSERT ──────────────────────────────────────────
  //
  // O evento de apagamento chega com o MESMO `mid` da mensagem original.
  // Tratá-lo como linha nova faz o insert bater na trava única, voltar 23505 e
  // ser lido como "reentrega" — e o texto original continua na tela, inteiro,
  // sem marca nenhuma. A pessoa vê "mensagem apagada" no Instagram dela e o CRM
  // segue exibindo o que ela apagou: além de errado, é problema de LGPD quando
  // o que ela apagou era um dado sensível digitado por engano.
  //
  // Os dois canais irmãos aplicam a revogação na mensagem existente. Aqui
  // também — e só se ninguém for encontrado é que cai no caminho de baixo, que
  // é o caso raro de o apagamento chegar antes da mensagem.
  if (evento.ehApagada) {
    const { data: revogadas } = await admin
      .from("messages")
      .update({ revoked_at: new Date().toISOString(), body: null })
      .eq("organization_id", organizationId)
      .eq("external_id", evento.externalId)
      .select("id");

    const alvo = (revogadas as { id: string }[] | null)?.[0];
    if (alvo) return { status: "ingested", messageId: alvo.id };
  }

  const contactId = await contatoDaPessoa(admin, entrada);

  const { data: conversationId, error: erroConversa } = await admin.rpc(
    "fn_upsert_conversation_do_canal" as never,
    {
      p_org: organizationId,
      p_contact: contactId,
      p_session: channelSessionId,
      // EXPLÍCITO. A função irmã fixa `whatsapp` no corpo, e uma conversa de
      // Instagram marcada como WhatsApp some de toda tela que filtra por canal —
      // sem erro nenhum, porque `whatsapp` é um valor válido.
      p_channel: CANAL_DA_CONVERSA,
    } as never,
  );
  if (erroConversa || !conversationId) {
    return { status: "failed", reason: `conversa: ${erroConversa?.message ?? "sem id"}` };
  }

  const primeira = evento.midias[0];
  const { data: inserida, error: erroInsert } = await admin
    .from("messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId as string,
      channel_session_id: channelSessionId,
      contact_id: contactId,
      // O ECO é mensagem NOSSA que voltou: pode ser a resposta que uma pessoa
      // deu pelo aplicativo do Instagram. Gravá-la como entrada faria o agente
      // responder à própria casa; descartá-la mostraria atendimento pela metade.
      direction: evento.ehEco ? "outbound" : "inbound",
      // ─── Toda linha nascida do webhook veio de FORA do CRM ────────────────
      //
      // O default da coluna é `'crm'`, e ele MENTE aqui: quem passou por este
      // arquivo chegou pelo webhook da Meta, não pelo composer. Os dois canais
      // irmãos carimbam `external_device` no mesmo lugar.
      //
      // Não é cosmético, e custa de dois jeitos. `removerEcoDoProprioEnvio`
      // filtra por este valor: sem ele, o eco do nosso próprio envio ESCAPA da
      // rede e vira segunda linha na tela — e a original fica presa em `queued`
      // para sempre, porque o UPDATE que lhe daria o `external_id` colide com a
      // linha do eco. E as métricas de atrito contam só `external_device`,
      // então a resposta que uma pessoa dá pelo aplicativo do Instagram sumiria
      // do painel de atendimento por fora.
      sent_via: "external_device",
      status: "delivered",
      type: primeira ? (["image", "audio", "video"].includes(primeira.tipo) ? primeira.tipo : "document") : "text",
      body: evento.ehApagada ? null : evento.texto,
      external_id: evento.externalId,
      sent_at: new Date(evento.timestamp).toISOString(),
      // A URL do anexo é PONTEIRO, não conteúdo: a CDN da Meta a expira, e a
      // primeira versão guardava só no `metadata` — onde o worker de
      // persistência não olha. Ele sai com "no media_url" e a mídia do cliente
      // vira linha sem bytes: o atendente vê "imagem" sem imagem. O canal
      // intermediado narra este exato defeito como "o pior do canal".
      ...(primeira?.url
        ? { media_url: primeira.url, media_mime: mimeDaMidia(primeira.tipo) }
        : {}),
      metadata: {
        ...(primeira ? { instagram_media_type: primeira.tipo } : {}),
        ...(evento.respostaA ? { in_reply_to_external_id: evento.respostaA } : {}),
        ...(evento.ehApagada ? { instagram_apagada: true } : {}),
      },
    })
    .select("id")
    .maybeSingle();

  if (erroInsert) {
    // 23505 = a Meta re-entregou. Ela reenvia por até 36 horas quando não recebe
    // 200, e a documentação dela diz com todas as letras que a deduplicação é
    // NOSSA. Não é erro: é o contrato funcionando.
    if (erroInsert.code === "23505") return { status: "duplicate" };
    return { status: "failed", reason: `mensagem: ${erroInsert.message}` };
  }

  const messageId = (inserida as { id: string } | null)?.id ?? "";

  // O carimbo move `last_inbound_at` — é ELE que abre a janela de 24h. Sem isso
  // o agente seria vetado para responder a quem acabou de escrever.
  //
  // O erro é LIDO, e isso importa mais aqui do que nos outros canais: este canal
  // tem `freeformOutsideWindow: false`, então o guardrail consulta exatamente
  // essa coluna antes de deixar o agente falar. Um carimbo que falha em silêncio
  // produz o megafone que o cabeçalho deste arquivo diz temer — recebe e nunca
  // responde — sem deixar rastro nenhum para quem for investigar.
  const { error: erroCarimbo } = await admin.rpc("fn_mark_conversation_message" as never, {
    p_conv: conversationId as string,
    p_direction: evento.ehEco ? "outbound" : "inbound",
    p_preview: previa(evento),
    p_at: new Date(evento.timestamp).toISOString(),
  } as never);
  if (erroCarimbo) {
    logger.warn("[instagram.ingest] carimbo da conversa falhou", {
      conversationId: conversationId as string,
      detalhe: erroCarimbo.message,
    });
  }

  // A mídia precisa dos BYTES: a URL da Meta vence, e o que sobra é uma linha de
  // imagem sem imagem. Best-effort de propósito — a mensagem já está gravada e
  // visível, e derrubar a ingestão aqui trocaria uma foto faltando por uma
  // tempestade de reentregas.
  if (primeira?.url && messageId) {
    const { error: erroMidia } = await admin.rpc("emit_event" as never, {
      p_event_type: "media.persist_requested",
      p_entity_kind: "message",
      p_entity_id: messageId,
      p_payload: { message_id: messageId, conversation_id: conversationId as string },
      p_metadata: { source: "instagram_webhook" },
      p_organization_id: organizationId,
    } as never);
    if (erroMidia) {
      logger.warn("[instagram.ingest] pedido de persistência de mídia falhou", {
        messageId,
        detalhe: erroMidia.message,
      });
    }
  }

  // Eco não dispara agente: ele é a nossa própria voz, e despachar aqui faria o
  // robô responder a si mesmo em laço.
  if (!evento.ehEco) {
    await aplicarEfeitosPosEntrada(admin, {
      organizationId,
      contactId,
      conversationId: conversationId as string,
      messageId: messageId || null,
      channelSessionId,
      texto: evento.texto,
      // A Meta não manda nome no webhook de mensagem — o perfil vem de uma
      // chamada à parte, que só funciona depois de a pessoa ter escrito. `null`
      // é honesto: quem batiza o card resolve com o que tiver.
      nomeDoContato: null,
      origem: "instagram_webhook",
    });
  }

  return { status: "ingested", messageId };
}
