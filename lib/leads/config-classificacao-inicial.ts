/**
 * Config numérica da classificação inicial A/B/C/D — a ÚNICA peça que falta
 * para `classificarLeadInicial` (ver classificacao-inicial.ts) produzir uma
 * classe de verdade em vez de "nao_avaliado".
 *
 * ═══ POR QUE ISTO É `null` E NÃO UM PALPITE ═══
 *
 * A diretiva pediu "pontuação proporcional ao máximo possível do caminho
 * condicional do formulário" e classe D = "lead válido de baixo orçamento".
 * Duas coisas viáveis existem no payload do Respondi (`respondent.score`,
 * `custom_fields.viable_investment_range`) — nenhuma delas vem com o dado que
 * a fórmula pede:
 *
 *   1. `respondent.score` é um agregado ÚNICO do Respondi (ex.: 55), sem
 *      quebra por pergunta e sem campo `max_score` no payload. Não há, em
 *      nenhum doc deste repo (`PROMPT_ESTRATEGICO_DECOLA_AI.md`,
 *      `DIRETRIZES_SDR_CONSULTIVO_EXPERT.md`, `PROMPT_AUDITORIA_ORQUESTRACAO.md`,
 *      grep feito em 2026-08-25) uma tabela de peso por pergunta nem um
 *      "máximo do caminho condicional" documentado. Sem isso, "proporcional
 *      ao máximo" não tem denominador — só o numerador.
 *   2. `viable_investment_range` é texto livre de um radio do Respondi (ex.:
 *      "De R$ 4 mil a R$ 7 mil por mês"). A fixture sanitizada
 *      (tests/fixtures/webhooks/respondi-imobiliario.json) só mostra a opção
 *      QUE FOI ESCOLHIDA numa resposta — não a lista completa de opções do
 *      radio. Sem a lista completa, não dá pra saber que faixa é "baixo
 *      orçamento" (classe D) sem inventar um corte que pode não bater com
 *      nenhuma opção real do form.
 *
 * Chutar os dois números aqui seria decidir, em silêncio, quem cada lead novo
 * vira (A vira D, D vira desqualificado) — exatamente o tipo de decisão que
 * a diretiva pede pra reservar ("só pare se precisar de uma decisão minha que
 * realmente altere o funcionamento do sistema"). `classificarLeadInicial`
 * devolve `"nao_avaliado"` enquanto isto for `null` — visível como pendente
 * na tela, nunca como "frio" por omissão (mesmo raciocínio de
 * `lib/leads/score-writer.ts`: zero é uma afirmação).
 *
 * ═══ O QUE PREENCHER, E A RECOMENDAÇÃO (não ativa até você confirmar) ═══
 *
 * `maxScoreConhecido`: o teto real do `respondent.score` do form "Imobiliárias
 * e Incorporadoras" (form_id 9FiY9mrO) no painel do Respondi — SOMA dos pesos
 * de todas as perguntas do caminho condicional que esse respondente percorreu
 * (o "máximo possível" pode variar por caminho, já que perguntas condicionais
 * pulam). Se o Respondi não expõe esse número, a alternativa é tratar o score
 * cru como JÁ NA ESCALA 0-100 (`maxScoreConhecido: 100`) — é a leitura mais
 * simples e é consistente com a fixture (score 55 num lead de ticket médio),
 * mas não está confirmada.
 *
 * `bandas`: os cortes de percentual para A/B/C, uma vez que o percentual
 * exista. Recomendação, só para referência — mesma régua que
 * `lib/kanban/score-band.ts` já usa pro score CONVERSACIONAL (quente/morno/
 * frio = 70/40), reaproveitada aqui por consistência de produto, não
 * confirmada para o score de FORMULÁRIO:
 *   A: percentual >= 70   B: 40 <= percentual < 70   C: percentual < 40
 *
 * `orcamentoBaixoRegex`: um padrão que reconheça, no TEXTO da opção de
 * `viable_investment_range`, as faixas que a Decola AÍ considera "baixo
 * orçamento, mas lead válido" (classe D) — precisa da lista real de opções do
 * radio pra não inventar valor que não existe no form.
 */
export interface BandaDePercentual {
  min: number;
  max: number;
}

export interface ConfigClassificacaoInicial {
  /** Teto do `respondent.score` do Respondi para este form_id. */
  maxScoreConhecido: number;
  /** Cortes de percentual (0-100) para as classes A/B/C. D não é banda de score — ver `orcamentoBaixoRegex`. */
  bandas: { A: BandaDePercentual; B: BandaDePercentual; C: BandaDePercentual };
  /**
   * Testado contra `custom_fields.viable_investment_range` (case-insensitive).
   * Bate → classe D, INDEPENDENTE do percentual — "baixo orçamento" é sobre o
   * orçamento declarado, não sobre o score.
   */
  orcamentoBaixoRegex: RegExp;
}

/**
 * `null` = pendente. Troque por um objeto `ConfigClassificacaoInicial` real
 * (com os 3 números/padrão acima confirmados por Matheus) para ativar a
 * classificação A/B/C/D de verdade — nenhuma outra mudança de código é
 * necessária, `classificarLeadInicial` já lê daqui.
 */
export const CONFIG_CLASSIFICACAO_INICIAL: ConfigClassificacaoInicial | null = null;
