import { redirect } from "next/navigation";

import { faltaParaConectarOGoogle, googleEstaConfigurado } from "@/lib/agenda/google/config";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";

import { AgendaClient } from "./_client";

export const dynamic = "force-dynamic";

/**
 * A Agenda.
 *
 * O servidor resolve só a SEMENTE — quem é, de que organização, e em que fuso a
 * grade deve ser desenhada. O dado vivo vem do cliente por `/api/v1/agenda`,
 * porque o cookie de sessão é `httpOnly` e o supabase-js do browser não o lê:
 * `auth.uid()` viria null e a RLS esconderia tudo. É a razão estrutural que o
 * resto do produto já segue.
 *
 * O FUSO É DA APRESENTAÇÃO, não da regra (decisão 4 da entrega): quem está em
 * Manaus vê a grade no horário de Manaus, enquanto as janelas de trabalho
 * continuam valendo no fuso da jornada. São perguntas diferentes e por isso duas
 * fontes — e este campo do perfil, oferecido pela tela há meses, ganha aqui o
 * primeiro leitor de verdade.
 */
export default async function AgendaPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  // `user.timezone` e não `user_metadata.timezone`: o AuthUser deste projeto
  // não expõe o metadata cru — ele extrai o que toda tela precisa no primeiro
  // render, como já fazia com o `locale`. O fuso entrou lá pela mesma razão.
  const fusoDeApresentacao = user.timezone ?? null;

  // Resolvido no SERVIDOR: `GOOGLE_CALENDAR_*` é env de servidor e não pode
  // atravessar para o cliente. A tela recebe o booleano e a lista do que falta,
  // nunca o segredo.
  const googleConfigurado = googleEstaConfigurado();
  const faltaNoGoogle = googleConfigurado ? [] : faltaParaConectarOGoogle();

  return (
    <AgendaClient
      fusoDeApresentacao={fusoDeApresentacao}
      googleConfigurado={googleConfigurado}
      faltaNoGoogle={faltaNoGoogle}
    />
  );
}
