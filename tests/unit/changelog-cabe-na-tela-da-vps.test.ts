import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { extractChangelogSection } from "@/lib/system/changelog";

/**
 * A seção mais nova do CHANGELOG é TELA DE PRODUTO, e ela tem um teto.
 *
 * O agente que roda por cron na VPS não manda "a seção da versão nova" para o
 * app: ele manda o CHANGELOG.md INTEIRO cortado em N bytes crus
 * (`git show <tag>:CHANGELOG.md | head -c N`), e é o app que extrai a seção do
 * texto recebido. Como o arquivo é lido de cima para baixo e a versão mais nova
 * fica no topo, isso funciona — até a seção mais nova sozinha passar de N.
 *
 * Medido ao cortar a v1.4.0 (2026-08-24): a seção tinha 39.899 bytes contra um
 * teto de 30.000. O texto chegava DECAPITADO no meio de uma frase e — pior — o
 * bloco `### ⚠️ Requer atenção` ficava inteiro do lado de fora do corte:
 * `extractChangelogSection()` sobre o texto truncado devolvia
 * `requiresAttention: null`. Os dois avisos daquela versão (que rodar o
 * `update.sh` uma vez passou a bastar, e que o teto de gasto de IA sempre foi em
 * dólar) simplesmente não existiriam para quem fosse atualizar.
 *
 * Nada reprovava isso. O defeito não está no texto nem no script: está em serem
 * dois artefatos com um contrato de tamanho que ninguém media. Este teste é esse
 * contrato.
 *
 * O teto NÃO é digitado aqui — é lido do próprio `agent.sh`. Um número copiado
 * para cá viraria uma segunda fonte da verdade, e a que envelhece primeiro é
 * sempre a cópia.
 *
 * CONSERTOS POSSÍVEIS quando este teste ficar vermelho, em ordem de preferência:
 *   1. enxugar a seção (quase sempre certo — item de changelog longo costuma ser
 *      explicação que só interessa a quem escreveu o código);
 *   2. mover `### ⚠️ Requer atenção` para logo depois do parágrafo de abertura —
 *      `findAttentionRange()` acha o bloco em qualquer posição da seção, então o
 *      aviso passa a sobreviver ao corte mesmo se o corpo for truncado.
 * Aumentar o teto no `agent.sh` conserta as versões futuras e NÃO conserta esta:
 * quem corta é o script que já está instalado na VPS do cliente, não o da `main`.
 */

const RAIZ = process.cwd();
const CHANGELOG = path.join(RAIZ, "CHANGELOG.md");
const AGENT_SH = path.join(RAIZ, "hostgator-setup-kit", "agent.sh");

/** O teto real, lido de onde ele é aplicado. */
function tetoDoAgente(): number {
  const sh = fs.readFileSync(AGENT_SH, "utf8");
  const m = /git show\s+"?\$\{?LATEST_TAG\}?"?:CHANGELOG\.md[^\n]*head -c (\d+)/.exec(sh);
  if (!m) {
    throw new Error(
      "não achei o corte do CHANGELOG em agent.sh — se o mecanismo mudou, este teste precisa " +
        "acompanhar em vez de ser apagado: o contrato de tamanho continua existindo.",
    );
  }
  return Number(m[1]);
}

/** A primeira versão numerada do arquivo — "Não lançado" não é publicável. */
function secaoMaisNova(raw: string): { versao: string; inicio: number; fim: number } {
  const linhas = raw.split("\n");
  const rx = /^##\s+\[(\d+\.\d+\.\d+)\]/;
  let inicio = -1;
  let versao = "";
  let offset = 0;

  for (const linha of linhas) {
    const m = rx.exec(linha);
    if (m && inicio === -1) {
      inicio = offset;
      versao = m[1]!;
    } else if (inicio !== -1 && /^##\s+\[/.test(linha)) {
      return { versao, inicio, fim: offset };
    }
    offset += Buffer.byteLength(linha, "utf8") + 1; // +1 = o \n
  }
  if (inicio === -1) throw new Error("nenhuma versão numerada no CHANGELOG.md");
  return { versao, inicio, fim: Buffer.byteLength(raw, "utf8") };
}

/** Exatamente o que o agente manda: os primeiros N bytes do arquivo. */
function comoChegaNaVps(raw: string, teto: number): string {
  return Buffer.from(raw, "utf8").subarray(0, teto).toString("utf8");
}

describe("o CHANGELOG da versão nova cabe no que a VPS recebe", () => {
  const raw = fs.readFileSync(CHANGELOG, "utf8");
  const teto = tetoDoAgente();
  const { versao, fim } = secaoMaisNova(raw);

  it("a seção mais nova termina antes do corte do agente", () => {
    expect(
      fim,
      `A seção [${versao}] termina no byte ${fim}, além do corte de ${teto} bytes que o ` +
        `agent.sh aplica. O dono da VPS receberia o texto cortado no meio. Enxugue a seção ` +
        `(veja o cabeçalho deste arquivo).`,
    ).toBeLessThanOrEqual(teto);
  });

  it("o aviso de ação manual sobrevive ao corte", () => {
    const inteiro = extractChangelogSection(raw, versao);
    expect(inteiro, `a seção [${versao}] não foi extraída do arquivo completo`).not.toBeNull();

    // Só cobra o que existe: versão sem ação manual não precisa do bloco.
    if (inteiro!.requiresAttention === null) return;

    const cortado = extractChangelogSection(comoChegaNaVps(raw, teto), versao);
    expect(
      cortado?.requiresAttention,
      `A seção [${versao}] tem "⚠️ Requer atenção", mas o bloco fica FORA dos ${teto} bytes ` +
        `que chegam à VPS — o aviso não apareceria para quem vai atualizar. Enxugue a seção, ` +
        `ou mova o bloco para logo depois do parágrafo de abertura.`,
    ).not.toBeNull();
  });
});
