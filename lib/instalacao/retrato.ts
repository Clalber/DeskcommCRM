/**
 * O RETRATO da instalação, montado num lugar só.
 *
 * Nasceu dentro da rota `/api/v1/system/instalacao` e saiu de lá quando o
 * wizard passou a precisar da mesma resposta: uma tela que faz `fetch` na
 * própria aplicação para saber algo que o servidor já sabe paga uma volta de
 * rede por nada — e, pior, cria uma segunda montagem do mesmo retrato, que é
 * como as respostas do produto começaram a divergir em primeiro lugar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { PROVEDOR_POR_ID } from "@/lib/ai/pontos/provedores";
import { lerAmbiente, nomeAindaEhPlaceholder, type FonteDeAmbiente } from "@/lib/instalacao/ambiente";

export interface RetratoDaInstalacao {
  empresa: { nome: string | null; aindaSemNomeProprio: boolean };
  inteligencia: {
    provedor: string;
    rotulo: string;
    origemDaChave: "org" | "instalacao" | "nenhuma";
    chaveDaOrg: { label: string; final: string } | null;
    modeloCurado: string | null;
    prontaParaPublicar: boolean;
  };
  whatsapp: { transporteApontado: boolean; canais: { total: number; conectados: number } | null };
  email: { configurado: boolean };
  funil: { id: string; nome: string } | null;
}

/** O provedor que a instalação escolheu — mesma leitura defensiva do runtime. */
export function provedorDaOrg(settings: unknown): string {
  const llm = (settings as { llm?: unknown } | null)?.llm;
  const p = (llm as { provider?: unknown } | null | undefined)?.provider;
  return typeof p === "string" && p.trim() !== "" ? p : "anthropic";
}

export interface DependenciasDoRetrato {
  /** Client com a sessão do usuário — o RLS faz o escopo. */
  supabase: SupabaseClient;
  orgId: string;
  /** Injetável para teste; em produção é o `process.env` do servidor. */
  ambiente?: FonteDeAmbiente;
  /**
   * Como contar os números conectados. Injetado porque a listagem canônica
   * exige o client de serviço, e este módulo não deve escolher isso sozinho.
   */
  contarCanais?: () => Promise<{ total: number; conectados: number } | null>;
}

export async function lerRetratoDaInstalacao(
  deps: DependenciasDoRetrato,
): Promise<RetratoDaInstalacao> {
  const { supabase, orgId } = deps;
  const ambiente = lerAmbiente(deps.ambiente);

  const { data: orgRow } = await supabase
    .from("organizations")
    .select("slug, display_name, settings")
    .eq("id", orgId)
    .maybeSingle();

  const provider = provedorDaOrg(orgRow?.settings);

  // Credencial cadastrada pela tela vence a chave da instalação — mesma
  // precedência que `resolveOrgLlmConfig` aplica no turno.
  const { data: credencial } = await supabase
    .from("ai_provider_credentials")
    .select("label, api_key_last4")
    .eq("organization_id", orgId)
    .eq("provider", provider)
    .eq("is_active", true)
    .not("validated_at", "is", null)
    .limit(1)
    .maybeSingle();

  const { data: modelo } = await supabase
    .from("ai_models")
    .select("model_id")
    .eq("provider", provider)
    .eq("is_default_for_provider", true)
    .is("deprecated_at", null)
    .limit(1)
    .maybeSingle();

  const { data: funil } = await supabase
    .from("crm_pipelines")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("is_default", true)
    .eq("is_archived", false)
    .maybeSingle();

  const origemDaChave: RetratoDaInstalacao["inteligencia"]["origemDaChave"] = credencial
    ? "org"
    : ambiente.chavesDeProvedor[provider] === true
      ? "instalacao"
      : "nenhuma";

  const modeloCurado = (modelo?.model_id as string | undefined) ?? null;

  return {
    empresa: {
      nome: (orgRow?.display_name as string | null) ?? null,
      aindaSemNomeProprio: nomeAindaEhPlaceholder(orgRow ?? {}),
    },
    inteligencia: {
      provedor: provider,
      rotulo: PROVEDOR_POR_ID.get(provider)?.rotulo ?? provider,
      origemDaChave,
      chaveDaOrg: credencial
        ? { label: credencial.label as string, final: credencial.api_key_last4 as string }
        : null,
      modeloCurado,
      // Chave sem modelo no catálogo não publica agente — é o estado de uma
      // instalação nova em OpenRouter, cujo catálogo só chega no cron diário.
      prontaParaPublicar: origemDaChave !== "nenhuma" && Boolean(modeloCurado),
    },
    whatsapp: {
      transporteApontado: ambiente.waha.apontado && ambiente.waha.comChave,
      canais: deps.contarCanais ? await deps.contarCanais() : null,
    },
    email: { configurado: ambiente.email },
    funil: funil ? { id: funil.id as string, nome: funil.name as string } : null,
  };
}
