/**
 * Os números NOSSOS que podem ser avisados por automação.
 *
 * ⚠️ Por que isto é uma lista, e não um campo digitado na regra
 *
 * A ação `notify_number` só envia para número REGISTRADO aqui. Sem a amarra, um
 * erro de digitação na regra — ou uma regra adulterada — vira disparo de
 * WhatsApp pelo número da empresa para qualquer número do mundo. A lista é a
 * diferença entre "avisar minha equipe" e "um enviador de mensagens arbitrário".
 */
import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { phoneLookupVariants, samePhone } from "@/lib/channels/phone-variants";
import { createClient } from "@/lib/supabase/server";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "org_notify_numbers" });
  if (!authz.ok) return authz.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_notify_numbers")
    .select("id, phone_e164, label, created_at")
    .eq("organization_id", authz.org.orgId)
    .order("created_at", { ascending: true });

  if (error) return fail("internal_error", "Falha ao listar os números.", 500, { requestId });
  return ok(data ?? [], { requestId });
}

const bodySchema = z
  .object({
    // Aceita como a pessoa digita — com espaço, parêntese, traço. A canonização
    // é nossa, não dela.
    phone: z.string().min(8).max(32),
    label: z.string().min(1).max(80),
  })
  .strict();

/**
 * ⚠️ Número sem DDI é BRASILEIRO, e isso precisa ser dito aqui.
 *
 * `canonicalPhoneBR` não inventa país: sem o `55` na frente, `(19) 99740-3473`
 * vira `+19997403473` — um número dos ESTADOS UNIDOS. A allowlist existe
 * justamente para o aviso não sair para um desconhecido, e sem esta função ela
 * produziria exatamente isso quando o dono digitasse no formato que a tela
 * ensina no placeholder.
 *
 * Também recusa lixo: `canonicalPhoneBR` devolve a entrada crua quando não há
 * dígito nenhum, então "aaaa" passaria e viraria o destino `"@c.us"`.
 */
export function numeroBrasileiroCanonico(bruto: string): string | null {
  const digitos = bruto.replace(/\D+/g, "");
  if (digitos.length < 10) return null;
  // 10 ou 11 dígitos = DDD + local, sem país. 12 ou 13 já vêm com o 55.
  const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
  if (!/^55[1-9][0-9]\d{8,9}$/.test(comPais)) return null;
  return `+${comPais}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "org_notify_numbers" });
  if (!authz.ok) return authz.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return fail("validation_failed", "Informe o número e um nome para ele.", 422, { requestId });
  }

  const phone = numeroBrasileiroCanonico(parsed.data.phone);
  if (!phone) {
    return fail(
      "validation_failed",
      "Número de WhatsApp inválido. Use DDD + número, como (19) 99740-3473.",
      422,
      { requestId },
    );
  }

  const supabase = await createClient();

  // ─── O número do PRÓPRIO canal não serve ─────────────────────────────────
  //
  // É a borda óbvia: a pessoa cadastra o número que tem à mão, e é justamente o
  // número conectado. O CRM mandaria o aviso para si mesmo — não atende ao
  // pedido ("um número FORA da plataforma") e o eco fica ambíguo.
  const { data: sessoes } = await supabase
    .from("channel_sessions")
    .select("phone_number")
    .eq("organization_id", authz.org.orgId);
  const ehOProprioCanal = (sessoes ?? []).some(
    (s) => s.phone_number && samePhone(s.phone_number as string, phone),
  );
  if (ehOProprioCanal) {
    return fail(
      "validation_failed",
      "Este é o número que a plataforma usa para enviar. Escolha outro — o aviso precisa chegar em um aparelho diferente.",
      422,
      { requestId },
    );
  }

  const { data, error } = await supabase
    .from("org_notify_numbers")
    .insert({
      organization_id: authz.org.orgId,
      phone_e164: phone,
      label: parsed.data.label,
      created_by: authz.user.id,
    })
    .select("id, phone_e164, label, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return fail("conflict", "Este número já está cadastrado.", 409, { requestId });
    }
    return fail("internal_error", "Falha ao cadastrar o número.", 500, { requestId });
  }

  await audit({
    action: "automation.notify_number_created",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "org_notify_number",
    resourceId: data.id as string,
    requestId,
    // O rótulo, não o telefone: número de pessoa da equipe é dado pessoal, e
    // registro operacional não é cópia de dado pessoal.
    metadata: { label: parsed.data.label },
  });

  // ⚠️ Aviso, não bloqueio: o número pode legitimamente ser também um cliente.
  // Quem decide é quem cadastrou — mas ele precisa saber, porque a partir daqui
  // as mensagens de aviso NÃO aparecem na conversa dele.
  // `in` com as variantes, não `eq`: a mesma pessoa está cadastrada com 12 ou
  // 13 dígitos conforme o nono, e igualdade crua não casa as duas grafias.
  const { data: contato } = await supabase
    .from("contacts")
    .select("id, display_name")
    .eq("organization_id", authz.org.orgId)
    .in("phone_number", phoneLookupVariants(phone).map((v) => v.replace("+", "")))
    .maybeSingle();

  return ok(
    { ...data, tambem_e_contato: contato ? { id: contato.id, nome: contato.display_name } : null },
    { requestId },
  );
}
