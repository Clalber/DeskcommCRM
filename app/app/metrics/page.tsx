import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { ROLE_RANK } from "@/lib/auth/types";

import { MetricsClient } from "./_components/MetricsClient";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  // spec 13 §6.1: agent vê as próprias (RLS); a comparação por atendente é manager+.
  const canCompare = !!activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;
  const idioma = user.idioma;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Desempenho", idioma)}</h1>
        <p className="text-sm text-muted-foreground">
          {canCompare
            ? traduzir("Atrito, funil e performance por atendente nos últimos 30 dias.", idioma)
            : traduzir("Atrito, seu funil e sua performance nos últimos 30 dias.", idioma)}
        </p>
      </header>

      <MetricsClient canCompare={canCompare} currentUserId={user.id} />
    </div>
  );
}
