import type { TrilhaDeCor } from "./tipos";

/**
 * As oito trilhas de cor de pessoa da Agenda.
 *
 * Os valores moram no `globals.css` (`--agenda-pessoa-1..8`), em três blocos de
 * tema, e NÃO são repetidos aqui — este módulo só sabe *apontar* para eles. Hex
 * em componente seria um segundo lugar para a mesma verdade, e o tema escuro
 * ficaria de fora.
 *
 * O nome existe porque cor não pode ser a única informação: ele vai para o
 * `title`/`aria-label` de quem só enxerga a bolinha, e para a legenda.
 */
export const TRILHAS: ReadonlyArray<{ trilha: TrilhaDeCor; nome: string }> = [
  { trilha: 1, nome: "Telha" },
  { trilha: 2, nome: "Âmbar" },
  { trilha: 3, nome: "Oliva" },
  { trilha: 4, nome: "Turquesa" },
  { trilha: 5, nome: "Azul" },
  { trilha: 6, nome: "Índigo" },
  { trilha: 7, nome: "Violeta" },
  { trilha: 8, nome: "Framboesa" },
];

/** A variável CSS da trilha — use sempre isto, nunca um hex. */
export function corDaTrilha(trilha: TrilhaDeCor): string {
  return `var(--agenda-pessoa-${trilha})`;
}

/**
 * Fundo do bloco, derivado da própria cor da trilha em vez de declarado à parte.
 *
 * `color-mix` sobre `--color-surface` (e não sobre `transparent`) porque o bloco
 * pousa em superfícies diferentes conforme a visão, e misturar com o fundo real
 * mantém o contraste do texto previsível nos dois temas.
 */
export function fundoDaTrilha(trilha: TrilhaDeCor, porcento = 12): string {
  return `color-mix(in oklab, ${corDaTrilha(trilha)} ${porcento}%, var(--color-surface))`;
}

/**
 * A inicial que acompanha a cor.
 *
 * Duas letras quando há sobrenome ("Ana Prado" → "AP"), porque numa equipe de
 * clínica "A" sozinho repete rápido. `Intl` não entra aqui: `toUpperCase` em
 * pt-br não tem caso especial que justifique.
 */
export function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0]?.[0] ?? "";
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? "") : "";
  return (primeira + ultima).toUpperCase();
}

/**
 * Distribui trilhas por posição na lista, e volta ao começo depois da oitava.
 *
 * Determinístico de propósito: a cor de alguém não pode mudar entre um render e
 * outro — a pessoa aprende "o Jade é a Ana", e uma cor sorteada destruiria isso.
 */
export function trilhaPorPosicao(posicao: number): TrilhaDeCor {
  const indice = ((posicao % TRILHAS.length) + TRILHAS.length) % TRILHAS.length;
  return (TRILHAS[indice]?.trilha ?? 1) as TrilhaDeCor;
}
