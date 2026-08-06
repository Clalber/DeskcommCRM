import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Nenhum seed de E2E pode ler `.env.local` DIRETO do disco.
 *
 * ═══ O DEFEITO QUE ISTO CONGELA (medido em 2026-08-06) ═══
 *
 * Os seeds faziam:
 *
 *     const envFile = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
 *
 * ignorando `process.env`. Num checkout de trabalho, `.env.local` aponta para
 * PRODUÇÃO — então a suíte E2E semeava organizações, usuários e agentes de teste
 * **no banco real**, e passava verde. O `.env.e2e` injetado no `webServer` do
 * Playwright não os alcançava, porque eles nunca olhavam para o ambiente.
 *
 * A org `e2e-test-org` está na produção deste projeto desde 2026-04-29. Não foi
 * um acidente de sessão: era o comportamento normal.
 *
 * ═══ POR QUE UM TESTE E NÃO SÓ A CORREÇÃO ═══
 *
 * Os 16 seeds foram migrados para `scripts/lib/env-de-teste.ts`. Sem este gate, o
 * 17º nasce copiando o mais próximo — e o padrão volta pela porta que ninguém
 * está olhando. O custo de escrever em produção não é reparável por code review
 * depois do fato.
 *
 * ⚠️ ESCOPO DECLARADO: este gate cobre `scripts/seed-e2e-*.ts` — o que a suíte
 * roda SOZINHA, sem ninguém olhando. As ~78 sondas de `tests/*.ts` e
 * `scripts/sonda-*`/`prova-*` seguem com o padrão antigo: são ferramentas que
 * alguém dispara à mão e acompanha. A dívida está no HANDOFF, não escondida aqui.
 */
const SEEDS = readdirSync(join(process.cwd(), "scripts"))
  .filter((f) => f.startsWith("seed-e2e-") && f.endsWith(".ts"))
  .map((f) => join("scripts", f))
  .sort();

/**
 * A forma que denuncia: ler o arquivo, em vez de perguntar ao ambiente.
 *
 * ⚠️ A primeira versão desta regex NÃO PEGAVA o padrão real, e o gate passava
 * medindo nada. Ela era:
 *
 *     /readFileSync\s*\(\s*(?:path\.join\([^)]*)?["'`][^"'`]*\.env\.local/
 *
 * O `[^)]*` parava no `)` de `process.cwd()` — que está no meio de
 * `path.join(process.cwd(), ".env.local")` — então a alternativa nunca casava.
 * Descoberto por sabotagem: reintroduzir a leitura num seed não vermelhou nada.
 *
 * A versão atual não tenta entender a estrutura da chamada: procura `.env.local`
 * como argumento de QUALQUER coisa parecida com leitura de arquivo. Regex que
 * modela sintaxe erra em silêncio; regex que procura o literal, não.
 */
const LE_DO_DISCO = /readFileSync[\s\S]{0,80}?\.env\.local/;

describe("seeds de E2E não leem .env.local do disco", () => {
  it("a varredura acha os seeds — sem isto, um teste vazio passaria e não mediria nada", () => {
    // Controle positivo. Um filtro errado devolve [], o `it.each` não roda
    // nenhum caso, e o arquivo inteiro vira decoração verde.
    expect(SEEDS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(SEEDS)("%s pergunta ao ambiente, não ao arquivo", (seed) => {
    const fonte = readFileSync(seed, "utf8");
    expect(
      LE_DO_DISCO.test(fonte),
      `${seed} lê .env.local do disco. Num checkout de trabalho isso aponta para PRODUÇÃO — ` +
        "use `credenciaisSupabaseDeTeste()` de scripts/lib/env-de-teste.ts, que faz process.env vencer.",
    ).toBe(false);
  });

  it.each(SEEDS)("%s anuncia contra qual banco vai escrever", (seed) => {
    const fonte = readFileSync(seed, "utf8");
    // O modo de falha caro é silencioso: um seed que escreve em produção acha os
    // mesmos dados de teste de sempre e termina com "✅ Seed completo". A linha
    // impressa é o que torna o destino observável antes do estrago.
    expect(
      fonte.includes("anunciarDestino("),
      `${seed} não chama anunciarDestino() — sem isso, ninguém vê que ele foi para a nuvem.`,
    ).toBe(true);
  });
});
