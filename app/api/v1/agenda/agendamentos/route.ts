/**
 * `/api/v1/agenda/agendamentos` — a rota, FINA.
 *
 * Ela faz três coisas e nenhuma delas é regra: autentica, valida a forma do
 * corpo, e traduz o resultado (ou o `ApiError`) em resposta HTTP. A decisão mora
 * em `_handler.ts`, e a razão é que uma ferramenta MCP não chama rota Next — não
 * há `request`, não há cookie, e a rota devolve `Response` em vez de dado. Rota
 * e tool chamam a MESMA função, e nenhuma das duas reimplementa a decisão.
 *
 * Piso `agent` nos três verbos: marcar, remarcar e cancelar são mutação, e quem
 * só olha a agenda não muda nada nela.
 */
import { randomUUID } from "node:crypto";

import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

import {
  alterarAgendamentoHandler,
  cancelarAgendamentoHandler,
  marcarAgendamentoHandler,
} from "./_handler";

const marcarSchema = z.object({
  event_type_id: z.string().uuid(),
  starts_at: z.string().datetime({ offset: true }),
  owner_user_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  notes: z.string().max(2000).optional(),
});

const alterarSchema = z
  .object({
    id: z.string().uuid(),
    /** Remarcar: o novo início. A duração vem do tipo, como na criação. */
    starts_at: z.string().datetime({ offset: true }).optional(),
    /**
     * `rescheduled` NÃO entra aqui: remarcar se pede mandando `starts_at`, e é
     * movimento próprio — não uma situação que se escolhe.
     */
    status: z.enum(["confirmed", "completed", "no_show"]).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((c) => c.starts_at !== undefined || c.status !== undefined || c.notes !== undefined, {
    message: "Informe pelo menos um campo para alterar.",
  });

const cancelarSchema = z.object({
  id: z.string().uuid(),
  /**
   * ⚠️ OBRIGATÓRIO, e não é burocracia: é o que a equipe lê ao ver o horário
   * vago. "Cancelado" sem motivo faz alguém ligar para o cliente perguntando o
   * que houve — ou, pior, não ligar.
   */
  reason: z.string().min(3).max(500),
});

export async function POST(req: NextRequest): Promise<Response> {
  return despachar(req, marcarSchema, marcarAgendamentoHandler, 201);
}

export async function PATCH(req: NextRequest): Promise<Response> {
  return despachar(req, alterarSchema, alterarAgendamentoHandler, 200);
}

export async function DELETE(req: NextRequest): Promise<Response> {
  return despachar(req, cancelarSchema, cancelarAgendamentoHandler, 200);
}

/**
 * O caminho comum dos três verbos: papel, forma, handler, tradução.
 *
 * Um só, e não três cópias, porque a diferença entre eles é o schema e a função
 * — o resto é idêntico, e três cópias divergiriam no primeiro ajuste, que é
 * exatamente o defeito que a extração do handler veio consertar.
 */
async function despachar<T>(
  req: NextRequest,
  schema: z.ZodType<T>,
  handler: (
    supabase: Awaited<ReturnType<typeof createClient>>,
    ctx: { organization_id: string; actor: { type: "user"; id: string }; requestId: string },
    input: T,
  ) => Promise<Record<string, unknown>>,
  status: 200 | 201,
): Promise<Response> {
  const requestId = randomUUID();

  const authz = await requireRole("agent", { requestId, resource: "agenda" });
  if (!authz.ok) return authz.response;
  const { org: activeOrg, user } = authz;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Dados inválidos.", 422, {
      details: (parsed.error as z.ZodError).flatten().fieldErrors as Record<string, unknown>,
      requestId,
    });
  }

  const supabase = await createClient();
  try {
    const resultado = await handler(
      supabase,
      {
        // A organização vem do COOKIE VALIDADO, nunca do corpo. Pela tool, ela
        // vem do contexto do agente — e é por isso que o handler a recebe como
        // parâmetro em vez de resolvê-la sozinho.
        organization_id: activeOrg.orgId,
        actor: { type: "user", id: user.id },
        requestId,
      },
      parsed.data,
    );
    return ok(resultado, { requestId, status });
  } catch (err) {
    if (err instanceof ApiError) {
      return fail(err.code, err.message, err.status, {
        details: err.details as Record<string, unknown> | undefined,
        requestId,
      });
    }
    throw err;
  }
}
