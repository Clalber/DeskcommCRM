/**
 * O RETRATO DA INSTALAÇÃO — o que já veio pronto e o que falta.
 *
 * Existe porque o onboarding pergunta o que o instalador já perguntou. Quem roda
 * o `install.sh` escolhe a inteligência artificial, cola a chave, sobe o
 * WhatsApp e o Redis — e então abre a primeira tela e é tratado como se tivesse
 * acabado de chegar. Não havia como responder "o que esta instalação já tem?"
 * sem juntar oito lugares que não se falam, e dois deles respondiam errado.
 *
 * Duas afirmações do produto que este endpoint desfaz:
 *
 *  1. "o servidor web não enxerga o env do worker" (`ai/providers/route.ts`) —
 *     falso: `docker-compose.prod.yml` dá o MESMO `env_file: .env` aos dois
 *     serviços. Por causa dessa premissa, a origem "veio da instalação" nunca
 *     aparecia na tela de Provedores, mesmo sendo ela que valia em runtime.
 *  2. "tudo usa a chave que veio na instalação" (painel de Provedores) — dito
 *     sempre que não há credencial cadastrada, sem nunca verificar se a chave
 *     existe. Numa instalação sem chave nenhuma a frase é falsa E tranquiliza,
 *     enquanto o funcionário está mudo.
 *
 * `?provar=1` acrescenta a única resposta que custa dinheiro: a chave TEM
 * SALDO? Só admin, e nunca por padrão — a tela não pode gastar sozinha.
 */
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listSelectableChannels } from "@/lib/channels/selectable";
import { PROVEDOR_POR_ID } from "@/lib/ai/pontos/provedores";
import { lerAmbiente, nomeAindaEhPlaceholder } from "@/lib/instalacao/ambiente";
import { provarSaldo } from "@/lib/instalacao/prova-de-credito";

export const dynamic = "force-dynamic";

/** O provedor que a instalação escolheu — mesma leitura defensiva do runtime. */
function provedorDaOrg(settings: unknown): string {
  const llm = (settings as { llm?: unknown } | null)?.llm;
  const p = (llm as { provider?: unknown } | null | undefined)?.provider;
  return typeof p === "string" && p.trim() !== "" ? p : "anthropic";
}

export async function GET(req: NextRequest) {
  const user = await requireAuth();
  const org = await resolveActiveOrg(user);
  if (!org) return fail("no_active_org", "nenhuma organização ativa", 400);
  if (ROLE_RANK[org.role] < ROLE_RANK.manager) {
    return fail("forbidden", "requer papel de gerente ou superior", 403);
  }

  const ambiente = lerAmbiente();
  const supabase = await createClient();

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("slug, display_name, settings")
    .eq("id", org.orgId)
    .maybeSingle();

  const provider = provedorDaOrg(orgRow?.settings);
  const rotuloDoProvedor = PROVEDOR_POR_ID.get(provider)?.rotulo ?? provider;

  // Credencial cadastrada pela tela (BYOK) vence a chave da instalação — é a
  // mesma precedência que `resolveOrgLlmConfig` aplica no turno.
  const { data: credencial } = await supabase
    .from("ai_provider_credentials")
    .select("id, label, api_key_last4, validated_at")
    .eq("organization_id", org.orgId)
    .eq("provider", provider)
    .eq("is_active", true)
    .not("validated_at", "is", null)
    .limit(1)
    .maybeSingle();

  const temChaveDeInstalacao = ambiente.chavesDeProvedor[provider] === true;
  const origemDaChave: "org" | "instalacao" | "nenhuma" = credencial
    ? "org"
    : temChaveDeInstalacao
      ? "instalacao"
      : "nenhuma";

  // O modelo curado do provedor escolhido. Sem linha, o agente não tem como ser
  // publicado — é o estado de uma instalação nova em OpenRouter, cujo catálogo
  // só chega no cron diário.
  const { data: modelo } = await supabase
    .from("ai_models")
    .select("model_id")
    .eq("provider", provider)
    .eq("is_default_for_provider", true)
    .is("deprecated_at", null)
    .limit(1)
    .maybeSingle();

  // Canais: `listSelectableChannels` é a fonte única (já exclui arquivado) e
  // LANÇA em erro de banco de propósito — lista vazia por falha é
  // indistinguível de "não há número", e convida a parear de novo um aparelho
  // que já está no ar.
  let canais: { total: number; conectados: number } | null = null;
  try {
    const lista = await listSelectableChannels(createAdminClient(), org.orgId);
    canais = {
      total: lista.length,
      conectados: lista.filter((c) => c.status === "WORKING").length,
    };
  } catch {
    canais = null;
  }

  const { data: funil } = await supabase
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", org.orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();

  const retrato = {
    empresa: {
      nome: orgRow?.display_name ?? null,
      // O instalador nunca pergunta o nome do negócio: toda instalação nasce
      // "Minha Empresa", e esse texto aparece no cabeçalho do wizard.
      aindaSemNomeProprio: nomeAindaEhPlaceholder(orgRow ?? {}),
    },
    inteligencia: {
      provedor: provider,
      rotulo: rotuloDoProvedor,
      origemDaChave,
      chaveDaOrg: credencial
        ? { label: credencial.label as string, final: credencial.api_key_last4 as string }
        : null,
      modeloCurado: (modelo?.model_id as string | undefined) ?? null,
      // Sem modelo no catálogo o agente não sobe, mesmo com chave válida.
      prontaParaPublicar: origemDaChave !== "nenhuma" && Boolean(modelo?.model_id),
    },
    whatsapp: {
      transporteApontado: ambiente.waha.apontado && ambiente.waha.comChave,
      canais,
    },
    email: {
      // Falso em toda instalação pelo kit: o `install.sh` não coleta a chave.
      // É por isso que o convite por link copiável é o caminho NORMAL aqui.
      configurado: ambiente.email,
    },
    funil: funil ? { id: funil.id as string, nome: funil.name as string } : null,
  };

  const querProvar = req.nextUrl.searchParams.get("provar") === "1";
  if (!querProvar) return ok(retrato);

  // A partir daqui custa dinheiro: uma geração real de um token. Nunca sai de
  // graça num GET que a tela chama sozinha.
  if (ROLE_RANK[org.role] < ROLE_RANK.admin) {
    return fail("forbidden", "provar a chave requer papel de administrador", 403);
  }
  if (origemDaChave === "nenhuma" || !retrato.inteligencia.modeloCurado) {
    return ok({
      ...retrato,
      prova: {
        feita: false,
        motivo:
          origemDaChave === "nenhuma"
            ? "Não há chave para testar."
            : "Não há modelo desta empresa de IA nesta instalação ainda.",
      },
    });
  }

  // A chave em claro só é necessária para a credencial da organização; a da
  // instalação o próprio processo já tem.
  const apiKey = credencial ? null : (process.env[chaveDoAmbiente(provider)] ?? "");
  if (!apiKey) {
    return ok({
      ...retrato,
      prova: {
        feita: false,
        motivo:
          "A chave cadastrada na tela é guardada cifrada; o teste de saldo cobre a chave da instalação.",
      },
    });
  }

  const r = await provarSaldo(provider, apiKey, retrato.inteligencia.modeloCurado);
  return ok({ ...retrato, prova: { feita: true, ...r } });
}

function chaveDoAmbiente(provider: string): string {
  return (
    { anthropic: "ANTHROPIC_API_KEY", openai: "OPENAI_API_KEY", openrouter: "OPENROUTER_API_KEY" }[
      provider
    ] ?? "__inexistente__"
  );
}
