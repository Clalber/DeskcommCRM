import { requireAuth } from "@/lib/auth/server";
import { ConnectNuvemshopClient } from "./_client";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { traduzir } from "@/lib/i18n/dicionario";

export const dynamic = "force-dynamic";

export default async function ConnectNuvemshopPage() {
  const user = await requireAuth();
  const idioma = normalizarIdioma(user.locale);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{traduzir("Conectar Nuvemshop", idioma)}</h2>
        <p className="text-sm text-muted-foreground">
          {traduzir("Importe pedidos, clientes e produtos da sua loja Nuvemshop.", idioma)}
        </p>
      </header>
      <ConnectNuvemshopClient />
    </div>
  );
}
