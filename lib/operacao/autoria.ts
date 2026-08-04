/**
 * Quem mexeu na CONFIGURAÇÃO da operação, gravado ao lado do estado que mudou.
 *
 * ⚠️ POR QUE ISTO PRECISOU EXISTIR. Até o agente de IA ganhar mãos sobre a
 * operação, toda mudança em etapa de funil, entrada automática de contatos e
 * regra automática vinha de uma pessoa com papel `manager+` — quem olhava a tela
 * era, necessariamente, quem tinha mudado. A partir do momento em que o agente
 * liga uma regra que roda sozinha, o estado na tela deixa de responder a
 * pergunta que importa: **fui eu ou foi ele?**
 *
 * O `api_audit_log` registra tudo, mas nenhuma tela de configuração o lê — e log
 * que não aparece é log morto (doutrina do sistema vivo, invariante 3). Por isso
 * a autoria mora na PRÓPRIA LINHA: o estado e a autoria do estado são lidos
 * juntos, na mesma consulta, pela tela que já existe.
 *
 * ⚠️ NÃO GUARDAMOS QUAL AGENTE, E ISSO É DELIBERADO. `Actor.id` para
 * `ai_agent` significa coisas DIFERENTES conforme o caminho de execução: no
 * runtime nativo (`lib/ai/runtime/agent.ts`) é o id da EXECUÇÃO
 * (`ai_agent_runs.id`); no harness de vendas
 * (`lib/agent-engine/edge/crm/mcp-tools.ts`) é o id do AGENTE (`ai_agents.id`);
 * e no MCP externo (`lib/mcp/auth.ts`) é o id do run ou o do token. Uma coluna
 * `..._agent_id uuid references ai_agents(id)` alimentada a partir daí seria
 * verdadeira em um caminho e falsa nos outros — e a chave estrangeira recusaria
 * a escrita justamente no caminho mais usado. Enquanto `Actor` não distinguir
 * agente de execução, guardar a ESPÉCIE do ator é a afirmação que se sustenta;
 * o `api_audit_log` continua guardando o identificador cru para quem investiga.
 */
import type { Actor } from "@/lib/api/handlers/types";

/** As espécies de autor que uma mudança de configuração pode ter. */
export type EspecieDeAutor = "user" | "ai" | "system";

/** As colunas que toda tabela de configuração ganha (migration 0101). */
export interface AutoriaDaMudanca {
  last_change_actor_kind: EspecieDeAutor;
  last_change_at: string;
}

/**
 * A autoria pronta para entrar no `insert`/`update`.
 *
 * `webhook_source` e qualquer ator futuro que não seja pessoa nem agente caem em
 * `system`: o produto agiu, não alguém. O mesmo vocabulário de
 * `lib/leads/activity-emitter.ts` — duas escalas de ator no mesmo sistema seriam
 * duas legendas para o usuário decorar.
 */
export function autoriaDaMudanca(actor: Actor, agora: Date = new Date()): AutoriaDaMudanca {
  return {
    last_change_actor_kind: especieDe(actor),
    last_change_at: agora.toISOString(),
  };
}

export function especieDe(actor: Actor): EspecieDeAutor {
  if (actor.type === "user") return "user";
  if (actor.type === "ai_agent") return "ai";
  return "system";
}

/**
 * Como a autoria é dita na tela.
 *
 * ⚠️ A FRASE MUDA DE FORÇA CONFORME O AUTOR, de propósito. "Você/time" é
 * confirmação; "o assistente" é NOTÍCIA — é o caso em que o usuário pode não
 * saber que a mudança aconteceu, e é o único motivo de esta coluna existir. Um
 * texto neutro para os dois ("alterado por…") desperdiçaria a diferença que o
 * dado carrega.
 *
 * `null` acontece nas linhas anteriores à migration 0101 (e é honesto: ninguém
 * sabe quem mexeu naquelas) — a tela simplesmente não diz nada.
 */
export function autorNaTela(kind: string | null): string | null {
  if (kind === "ai") return "alterado pelo assistente";
  if (kind === "user") return "alterado por você/time";
  if (kind === "system") return "alterado automaticamente pelo sistema";
  return null;
}

/** `true` quando a última mudança NÃO foi de uma pessoa — o que a tela destaca. */
export function mudadoPorAgente(kind: string | null): boolean {
  return kind === "ai";
}
