import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { ROLE_RANK } from "@/lib/auth/types";
import { TemplatesClient } from "./_components/TemplatesClient";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app/inbox");
  const canShare = ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;
  const idioma = user.idioma;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        {/* "Respostas rápidas", não "Templates": estes são scripts do atendente,
            consumidos pelo composer do inbox. O nome "Templates" pertence aos da
            Meta (HSM), em Canais, onde é o termo técnico correto. Duas telas com
            o mesmo nome e propósitos opostos confundiam. A URL não muda. */}
        <h1 className="text-2xl font-semibold tracking-tight">
          {traduzir("Respostas rápidas", idioma)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {traduzir(
            "Scripts salvos para responder mais rápido; pessoais ou compartilhados com a equipe.",
            idioma,
          )}
        </p>
      </header>
      <TemplatesClient canShare={canShare} currentUserId={user.id} />
    </div>
  );
}
