import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

import { TiposDeAgendamentoClient, type TipoRow } from "./_client";

export const dynamic = "force-dynamic";

/**
 * TIPOS DE AGENDAMENTO — a configuração que o produto prometia e não tinha.
 *
 * ─── Por que aqui, e não dentro da Agenda ────────────────────────────────
 *
 * O comentário do `lib/navigation/registry.ts` já dizia, antes de esta tela
 * existir: *"Os TIPOS de agendamento e a disponibilidade — que são configuração
 * de verdade — vão para Configurações quando existirem."* A Agenda é onde o dia
 * ACONTECE; aqui é onde ele se configura.
 *
 * ─── O que estava faltando ───────────────────────────────────────────────
 *
 * A `calendar_event_types` tem dez categorias no CHECK, duração, buffers,
 * antecedência mínima, janela de agendamento e local — e não havia como criar ou
 * editar um tipo por lugar nenhum. Toda organização recebia três tipos semeados
 * (`fn_semear_tipos_de_agendamento`) e ficava com eles para sempre; uma clínica
 * que quisesse "Retorno de 15 minutos" não tinha caminho.
 */
export default async function TiposDeAgendamentoPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  // `viewer` vê a lista (é informação de operação: quanto dura uma consulta);
  // criar e alterar é `manager`, e a rota cobra de novo — a tela esconder não é
  // autorização, é cortesia.
  const podeEditar = user.is_platform_admin || ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  const supabase = await createClient();
  const [{ data: tipos }, { data: pessoas }] = await Promise.all([
    supabase
      .from("calendar_event_types")
      .select(
        "id, name, slug, description, category, duration_minutes, location_kind, location_details, default_owner_user_id, requires_confirmation, is_active",
      )
      .eq("organization_id", activeOrg.orgId)
      .order("is_active", { ascending: false })
      .order("name"),
    supabase
      .from("user_organizations")
      .select("user_id, role")
      .eq("organization_id", activeOrg.orgId)
      .is("revoked_at", null),
  ]);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Tipos de agendamento</h1>
        <p className="mt-1 text-sm text-text-muted">
          O que se pode marcar, quanto dura e quem atende. É isto que a tela de marcar e o
          agente de IA oferecem ao cliente.
        </p>
      </header>
      <TiposDeAgendamentoClient
        tiposIniciais={(tipos ?? []) as TipoRow[]}
        pessoas={(pessoas ?? []).map((p) => ({ id: String(p.user_id), papel: String(p.role) }))}
        podeEditar={podeEditar}
      />
    </div>
  );
}
