import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { ROLE_RANK } from "@/lib/auth/types";
import { AuditClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  const idioma = normalizarIdioma(user.locale);
  if (!user.is_platform_admin && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-sm text-muted-foreground">
          {traduzir("Histórico append-only de mutações na organização. Manager+.", idioma)}
        </p>
      </header>
      <AuditClient />
    </div>
  );
}
