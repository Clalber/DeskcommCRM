/**
 * POST /api/v1/messages — envia mensagem outbound (handler em ./_handler.ts).
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import {
  chaveDoCabecalho,
  guardarResultado,
  hashDoPedido,
  reservarExecucao,
  soltarReserva,
} from "@/lib/api/idempotencia";
import { ApiError } from "@/lib/api/types";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { sendMessageSchema, validateRequest, type SendMessageInput } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { sendMessageHandler } from "./_handler";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const supabase = await createClient();

  // spec 13 §4: escrita é agent+ (viewer é read-only).
  const authz = await requireRole("agent", { requestId, resource: "messages" });
  if (!authz.ok) return authz.response;
  const user = authz.user;
  const activeOrg = authz.org;

  let input;
  try {
    input = await validateRequest(sendMessageSchema, req);
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }

  // ─── IDEMPOTÊNCIA: a mesma intenção não vira duas mensagens ───────────────
  //
  // O cliente HTTP deste produto retenta mutação e reenvia a MESMA
  // `Idempotency-Key` em todas as tentativas (`lib/api/client.ts`). Sem esta
  // reserva, cada tentativa virava uma mensagem — e como o envio chama a Meta
  // dentro da requisição, o cliente do outro lado recebia a frase duas vezes.
  // Medido em produção: duas requisições, 1,43 s de intervalo, as duas com id
  // externo da Meta.
  //
  // A reserva é tomada ANTES de executar. Consultar-executar-gravar não serve
  // aqui: a segunda requisição chega com a primeira ainda falando com a Meta.
  const escopo = {
    organizationId: activeOrg.orgId,
    chave: chaveDoCabecalho(req.headers),
    endpoint: "/api/v1/messages",
    requestHash: hashDoPedido(input),
  };
  const admin = createAdminClient();
  const reserva = await reservarExecucao(admin, escopo);

  if (reserva.estado === "repetida") {
    // A MESMA mensagem que a primeira tentativa criou, com o mesmo id. Devolver
    // erro aqui faria o atendente ver falha numa mensagem que saiu — e reenviar
    // à mão, trazendo a duplicata de volta pela porta da frente.
    return ok(reserva.corpo, { status: 200, requestId });
  }

  if (reserva.estado === "em_andamento") {
    // A primeira tentativa ainda está falando com a Meta. Não executamos de
    // novo, e o código diz exatamente isso — não é falha da mensagem.
    return fail(
      "idempotency_conflict",
      "Esta mensagem já está sendo enviada. Aguarde a confirmação.",
      409,
      { requestId },
    );
  }

  try {
    const message = await sendMessageHandler(
      supabase,
      {
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
      },
      input as SendMessageInput,
    );
    await guardarResultado(admin, escopo, {
      status: 201,
      corpo: message as unknown as Record<string, unknown>,
    });
    return ok(message, { status: 201, requestId });
  } catch (err) {
    // Falha SOLTA a reserva: guardar erro faria uma indisponibilidade curta
    // virar erro permanente por 24 horas para esta chave, e a retentativa —
    // que é o que salvaria a mensagem — encontraria uma reserva morta.
    await soltarReserva(admin, escopo);
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, { requestId });
    }
    throw err;
  }
}
