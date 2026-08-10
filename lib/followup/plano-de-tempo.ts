/**
 * O TEMPO QUE A IA ESCOLHEU — leitura do `timing_plan` (migrations 0144/0145).
 *
 * Quando o agente aciona um follow-up adaptativo, ele decide de uma vez o plano
 * de atrasos do fluxo inteiro e o grava no enrollment. Este módulo é o lado da
 * LEITURA: transforma o `jsonb` no que o dossiê mostra — quanto a IA escolheu,
 * por quê, e se ela bateu no limite que o dono do fluxo configurou.
 *
 * Contrato (fechado com o dono do motor):
 *
 *     {
 *       "decidido_em": "<ISO>",
 *       "modelo": "<id do modelo>",
 *       "esperas": {
 *         "<node_id>": {
 *           "escolhido_ms": int, "min_ms": int, "max_ms": int,
 *           "clampado": bool, "motivo": "<frase curta em pt-br>"
 *         }
 *       }
 *     }
 */
import { duracaoLegivel } from "./eventos-legiveis";

export interface EsperaDoPlano {
  escolhido_ms: number;
  min_ms: number;
  max_ms: number;
  clampado: boolean;
  motivo: string;
}

export interface PlanoDeTempo {
  decidido_em: string | null;
  modelo: string | null;
  esperas: Record<string, EsperaDoPlano>;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Lê o plano com desconfiança.
 *
 * A coluna é `jsonb` e quem a escreve é o motor a partir da resposta de um
 * modelo. Um plano meio escrito não pode derrubar o dossiê inteiro: cada espera
 * entra só se tiver os três números que a tela promete mostrar, e o resto é
 * descartado — meia linha na tela seria pior que linha nenhuma, porque afirmaria
 * uma decisão que não dá para conferir.
 *
 * `null` quando não há plano: fluxo v1 e espera fixa NÃO mostram bloco nenhum.
 * Um placeholder ali afirmaria que houve decisão da IA onde não houve.
 */
export function leituraDoPlano(bruto: unknown): PlanoDeTempo | null {
  if (!bruto || typeof bruto !== "object") return null;
  const raiz = bruto as Record<string, unknown>;
  const cru = raiz.esperas;
  if (!cru || typeof cru !== "object") return null;

  const esperas: Record<string, EsperaDoPlano> = {};
  for (const [nodeId, v] of Object.entries(cru as Record<string, unknown>)) {
    if (!v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    const escolhido = numero(e.escolhido_ms);
    const min = numero(e.min_ms);
    const max = numero(e.max_ms);
    if (escolhido === null || min === null || max === null) continue;
    esperas[nodeId] = {
      escolhido_ms: escolhido,
      min_ms: min,
      max_ms: max,
      clampado: e.clampado === true,
      // O motivo é o que transforma o bloco de telemetria em explicação. Sem
      // ele a tela diria "4 horas" e o operador continuaria sem saber por quê —
      // por isso a ausência é DITA, não escondida.
      motivo: texto(e.motivo) ?? "sem motivo registrado",
    };
  }

  if (Object.keys(esperas).length === 0) return null;
  return { decidido_em: texto(raiz.decidido_em), modelo: texto(raiz.modelo), esperas };
}

/** A espera em três frases prontas para a tela. */
export function descreveEspera(espera: EsperaDoPlano): { escolhido: string; faixa: string; motivo: string } {
  return {
    escolhido: duracaoLegivel(espera.escolhido_ms),
    faixa: `seu limite: de ${duracaoLegivel(espera.min_ms)} a ${duracaoLegivel(espera.max_ms)}`,
    motivo: espera.motivo,
  };
}
