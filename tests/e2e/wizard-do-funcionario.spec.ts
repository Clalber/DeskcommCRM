/**
 * O WIZARD, PELA TELA, DENTRO DO CI.
 *
 * A jornada de instalação fresca é a P0 da doutrina de QA deste projeto — é o
 * produto que se vende — e é a ÚNICA spec fora do gate, porque depende de WAHA,
 * Redis, Resend e Nuvemshop. O resultado é que o onboarding pôde apodrecer sem
 * nada ficar vermelho: foi assim que oito premissas mortas chegaram até aqui.
 *
 * Esta spec cobre o que dá para cobrir sem esses serviços — que é quase tudo:
 * o wizard inteiro, do login ao "Começar a usar". Fica de fora só o ensaio com
 * resposta de verdade, que precisa de chave de IA com saldo.
 *
 * ISOLAMENTO: cria a PRÓPRIA organização, com o próprio dono. O seed do CI
 * entrega a organização compartilhada já onboardada, e zerar o estado dela para
 * testar o wizard mandaria todas as specs seguintes para dentro do onboarding.
 */
import { randomUUID } from "node:crypto";

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const SENHA = "WizardQa!2026#Deskcomm";
const email = `wizard-${randomUUID().slice(0, 8)}@qa.local`;

let userId = "";
let orgId = "";

/**
 * O estado que o `install.sh` deixa: dono criado, organização com o nome
 * placeholder, provedor de IA escolhido no terminal, e `onboarded_at` nulo.
 */
test.beforeAll(async () => {
  const { data: criado, error: errUser } = await svc.auth.admin.createUser({
    email,
    password: SENHA,
    email_confirm: true,
  });
  if (errUser || !criado.user) throw errUser ?? new Error("sem usuário");
  userId = criado.user.id;

  const { data: org, error: errOrg } = await svc
    .from("organizations")
    .insert({
      slug: `minha-empresa-${randomUUID().slice(0, 8)}`,
      display_name: "Minha Empresa",
      legal_name: "Minha Empresa",
      status: "active",
      created_by: userId,
      settings: { llm: { provider: "anthropic" } },
    })
    .select("id")
    .single();
  if (errOrg || !org) throw errOrg ?? new Error("sem org");
  orgId = org.id as string;

  await svc.from("user_organizations").insert({
    organization_id: orgId,
    user_id: userId,
    role: "admin",
    accepted_at: new Date().toISOString(),
  });
});

test.afterAll(async () => {
  if (orgId) {
    await svc.from("ai_agent_runs").delete().eq("organization_id", orgId);
    await svc.from("ai_agent_versions").delete().eq("organization_id", orgId);
    await svc.from("ai_agents").delete().eq("organization_id", orgId);
    await svc.from("org_memory_pointers").delete().eq("organization_id", orgId);
    await svc.from("org_memory_versions").delete().eq("organization_id", orgId);
    await svc.from("user_organizations").delete().eq("organization_id", orgId);
  }
  if (userId) await svc.auth.admin.deleteUser(userId);
});

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(SENHA);
  await page.getByRole("button", { name: /entrar/i }).click();
}

test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("o wizard monta um funcionário", () => {
  test("abre mostrando o que a instalação já trouxe, e não pede o nome de novo", async ({
    page,
  }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });

    // O passo 1 começa pelo que já existe — em vez de um formulário em branco.
    await expect(page.getByText(/já está de pé/i)).toBeVisible();

    // O instalador nunca pergunta o nome do negócio: a organização nasce
    // "Minha Empresa". Mandar isso como valor inicial obrigava a pessoa a
    // apagá-lo, e quem não percebia ficava com o placeholder para sempre.
    await expect(page.locator("#display_name")).toHaveValue("");
  });

  test("o aceite de termos leva a documentos que EXISTEM", async ({ page }) => {
    // O checkbox é obrigatório e linkava duas páginas que respondiam 404.
    for (const href of ["/legal/terms", "/legal/privacy"]) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBe(200);
    }
  });

  test("o nome do negócio chega ao cabeçalho do passo seguinte", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/welcome/, { timeout: 30_000 });

    await page.locator("#display_name").fill("Clínica Bem Viver");
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });

    // O layout do wizard é compartilhado entre os passos e não re-renderizava:
    // o cabeçalho seguia dizendo "Minha Empresa" o onboarding inteiro, mesmo
    // com o banco já gravado.
    // `.first()`: há dois <header> na página — o do wizard (com a marca e o
    // nome do negócio) e o do passo. O do layout é o que congelava.
    const cabecalho = page.locator("header").first();
    await expect(cabecalho).toContainText("Clínica Bem Viver");
    await expect(cabecalho).not.toContainText("Minha Empresa");
  });

  test("o passo do telefone não expõe identificador interno nem enum", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/connect-whatsapp/, { timeout: 30_000 });

    const corpo = page.locator("body");
    // Mostrava "Sessão: org_f3d61bc0" e "Status: INIT".
    await expect(corpo).not.toContainText(/Sessão:/i);
    await expect(corpo).not.toContainText(/Status:\s*(INIT|STARTING|SCAN_QR_CODE|WORKING)/);
    // E nunca mais manda rodar Docker nem aponta para um menu que não existe.
    await expect(corpo).not.toContainText(/docker compose/i);
    await expect(corpo).not.toContainText(/Configurações → Canais/i);

    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });
  });

  test("treinar: pede as regras da casa e mostra o que ele já sabe fazer", async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/setup-ai/, { timeout: 30_000 });

    await expect(page.getByRole("heading", { name: /treine seu funcionário/i })).toBeVisible();
    // As duas listas que não pedem configuração nenhuma.
    await expect(page.getByText(/ele já vem sabendo/i)).toBeVisible();
    await expect(page.getByText(/e nunca vai fazer/i)).toBeVisible();

    await page.locator("#name").fill("Bia");
    await page.locator("#regras_da_casa").fill("Horário: 8h às 18h. Nunca prometa desconto.");
    await page.getByRole("button", { name: /criar e continuar/i }).click();

    // O passo novo não pode ser pulado no caminho de sucesso — era o que o
    // destino fixo da action fazia.
    await page.waitForURL(/\/onboarding\/testar/, { timeout: 30_000 });
  });

  test("as regras da casa viraram memória da organização, não prompt do agente", async () => {
    const { data: mem } = await svc
      .from("org_memory_versions")
      .select("content")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();
    expect(mem?.content).toContain("Nunca prometa desconto");

    // Elas valem para QUALQUER agente da organização; no prompt deste, a
    // segunda contratação nasceria sem elas.
    const { data: versao } = await svc
      .from("ai_agent_versions")
      .select("system_prompt, provider, tool_ids, pipeline_ids")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle();
    expect(versao?.system_prompt).not.toContain("Nunca prometa desconto");
    // E o funcionário nasce podendo mexer no CRM.
    expect(versao?.provider).toBe("anthropic");
    expect((versao?.tool_ids as string[])?.length ?? 0).toBeGreaterThan(0);
  });

  test("o wizard termina apresentando o sistema, e o resumo não acusa passo inexistente", async ({
    page,
  }) => {
    await login(page);
    await page.waitForURL(/\/onboarding\/testar/, { timeout: 30_000 });
    await page.getByRole("button", { name: /^continuar$/i }).click();

    await page.waitForURL(/\/onboarding\/invite-team/, { timeout: 30_000 });
    await page.getByRole("button", { name: /pular por enquanto/i }).click();
    await page.waitForURL(/\/onboarding\/done/, { timeout: 30_000 });

    // O tour: as peças apresentadas pelo que fazem.
    await expect(page.getByText(/o que mais tem aqui/i)).toBeVisible();
    await expect(page.getByText(/voltar a falar com quem sumiu/i)).toBeVisible();

    // A integração de loja vem desligada: o passo não existe nesta instalação,
    // e o resumo listava "Loja Nuvemshop (pulado)" — acusando a pessoa de não
    // fazer o que ninguém lhe ofereceu.
    await expect(page.locator("body")).not.toContainText(/Nuvemshop/i);

    await page.getByRole("button", { name: /começar a usar/i }).click();
    await page.waitForURL(/\/app\//, { timeout: 30_000 });

    const { data: org } = await svc
      .from("organizations")
      .select("onboarded_at, display_name")
      .eq("id", orgId)
      .maybeSingle();
    expect(org?.onboarded_at).toBeTruthy();
    expect(org?.display_name).toBe("Clínica Bem Viver");
  });
});
