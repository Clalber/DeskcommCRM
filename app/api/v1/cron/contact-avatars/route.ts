/**
 * contact-avatars — baixa e mantém atualizada a foto de perfil dos contatos.
 *
 * POR QUE UM CRON, E NÃO NA INGESTÃO
 * O webhook de entrada precisa responder rápido: baixar e subir uma imagem no meio
 * dele atrasaria a gravação da mensagem e, num pico, faria o canal reenfileirar.
 * Aqui vale a mesma regra do resto do repo — trabalho pesado sai do caminho
 * quente e vira varredura periódica.
 *
 * POR QUE O ARQUIVO, E NÃO A URL
 * O canal devolve uma URL assinada do CDN do WhatsApp, com `oe=<expiração>` no
 * fim. Medido numa instalação real: 9 dias. Guardar a URL faria todo avatar
 * sumir da tela em pouco mais de uma semana, sem erro nenhum. Então o arquivo
 * vai para o bucket privado `whatsapp-media`, como já se faz com a mídia das
 * mensagens, e a tela pede URL assinada na hora.
 *
 * ORDEM DA VARREDURA: `avatar_updated_at nulls first` — quem nunca teve foto
 * entra antes de quem só está desatualizado. O rosto que falta incomoda mais
 * que o rosto velho.
 *
 * Auth: Bearer INTERNAL_SECRET (fail-closed), igual aos demais crons.
 */
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { DEFAULT_CHANNEL_PROVIDER, getAdapter, type ChannelProvider } from "@/lib/channels";
import {
  CHANNEL_SESSION_REF_COLUMNS,
  resolveSessionRef,
  type ChannelSessionRef,
} from "@/lib/channels/session-ref";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Contatos por invocação. Baixar imagem é I/O: cap baixo evita segurar o cron. */
const SCAN_LIMIT = 25;
/** Revisita a foto a cada 7 dias — gente troca de foto, mas não toda hora. */
const REFRESH_AFTER_DAYS = 7;
/** Foto de perfil do WhatsApp é pequena; acima disto é resposta errada. */
const MAX_BYTES = 2 * 1024 * 1024;

interface ContactRow {
  id: string;
  organization_id: string;
  wa_identity: string | null;
  avatar_storage_path: string | null;
  /**
   * Contato de canal que endereça por id OPACO, e não por telefone.
   *
   * Quando presente, dispensa `wa_identity` — que esses contatos não têm — e
   * carrega o que o adapter precisa: qual conexão pergunta, e por quem.
   */
  identidadeOpaca?: {
    sessionRef: string;
    provider: ChannelProvider;
    providerUserId: string;
    /** O nome que o contato tem hoje. Serve para saber se ainda é provisório. */
    displayName: string | null;
  };
}

/** `lid:123…` / `phone:+55…` → o chatId que o adapter espera. */
function chatIdFromIdentity(identity: string): string | null {
  if (identity.startsWith("lid:")) return `${identity.slice(4)}@lid`;
  if (identity.startsWith("phone:")) return `${identity.slice(6).replace(/\D/g, "")}@c.us`;
  return null;
}

/**
 * Contatos de canal endereçado por id OPACO que ainda precisam de perfil.
 *
 * Por que uma consulta à parte: a varredura principal exige `wa_identity`, e
 * esses contatos não têm telefone nenhum. Alargar aquela consulta mexeria no
 * caminho mais quente do produto sem ganho; esta é aditiva e some sozinha em
 * instalação que não usa esse tipo de canal (devolve lista vazia).
 *
 * O filtro de anonimização é o MESMO da principal, e pelo mesmo motivo: sem ele
 * um contato anonimizado por pedido LGPD voltaria a ser varrido e o cron
 * baixaria o rosto dele de novo, reintroduzindo sozinho o dado que acabara de
 * ser apagado.
 */
async function contatosDeIdentidadeOpaca(
  admin: ReturnType<typeof createAdminClient>,
  cutoff: string,
): Promise<ContactRow[]> {
  const { data, error } = await admin
    .from("channel_contact_identities")
    .select(
      `provider_user_id, organization_id,
       contacts!inner(id, display_name, avatar_storage_path, avatar_updated_at, is_anonymized),
       channel_sessions!inner(id, provider, ${CHANNEL_SESSION_REF_COLUMNS})`,
    )
    .eq("contacts.is_anonymized", false)
    .or(`avatar_updated_at.is.null,avatar_updated_at.lt.${cutoff}`, {
      referencedTable: "contacts",
    })
    .limit(SCAN_LIMIT);

  if (error) {
    // Não derruba a rodada: a varredura principal já pode ter trabalho útil, e
    // 500 aqui deixaria TODOS os contatos sem foto por causa de um canal.
    logger.warn("[contact-avatars] varredura de identidade opaca falhou", {
      detail: error.message,
    });
    return [];
  }

  const linhas: ContactRow[] = [];
  // `Array.isArray` e não `?? []`: um cliente que devolva objeto ou `undefined`
  // em vez de lista faria o `for…of` estourar aqui dentro — e um throw nesta
  // função derruba a rodada INTEIRA, deixando todos os contatos sem foto por
  // causa de uma consulta acessória. Foi o que um teste de corrida já existente
  // pegou.
  for (const l of (Array.isArray(data) ? data : []) as unknown as Array<{
    provider_user_id: string;
    organization_id: string;
    contacts: { id: string; display_name: string | null; avatar_storage_path: string | null };
    channel_sessions: ChannelSessionRef & { provider: ChannelProvider };
  }>) {
    // `resolveSessionRef` em vez de ler a coluna: qual coluna identifica a
    // sessão é decisão do canal, e nomeá-la aqui traria o nome do transporte
    // para fora de `lib/channels/` — o que a doutrina de restrição de canal
    // proíbe e o `lint:channels` reprova.
    let sessionRef: string;
    try {
      sessionRef = resolveSessionRef(l.channel_sessions);
    } catch {
      continue;
    }
    if (!sessionRef) continue;

    linhas.push({
      id: l.contacts.id,
      organization_id: l.organization_id,
      wa_identity: null,
      avatar_storage_path: l.contacts.avatar_storage_path,
      identidadeOpaca: {
        sessionRef,
        provider: l.channel_sessions.provider,
        providerUserId: l.provider_user_id,
        displayName: l.contacts.display_name,
      },
    });
  }
  return linhas;
}

/**
 * Dá nome ao contato — mas só se ele ainda não tem um de verdade.
 *
 * ⚠️ NUNCA sobrescreve nome existente. O operador pode ter renomeado o contato
 * à mão ("Dona Marta, do salão"), e um cron que passasse por cima disso apagaria
 * trabalho humano toda semana, calado. Só substitui o rótulo PROVISÓRIO que a
 * ingestão criou por não ter nada melhor.
 */
async function batizar(
  c: ContactRow,
  perfil: { nome: string | null; username: string | null },
): Promise<void> {
  const opaca = c.identidadeOpaca;
  if (!opaca) return;

  const nome = perfil.nome ?? (perfil.username ? `@${perfil.username}` : null);
  if (!nome) return;

  // O rótulo provisório termina com o id; qualquer outra coisa é nome de gente
  // ou escolha do operador, e não se toca.
  const atual = opaca.displayName ?? "";
  const aindaProvisorio = atual === "" || atual.endsWith(opaca.providerUserId.slice(-6));
  if (!aindaProvisorio) return;

  const admin = createAdminClient();
  await admin
    .from("contacts")
    .update({ display_name: nome })
    .eq("id", c.id)
    .eq("organization_id", c.organization_id)
    // Mesma corrida que o carimbo fecha: entre escolher o lote e gravar há I/O
    // de rede, e a anonimização pode ter alcançado este contato no meio.
    .eq("is_anonymized", false);

  if (perfil.username) {
    await admin
      .from("channel_contact_identities")
      .update({ provider_username: perfil.username })
      .eq("organization_id", c.organization_id)
      .eq("contact_id", c.id)
      .eq("provider_user_id", opaca.providerUserId);
  }
}

async function handle(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();

  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";
  const accepted = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  if (accepted.length === 0 || !provided || !accepted.includes(provided)) {
    return fail("forbidden", "Cron secret missing or invalid.", 403, { requestId });
  }

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - REFRESH_AFTER_DAYS * 86_400_000).toISOString();

  // Nunca buscados (null) OU buscados há mais de REFRESH_AFTER_DAYS.
  //
  // `is_anonymized` fora é OBRIGATÓRIO, não otimização: sem esse filtro, um
  // contato anonimizado por pedido LGPD voltaria a ser varrido no refresh
  // seguinte e o cron BAIXARIA O ROSTO DELE DE NOVO — reintroduzindo, sozinho e
  // periodicamente, o dado pessoal que acabara de ser apagado. A anonimização é
  // declarada irreversível no produto; esta linha é o que sustenta isso.
  const { data: contatos, error: queryError } = await admin
    .from("contacts")
    .select("id, organization_id, wa_identity, avatar_storage_path")
    .not("wa_identity", "is", null)
    .eq("is_anonymized", false)
    .or(`avatar_updated_at.is.null,avatar_updated_at.lt.${cutoff}`)
    .order("avatar_updated_at", { ascending: true, nullsFirst: true })
    .limit(SCAN_LIMIT);

  if (queryError) {
    logger.error("[contact-avatars] query failed", { detail: queryError.message, requestId });
    return fail("internal_error", queryError.message, 500, { requestId });
  }

  const rows = (contatos ?? []) as ContactRow[];

  // ─── A SEGUNDA PISTA: quem não tem telefone ──────────────────────────────
  //
  // A consulta acima exige `wa_identity`, e contato de canal endereçado por id
  // opaco NÃO tem — ele nunca entrava na varredura, e o nome dele ficava
  // `Instagram 384756` para sempre. Uma lista de contatos indistinguíveis faz o
  // CRM parecer quebrado para quem vende.
  //
  // Consulta SEPARADA em vez de alargar a de cima: o caminho do canal por
  // telefone é o mais quente do produto e não ganha nada em ser mexido. Aditiva,
  // com o MESMO filtro de anonimização — sem ele, o cron rebaixaria um pedido
  // LGPD baixando o rosto de volta.
  rows.push(...(await contatosDeIdentidadeOpaca(admin, cutoff)));
  let atualizados = 0;
  let semFoto = 0;
  let falhas = 0;

  for (const c of rows) {
    const chatId = c.identidadeOpaca
      ? c.identidadeOpaca.providerUserId
      : c.wa_identity
        ? chatIdFromIdentity(c.wa_identity)
        : null;
    // Carimba mesmo sem conseguir resolver o chatId: sem isso o contato voltaria
    // em TODA rodada do cron, para sempre, batendo no canal à toa.
    //
    // `is_anonymized = false` no UPDATE não repete o filtro do SELECT — fecha uma
    // corrida. Entre a seleção do lote e esta gravação há I/O de rede por contato
    // (canal, download, upload), e a anonimização em escopo de tenant percorre
    // centenas de contatos enquanto isto roda. Se o pedido LGPD alcançar este
    // contato no meio do caminho, sem esta cláusula o cron gravaria o rosto de
    // volta num contato JÁ anonimizado — e o filtro do SELECT nunca mais o
    // escolheria para corrigir. Devolve as linhas afetadas para que quem chamou
    // saiba se a gravação valeu.
    const carimbar = async (path: string | null): Promise<boolean> => {
      const { data: afetadas } = await admin
        .from("contacts")
        .update({
          ...(path !== null ? { avatar_storage_path: path } : {}),
          avatar_updated_at: new Date().toISOString(),
        })
        .eq("id", c.id)
        .eq("organization_id", c.organization_id)
        .eq("is_anonymized", false)
        .select("id");
      return (afetadas ?? []).length > 0;
    };

    if (!chatId) {
      await carimbar(null);
      semFoto++;
      continue;
    }

    try {
      // Contato de id opaco já sabe por qual conexão perguntar — a identidade
      // dele é escopada a UMA sessão, e perguntar por outra devolveria o perfil
      // de outra pessoa (o mesmo id pertence a alguém diferente em cada conta).
      let ref: string | null = null;
      let providerDaSessao: ChannelProvider | null = null;

      if (c.identidadeOpaca) {
        ref = c.identidadeOpaca.sessionRef;
        providerDaSessao = c.identidadeOpaca.provider;
      } else {
        const { data: sessao } = await admin
          .from("channel_sessions")
          .select("waha_session_name, provider")
          .eq("organization_id", c.organization_id)
          .eq("status", "WORKING")
          .limit(1)
          .maybeSingle();
        ref = (sessao as { waha_session_name?: string | null } | null)?.waha_session_name ?? null;
        providerDaSessao =
          (sessao as { provider?: ChannelProvider | null } | null)?.provider ?? null;
      }

      if (!ref) {
        await carimbar(null);
        semFoto++;
        continue;
      }

      // Pelo adapter, nunca falando com o canal direto: a doutrina
      // `restricao-de-canal` proíbe nomear provider fora de lib/channels/, e o
      // `pnpm lint:channels` reprova o build se acontecer (foi o que pegou a
      // primeira versão desta rota). Testar a PRESENÇA do método é como se
      // pergunta "este canal sabe fazer isso?" sem perguntar qual canal é.
      const adapter = getAdapter(providerDaSessao ?? DEFAULT_CHANNEL_PROVIDER);

      // ─── Perfil INTEIRO quando o canal sabe dar ──────────────────────────
      //
      // Onde o interlocutor é um telefone, o número já é rótulo utilizável e só
      // falta a foto. Onde ele é um id opaco, o contato nasce sem nome nenhum —
      // e nome e foto vêm do MESMO endereço. Duas requisições dobrariam o custo
      // de cota por contato sem trazer nada.
      const alvo = { organizationId: c.organization_id, sessionRef: ref, recipient: chatId };
      const perfil = adapter.fetchProfile ? await adapter.fetchProfile(alvo) : null;

      if (perfil) await batizar(c, perfil);

      if (!adapter.fetchProfile && !adapter.fetchProfilePictureUrl) {
        await carimbar(null);
        semFoto++;
        continue;
      }
      const profilePictureURL = perfil
        ? perfil.fotoUrl
        : await adapter.fetchProfilePictureUrl!(alvo);
      if (!profilePictureURL) {
        // Contato sem foto ou com privacidade fechada: estado normal, não erro.
        await carimbar(null);
        semFoto++;
        continue;
      }

      const img = await fetch(profilePictureURL);
      if (!img.ok) {
        await carimbar(null);
        falhas++;
        continue;
      }
      const buf = Buffer.from(await img.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) {
        await carimbar(null);
        falhas++;
        continue;
      }

      // Caminho estável por contato: `upsert` sobrescreve a foto antiga em vez
      // de acumular um arquivo órfão por refresh (7 dias × N contatos viraria
      // lixo pago no bucket).
      const path = `${c.organization_id}/avatars/${c.id}.jpg`;
      const { error: upErr } = await admin.storage
        .from("whatsapp-media")
        .upload(path, buf, { contentType: "image/jpeg", upsert: true });
      if (upErr) {
        await carimbar(null);
        falhas++;
        continue;
      }

      const gravou = await carimbar(path);
      if (!gravou) {
        // O contato foi anonimizado enquanto baixávamos a foto dele. O arquivo
        // já subiu, então bloquear a gravação não basta: sem isto o objeto ficaria
        // no bucket sem ponteiro nenhum — pior que o defeito original, porque
        // invisível. Devolvemos à fila de redação, o mesmo caminho que a cascata
        // usa, e o worker de limpeza remove.
        await admin.from("storage_redaction_queue").upsert(
          {
            organization_id: c.organization_id,
            bucket: "whatsapp-media",
            object_path: path,
            status: "pending",
            attempts: 0,
            processed_at: null,
            error_message: null,
          },
          { onConflict: "bucket,object_path" },
        );
        logger.warn("[contact-avatars] anonimizado durante a busca; foto devolvida à fila", {
          contact_id: c.id,
          organization_id: c.organization_id,
          requestId,
        });
        semFoto++;
        continue;
      }
      atualizados++;
    } catch (err) {
      await carimbar(null);
      falhas++;
      logger.warn("[contact-avatars] contato falhou", {
        contact_id: c.id,
        detail: err instanceof Error ? err.message : String(err),
        requestId,
      });
    }
  }

  return ok(
    { scanned: rows.length, updated: atualizados, no_picture: semFoto, failed: falhas },
    { requestId },
  );
}

export const GET = handle;
export const POST = handle;
