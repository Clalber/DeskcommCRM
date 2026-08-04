/**
 * Capacidades do pacote "Aprender e evoluir" — o acervo da empresa e a memoria
 * da organizacao.
 *
 * PROMOCAO DE CAPACIDADE SOMBRA: `search_knowledge` ja existia dentro do turno
 * do agente (`lib/agent-engine/agent/inbound-turn.ts`), funcionando e invisivel
 * — o humano que configura nao a via, nao a desligava e nao auditava seu uso.
 * Aqui ela vira capacidade de primeira classe: entra no catalogo, aparece na
 * tela e passa pela mesma auditoria das demais.
 *
 * A regra de busca NAO e reimplementada: vive em `lib/ai/knowledge/busca.ts` e
 * e a mesma para o agente e para a pessoa.
 */
import { z } from "zod";

import {
  buscarConhecimento,
  resolverAcervoDoAgente,
} from "@/lib/ai/knowledge/busca";
import type { McpToolDefinition } from "../types";

// ---------------------------------------------------------------------------
// buscar no acervo
// ---------------------------------------------------------------------------

const buscarInputShape = {
  pergunta: z.string().trim().min(1).describe("O que se quer saber, em linguagem natural."),
  quantidade: z.number().int().min(1).max(10).optional().default(5),
  /**
   * So e necessario quando quem chama NAO e um agente (ex: cliente MCP externo
   * operado por uma pessoa). Agente nenhum precisa informar: ele e o proprio.
   */
  assistente_id: z.string().uuid().optional(),
};

/** Limiar de similaridade do repo (mesmo default da RPC `retrieve_top_k_chunks`). */
const LIMIAR_PADRAO = 0.72;

export const crmSearchKnowledge: McpToolDefinition<typeof buscarInputShape> = {
  name: "crm_search_knowledge",
  description:
    "Busca semantica no acervo de conhecimento da organizacao (RAG). Devolve os trechos mais " +
    "relevantes com a similaridade de cada um. Quando nada passa do limiar, devolve " +
    "`melhor_similaridade` para distinguir 'nao ha nada sobre isso' de 'ha algo perto, mas fraco'.",
  inputSchema: buscarInputShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    const agentId =
      input.assistente_id ?? (ctx.actor.type === "ai_agent" ? ctx.actor.id : undefined);

    if (!agentId) {
      return {
        erro: "assistente_nao_informado",
        mensagem:
          "Cada assistente consulta o proprio acervo. Informe qual assistente deve responder.",
      };
    }

    const kbVersionId = await resolverAcervoDoAgente(ctx.supabase, ctx.organizationId, agentId);
    if (!kbVersionId) {
      // Nao e erro: e um estado legitimo e acionavel — o assistente ainda nao
      // tem material publicado. Devolver como falha faria o modelo tratar como
      // bug e tentar de novo em vez de dizer que nao sabe.
      return {
        trechos: [],
        melhor_similaridade: null,
        aviso: "assistente_sem_acervo_publicado",
      };
    }

    const resultado = await buscarConhecimento(ctx.supabase, {
      organizationId: ctx.organizationId,
      kbVersionId,
      pergunta: input.pergunta,
      topK: input.quantidade,
      limiar: LIMIAR_PADRAO,
    });

    return {
      trechos: resultado.trechos,
      melhor_similaridade: resultado.melhorSimilaridade,
    };
  },
};

// ---------------------------------------------------------------------------
// listar o material do acervo
// ---------------------------------------------------------------------------

const listarMateriaisInputShape = {
  apenas_ativos: z.boolean().optional().default(true),
};

export const crmListKnowledgeSources: McpToolDefinition<typeof listarMateriaisInputShape> = {
  name: "crm_list_knowledge_sources",
  description:
    "Lista os materiais que compoem o acervo de conhecimento da organizacao, com estado de " +
    "indexacao e contagem de trechos. Util para saber se uma resposta faltou por ausencia de " +
    "material ou por falha de indexacao.",
  inputSchema: listarMateriaisInputShape,
  category: "read",
  requiresRole: "agent",
  requiresScope: "mcp:read",
  handler: async (input, ctx) => {
    let q = ctx.supabase
      .from("ai_knowledge_sources")
      .select(
        "id, agent_id, name, source_type, status, last_index_status, last_index_error, last_indexed_at, chunks_count, is_active, created_at",
      )
      // Service role bypassa RLS: o filtro por organizacao e manual e
      // obrigatorio, e a fonte e o contexto autenticado, nunca a entrada.
      .eq("organization_id", ctx.organizationId)
      .order("created_at", { ascending: false });

    if (input.apenas_ativos) q = q.eq("is_active", true);

    const { data, error } = await q;
    if (error) throw new Error(`listar_materiais_falhou: ${error.message}`);

    return { materiais: data ?? [] };
  },
};
