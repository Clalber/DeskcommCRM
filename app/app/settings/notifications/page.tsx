import { requireAuth } from "@/lib/auth/server";
import { Card } from "@/components/ui/card";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";
import { NotificationPrefsClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireAuth();
  const idioma = normalizarIdioma(user.locale);
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          {traduzir("Notificações", idioma)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {traduzir("Canais e categorias.", idioma)}
        </p>
      </header>

      <Card className="border-amber-500/40 bg-amber-50/40 p-4 text-sm dark:bg-amber-900/10">
        {traduzir(
          "Email ainda não está disponível. In-app (toast) e Push (Chrome) já funcionam para as cinco categorias.",
          idioma,
        )}
      </Card>

      <NotificationPrefsClient />
    </div>
  );
}
