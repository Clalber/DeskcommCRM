/**
 * O subtítulo do card do nó final passou a sair de `lib/followup/vocabulario.ts`
 * em vez de um mapa próprio deste arquivo — eram duas cópias das mesmas três
 * palavras. A troca só vale se o texto na tela for o MESMO, e "mesmo" aqui é
 * literal: `tests/e2e/followup-journey.spec.ts` confere "Convertido" no card.
 */
import { describe, expect, it } from "vitest";

import { describeNodeConfig } from "./nodeVisuals";

describe("describeNodeConfig — nó final", () => {
  it.each([
    ["converted", "Convertido"],
    ["exhausted", "Esgotado"],
    ["custom", "Personalizado"],
  ] as const)("outcome '%s' aparece no card como '%s'", (outcome, esperado) => {
    expect(describeNodeConfig("end", { outcome })).toBe(esperado);
  });
});
