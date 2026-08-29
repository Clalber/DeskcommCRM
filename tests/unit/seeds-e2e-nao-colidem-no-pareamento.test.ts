import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Nenhum seed de e2e deixa uma sessão de canal em estado de PAREAMENTO PENDENTE.
 *
 * ─── Por que esta guarda existe ─────────────────────────────────────────────
 *
 * O índice `channel_sessions_um_pareamento_pendente_por_org` (migration 0204)
 * admite UMA sessão por organização com `status in ('STARTING','SCAN_QR_CODE')`
 * e sem telefone. O default da coluna `status` é justamente `STARTING`.
 *
 * Os seeds de e2e **compartilham a organização** do `.e2e-creds.json`, e cada um
 * procura sessão existente apenas pelo PRÓPRIO `waha_session_name` — nenhum
 * pergunta "já existe pendente?". Consequência: dois seeds na mesma rodada, o
 * segundo leva `23505`, a spec morre no `beforeAll` com
 * `insert channel_session: duplicate key`, e o check `e2e` fica vermelho por um
 * motivo que não tem nada a ver com o que a spec testa.
 *
 * ─── Por que é uma guarda, e não cinco correções ────────────────────────────
 *
 * Isto foi consertado DUAS vezes à mão e voltou nas duas. Na primeira, dois
 * seeds foram corrigidos porque uma auditoria os nomeou — e sobraram três, que
 * só apareceram quando o CI ficou vermelho de novo, num arquivo que ninguém
 * tinha citado. Corrigir a instância que alguém apontou não fecha a classe: o
 * seed seguinte nasce sem `status` porque o default parece razoável, e o defeito
 * volta pela sexta vez.
 *
 * A régua é de FORMA (lê o arquivo), não de execução: um seed novo é reprovado
 * antes de chegar ao CI de e2e, que custa minutos para dizer a mesma coisa.
 */

const DIR = "scripts";

/** `WORKING` é o estado honesto: o que estes seeds simulam é canal CONECTADO. */
const SAIDAS = [/status:\s*["'`]/, /phone_number:\s*["'`]/];

function insertsDeSessao(fonte: string): string[] {
  // O bloco entre `.insert({` e o `})` que o fecha, para cada insert que
  // menciona `waha_session_name` — os outros inserts do arquivo não interessam.
  const blocos: string[] = [];
  const re = /\.insert\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fonte))) {
    let nivel = 1;
    let i = m.index + m[0].length;
    while (i < fonte.length && nivel > 0) {
      if (fonte[i] === "{") nivel++;
      else if (fonte[i] === "}") nivel--;
      i++;
    }
    const bloco = fonte.slice(m.index, i);
    if (bloco.includes("waha_session_name")) blocos.push(bloco);
  }
  return blocos;
}

describe("seeds de e2e não deixam pareamento pendente", () => {
  const seeds = readdirSync(DIR).filter((f) => f.startsWith("seed-e2e-") && f.endsWith(".ts"));

  it("CONTROLE: há seeds para inspecionar (senão a régua passa por vacuidade)", () => {
    expect(seeds.length).toBeGreaterThan(3);
  });

  it("todo insert de sessão declara `status` ou `phone_number`", () => {
    const faltando: string[] = [];
    for (const arquivo of seeds) {
      const fonte = readFileSync(join(DIR, arquivo), "utf8");
      for (const bloco of insertsDeSessao(fonte)) {
        if (!SAIDAS.some((re) => re.test(bloco))) faltando.push(arquivo);
      }
    }
    expect(
      faltando,
      "Seed que insere channel_sessions sem `status` herda o default `STARTING` e\n" +
        "entra no índice de pareamento pendente da migration 0204. Como os seeds\n" +
        "compartilham a organização do .e2e-creds.json, o SEGUNDO da rodada leva\n" +
        "23505 e derruba a spec no beforeAll.\n" +
        'Conserto: `status: "WORKING"` — é o que o seed simula de verdade.',
    ).toEqual([]);
  });

  it("CONTROLE: a régua enxerga um insert sem status (senão ela não mede nada)", () => {
    // Sem este caso, um erro no varredor de blocos devolveria `[]` para tudo e a
    // guarda ficaria verde justamente quando parasse de funcionar.
    const falso = `await admin.from("channel_sessions").insert({
      organization_id: orgId,
      waha_session_name: SESSION_NAME,
      webhook_secret_encrypted: "\\\\x00",
    });`;
    const blocos = insertsDeSessao(falso);
    expect(blocos).toHaveLength(1);
    expect(SAIDAS.some((re) => re.test(blocos[0]!))).toBe(false);
  });
});
