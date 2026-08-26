/**
 * Capacidades de AGENDA — consultar horário e marcar compromisso.
 *
 * ESTE ARQUIVO FALA COM O HUMANO que configura o agente. O texto que vai ao
 * MODELO é a `description` do handler (`lib/mcp/tools/agendamento.ts`), e ela
 * NÃO tem cópia aqui — duplicata que ninguém lê não é documentação, é armadilha.
 *
 * ⚠️ O VOCABULÁRIO DO DONO DA CLÍNICA NÃO É O NOSSO. Aqui não entram "slot",
 * "agendamento" no sentido de linha de banco, nem "appointment": o gate
 * `tests/unit/catalogo-tools-leigo-friendly.test.ts` reprova jargão, e a pessoa
 * que lê esta tela diz CONSULTA, SESSÃO e HORÁRIO. As palavras de wire ficam
 * só no `name`, que é contrato e não texto.
 *
 * ⚠️ PACOTE: `vender`, e a razão é ARITMÉTICA antes de ser semântica.
 *
 * `atender` seria a primeira escolha — marcar consulta é o desfecho de um
 * atendimento. Mas ele está com 18 capacidades num teto de 20 POR AGENTE
 * (`lib/mcp/tools/pacotes.ts:10`), e a família de agenda são CINCO: consultar,
 * listar, marcar, remarcar e desmarcar. Em `atender` cabe UMA — e uma família
 * partida entre dois pacotes é pior que ela inteira no pacote vizinho, porque o
 * dono liga "Atender" e ganha metade da agenda sem saber qual metade.
 *
 * `vender` tem folga para as cinco. E é defensável sem apelar para o número: numa
 * clínica, marcar consulta É a conversão — é o "ganho" do funil, não uma resposta
 * a mais na conversa.
 *
 * ⚠️ NÃO CRAVO O NÚMERO AQUI, e a razão é que ele já me pegou uma vez: a versão
 * anterior deste comentário dizia "vender tem 11 (11+5=16)" e estava errada — eram
 * 12 antes desta tool, 13 depois. O erro não foi de leitura, foi de INSTRUMENTO:
 * medi com regex sobre o texto do catálogo, com janela de 900 caracteres entre
 * `name:` e `pacotes:`, e `crm_propose_contact_field` tem 1930. A janela truncou
 * em silêncio e o script não tinha como avisar.
 *
 * Quem for reabrir a decisão de pacote mede pelo OBJETO, não pelo texto:
 *
 *   pnpm exec tsx -e 'import("@/lib/mcp/tools/catalogo").then(({TOOL_CATALOG})=>{
 *     const p={}; for(const t of TOOL_CATALOG) for(const b of t.pacotes) p[b]=(p[b]??0)+1;
 *     console.log(p, "total:", TOOL_CATALOG.length)})'
 *
 * O total serve de controle: se a soma dos pacotes não fizer sentido contra
 * `TOOL_CATALOG.length`, o instrumento está perdendo entrada.
 *
 * Medido: acrescentar esta capacidade a `atender` levaria o pacote a 19 e
 * quebraria `tests/e2e/capacidades-do-agente.spec.ts` em DOIS pontos — a
 * asserção de "falta 1 vaga" (viraria 2) e a de que liberar UMA vaga basta para
 * ligar o pacote (não bastaria). Isso não é motivo para escolher `vender`, mas é
 * o custo que a escolha por `atender` teria, e ele está aqui para quem reabrir.
 *
 * **Decisão de pacote PRÓPRIO (`agendar`) segue pendente com o maestro** — foi
 * levantada em `CONTRATO-MCP-agenda.md` §7 antes de existir código. `vender` é o
 * lar que não estoura nada hoje e não parte a família.
 */
import { declararTools } from "./tipos";

export const TOOLS_AGENDAMENTO = declararTools([
  {
    name: "crm_find_free_slots",
    category: "read",
    rotulo: "Ver horários livres na agenda",
    explicacao:
      "Mostra os horários em que um atendente pode receber, já descontando as folgas dele, o que ele tem marcado e os compromissos da agenda pessoal.",
    oQueToca: "Agenda da equipe",
    risco: "seguro",
    pacotes: ["vender"],
  },
]);
