import Link from "next/link";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TeamMembersClient } from "./_components/TeamMembersClient";
import { AttendantsClient } from "./_components/AttendantsClient";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  const isAdmin = !!activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin;
  const isManager = !!activeOrg && ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;
  const idioma = normalizarIdioma(user.locale);
  const t = (texto: string) => traduzir(texto, idioma);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{t("Equipe")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("Gestão de membros, roles e atendimento do tenant.")}
          </p>
        </div>
        {isAdmin ? (
          <Button asChild className="shrink-0">
            <Link href="/app/team/invite">{t("Convidar membros")}</Link>
          </Button>
        ) : null}
      </header>

      <Tabs defaultValue="members" className="flex flex-1 flex-col">
        <TabsList>
          <TabsTrigger value="members">{t("Membros")}</TabsTrigger>
          <TabsTrigger value="attendants">{t("Atendimento")}</TabsTrigger>
        </TabsList>
        <TabsContent value="members" className="mt-4">
          <TeamMembersClient currentUserId={user.id} canManage={isAdmin} />
        </TabsContent>
        <TabsContent value="attendants" className="mt-4">
          {isManager ? (
            <AttendantsClient canManage={isManager} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("A gestão de atendimento está disponível para gerentes e administradores.")}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
