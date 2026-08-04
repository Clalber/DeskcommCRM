/**
 * Shape de uma entrada do catalogo de tools.
 *
 * Separado do agregador (`lib/mcp/tools/catalog.ts`) para que cada dominio
 * declare suas capacidades no proprio arquivo sem que times paralelos colidam
 * no mesmo hunk. Client-safe: zero import de zod, supabase ou next/headers.
 */
import type { McpToolCategory } from "../../types";
import type { ToolBundle, ToolRisk } from "../pacotes";

export interface McpToolCatalogEntry {
  /** CONTRATO DE WIRE — imutavel depois de publicado. */
  name: string;
  /** Dirige requiresScope/requiresRole. Nao e rotulo de tela. */
  category: McpToolCategory;
  /** Texto tecnico entregue ao MODELO. */
  description: string;

  // ---- camada de apresentacao: o que o HUMANO le ----
  /** Verbo no infinitivo, pt-BR. Ex: "Mover oportunidade de etapa". */
  rotulo: string;
  /** O que acontece quando a IA usa isto, em portugues de gente (>= 40 chars). */
  explicacao: string;
  /** O recurso na linguagem do usuario. Ex: "Funil de vendas". */
  oQueToca: string;
  risco: ToolRisk;
  /** >= 1 pacote. Uma capacidade pode servir a mais de uma jornada. */
  pacotes: ReadonlyArray<ToolBundle>;
}

/**
 * Helper de declaracao. Existe para dar erro de tipo no arquivo do dominio —
 * sem ele, o objeto so seria checado no agregador e a mensagem apontaria para
 * o arquivo errado.
 */
export function declararTools(
  entradas: ReadonlyArray<McpToolCatalogEntry>,
): ReadonlyArray<McpToolCatalogEntry> {
  return entradas;
}
