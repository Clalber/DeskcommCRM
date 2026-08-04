/**
 * Capacidades de EVOLUCAO — o que a empresa ja sabe e o que o agente aprende.
 *
 * `description` fala com o modelo; `rotulo`/`explicacao`/`oQueToca` falam com o
 * humano que configura o agente. Ver `docs/handoffs/BRIEFING-ia-360.md` §4.
 *
 * DECISAO DELIBERADA — a IA nao aprova a propria melhoria. As propostas do
 * flywheel (`flywheel_distiller_proposals`) sao expostas para LEITURA. Nenhuma
 * capacidade de aprovar entra neste catalogo: o gate humano e o desenho do
 * flywheel, e dar ao agente o poder de aprovar mudancas em si mesmo removeria
 * exatamente a trava que torna a auto-melhoria segura. Aprovar continua sendo
 * um clique de pessoa, na tela do agente.
 */
import { declararTools } from "./tipos";

export const TOOLS_EVOLUCAO = declararTools([
  {
    name: "crm_search_knowledge",
    category: "read",
    description:
      "Busca semantica no acervo de conhecimento da organizacao (RAG). Devolve os trechos mais " +
      "relevantes com a similaridade de cada um. Quando nada passa do limiar, devolve " +
      "`melhor_similaridade` para distinguir 'nao ha nada sobre isso' de 'ha algo perto, mas fraco'.",
    rotulo: "Consultar o que a empresa já sabe",
    explicacao:
      "Procura a resposta nos materiais que você cadastrou, para o assistente responder com a informação da sua empresa em vez de inventar.",
    oQueToca: "Base de conhecimento",
    risco: "seguro",
    pacotes: ["evoluir", "atender"],
  },
  {
    name: "crm_list_knowledge_sources",
    category: "read",
    description:
      "Lista os materiais que compoem o acervo de conhecimento da organizacao, com estado de " +
      "indexacao e contagem de trechos. Util para saber se uma resposta faltou por ausencia de " +
      "material ou por falha de indexacao.",
    rotulo: "Ver os materiais cadastrados",
    explicacao:
      "Mostra quais materiais estão no acervo da empresa e se foram processados, para saber se faltou conteúdo ou se algo falhou.",
    oQueToca: "Base de conhecimento",
    risco: "seguro",
    pacotes: ["evoluir"],
  },
]);
