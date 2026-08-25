/**
 * Classificação inicial do lead — roda UMA vez, na ingestão do webhook, antes
 * de qualquer humano ou IA conversar com o lead. Três saídas possíveis:
 *
 *   1. `desqualificado` — bateu um dos 3 motivos EXATOS abaixo. Determinístico,
 *      sem exceção por regra mal configurada (mesmo raciocínio do gate de
 *      consentimento em `lib/automation/guarda-do-contato.ts`: invariante de
 *      negócio fica em código, não em config).
 *   2. `revisao_humana` — o dado não é claramente bom nem claramente
 *      desqualificável (conflito de identidade). Não é uma classe A/B/C/D:
 *      é um pedido de olho humano ANTES de classificar.
 *   3. `A` | `B` | `C` | `D` | `nao_avaliado` — a classe de score, quando
 *      computável. `nao_avaliado` é o valor honesto enquanto
 *      `CONFIG_CLASSIFICACAO_INICIAL` for `null` (ver esse arquivo pro
 *      porquê) — nunca um "C" ou "frio" adivinhado por omissão.
 *
 * Este módulo é PURO (nenhum I/O) — testável sem banco, chamado pela rota do
 * webhook com os `custom_fields` já mapeados pelo normalizador do Respondi.
 */
import { CONFIG_CLASSIFICACAO_INICIAL } from "@/lib/leads/config-classificacao-inicial";

export type ClasseInicial = "A" | "B" | "C" | "D" | "nao_avaliado";
export type ResultadoClassificacaoInicial =
  | { status: "desqualificado"; motivo: MotivoDesqualificacao }
  | { status: "revisao_humana"; motivo: MotivoRevisaoHumana }
  | { status: "classificado"; classe: ClasseInicial; percentual: number | null };

export type MotivoDesqualificacao = "sem_capacidade_de_investimento" | "contato_invalido" | "sem_consentimento";
export type MotivoRevisaoHumana = "conflito_de_identidade";

export interface EntradaClassificacaoInicial {
  customFields: Record<string, unknown>;
  /** `null` = telefone ausente ou não normalizável (ver `normalizePhoneBR`). */
  phoneNormalizado: string | null;
  consentGranted: boolean;
  /**
   * Presente só quando o contato foi casado com um JÁ EXISTENTE (mesmo
   * telefone ou mesmo e-mail) — necessário pra checar conflito de identidade.
   * `null` = contato novo, sem conflito possível.
   */
  contatoExistente: { name: string | null } | null;
  /** Nome que ESTE envio trouxe (`mapped.name`). */
  nomeDoEnvio: string | null;
}

/**
 * As frases-exatas de "sem capacidade de investimento" que o form
 * "Imobiliárias e Incorporadoras" do Respondi usa como opção do radio de
 * faixa de investimento viável. Comparação exata (case-insensitive, trim) —
 * NUNCA substring/regex frouxo, porque "Ainda não posso investir" é o único
 * motivo dos 3 que é DIRETO do usuário (os outros dois são inferência nossa),
 * e um match frouxo desqualificaria por engano uma resposta que só MENCIONA
 * a frase sem ser ela.
 *
 * Hoje só tem a forma exata citada na diretiva. Se o Respondi tiver outra
 * variante (typo do form, opção duplicada), adicione aqui — não crie um
 * segundo lugar de verdade.
 */
const FRASES_SEM_CAPACIDADE = ["ainda não posso investir"];

function normalizaTexto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim().toLowerCase() : null;
}

/**
 * Os 3 motivos EXATOS de desqualificação, na ordem em que a diretiva os lista.
 * Qualquer outro sinal ruim (spam, incoerência) NÃO desqualifica — vai para
 * `avaliarRevisaoHumana` ou fica pendente de config, nunca vira um 4º motivo
 * inventado aqui.
 */
export function avaliarDesqualificacao(input: EntradaClassificacaoInicial): MotivoDesqualificacao | null {
  // 1. "Ainda não posso investir" — testado contra o campo de faixa de
  // investimento viável, que é onde a diretiva ancora a frase.
  const faixaViavel = normalizaTexto(input.customFields.viable_investment_range);
  if (faixaViavel && FRASES_SEM_CAPACIDADE.includes(faixaViavel)) {
    return "sem_capacidade_de_investimento";
  }

  // 2. Contato inválido — o canal de follow-up (WhatsApp) não existe depois
  // da normalização E.164. Um lead sem telefone válido não tem como receber
  // nenhuma das cadências por classe.
  if (!input.phoneNormalizado) return "contato_invalido";

  // 3. Consentimento recusado/ausente — mesmo estado no schema hoje
  // (`consent.marketing.granted_at` null nos dois casos; ver
  // guarda-do-contato.ts pro mesmo raciocínio do lado do envio).
  if (!input.consentGranted) return "sem_consentimento";

  return null;
}

/**
 * Único caso de revisão humana implementado agora: conflito de identidade
 * DETERMINÍSTICO — o envio casou com um contato já existente (mesmo telefone
 * ou e-mail) cujo nome gravado diverge do nome que ESTE envio trouxe. É o
 * sinal mais barato de "duas pessoas atrás do mesmo contato" ou "nome digitado
 * errado da vez passada" — os dois merecem olho humano antes de classificar.
 *
 * "Spam" e "incoerência" (pedidos pela diretiva) NÃO estão aqui: exigem
 * julgamento sobre texto livre (nome sem sentido, respostas contraditórias
 * entre si) que este módulo, deliberadamente determinístico, não tenta
 * adivinhar sem um critério escrito por Matheus — ver o TODO no relatório
 * desta sessão. Ficam PENDENTES, não inventadas.
 */
export function avaliarRevisaoHumana(input: EntradaClassificacaoInicial): MotivoRevisaoHumana | null {
  if (!input.contatoExistente) return null;
  const nomeExistente = normalizaTexto(input.contatoExistente.name);
  const nomeNovo = normalizaTexto(input.nomeDoEnvio);
  if (nomeExistente && nomeNovo && nomeExistente !== nomeNovo) {
    return "conflito_de_identidade";
  }
  return null;
}

/**
 * O percentual — numerador confirmado (`respondi_score`), denominador
 * PENDENTE (`CONFIG_CLASSIFICACAO_INICIAL.maxScoreConhecido`). Devolve `null`
 * enquanto o config não existir; nunca inventa um teto.
 */
function calcularPercentual(customFields: Record<string, unknown>): number | null {
  if (!CONFIG_CLASSIFICACAO_INICIAL) return null;
  const bruto = Number(customFields.respondi_score);
  if (!Number.isFinite(bruto)) return null;
  const max = CONFIG_CLASSIFICACAO_INICIAL.maxScoreConhecido;
  if (!(max > 0)) return null;
  return Math.max(0, Math.min(100, (bruto / max) * 100));
}

function bandaDoPercentual(percentual: number, cfg: NonNullable<typeof CONFIG_CLASSIFICACAO_INICIAL>): "A" | "B" | "C" {
  if (percentual >= cfg.bandas.A.min) return "A";
  if (percentual >= cfg.bandas.B.min) return "B";
  return "C";
}

export function classificarLeadInicial(input: EntradaClassificacaoInicial): ResultadoClassificacaoInicial {
  const motivoDesqualificacao = avaliarDesqualificacao(input);
  if (motivoDesqualificacao) return { status: "desqualificado", motivo: motivoDesqualificacao };

  const motivoRevisao = avaliarRevisaoHumana(input);
  if (motivoRevisao) return { status: "revisao_humana", motivo: motivoRevisao };

  const percentual = calcularPercentual(input.customFields);
  const cfg = CONFIG_CLASSIFICACAO_INICIAL;

  // D é sobre ORÇAMENTO declarado, não sobre score — checa antes da banda de
  // percentual e a sobrepõe quando bate (um lead pode ter score alto e
  // orçamento baixo ao mesmo tempo; a diretiva pede que isso vire D, não A).
  if (cfg) {
    const faixaViavel = normalizaTexto(input.customFields.viable_investment_range);
    if (faixaViavel && cfg.orcamentoBaixoRegex.test(faixaViavel)) {
      return { status: "classificado", classe: "D", percentual };
    }
  }

  if (percentual === null || !cfg) return { status: "classificado", classe: "nao_avaliado", percentual };
  return { status: "classificado", classe: bandaDoPercentual(percentual, cfg), percentual };
}
