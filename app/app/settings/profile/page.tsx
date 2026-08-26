import { requireAuth } from "@/lib/auth/server";
import { traduzir } from "@/lib/i18n/dicionario";
import { normalizarIdioma } from "@/lib/i18n/idiomas";
import { ProfileForm } from "./_form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireAuth();
  // `locale` já vem tipado em AuthUser (loadAuthUser lê user_metadata.locale) —
  // o comentário antigo dizia que não vinha; estava desatualizado. `timezone`
  // não está em AuthUser e segue pelo cast do meta, como full_name/avatar_url.
  const meta = user as unknown as {
    full_name: string | null;
    avatar_url: string | null;
    timezone?: string | null;
  };
  const idioma = normalizarIdioma(user.locale);
  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Perfil", idioma)}</h1>
        <p className="text-sm text-muted-foreground">
          {traduzir("Informações pessoais. Email só pode ser trocado em breve.", idioma)}
        </p>
      </header>
      <ProfileForm
        email={user.email}
        initialFullName={meta.full_name}
        initialAvatarUrl={meta.avatar_url}
        initialLocale={idioma}
        initialTimezone={meta.timezone ?? "America/Sao_Paulo"}
      />
    </div>
  );
}
