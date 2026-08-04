/**
 * Emite um token MCP de AGENTE para o E2E de "organizar a operação" (IA 360 W4).
 *
 * ⚠️ POR QUE UM TOKEN DE VERDADE, E NÃO UM MOCK. O que o teste precisa provar é
 * que a mudança feita pelo AGENTE chega à tela marcada como dele. Isso depende
 * de três coisas que só existem no caminho real: o scope `actor:ai_agent` (que
 * `deriveActor` lê para montar o `Actor`), a espécie gravada por
 * `autoriaDaMudanca`, e a leitura da tela. Um handler chamado direto no processo
 * de teste pularia a primeira e provaria menos do que parece.
 *
 * ⚠️ O PAPEL É `manager`, E ISSO É O BUG-02 APARECENDO. Um agente PUBLICADO
 * recebe `role:agent` fixo (ver `lib/ai/runtime/mcp_token.ts`) e seria recusado
 * por `ensureRole` em toda tool de escrita — é a lacuna medida em
 * `tests/unit/capacidade-alcancavel-pelo-agente.test.ts`. O caminho exercitado
 * aqui é o do cliente MCP externo (server-to-server), que é real, suportado e
 * hoje o ÚNICO por onde uma escrita de configuração chega ao banco vinda de um
 * ator `ai_agent`. Quando o BUG-02 for decidido, este seed passa a poder usar
 * `role:agent` — e o teste continua valendo.
 *
 * Idempotente: revoga tokens anteriores com o mesmo nome antes de emitir.
 *
 * Run: npx tsx scripts/seed-e2e-agente-mcp.ts
 * Output: .e2e-agente-mcp.json (gitignored)
 */
import { createHash, randomBytes } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

import { createClient } from "@supabase/supabase-js";

const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]!] = m[2]!.replace(/^"(.*)"$/, "$1");
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local");
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const NOME = "e2e-agente-organiza";
const ORG_SLUG = "e2e-test-org";

async function main(): Promise<void> {
  const { data: org, error: orgErr } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();
  if (orgErr) throw new Error(orgErr.message);
  if (!org) {
    throw new Error(`org "${ORG_SLUG}" não existe — rode scripts/seed-e2e-credentials.ts antes`);
  }
  const orgId = (org as { id: string }).id;

  const { data: dono, error: donoErr } = await admin
    .from("user_organizations")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("role", "admin")
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (donoErr) throw new Error(donoErr.message);
  if (!dono) throw new Error("nenhum admin ativo na org de E2E");

  // Idempotência: o token anterior deste seed morre antes do novo nascer — dois
  // tokens vivos com o mesmo nome tornariam impossível dizer qual foi usado.
  await admin
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("name", NOME)
    .is("revoked_at", null);

  const prefix = `dsk_e2eag_${randomBytes(3).toString("hex")}`;
  const plaintext = `${prefix}_${randomBytes(32).toString("base64url")}`;
  const hash = createHash("sha256").update(plaintext).digest();

  const { data: token, error } = await admin
    .from("api_tokens")
    .insert({
      organization_id: orgId,
      created_by: (dono as { user_id: string }).user_id,
      name: NOME,
      prefix,
      token_hash: `\\x${hash.toString("hex")}`,
      scopes: ["mcp:read", "mcp:write", "actor:ai_agent", "role:manager"],
      expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !token) throw new Error(error?.message ?? "insert do token falhou");

  const saida = {
    organization_id: orgId,
    token_id: (token as { id: string }).id,
    // Plaintext só aqui: o banco guarda o hash, e o arquivo é gitignored.
    bearer: plaintext,
  };
  fs.writeFileSync(
    path.join(process.cwd(), ".e2e-agente-mcp.json"),
    JSON.stringify(saida, null, 2),
  );
  console.log(`token MCP de agente emitido para a org ${orgId} (.e2e-agente-mcp.json)`);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
