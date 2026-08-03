import { NavHub } from "@/components/shell/NavHub";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

/**
 * Hub de Organização.
 *
 * A lista de cards que vivia aqui era uma segunda navegação escrita à mão, e
 * divergia do sidebar — Funis, Conexões, canal oficial e Audit Log apareciam
 * como se fossem configuração, quando são CRM, Canais e Análise. Agora o
 * conteúdo vem do registro, e o que sobra aqui é o que de fato é organização:
 * sua conta, sua empresa, e quem tem acesso ao quê.
 */
export default async function SettingsHubPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);

  return (
    <NavHub
      group="organizacao"
      isPlatformAdmin={user.is_platform_admin}
      role={activeOrg?.role ?? null}
      title="Configurações"
      subtitle="Sua conta, os dados da empresa e quem tem acesso ao quê."
    />
  );
}
