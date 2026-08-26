import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * FRENTE SEM TELA DECLARA QUEM A PROVA EM TELA — e o endereço tem de existir.
 *
 * ## Por que este teste existe
 *
 * A doutrina de QA Visual deste repo diz que nada é pronto sem prova em tela.
 * Uma camada de API não tem pixel: ela não consegue cumprir isso sozinha, e se
 * depender da tela para fechar, vira dependência circular com quem depende dela
 * para existir.
 *
 * A DECISÃO 21 da entrega da Agenda resolveu assim: a frente sem tela fecha com
 * prova de caminho real **declarando o nome da spec** que vai cobri-la em tela.
 * A obrigação não some — ela ganha endereço.
 *
 * ## E por que ele NÃO é burocracia
 *
 * Sem este gate, a DECISÃO 21 depende da disciplina de quem escreve o relatório:
 * basta citar uma spec que não existe, ou que nunca vai existir, e a dívida
 * evapora sem ninguém ver. Foi o próprio @Maestro quem apontou, aplicando à
 * governança a conclusão que a entrega tirou da infraestrutura:
 *
 *   **regra não protege quem a escreve; mecanismo protege.**
 *
 * É a mesma tese que levou o time de "avisar antes de subir o banco" para
 * "subir stack com nome próprio" — e de "lembrar de escolher porta" para
 * "o daemon escolhe".
 *
 * ## O contrato
 *
 * Relatório de entrega em `evidence/calendario/ENTREGA-*.md` que contenha uma
 * linha `prova-em-tela: <caminho>` precisa que aquele caminho EXISTA. Relatório
 * sem a linha não é cobrado aqui — quem cobra é a revisão; este teste garante
 * apenas que **endereço declarado é endereço real**.
 */
const RAIZ = process.cwd();
const PASTA = path.join(RAIZ, "evidence", "calendario");
const DECLARACAO = /^\s*prova-em-tela:\s*(\S+)\s*$/gim;

describe("frente sem tela declara quem a prova em tela", () => {
  it("toda spec citada como prova-em-tela existe no disco", () => {
    if (!existsSync(PASTA)) return; // a entrega ainda não produziu evidência

    const quebrados: string[] = [];
    for (const arquivo of readdirSync(PASTA).filter((f) => /^ENTREGA-.*\.md$/.test(f))) {
      const conteudo = readFileSync(path.join(PASTA, arquivo), "utf-8");
      for (const [, alvo] of conteudo.matchAll(DECLARACAO)) {
        if (!existsSync(path.join(RAIZ, alvo))) quebrados.push(`${arquivo} → ${alvo}`);
      }
    }

    expect(
      quebrados,
      "Relatório de entrega cita uma prova em tela que NÃO existe. A DECISÃO 21 " +
        "permite fechar frente sem pixel, mas o endereço declarado tem de ser real — " +
        "senão a obrigação evapora sem ninguém ver. Crie a spec ou corrija o caminho.",
    ).toEqual([]);
  });

  it("CONTROLE: o detector enxerga uma declaração quebrada", () => {
    // Sem este caso, o teste acima fica verde se a regex parar de casar —
    // e verde por instrumento morto é indistinguível de verde por estar tudo certo.
    const amostra = "prova-em-tela: tests/e2e/nao-existe-de-proposito.spec.ts\n";
    const achados = [...amostra.matchAll(DECLARACAO)].map((m) => m[1]);
    expect(achados).toEqual(["tests/e2e/nao-existe-de-proposito.spec.ts"]);
    expect(existsSync(path.join(RAIZ, achados[0]!))).toBe(false);
  });
});
