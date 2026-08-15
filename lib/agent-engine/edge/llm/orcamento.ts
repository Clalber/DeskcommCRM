/**
 * O TETO DE ORÇAMENTO QUE VINCULA — a decisão, sem I/O.
 *
 * ═══ POR QUE ESTE ARQUIVO EXISTE ═══
 *
 * A tela editava `ai_budgets.monthly_limit_cents` e o enforcement lia
 * `organizations.settings.llm.monthly_budget_cents`. Dois campos, duas fontes,
 * nenhuma ligação: quem preenchia a tela acreditava estar protegido e não
 * estava. Ligar um no outro, sozinho, estrangularia todo mundo — a coluna nasce
 * com `DEFAULT 5000` (`supabase/baseline.sql:1053`), o que torna "escolhi US$ 50"
 * indistinguível de "nunca abri a tela".
 *
 * A saída não é adivinhar a intenção a partir do valor herdado: é tornar o valor
 * INERTE até um admin declarar a intenção, num campo que só existe para isso
 * (`ai_budgets.enforcement_mode`, cujo default é `'off'`).
 *
 * ═══ A DECISÃO MORA AQUI, PURA ═══
 *
 * `decidirOrcamento` recebe o estado e devolve o veredito. Zero banco, zero
 * rede, zero relógio implícito (`agora` é argumento). É o único lugar onde a
 * pergunta "esta chamada de LLM pode sair?" é respondida — o chamador
 * (`run-model-call.ts`) executa o veredito, não o recalcula.
 *
 * ⚠️ TODA CONDIÇÃO AMBÍGUA RESOLVE PARA "NÃO BLOQUEIA". Errar frouxo custa
 * dinheiro de provedor, é visível na tela de Uso e é recuperável; errar duro
 * mata o WhatsApp de um negócio numa VPS onde não há para quem ligar, e a
 * descoberta vem pelo cliente dele. Os custos não são simétricos, e a ordem das
 * recusas abaixo é essa assimetria escrita.
 */

/**
 * Piso do teto: US$ 1,00/mês. Abaixo disto o número não é orçamento de um agente
 * de WhatsApp, é erro de unidade — e um erro de unidade não pode calar a IA.
 */
export const PISO_DE_TETO_CENTS = 100;

/**
 * Chamadas que o teto NUNCA bloqueia — o custo delas continua somando no gasto
 * (excluí-las da soma faria o número mentir), mas a recusa não as alcança:
 *
 * - `connection_test` (`lib/agent-engine/edge/llm/test-model.ts:31`) é o único
 *   diagnóstico de quem está no escuro; bloqueá-lo tira a lanterna de quem está
 *   justamente tentando entender por que a IA parou.
 * - `jailbreak_detect` (`lib/agent-engine/guardrails/jailbreak/classifier.ts:114`)
 *   e `promise_semantic` (`lib/agent-engine/guardrails/promise/semantic.ts:113`)
 *   são guardrails. Estouro de orçamento não pode virar desligamento de
 *   proteção. (NÃO MEDIDO se algum chamador desses dois trata a exceção como
 *   "sem veto" — a isenção mata a pergunta em vez de deixá-la aberta.)
 */
export const PURPOSES_ISENTOS = [
  'connection_test',
  'jailbreak_detect',
  'promise_semantic',
] as const;

/** `ai_budgets.enforcement_mode`. Nasce `'off'` por DEFAULT do ALTER. */
export type ModoDeOrcamento = 'off' | 'avisar' | 'bloquear';

/**
 * Valor efetivo de `AI_BUDGET_ENFORCEMENT`, já normalizado. A chave só sabe
 * AFROUXAR: `'off'` cala tudo, `'avisar'` rebaixa qualquer `bloquear`, `'on'`
 * apenas respeita o que cada organização escolheu — `on` não liga nada.
 */
export type ChaveDeOrcamento = 'on' | 'avisar' | 'off';

/** Por que a chamada seguiu. É enum porque o log e o teste comparam este valor. */
export type RazaoDeSeguir =
  /** `enforcement_mode = 'off'`: a organização nunca ligou a proteção. */
  | 'modo_desligado'
  /** `AI_BUDGET_ENFORCEMENT=off`: kill switch do operador da instalação. */
  | 'chave_de_emergencia'
  /** `purpose` em `PURPOSES_ISENTOS`. */
  | 'purpose_isento'
  /** Teto ≤ 0 — "sem limite", nunca "bloqueia tudo". */
  | 'sem_teto'
  /** Teto abaixo de `PISO_DE_TETO_CENTS`: baixo demais para ser honrado. */
  | 'teto_abaixo_do_piso'
  /** Gasto ainda abaixo do limiar de alarme. O caminho normal. */
  | 'abaixo_do_limiar';

export interface EntradaDeOrcamento {
  /** `ai_budgets.enforcement_mode`. Linha ausente ⇒ o chamador resolve `'off'`. */
  modo: ModoDeOrcamento;
  /** `ai_budgets.monthly_limit_cents` — centavo de DÓLAR (ver `pricing.ts`). */
  tetoCents: number;
  /** Gasto do mês corrente, na régua única `fn_gasto_de_ia_do_mes`. */
  gastoCents: number;
  /** `ai_budgets.enforcement_effective_at`. `null` = carência sem prazo ⇒ nunca bloqueia. */
  efetivoEm: Date | null;
  /** Injetado, nunca `new Date()` aqui dentro: dois relógios no teste é um bug. */
  agora: Date;
  /** `RunModelCallInput.purpose` já resolvido pelo seam. */
  purpose: string;
  /** `AI_BUDGET_ENFORCEMENT` normalizado por `normalizarChaveDeOrcamento`. */
  chave: ChaveDeOrcamento;
  /**
   * `ai_budgets.alarm_threshold_pct` — percentual do teto em que o aviso abre.
   * O banco restringe a 50..99 (`ai_budgets_alarm_threshold_pct_check`).
   */
  limiarPct: number;
  /**
   * Já houve `agent_inbox_items` kind `budget_warning` NESTE MÊS. É `created_at`
   * no mês, não `status = 'open'`: fechar o aviso à mão não pode virar bypass
   * permanente do bloqueio.
   */
  avisadoNesteMes: boolean;
}

export type Veredito =
  | { acao: 'seguir'; porque: RazaoDeSeguir }
  | { acao: 'avisar_e_seguir'; porque: 'primeiro_cruzamento' | 'limiar' }
  | { acao: 'bloquear'; porque: 'teto_atingido' };

function ehPurposeIsento(purpose: string): boolean {
  return (PURPOSES_ISENTOS as readonly string[]).includes(purpose);
}

/**
 * As SEIS condições conjuntivas do bloqueio — todas precisam valer, e qualquer
 * uma sozinha basta para a chamada seguir:
 *
 *   1. `modo === 'bloquear'`
 *   2. `efetivoEm !== null && efetivoEm <= agora`   (a carência venceu)
 *   3. `tetoCents >= PISO_DE_TETO_CENTS`
 *   4. a chave de emergência não afrouxa
 *   5. `purpose` fora de `PURPOSES_ISENTOS`
 *   6. já houve aviso neste mês
 *
 * ...e só então o gatilho: `gastoCents >= tetoCents`.
 *
 * ⚠️ A CONDIÇÃO 6 É O QUE IMPEDE "CALOU SEM NUNCA TER AVISADO" — mesmo no salto
 * de 79% para 101% entre duas chamadas, a primeira que cruza o teto avisa e
 * segue. Custo máximo: uma chamada além do teto.
 *
 * ⚠️ TETO 0 SEGUE, SEMPRE. Hoje `0` significa "sem limite" na tela
 * (`components/ai/BudgetCard.tsx:192`, verbatim: "0 desativa o orçamento (sem
 * limite, sem alertas)") e "bloqueia tudo" no enforcement — o teste vivo é
 * `spent < budgetCents` (`lib/agent-engine/edge/llm/run-model-call.ts:127`), e
 * com teto 0 ele é falso já com gasto zero. É assim que `scripts/smoke-llm.ts:168`
 * prova o bloqueio: gravando `'0'`. A inversão perfeita — quem recusou o
 * orçamento de propósito levando o corte mais duro — morre aqui por construção.
 */
export function decidirOrcamento(entrada: EntradaDeOrcamento): Veredito {
  // (1) Retorno mais cedo de todos. Para 100% das organizações no dia 1 o modo é
  // 'off', e o chamador nem chega a consultar o gasto: menos trabalho que hoje.
  if (entrada.modo === 'off') {
    return { acao: 'seguir', porque: 'modo_desligado' };
  }

  // (2) Kill switch do operador da VPS às 2h da manhã: põe `off`, reinicia, a IA
  // volta — sem psql, sem saber SQL.
  if (entrada.chave === 'off') {
    return { acao: 'seguir', porque: 'chave_de_emergencia' };
  }

  // (3) Diagnóstico e guardrail nunca são recusados por gasto.
  if (ehPurposeIsento(entrada.purpose)) {
    return { acao: 'seguir', porque: 'purpose_isento' };
  }

  // (4) e (5) — teto sem valor útil não vincula ninguém.
  if (entrada.tetoCents <= 0) {
    return { acao: 'seguir', porque: 'sem_teto' };
  }
  if (entrada.tetoCents < PISO_DE_TETO_CENTS) {
    return { acao: 'seguir', porque: 'teto_abaixo_do_piso' };
  }

  const limiarCents = (entrada.tetoCents * entrada.limiarPct) / 100;
  if (entrada.gastoCents < limiarCents) {
    return { acao: 'seguir', porque: 'abaixo_do_limiar' };
  }
  if (entrada.gastoCents < entrada.tetoCents) {
    return { acao: 'avisar_e_seguir', porque: 'limiar' };
  }

  // Daqui para baixo o gasto JÁ atingiu o teto. Cada recusa restante troca o
  // bloqueio por aviso — nenhuma delas volta a 'seguir', porque a partir do teto
  // o silêncio é que seria a resposta errada.

  // Modo 'avisar' é o degrau do meio da escada: acompanha e avisa, nunca para.
  if (entrada.modo !== 'bloquear') {
    return { acao: 'avisar_e_seguir', porque: 'limiar' };
  }

  // A chave só sabe afrouxar: 'avisar' rebaixa qualquer 'bloquear'.
  if (entrada.chave === 'avisar') {
    return { acao: 'avisar_e_seguir', porque: 'limiar' };
  }

  // (6) Carência. `null` nasce da coluna nova e nunca vence — `null <= now()` é
  // `null` no banco, e aqui é uma recusa explícita, não um `undefined` de sorte.
  if (entrada.efetivoEm === null || entrada.agora.getTime() < entrada.efetivoEm.getTime()) {
    return { acao: 'avisar_e_seguir', porque: 'limiar' };
  }

  // (7) Ninguém é bloqueado sem ter sido avisado.
  if (!entrada.avisadoNesteMes) {
    return { acao: 'avisar_e_seguir', porque: 'primeiro_cruzamento' };
  }

  return { acao: 'bloquear', porque: 'teto_atingido' };
}

/**
 * Grafias que o operador escreve quando quer desligar. Case-insensitive e com
 * trim; `'não'` entra junto com `'nao'` porque o `.toLowerCase()` preserva o til.
 */
const GRAFIAS_DE_DESLIGADO = new Set([
  'off',
  'false',
  '0',
  'no',
  'nao',
  'não',
  'disabled',
]);

/**
 * `AI_BUDGET_ENFORCEMENT` cru → valor efetivo. QUALQUER outra coisa, inclusive
 * vazio e lixo, vira `'on'`.
 *
 * ⚠️ POR QUE A NORMALIZAÇÃO MORA AQUI E NÃO NUM `z.enum` DO `lib/env.ts`: aquele
 * arquivo faz `safeParse` (`:204`) e LANÇA quando o schema recusa (`:223`). Um
 * `z.enum` para o kill switch transformaria a alavanca de emergência num
 * derrubador do app inteiro no dia em que o operador escrevesse `false` — o
 * idioma dos vizinhos `AGENT_DISPATCH_CONSUMER` (`:104`) e
 * `EVENT_LOG_WORKER_ENABLED` (`:107`). O precedente correto no mesmo arquivo é
 * `APP_ACCENT_HEX: z.string().optional().default("")` (`:201`): string crua no
 * env, normalização no código.
 */
export function normalizarChaveDeOrcamento(v: string | undefined): ChaveDeOrcamento {
  const bruto = (v ?? '').trim().toLowerCase();
  if (GRAFIAS_DE_DESLIGADO.has(bruto)) return 'off';
  if (bruto === 'avisar' || bruto === 'warn') return 'avisar';
  return 'on';
}

/**
 * O statement ÚNICO do gate: lê o estado, retrata alerta obsoleto e abre o aviso
 * do limiar — uma ida ao banco.
 *
 * É constante exportada, e não SQL inline, porque o invariante de banco precisa
 * executar ESTE texto contra um Postgres real. Reimplementá-lo no teste mediria
 * a cópia, e a cópia continuaria certa com o original sabotado.
 *
 * Parâmetros: `$1` organization_id, `$2` título do aviso, `$3` corpo do aviso.
 *
 * Sem linha em `ai_budgets` a CTE `orc` é vazia, `modo` volta `null`, e o
 * chamador resolve para `'off'`. Nulo é sempre a resposta mais frouxa.
 */
export const SQL_ORCAMENTO = `
with orc as (
  select b.monthly_limit_cents            as teto,
         b.enforcement_mode               as modo,
         b.enforcement_effective_at       as efetivo_em,
         b.alarm_threshold_pct            as limiar_pct
    from ai_budgets b
   where b.organization_id = $1
),
gasto as (
  select public.fn_gasto_de_ia_do_mes($1) as spent
),
-- Lido ANTES dos inserts: todas as CTEs enxergam o MESMO snapshot, então
-- \`avisado_antes\` reflete o estado anterior a qualquer insert deste statement.
-- É \`created_at >= date_trunc('month', now())\` e NÃO \`status = 'open'\`: fechar o
-- aviso à mão não pode virar um bypass permanente do bloqueio.
avisado_antes as (
  select exists (
    select 1 from agent_inbox_items
     where organization_id = $1 and kind = 'budget_warning'
       and created_at >= date_trunc('month', now())
  ) as ja
),
-- LAÇO DE RETORNO: o gasto caiu abaixo do limiar — virou o mês, ou o admin
-- subiu o teto. Retrata os dois avisos. Sem isto o alerta CRÍTICO fica aceso
-- para sempre: o único auto-resolvedor do produto é o de circuit.ts, escopado
-- por ref_kind próprio, e o item de orçamento nunca teve ref_kind.
retrata as (
  update agent_inbox_items set status = 'resolved'
   where organization_id = $1
     and kind in ('budget_exceeded','budget_warning')
     and status = 'open'
     and (select spent from gasto)
         < (select teto * limiar_pct / 100.0 from orc)
  returning 1
),
avisa as (
  insert into agent_inbox_items (organization_id, kind, severity, title, body, ref_kind, ref_id)
  select $1, 'budget_warning', 'warn', $2, $3, 'ai_budget', $1
   where (select modo from orc) in ('avisar','bloquear')
     and (select spent from gasto) >= (select teto * limiar_pct / 100.0 from orc)
     and not exists (
       select 1 from agent_inbox_items
        where organization_id = $1 and kind = 'budget_warning' and status = 'open'
     )
  returning 1
)
select (select teto from orc)         as teto,
       (select modo from orc)         as modo,
       (select efetivo_em from orc)   as efetivo_em,
       (select limiar_pct from orc)   as limiar_pct,
       (select spent from gasto)      as gasto,
       (select ja from avisado_antes) as avisado_antes;
`;
