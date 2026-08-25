import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { redirect } from "next/navigation";
import { getWahaClient } from "@/lib/waha/client";
import { ConnectWhatsappClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function ConnectWhatsappPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/login");

  const wahaConfigured = getWahaClient() !== null;

  // A volta do canal oficial depende deste valor, e o `install.sh` NÃO o
  // escreve — numa instalação recém-feita ele está sempre ausente. Lido aqui,
  // no servidor, para a tela poder avisar ANTES de a pessoa ir atrás de três
  // credenciais no painel: sem ele o número envia e nunca recebe, que é
  // exatamente o modo de falha que ninguém procura porque não reclama.
  const oficialPodeReceber = Boolean(process.env.META_WEBHOOK_VERIFY_TOKEN);
  // We don't try to start the session at SSR — client kicks off the call
  // (and shows graceful banner if WAHA is not reachable).

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Dê um telefone a ele</h2>
        <p className="text-sm text-muted-foreground">
          É por este número que ele vai atender seus clientes. Se você conecta pelo
          celular, tenha ele por perto.
        </p>
      </header>
      <ConnectWhatsappClient
        wahaConfigured={wahaConfigured}
        sessionName={`org_${activeOrg.orgId.slice(0, 8)}`}
        oficialPodeReceber={oficialPodeReceber}
      />
    </div>
  );
}
