/**
 * QA EXPLORATÓRIO — não é gate, é olhar a coisa funcionando com olho crítico.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. O E2E da W4
 * (`agente-organiza-operacao.spec.ts`) prova que as capacidades FUNCIONAM: ele
 * monta os argumentos, chama por JSON-RPC e confere o efeito na tela. O que ele
 * **não** responde é se a coisa ficou BOA — se o dono do negócio entende o que
 * está ligando, e se o MODELO escolhe a ferramenta certa quando ninguém monta os
 * argumentos por ele.
 *
 * São perguntas diferentes, e a segunda só se responde usando o produto como
 * usuário: com um agente publicado de verdade e um LLM de verdade decidindo.
 * Este spec faz isso e **guarda o que viu**.
 *
 * Roda pelo MESMO endpoint que o botão "Executar teste" da tela chama
 * (`/versions/[vid]/test`) — é dry-run, nada é enviado ao cliente, e o run fica
 * registrado em `ai_agent_runs`.
 *
 * ⚠️ CONSOME CRÉDITO DE VERDADE. É o preço de saber se funciona de fato.
 * Não é gate de CI: é instrumento de observação, rodado sob demanda.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

import { generateTotp, msUntilNextTotpWindow } from "./utils/totp";

const APP_URL = `http://localhost:${process.env.E2E_PORT ?? "3001"}`;
const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const SAIDA = path.join(process.cwd(), "evidence", "ia-360-w4");

interface Creds {
  password: string;
  users: Record<string, { email: string }>;
  admin_totp?: { factor_id: string; secret: string };
}

function loadCreds(): Creds {
  if (!fs.existsSync(CREDS_PATH)) {
    execFileSync("npx", ["tsx", "scripts/seed-e2e-credentials.ts"], { stdio: "inherit" });
  }
  return JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
}

const creds = loadCreds();

/** As capacidades da W4 que cabem no teto de 20 por agente, mais o essencial de contexto. */
const CAPACIDADES = [
  "crm_list_pipelines",
  "crm_list_stages",
  "crm_create_stage",
  "crm_update_stage",
  "crm_list_tags",
  "crm_manage_tags",
  "crm_list_message_templates",
  "crm_render_message_template",
  "crm_list_webhook_sources",
  "crm_list_webhook_source_events",
  "crm_list_automation_rules",
  "crm_list_automation_runs",
  "crm_set_automation_rule_active",
  "crm_list_team_members",
];

const PROMPT = [
  "Você é o assistente de operação de uma clínica. Além de atender, você ajuda a manter a casa",
  "em ordem: conhece o funil, os marcadores em uso, as respostas prontas, as entradas automáticas",
  "de contatos e as regras automáticas.",
  "Quando perguntarem sobre a operação, USE as ferramentas para responder com o que existe de",
  "verdade — nunca invente nome de etapa, de marcador ou de regra.",
].join(" ");

/** Os cenários. Cada um é uma pergunta que um humano faria de verdade. */
const CENARIOS = [
  {
    nome: "1-ler-o-funil",
    mensagem: "Quais são as etapas do nosso funil hoje? Lista pra mim na ordem.",
    esperado: "crm_list_pipelines e/ou crm_list_stages",
  },
  {
    nome: "2-marcador-existente",
    mensagem:
      "Quero marcar este atendimento como urgente. Que marcadores a gente já usa? Não quero criar um repetido.",
    esperado: "crm_list_tags antes de qualquer crm_manage_tags",
  },
  {
    nome: "3-diagnostico-de-entrada",
    mensagem:
      "O formulário do nosso site parou de trazer contatos hoje. Consegue descobrir o que houve?",
    esperado: "crm_list_webhook_sources + crm_list_webhook_source_events",
  },
  {
    nome: "4-capacidade-apenas-humana",
    mensagem: "Cria uma etapa nova no funil chamada Pós-venda, no fim de tudo.",
    esperado: "crm_create_stage — que é apenasHumano e deve ser RECUSADA pelo papel",
  },
];

/**
 * Login como ADMIN, com MFA — porque criar versão de agente exige `admin`.
 *
 * Não é detalhe de teste: é o próprio produto dizendo quem pode mexer no
 * cérebro do assistente. Um manager configura a operação; publicar o que a IA
 * pensa é do dono.
 */
async function login(page: Page): Promise<void> {
  const secret = creds.admin_totp?.secret;
  expect(secret, "o seed precisa gravar admin_totp em .e2e-creds.json").toBeTruthy();

  await page.goto(`${APP_URL}/login`);
  await page.locator("#email").fill(creds.users.admin!.email);
  await page.locator("#password").fill(creds.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/login\/mfa/);

  for (let tentativa = 0; tentativa < 2; tentativa++) {
    // Código a menos de 3s da virada da janela expira em trânsito.
    if (msUntilNextTotpWindow() < 3_000) {
      await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    }
    await page.locator('input[aria-label="Dígito 1"]').click();
    await page.keyboard.type(generateTotp(secret!), { delay: 40 });
    try {
      await page.waitForURL(/\/app\//, { timeout: 8_000 });
      return;
    } catch {
      await page.waitForTimeout(msUntilNextTotpWindow() + 200);
    }
  }
  throw new Error("MFA falhou depois de 2 tentativas de TOTP");
}

/** Cria a versão de teste com as capacidades da W4 ligadas. */
async function versaoComAsCapacidades(req: APIRequestContext, agenteId: string): Promise<string> {
  const [credRes, canalRes] = await Promise.all([
    req.get(`${APP_URL}/api/v1/ai/credentials`),
    req.get(`${APP_URL}/api/v1/channel-sessions`),
  ]);
  const cred = (await credRes.json()) as { data?: Array<{ id: string; provider: string }> };
  const canal = (await canalRes.json()) as { data?: Array<{ id: string }> };
  const credentialId = cred.data?.find((c) => c.provider === "anthropic")?.id ?? cred.data?.[0]?.id;
  const canalId = canal.data?.[0]?.id;
  if (!credentialId || !canalId) {
    throw new Error(
      `faltou pré-requisito: credential=${credentialId ?? "?"} canal=${canalId ?? "?"}`,
    );
  }

  const res = await req.post(`${APP_URL}/api/v1/ai/agents/${agenteId}/versions`, {
    data: {
      system_prompt: PROMPT,
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      credential_id: credentialId,
      channel_session_id: canalId,
      tool_ids: CAPACIDADES,
      max_steps: 8,
    },
  });
  const corpo = await res.text();
  if (!res.ok()) throw new Error(`criar versão → ${res.status()}: ${corpo.slice(0, 400)}`);
  return (JSON.parse(corpo) as { data: { id: string } }).data.id;
}

test.describe("QA — o agente usa as mãos que a W4 entregou?", () => {
  test("um modelo de verdade escolhendo as capacidades novas", async ({ page }) => {
    test.setTimeout(600_000);
    fs.mkdirSync(SAIDA, { recursive: true });
    await login(page);

    const agentesRes = await page.request.get(`${APP_URL}/api/v1/ai/agents`);
    const agentes = (await agentesRes.json()) as { data?: Array<{ id: string; name: string }> };
    const agenteId = agentes.data?.[0]?.id;
    expect(agenteId, "a org de E2E precisa de um agente").toBeTruthy();

    const versaoId = await versaoComAsCapacidades(page.request, agenteId!);
    console.info(`[QA] versão de teste ${versaoId} com ${CAPACIDADES.length} capacidades`);

    const relatorio: string[] = [];
    for (const cenario of CENARIOS) {
      const res = await page.request.post(
        `${APP_URL}/api/v1/ai/agents/${agenteId}/versions/${versaoId}/test`,
        { data: { sample_message: cenario.mensagem }, timeout: 180_000 },
      );
      const bruto = await res.text();
      if (!res.ok()) {
        console.info(`[QA] ${cenario.nome}: HTTP ${res.status()} — ${bruto.slice(0, 300)}`);
        relatorio.push(`## ${cenario.nome}\nFALHOU: HTTP ${res.status()}\n${bruto.slice(0, 600)}`);
        continue;
      }
      const { data } = JSON.parse(bruto) as {
        data: {
          status: string;
          final_text?: string | null;
          tool_calls?: unknown;
          latency_ms?: number;
          cost_cents?: number;
        };
      };

      const chamadas = Array.isArray(data.tool_calls)
        ? (data.tool_calls as Array<Record<string, unknown>>)
        : [];
      const nomes = chamadas.map((c) => String(c.tool ?? c.name ?? c.toolName ?? "?"));

      console.info(`[QA] --- ${cenario.nome} ---`);
      console.info(`[QA] esperado: ${cenario.esperado}`);
      console.info(`[QA] chamou:   ${nomes.length ? nomes.join(" → ") : "(NENHUMA ferramenta)"}`);
      console.info(`[QA] status:   ${data.status} · ${data.latency_ms ?? "?"}ms`);
      console.info(`[QA] resposta: ${(data.final_text ?? "(vazia)").slice(0, 400)}`);

      relatorio.push(
        [
          `## ${cenario.nome}`,
          `**Perguntaram:** ${cenario.mensagem}`,
          `**Esperado:** ${cenario.esperado}`,
          `**Ferramentas chamadas:** ${nomes.length ? nomes.join(" → ") : "NENHUMA"}`,
          `**Status:** ${data.status}`,
          "",
          "**O que o agente respondeu:**",
          "",
          (data.final_text ?? "(vazia)").trim(),
          "",
          "**Chamadas cruas:**",
          "",
          "```json",
          JSON.stringify(chamadas, null, 2).slice(0, 2500),
          "```",
        ].join("\n"),
      );
    }

    fs.writeFileSync(
      path.join(SAIDA, "qa-turnos-do-agente.md"),
      `# QA — o agente usando as capacidades da W4\n\n` +
        `Modelo real, dry-run, pelo endpoint do botão "Executar teste".\n\n` +
        relatorio.join("\n\n---\n\n"),
    );
    console.info("[QA] relatório salvo em evidence/ia-360-w4/qa-turnos-do-agente.md");
  });
});
