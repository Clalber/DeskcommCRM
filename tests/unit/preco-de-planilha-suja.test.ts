import { describe, expect, it } from "vitest";

import { precoParaCentavos } from "@/lib/schemas/produtos";

/**
 * A PLANILHA DA LOJA VEM SUJA — e adivinhar errado é caro dos dois lados.
 *
 * "R$ 5.499,00", "5499,00", "5.499" e "5499" significam a mesma coisa para quem
 * digitou. Ler "5.499" como cinco reais e quarenta e nove centavos põe um iPhone
 * a cinco reais; ler "5,49" como quinhentos e quarenta e nove cobra cem vezes
 * mais. Os dois erros passam despercebidos numa importação de 300 linhas.
 *
 * A regra: o ÚLTIMO separador manda. Dois dígitos depois dele são centavos;
 * qualquer outra coisa é separador de milhar.
 */
describe("preço em texto livre vira centavos", () => {
  it("lê as formas que a loja escreve", () => {
    expect(precoParaCentavos("R$ 5.499,00")).toBe(549900);
    expect(precoParaCentavos("5499,00")).toBe(549900);
    expect(precoParaCentavos("5.499")).toBe(549900);
    expect(precoParaCentavos("5499")).toBe(549900);
    expect(precoParaCentavos("R$5.499,90")).toBe(549990);
  });

  it("entende o formato americano sem confundir com milhar", () => {
    expect(precoParaCentavos("5,499.00")).toBe(549900);
    expect(precoParaCentavos("1299.90")).toBe(129990);
  });

  it("valores pequenos, onde o erro de escala é mais fácil", () => {
    expect(precoParaCentavos("49,90")).toBe(4990);
    expect(precoParaCentavos("0,99")).toBe(99);
    expect(precoParaCentavos("100")).toBe(10000);
  });

  it("RECUSA o que não dá para ler, em vez de chutar", () => {
    // Recusar é a função: a linha entra no relatório de erro e a pessoa
    // corrige. Um chute vira preço errado dito a um cliente.
    expect(precoParaCentavos("")).toBeNull();
    expect(precoParaCentavos("sob consulta")).toBeNull();
    expect(precoParaCentavos("-50")).toBeNull();
    expect(precoParaCentavos("R$")).toBeNull();
  });
});
