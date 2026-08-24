import { describe, expect, it } from "vitest";

import { camposDoFunil } from "./campos-do-funil";

describe("camposDoFunil", () => {
  it("ignora entradas que não passam no schema", () => {
    expect(
      camposDoFunil({
        fields: [{ key: "endereco", label: "Endereço", type: "text" }, { key: "??" }],
      }),
    ).toEqual([{ key: "endereco", label: "Endereço", type: "text" }]);
  });
});
