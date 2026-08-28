import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { indexExists, lastLine, sql } from "./gov-helpers";

/**
 * Uma organização tem NO MÁXIMO um pareamento de WhatsApp em andamento.
 *
 * ─── O defeito que isto trava ───────────────────────────────────────────────
 *
 * UM clique em "Conectar novo WhatsApp" criava DUAS sessões: `lib/api/client.ts`
 * retenta mutação e a rota chama `waha.startSession()` DEPOIS do insert, então
 * WAHA lento faz o cliente abortar por timeout e retentar com a linha gravada.
 * Medido em produção: dois `channel.connected` com `request_id` distintos,
 * 489 ms apart.
 *
 * ─── Por que este invariante precisa de BANCO, e não de unitário ────────────
 *
 * O unitário (`tests/unit/canal-nao-duplica-no-retry.test.ts`) prova que a ROTA
 * trata o `23505`. Ele não pode provar que o `23505` ACONTECE — isso é o índice
 * parcial da 0204, e um índice só existe num Postgres. Com o unitário sozinho, o
 * conserto passaria verde com o índice ausente do baseline: a rota trataria um
 * erro que o banco nunca produz, e o clone seguiria duplicando.
 *
 * ─── A trinca que precisa concordar ─────────────────────────────────────────
 *
 * O predicado do índice, a constante do TypeScript e a query da rota falam do
 * mesmo conjunto de estados. Se divergirem, o índice barra um conjunto e a rota
 * lê outro — o sintoma seria 409 onde deveria haver a sessão pendente. Por isso
 * os valores são LIDOS do arquivo, nunca transcritos: um invariante que carrega
 * a própria cópia da lista é a terceira lista, e passa verde na divergência que
 * existe para pegar (lição de `vocabulario-banco-x-typescript.test.ts`).
 *
 * ─── Três armadilhas que a primeira versão deste arquivo pisou ──────────────
 *
 * Ela nunca chegou a executar, e teria ficado vermelha por motivos que não têm
 * nada a ver com o que mede. Ficam registradas porque a próxima pessoa a
 * escrever um invariante de banco vai pisar nelas de novo:
 *
 *  1. **`GOV_ORG` não existe** a menos que o arquivo chame `seedGov()`. Cada
 *     arquivo recebe um banco novo copiado do molde, e o molde é só o baseline.
 *     Sem seed, todo insert morre na FK com `23503` — nunca no índice.
 *  2. **`GOV_SESSION` já ocupa o slot.** O seed a cria sem `status` nem
 *     telefone, e os defaults (`STARTING`, `provider='waha'`) são exatamente a
 *     forma do predicado. Usar `GOV_ORG` faria o PRIMEIRO insert do teste levar
 *     `23505` — o oposto do que ele afirma. Por isso aqui cada caso cria a
 *     PRÓPRIA organização, como faz `canal-identificador-unico-entre-ativos`.
 *  3. **`psql -tA` imprime etiqueta de comando.** Comparar a saída inteira com
 *     `'23505'` nunca casa: vem `INSERT 0 1` junto. O padrão do repo é
 *     sentinela `select 'ok'` com `lastLine`, e `erroDe` para a violação — que
 *     ainda checa o NOME da trava, senão "rejeitou" não distingue este índice
 *     de um CHECK, de uma FK ou da RLS.
 */

const INDICE = "channel_sessions_um_pareamento_pendente_por_org";

/** O predicado do índice, direto do catálogo. */
function predicadoDoIndice(): string {
  return sql(`select pg_get_expr(i.indpred, i.indrelid)
                from pg_index i
                join pg_class c on c.oid = i.indexrelid
               where c.relname = '${INDICE}';`);
}

/** Os valores do `as const` em `lib/channels/pareamento-pendente.ts`. */
function statusDoTypeScript(): string[] {
  const fonte = readFileSync("lib/channels/pareamento-pendente.ts", "utf8");
  const bloco = /STATUS_DE_PAREAMENTO_PENDENTE\s*=\s*\[([^\]]*)\]/.exec(fonte);
  if (!bloco) throw new Error("STATUS_DE_PAREAMENTO_PENDENTE não encontrado");
  return [...bloco[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!).sort();
}

function providerDoTypeScript(): string {
  const fonte = readFileSync("lib/channels/pareamento-pendente.ts", "utf8");
  const m = /PROVIDER_DO_QR\s*=\s*"([^"]+)"/.exec(fonte);
  if (!m) throw new Error("PROVIDER_DO_QR não encontrado");
  return m[1]!;
}

/** Organização própria: não há sessão nenhuma nela, então o slot começa livre. */
function novaOrg(slug: string): string {
  sql(`
    insert into public.organizations (slug, legal_name, display_name)
    values ('${slug}', 'inv 0203', 'inv 0203');
  `);
  return sql(`select id from public.organizations where slug = '${slug}'`).trim();
}

function insertSession(org: string, cols: Record<string, string>): string {
  const nomes = ["organization_id", "waha_session_name", "webhook_secret_encrypted", ...Object.keys(cols)];
  const vals = [`'${org}'`, `'inv_' || gen_random_uuid()`, `'\\x00'::bytea`, ...Object.values(cols)];
  return sql(`
    insert into public.channel_sessions (${nomes.join(", ")})
    values (${vals.join(", ")});
    select 'ok';
  `);
}

function erroDe(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    const err = e as { stderr?: Buffer | string; message?: string };
    return String(err.stderr ?? "") + String(err.message ?? "");
  }
  throw new Error("o INSERT passou — a trava não existe neste banco");
}

describe("um pareamento pendente por organização", () => {
  it("o índice parcial existe — sem ele a rota trata um erro que nunca chega", () => {
    expect(indexExists(INDICE)).toBe(true);
  });

  it("o predicado do índice usa os MESMOS estados que o TypeScript", () => {
    const doBanco = [...predicadoDoIndice().matchAll(/'([A-Z_]+)'::text/g)].map((m) => m[1]!).sort();
    expect(doBanco).toEqual(statusDoTypeScript());
  });

  it("o índice é ESCOPADO ao WAHA — a 0203 tornou a tabela multi-provider", () => {
    expect(predicadoDoIndice()).toContain(`provider = '${providerDoTypeScript()}'`);
  });

  it("a SEGUNDA sessão pendente da mesma org é RECUSADA, e pela trava certa", () => {
    const org = novaOrg(`inv-0203-dup-${Date.now()}`);
    expect(lastLine(insertSession(org, { status: `'STARTING'` }))).toBe("ok");

    const erro = erroDe(() => insertSession(org, { status: `'SCAN_QR_CODE'` }));
    // O NOME da trava na asserção: "rejeitou" sozinho não distingue este índice
    // de um CHECK, de uma FK ou da RLS.
    expect(erro).toContain(INDICE);
  });

  it("uma sessão JÁ PAREADA não é barrada — conectar um 2º aparelho é legítimo", () => {
    const org = novaOrg(`inv-0203-fone-${Date.now()}`);
    insertSession(org, { status: `'STARTING'` });
    expect(
      lastLine(insertSession(org, { status: `'WORKING'`, phone_number: `'5511999999999'` })),
    ).toBe("ok");
  });

  it("uma pendente de OUTRO provider convive com a do WhatsApp", () => {
    // A prova do escopo. Antes desta linha o índice era cego ao provider, e o
    // Instagram — que a 0202 acabara de admitir no schema — travaria o WhatsApp.
    //
    // `instagram_user_id` não é enfeite: `channel_sessions_provider_ref_check`
    // (0203) exige o identificador da conta para cada provider. Sem ele o insert
    // morre com 23514 ANTES de o índice opinar, e o caso mediria a constraint
    // errada — vermelho por acidente, ou verde por acidente depois.
    const org = novaOrg(`inv-0203-prov-${Date.now()}`);
    insertSession(org, { status: `'STARTING'` });
    expect(
      lastLine(
        insertSession(org, {
          status: `'STARTING'`,
          provider: `'meta_instagram'`,
          instagram_user_id: `'ig_probe'`,
        }),
      ),
    ).toBe("ok");
  });
});
