/**
 * Os três `<SelectItem>` do nó final deixaram de ser literais e passaram a sair
 * de `opcoes(RESULTADOS_DO_FIM)`. Uma varredura de texto no arquivo não enxerga
 * item gerado em `.map()` — então a prova de que nada mudou na tela precisa ser
 * o DOM, aberto, e não o código-fonte.
 *
 * `tests/e2e/followup-journey.spec.ts` escolhe "Convertido" pelo nome exato.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it } from "vitest";

import { EndForm } from "./EndForm";

beforeAll(() => {
  // Radix Select usa pointer capture e scrollIntoView; o jsdom não implementa
  // nenhum dos dois e o clique no gatilho morre antes de abrir a lista.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});

describe("EndForm — seletor de resultado", () => {
  it("oferece Convertido, Esgotado e Personalizado, nessa ordem", async () => {
    render(<EndForm config={{ outcome: "exhausted" }} onChange={() => {}} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Resultado" }));

    const itens = await screen.findAllByRole("option");
    expect(itens.map((i) => i.textContent)).toEqual(["Convertido", "Esgotado", "Personalizado"]);
  });

  it("escolher uma opção grava o valor de wire correspondente", async () => {
    const gravados: Array<{ outcome: string }> = [];
    render(
      <EndForm
        config={{ outcome: "exhausted" }}
        onChange={(c) => gravados.push(c as { outcome: string })}
      />,
    );

    await userEvent.click(screen.getByRole("combobox", { name: "Resultado" }));
    await userEvent.click(await screen.findByRole("option", { name: "Convertido" }));

    // O rótulo é português; o que desce para o grafo continua sendo o wire.
    expect(gravados).toEqual([{ outcome: "converted" }]);
  });
});
