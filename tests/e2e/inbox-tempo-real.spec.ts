/**
 * A MENSAGEM NOVA APARECE SEM O F5 — provado pela tela, que é o que o usuário faz.
 *
 * ─── O defeito que este spec guarda ─────────────────────────────────────────
 *
 * "Recebemos mensagem e só reflete no inbox se atualizarmos a página."
 *
 * O socket do Realtime assinava com a ANON KEY: o cookie de sessão é httpOnly,
 * o supabase-js do browser não enxerga a sessão, e a callback padrão dele
 * termina em `?? this.supabaseKey`. Canal anônimo responde SUBSCRIBED, a RLS
 * filtra do outro lado, e nada é entregue — em silêncio, com todo sinal
 * disponível dizendo "saudável".
 *
 * ─── Por que ESTE teste, e não um unitário ──────────────────────────────────
 *
 * Os unitários anteriores exercitavam `setAuth` contra um cliente FAKE e
 * ficaram verdes durante todo o defeito, porque o que quebrou foi o EFEITO de
 * uma chamada, não a chamada. Só o caminho inteiro — browser real, cookie
 * httpOnly real, socket real, RLS real — prova que a entrega acontece.
 *
 * ⚠️ NÃO RECARREGA A PÁGINA depois de abrir o inbox, e isso é o teste. Se
 * alguém acrescentar um `reload()` aqui "para estabilizar", ele passa a medir o
 * F5 — exatamente o sintoma que existe para proibir.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page } from "@playwright/test";

interface E2ECreds {
  password: string;
  users: Record<string, { id: string; email: string; role: string }>;
}

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");

function creds(): E2ECreds {
  if (!fs.existsSync(CREDS_PATH)) {
    execFileSync(process.execPath, ["--import", "tsx", "scripts/seed-e2e-credentials.ts"], {
      stdio: "inherit",
    });
  }
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as E2ECreds;
}

async function login(page: Page, email: string, senha: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(senha);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/app\//);
}

/**
 * Grava uma mensagem inbound pelo mesmo caminho da ingestão: service role,
 * INSERT em `messages` + carimbo em `conversations`. Roda FORA do browser, como
 * o webhook do WhatsApp roda — se fosse pela própria página, o teste provaria
 * que a UI mostra o que ela mesma escreveu, que é outra coisa.
 */
function chegarMensagem(conversationId: string, corpo: string): void {
  execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "-e",
      `
      import { createClient } from "@supabase/supabase-js";
      import { credenciaisSupabaseDeTeste } from "./scripts/lib/env-de-teste";
      const { url, serviceRoleKey } = credenciaisSupabaseDeTeste();
      const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
      const { data: conv, error: e1 } = await admin
        .from("conversations")
        .select("id, organization_id, channel_session_id, contact_id")
        .eq("id", process.env.CONV_ID!)
        .single();
      if (e1) throw new Error("conversa: " + e1.message);
      const { error: e2 } = await admin.from("messages").insert({
        organization_id: conv.organization_id,
        conversation_id: conv.id,
        channel_session_id: conv.channel_session_id,
        contact_id: conv.contact_id,
        external_id: "e2e-tempo-real-" + Date.now(),
        direction: "inbound",
        type: "text",
        body: process.env.CORPO!,
        status: "delivered",
      });
      if (e2) throw new Error("mensagem: " + e2.message);
      // O que reordena a lista é o carimbo da última mensagem, não o insert.
      const { error: e3 } = await admin
        .from("conversations")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", conv.id);
      if (e3) throw new Error("carimbo: " + e3.message);
      `,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, CONV_ID: conversationId, CORPO: corpo },
      stdio: "inherit",
    },
  );
}

test.describe("inbox em tempo real", () => {
  test("mensagem que chega aparece na conversa aberta, sem recarregar", async ({ page }) => {
    const c = creds();
    await login(page, c.users.admin!.email, c.password);

    await page.goto("/app/inbox");
    // A aba "Todas": a conversa do seed pode estar atribuída a qualquer um, e a
    // fila (default) mostraria só as não atribuídas.
    await page.getByRole("tab", { name: /Todas/ }).click();

    // Abre a primeira conversa — o estado real de quem está atendendo: a
    // conversa na tela, esperando o cliente responder.
    const item = page.locator("[data-conversation-id]").first();
    await expect(item, "o seed precisa ter ao menos uma conversa").toBeVisible({
      timeout: 20_000,
    });
    const conversationId = await item.getAttribute("data-conversation-id");
    expect(conversationId).toBeTruthy();
    await item.click();
    await page.waitForURL(new RegExp(`/app/inbox/${conversationId}`), { timeout: 20_000 });

    // Espera o thread ASSENTAR antes de escrever. Sem isto, o refetch inicial
    // poderia trazer a mensagem e o teste passaria sem o canal ter feito nada —
    // verde pelo motivo errado, que é o modo de falha desta classe de teste.
    await expect(page.getByTestId("chat-thread")).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(2_000);

    const corpo = `chegou em tempo real ${Date.now()}`;
    chegarMensagem(conversationId!, corpo);

    // O canal está de pé ANTES de a mensagem chegar. Sem esta linha, o teste
    // passaria com o canal morto se a rede de segurança curasse a perda a tempo
    // — e a rede existe justamente para o canal morto. Verde pelo motivo errado.
    await expect(page.locator("[data-realtime-status]")).toHaveAttribute(
      "data-realtime-status",
      "subscribed",
      { timeout: 20_000 },
    );

    // ⚠️ SEM reload. Se aparecer, o canal entregou.
    await expect(page.getByText(corpo)).toBeVisible({ timeout: 25_000 });

    // E entregou pelo CANAL, não pela rede de segurança: `divergencias` conta as
    // vezes em que o refetch trouxe novidade que o canal não tinha trazido.
    await expect(page.locator("[data-refetch-divergencias]")).toHaveAttribute(
      "data-refetch-divergencias",
      "0",
    );

    // E a lista também reagiu — é o outro canal do mesmo socket, que era
    // justamente o que ficava anônimo quando dois canais coexistiam.
    await expect(page.locator("[data-conversation-id]").first()).toContainText(corpo, {
      timeout: 25_000,
    });
  });
});
