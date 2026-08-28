"use client";
/**
 * O locale do `date-fns` que corresponde ao idioma da interface.
 *
 * ─── Por que um módulo, e não `idioma === "es" ? es : ptBR` em cada tela ────
 *
 * A Agenda formata data em CINCO arquivos (`_client`, `GradeDaAgenda`,
 * `PainelDeMarcacao`, `HistoricoDaAgenda` e a vitrine pública). Espalhar o
 * ternário por todos eles cria cinco lugares para esquecer o próximo idioma —
 * e o esquecimento é silencioso, porque uma data em português dentro de uma
 * tela em espanhol não quebra teste nenhum: ela só fica errada.
 *
 * ─── `ptBR` é o default, e isso não é acidente ──────────────────────────────
 *
 * Mesma regra do dicionário: idioma desconhecido cai em português, que é o
 * comportamento de antes desta feature. Uma data nunca deixa de ser formatada.
 */
import { es, ptBR } from "date-fns/locale";
import type { Locale } from "date-fns";

import { useIdioma } from "./IdiomaProvider";
import type { Idioma } from "./idiomas";

const POR_IDIOMA: Record<Idioma, Locale> = {
  "pt-BR": ptBR,
  es,
};

/** Fora de componente (server component, helper puro). */
export function localeDeData(idioma: Idioma): Locale {
  return POR_IDIOMA[idioma] ?? ptBR;
}

/** Dentro de componente cliente: segue o idioma do provider. */
export function useLocaleDeData(): Locale {
  return localeDeData(useIdioma());
}
