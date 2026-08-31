/**
 * Um número de WhatsApp CONECTADO (`status = 'WORKING'`) para as specs que
 * exercitam envio automatizado.
 *
 * ═══ Por que isto precisa de seed, e não da tela ═══
 *
 * Conectar um número de verdade exige ler um QR code no celular. Numa
 * instalação real isso acontece uma vez, à mão; num rig de teste não acontece
 * nunca. Sem uma sessão `WORKING` a tela de automação desabilita TODOS os
 * números no seletor — corretamente, porque mandar mensagem por um número
 * desconectado é o defeito que aquele `disabled` existe para evitar — e a spec
 * não tem o que medir.
 *
 * `seed-e2e-followup-agent.ts` também cria uma sessão, mas ela nasce
 * `STARTING` (o default da coluna): serve para o que aquele seed precisa (uma
 * FK não-nula para publicar agente) e não serve aqui.
 *
 * ═══ O que este número NÃO é ═══
 *
 * Não é um WhatsApp que funciona. O `WAHA_API_BASE_URL` do `.env.e2e` aponta
 * para uma porta vazia, então todo envio por ele MORRE — e isso é proposital:
 * é exatamente a instalação com o WhatsApp fora do ar que o relato de
 * 2026-08-24 descreve, e é sobre esse desfecho que a spec afirma.
 *
 * Idempotente pelo `waha_session_name`. Run: npx tsx scripts/seed-e2e-numero-conectado.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";

import { createClient } from "@supabase/supabase-js";

import { anunciarDestino, credenciaisSupabaseDeTeste } from "./lib/env-de-teste";

const CREDS_PATH = path.join(process.cwd(), ".e2e-creds.json");
const SESSION_NAME = "e2e-numero-conectado";

interface Creds {
  org_id: string;
  numero_conectado?: { channel_session_id: string };
}

async function main(): Promise<void> {
  // `process.env` VENCE o `.env.local` (ver scripts/lib/env-de-teste.ts), e o
  // destino é ANUNCIADO: um seed que escreve na nuvem por engano acha os mesmos
  // dados de teste de sempre e termina dizendo "pronto". A linha impressa é o
  // que torna o estrago visível ANTES dele.
  const credenciais = credenciaisSupabaseDeTeste();
  anunciarDestino("seed-e2e-numero-conectado", credenciais);
  const admin = createClient(credenciais.url, credenciais.serviceRole, {
    auth: { persistSession: false },
  });

  const creds = JSON.parse(fs.readFileSync(CREDS_PATH, "utf8")) as Creds;
  const orgId = creds.org_id;

  const { data: existente } = await admin
    .from("channel_sessions")
    .select("id, status")
    .eq("organization_id", orgId)
    .eq("waha_session_name", SESSION_NAME)
    .maybeSingle();

  let id: string;
  if (existente) {
    id = (existente as { id: string }).id;
    // Uma spec anterior pode ter deixado o status em outro valor (o watchdog
    // reconcilia com o WAHA real, que aqui não existe). Reafirma WORKING.
    await admin.from("channel_sessions").update({ status: "WORKING" }).eq("id", id);
  } else {
    const { data, error } = await admin
      .from("channel_sessions")
      .insert({
        organization_id: orgId,
        waha_session_name: SESSION_NAME,
        display_name: "Número conectado (E2E)",
        phone_number: "+5511999990000",
        status: "WORKING",
        webhook_secret_encrypted: "\\x00",
      } as never)
      .select("id")
      .single();
    if (error || !data) throw new Error(`insert channel_sessions: ${error?.message}`);
    id = (data as { id: string }).id;
  }

  // ═══ A janela de envio deste número fica EXPLÍCITA: sempre aberta ═══
  //
  // Sem esta linha o número herda os defaults do pacing — 7h–22h em
  // America/Sao_Paulo (lib/agent-engine/pacing/defaults.ts) — e a spec passa ou
  // falha conforme a HORA em que o CI roda: entre 01h e 10h UTC (22h–7h em São
  // Paulo) o motor adia o envio antes de tentá-lo (`postponeUntil` →
  // lib/automation/engine.ts → run `adiado`, "Aguardando envio" na tela), e a
  // asserção que espera "Falhou" nunca tem o que ver. Medido em 2026-08-30/31:
  // as mesmas specs, no MESMO commit, verdes em toda rodada 13h32–00h22 UTC e
  // vermelhas em toda rodada 01h16–02h56 UTC — inclusive num PR de controle com
  // a main pura, sem mudança nenhuma de código.
  //
  // O knob é o MESMO que a tela de Conexões grava (`channel_knobs`, a régua
  // única de janela): a spec declara a pré-condição de que precisa — janela
  // aberta — em vez de depender do relógio de quem roda. O que a spec prova
  // (envio que morre aparece como FALHOU, nunca como sucesso) continua provado
  // igual, a qualquer hora e em qualquer fuso.
  const { error: knobsErr } = await admin.from("channel_knobs").upsert(
    {
      organization_id: orgId,
      channel_session_id: id,
      window_start_hour: 0,
      window_end_hour: 24, // fim exclusivo; 24 = até a meia-noite (KNOB_BOUNDS.hourEnd)
      allow_sunday: true,
    } as never,
    { onConflict: "organization_id,channel_session_id" },
  );
  if (knobsErr) throw new Error(`upsert channel_knobs: ${knobsErr.message}`);

  creds.numero_conectado = { channel_session_id: id };
  fs.writeFileSync(CREDS_PATH, JSON.stringify(creds, null, 2));
  console.info(`[seed] número conectado (WORKING, janela 0h–24h): ${id}`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
