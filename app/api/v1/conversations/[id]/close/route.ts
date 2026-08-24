/**
 * POST /api/v1/conversations/[id]/close — fecha a conversa.
 *
 * Não bloqueia por assignee — qualquer membro com permissão (RLS) pode fechar.
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import type { Conversation } from "@/lib/types/messaging";

export const dynamic = "force-dynamic";

const SELECT_COLS = `
  id, organization_id, contact_id, channel_session_id, channel, status,
  status_changed_at, assigned_to_user_id, assigned_at, last_inbound_at,
  last_outbound_at, last_message_at, last_message_preview,
  unread_count_for_assignee, is_group, group_chat_id, metadata,
  created_at, updated_at
`;

interface RouteCtx {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, ctx: RouteCtx): Promise<Response> {
  const requestId = randomUUID();
  const { id } = await ctx.params;
  const supabase = await createClient();

  // spec 13 §4: escrita é agent+ (viewer é read-only).
  const authz = await requireRole("agent", { requestId, resource: "conversations" });
  if (!authz.ok) return authz.response;
  const user = authz.user;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("conversations")
    .update({
      status: "closed",
      status_changed_at: now,
      // FECHAR DEVOLVE O COMANDO AO AUTOMÁTICO — e sem esta linha a 0173 vazaria.
      //
      // Desde a 0173, assumir grava `bot_silenced_until='infinity'`. Fechar NÃO
      // solta o dono (de propósito: "quem atendeu é histórico"), e a ingestão
      // reusa a MESMA linha de conversa quando o cliente escreve de novo
      // (`fn_upsert_wa_conversation`, `on conflict do update`). Sem limpar o
      // silêncio aqui, o fim NORMAL de um atendimento (Assumir → Fechar) deixaria
      // o automático mudo para sempre naquele cliente — que é exatamente o
      // defeito que fez a alternativa via `assignee_kind` ser reprovada.
      //
      // Limpar aqui é seguro para a escalação de verdade: quem escalou também
      // gravou `contacts.force_human`, que continua barrando os três guards. A
      // trava durável é aquela; esta é a do episódio.
      //
      // Só esta coluna. `last_handoff_at`/`last_handoff_reason` ficam: eles contam
      // o que aconteceu, e a tela só os mostra enquanto há silêncio vigente.
      bot_silenced_until: null,
    })
    .eq("id", id)
    .select(SELECT_COLS)
    .maybeSingle();

  if (error) {
    return fail("internal_error", error.message, 500, { requestId });
  }
  if (!data) {
    return fail("not_found", "Conversa não encontrada.", 404, { requestId });
  }

  const conv = data as unknown as Conversation;

  await audit({
    action: "conversation.closed",
    actorUserId: user.id,
    organizationId: conv.organization_id,
    resourceType: "conversation",
    resourceId: conv.id,
    requestId,
  });

  return ok(conv, { requestId });
}
