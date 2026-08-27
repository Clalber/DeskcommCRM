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
 * ⚠️ O PLAYBOOK `agendamento` CITA ESTES QUATRO NOMES AO CONVERSADOR — e a doutrina
 * do repo diz que a cura do vazamento é o Conversador NUNCA TER VISTO o vocabulário
 * (`lib/agent-engine/agent/entrega-de-capacidade.ts:7`, `operator-turn.ts:5`: "a separação
 * é por AUSÊNCIA"). Aqui a mitigação é por REDAÇÃO, que é filtro. A tensão é real e fica
 * escrita, não resolvida — quem reabrir decide com ela à vista.
 *
 * O CENÁRIO CONCRETO, para não ficar em abstração: o playbook é injetado no
 * `inbound_turn` (`lib/agent-engine/agent/inbound-turn.ts:1617`), por GATILHO, não sempre.
 * O turno monta as tools MCP **habilitadas na tela** (idem:2415). Se um tenant habilitar a
 * família de agenda apenas em `operator_tool_ids`, o Conversador lê quatro nomes que não
 * pode chamar. Três desfechos, e cada um tem ONDE ser observado:
 *
 *   (a) repete o nome ao cliente ...... `internal_vocabulary` no before-send. Medido no
 *       HEAD, não deduzido: as tools de agenda são pegas pela lista derivada do
 *       `TOOL_CATALOG` E pela regra snake_case — que pega até nome INVENTADO. O veto
 *       volta ao modelo como erro instrutivo. Remedir:
 *
 *         pnpm exec tsx -e 'import("@/lib/agent-engine/guardrails/vazamento-interno")
 *           .then(({detectarVazamentoInterno:d})=>{
 *             console.log(d("vou usar crm_book_appointment"), d("quinta as 14h, pode ser?"))})'
 *
 *       O segundo argumento é o CONTROLE: se ele também acusar, o detector está gritando
 *       com tudo e o primeiro resultado não prova nada.
 *
 *   (b) tenta CHAMAR tool ausente ..... não é vazamento, é erro de tool call, e aparece no
 *       log de invocação do run.
 *
 *   (c) promete a capacidade sem tê-la . os gates `promise`/`semantic_promise` da mesma
 *       cadeia. É o desfecho que (a) e (b) não cobrem: nenhum nome sai e nenhuma chamada
 *       acontece.
 *
 * ⚠️ O QUE NINGUÉM MEDIU AINDA: como o modelo se comporta, de fato, num tenant com a
 * família só no Operador. Há lugar de observação — `before_send_traces` é durável e
 * exportável por run, então olhar não precisa ser síncrono com o evento. Isso é trabalho
 * ADIADO com endereço, não risco sem instrumento: quem quiser fechar, olha o traço do
 * primeiro tenant nessa configuração. (Achado do Arquiteto; a ressalva mora aqui, e não no
 * briefing da entrega, porque briefing morre com a entrega e este arquivo não.)
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
  {
    name: "crm_list_appointments",
    category: "read",
    rotulo: "Ver os compromissos marcados",
    explicacao:
      "Lista os compromissos com hora marcada de um cliente ou de um dia, com a situação de cada um: marcado, realizado ou desmarcado.",
    oQueToca: "Agenda da equipe",
    risco: "seguro",
    pacotes: ["vender"],
  },
  {
    name: "crm_book_appointment",
    category: "write",
    rotulo: "Marcar consulta ou sessão",
    explicacao:
      "Reserva um horário do atendente para receber o cliente. A pessoa passa a contar com esse horário, então não é um registro interno.",
    oQueToca: "Agenda da equipe",
    // `atencao` e não `critico`: marcar errado se desfaz — remarca ou desmarca.
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_reschedule_appointment",
    category: "write",
    rotulo: "Remarcar um compromisso",
    explicacao:
      "Move um compromisso já marcado para outro horário, mantendo o mesmo cliente e o mesmo tipo de atendimento.",
    oQueToca: "Agenda da equipe",
    risco: "atencao",
    pacotes: ["vender"],
  },
  {
    name: "crm_cancel_appointment",
    category: "write",
    rotulo: "Desmarcar um compromisso",
    explicacao:
      "Desmarca um horário combinado e devolve esse horário para outra pessoa poder pegar, o que não dá para desfazer.",
    oQueToca: "Agenda da equipe",
    // ⚠️ `critico` INVERTE a intuição, e a régua do repo decide sozinha: crítico é
    // "efeito que não dá para desfazer". Marcar errado se desfaz; CANCELAR não —
    // o horário volta ao pool e some em segundos. Consequência deliberada: crítico
    // nunca entra por pacote, então a IA marca assim que o pacote é ligado e só
    // desmarca se o dono ligar explicitamente. Falha fechado no lado certo.
    risco: "critico",
    pacotes: ["vender"],
  },
]);
