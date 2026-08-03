import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/**
 * Hub de Canais.
 *
 * Conectar um número tinha duas respostas dependendo de qual WhatsApp era: o
 * por QR vivia em Conexões, o oficial da Meta em Configurações. Aqui as duas
 * ficam lado a lado, junto das fontes de dados externas (loja, webhooks).
 */
export default async function CanaisHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);

  return (
    <NavHub
      group="canais"
      isPlatformAdmin={user.is_platform_admin}
      role={activeOrg?.role ?? null}
      title="Canais"
      subtitle="Por onde as mensagens entram e saem, e o que traz dados de fora."
    />
  );
}
