/**
 * De onde um script de seed/sonda lê as credenciais do Supabase.
 *
 * ═══ O DEFEITO QUE ISTO CONSERTA (medido em 2026-08-06) ═══
 *
 * Os scripts liam `.env.local` **direto do disco**, ignorando `process.env`:
 *
 *     const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
 *
 * Num checkout de trabalho, `.env.local` aponta para PRODUÇÃO. Consequência: a
 * suíte E2E semeava organizações, usuários e agentes de teste no banco real — e
 * o `.env.e2e` no `webServer` do Playwright **não alcançava** esses scripts,
 * porque eles nunca olharam para o ambiente. O sintoma que denunciou: o factor
 * TOTP gravado em `.e2e-creds.json` não existia no banco local, porque tinha
 * sido criado na nuvem.
 *
 * A org `e2e-test-org` está na produção deste projeto desde 2026-04-29. Ela não
 * chegou lá por acidente de uma sessão: chegou porque **este era o comportamento
 * normal** da suíte.
 *
 * ═══ A REGRA ═══
 *
 * `process.env` VENCE o arquivo. É o que permite `set -a; . ./.env.e2e` (ou o
 * `env` do Playwright) redirecionar qualquer script sem editar nenhum deles.
 * Sem valor no ambiente, cai em `.env.local` — o comportamento de sempre, para
 * quem roda uma sonda à mão durante o desenvolvimento.
 */
import fs from "node:fs";
import path from "node:path";

export interface CredenciaisSupabase {
  url: string;
  serviceRole: string;
  /** anon key — alguns seeds fazem signIn como usuário comum (ex.: enroll TOTP). */
  anonKey: string;
  /** base do app, para links gerados pelo seed. */
  appUrl: string;
  /** de onde os valores vieram — vai ao log, para o operador não adivinhar. */
  origem: "ambiente" | "arquivo";
}

function lerArquivo(arquivo: string): Record<string, string> {
  const caminho = path.join(process.cwd(), arquivo);
  if (!fs.existsSync(caminho)) return {};
  const env: Record<string, string> = {};
  for (const linha of fs.readFileSync(caminho, "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(linha);
    if (m) env[m[1]!] = (m[2] ?? "").replace(/^"(.*)"$/, "$1").trim();
  }
  return env;
}

/**
 * Resolve URL + service role. `process.env` primeiro; `.env.local` depois.
 *
 * Lança quando não acha — nunca devolve string vazia, que viraria uma chamada
 * ao Supabase com credencial vazia e um erro três camadas adiante.
 */
export function credenciaisSupabaseDeTeste(): CredenciaisSupabase {
  const doAmbiente = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    serviceRole: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  };
  if (doAmbiente.url !== "" && doAmbiente.serviceRole !== "") {
    return {
      ...doAmbiente,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
      origem: "ambiente",
    };
  }

  const arquivo = lerArquivo(".env.local");
  const url = arquivo.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRole = arquivo.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (url === "" || serviceRole === "") {
    throw new Error(
      "Sem credenciais do Supabase: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY " +
        "no ambiente (ex.: `set -a; . ./.env.e2e; set +a`) ou no .env.local.",
    );
  }
  return {
    url,
    serviceRole,
    anonKey: arquivo.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    appUrl: arquivo.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    origem: "arquivo",
  };
}

/**
 * Diz em voz alta contra QUAL banco o script vai escrever.
 *
 * Existe porque o modo de falha caro aqui é silencioso: um seed que escreve na
 * produção acha exatamente os mesmos dados de teste de sempre e termina com
 * "✅ Seed completo". Uma linha impressa é o que transforma isso em algo que
 * alguém pode notar antes de apertar enter na próxima vez.
 */
export function anunciarDestino(script: string, c: CredenciaisSupabase): void {
  const local = c.url.startsWith("http://127.0.0.1") || c.url.startsWith("http://localhost");
  const rotulo = local ? "LOCAL" : "⚠️  REMOTO";
  console.info(`[${script}] escrevendo em ${rotulo}: ${c.url} (origem: ${c.origem})`);
}
