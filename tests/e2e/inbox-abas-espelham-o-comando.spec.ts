/**
 * AS ABAS DA INBOX MOSTRAM QUEM MANDA — PELA TELA.
 *
 * ## O defeito, medido na VPS de um usuário em 2026-08-30
 *
 * As abas descreviam quem estava no comando lendo `conversations.status`, coluna
 * que o motor de IA nunca consulta:
 *
 *     aba "IA"   (?status=ai_handling)              ->  2 conversas
 *     aba "Fila" (sem dono + status open|pending)   -> 83 conversas
 *     o motor realmente atenderia                   -> 49 conversas
 *
 * O dono abria a Inbox, via 83 pessoas "aguardando atendente" e concluía que
 * tinha uma montanha de trabalho parado — quando 47 daquelas estavam sendo
 * respondidas pelo robô naquele instante. E a aba que deveria mostrar o robô
 * trabalhando ficava vazia, sugerindo que a IA tinha parado.
 *
 * ## Por que uma spec de tela, e não só o invariante
 *
 * `tests/invariants/comando-da-conversa-espelha-o-ts.test.ts` prova que o banco e
 * o TypeScript concordam sobre o COMANDO. Nada nele prova que a ABA pede o
 * filtro certo, que o hook o serializa na query string, que a rota o aceita e
 * que a lista renderiza o resultado. Entre a regra e a linha na tela há um
 * `tabToFilter`, um `qs.set`, um Zod e um `.in()` — e o `qs.set` esquecido é
 * exatamente o defeito que passa por todo gate de tipo: a aba pediria filtro
 * nenhum e mostraria a lista inteira, parecendo funcionar.
 */
import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { carregarEnvLocal } from "../../scripts/lib/env-de-teste";
import { lerCreds, loginComoAdmin } from "./helpers/login-admin";

const env = carregarEnvLocal();
const admin: SupabaseClient = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/** Nomes próprios e improváveis: a org de teste é compartilhada entre specs. */
const ESPERANDO = "Zoraide Fila-Humana";
const ROBO = "Xisto Robo-Conduzindo";
const SESSAO = "aaaaaaaa-e2e0-4000-8000-00000000ab01";

async function limpar(orgId: string) {
  for (const nome of [ESPERANDO, ROBO]) {
    const { data } = await admin
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("display_name", nome);
    for (const c of data ?? []) {
      await admin.from("conversations").delete().eq("contact_id", (c as { id: string }).id);
      await admin.from("contacts").delete().eq("id", (c as { id: string }).id);
    }
  }
  await admin.from("channel_sessions").delete().eq("id", SESSAO);
}

async function semear(orgId: string) {
  await limpar(orgId);
  const { error: eSess } = await admin.from("channel_sessions").insert({
    id: SESSAO,
    organization_id: orgId,
    waha_session_name: `abas-comando-${Date.now()}`,
    webhook_secret_encrypted: "\\x00",
    status: "WORKING",
  });
  if (eSess) throw new Error(`fixture de canal falhou: ${eSess.message}`);

  const agora = new Date().toISOString();
  for (const [nome, silencio] of [
    // Escalada: o silêncio é o que a põe esperando uma pessoa — e não o status.
    [ESPERANDO, "infinity"],
    // Aberta e sem trava: é o robô que responde a próxima mensagem dela.
    [ROBO, null],
  ] as const) {
    const { data: ct, error: eCt } = await admin
      .from("contacts")
      .insert({ organization_id: orgId, display_name: nome })
      .select("id")
      .single();
    if (eCt) throw new Error(`fixture de contato falhou: ${eCt.message}`);
    const { error: eConv } = await admin.from("conversations").insert({
      organization_id: orgId,
      contact_id: (ct as { id: string }).id,
      channel_session_id: SESSAO,
      status: "open",
      assigned_to_user_id: null,
      bot_silenced_until: silencio,
      last_inbound_at: agora,
      last_message_at: agora,
      last_message_preview: `mensagem de ${nome}`,
    });
    if (eConv) throw new Error(`fixture de conversa falhou: ${eConv.message}`);
  }
}

test.describe("Inbox: as abas perguntam quem manda", () => {
  // O teto global é 30 s e não cabe: só o login com MFA já consome uma boa parte
  // dele. Mesmo número da spec irmã `inbox-quem-manda.spec.ts`.
  test.describe.configure({ timeout: 180_000 });

  let orgId = "";

  test.beforeEach(async () => {
    orgId = (lerCreds() as unknown as { org_id: string }).org_id;
    await semear(orgId);
  });

  test.afterEach(async () => {
    if (orgId) await limpar(orgId);
  });

  test("Fila mostra só quem espera uma PESSOA; Automático mostra o que o robô conduz", async ({
    page,
  }) => {
    await loginComoAdmin(page, lerCreds());
    await page.goto("/app/inbox");

    const lista = page.getByRole("main").or(page.locator("body"));
    await expect(lista.getByText(ESPERANDO).first()).toBeVisible({ timeout: 30_000 });

    // ── FILA: quem realmente precisa de gente.
    // `tab`, não `button`: as abas são `TabsTrigger` do shadcn. E o nome vem por
    // REGEX porque o contador entra no nome acessível ("Fila 36") — `exact` aqui
    // nunca casaria. Mesmo idioma da spec irmã `inbox-quem-manda.spec.ts`.
    await page.getByRole("tab", { name: /Fila/i }).first().click();
    await expect(page.getByText(ESPERANDO).first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(ROBO),
      "a Fila listou uma conversa que o automático está conduzindo — o defeito voltou",
    ).toHaveCount(0);

    // ── AUTOMÁTICO: a outra direção, e ela é a que impede um 'conserto' que
    // simplesmente esvazie a Fila.
    await page.getByRole("tab", { name: /Autom/i }).first().click();
    await expect(page.getByText(ROBO).first()).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(ESPERANDO),
      "a aba do automático listou uma conversa escalada para humano",
    ).toHaveCount(0);
  });
});
