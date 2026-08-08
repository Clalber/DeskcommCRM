import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sql } from "./gov-helpers";

/**
 * FUNÇÃO NOVA EM `public` NASCE EXECUTÁVEL PELA ANON KEY — E A VARREDURA DO
 * BASELINE TEM QUE CONTINUAR CURANDO ISSO, DE VERDADE.
 *
 * ## O que este arquivo protege, e por que merece catraca
 *
 * `tests/invariants/hardening-definer-varredura.test.ts` já varre o ACL de toda
 * `security definer` de `public`. Ele estava VERDE na `main` enquanto o produto
 * tinha **6 delas executáveis por `anon`** — porque o banco onde ele roda não era
 * o banco do produto.
 *
 * Todo projeto Supabase (nuvem — que é o que `hostgator-setup-kit/install.sh`
 * manda o cliente criar — e a CLI local) grava no bootstrap, ANTES de qualquer
 * SQL nosso:
 *
 *     ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 *       GRANT ALL ON FUNCTIONS TO anon;
 *
 * Isso não é uma linha cujo efeito acaba quando ela passa: é uma entrada em
 * `pg_default_acl`, que fica no catálogo. A partir dali **toda** função criada em
 * `public` nasce com `EXECUTE` para `anon` — as do corpo do dump, as do apêndice,
 * e as de toda migration futura. O baseline emite aquele `ALTER` na linha ~3960
 * apenas porque o `pg_dump` está reproduzindo uma entrada que já existia lá.
 *
 * Num Postgres CRU, ao contrário, a entrada só passa a existir NA linha 3960 — e
 * as ~27 funções do corpo, criadas antes dela, nascem limpas. Era exatamente a
 * diferença entre o `scripts/test-db.sh` e a realidade. Medido em 2026-08-08,
 * `pgvector/pgvector:pg17`, baseline @9249e6f2:
 *
 *     prelude sem o default ACL -> 0 de 27 definer executáveis por anon
 *     prelude com  o default ACL -> 6 de 27
 *
 * As 6: `activate_kb_version`, `fn_decrypt_oauth`, `fn_encrypt_oauth`,
 * `fn_lgpd_cascade_redact_contact`, `fn_update_budget_consumption`,
 * `retrieve_top_k_chunks` — as MESMAS que `has_function_privilege('anon', …)`
 * devolve hoje no Supabase local desta máquina, e as mesmas que o autor do PR
 * #189 mediu numa VPS de produção. `fn_decrypt_oauth` alcançável pela anon key,
 * que vai para o browser.
 *
 * ## A linha cuja perda seria silenciosa
 *
 * O conserto de fundo tem duas metades, e a segunda não tem dono:
 *
 *   1. o bloco de varredura no fim de `supabase/baseline.sql` (migration 0116);
 *   2. as 4 linhas de `alter default privileges` no prelude do
 *      `scripts/test-db.sh`, que fazem o banco efêmero ser o banco do produto.
 *
 * Se a (2) sumir, **nada fica vermelho**: a suíte inteira segue verde, medindo um
 * universo onde este defeito não pode existir. Nenhum `grep` de símbolo a
 * encontra, e uma convergência independente no prelude a sobrescreve sem gerar
 * conflito. Por isso o primeiro caso deste arquivo é uma guarda do HARNESS, não
 * do schema: ele reprova se o banco de teste voltar a ser fictício.
 *
 * ## Por que aqui e não em `tests/unit/`
 *
 * A ordem dos blocos no arquivo é texto e já tem guarda estática em
 * `tests/unit/varredura-anon-e-o-ultimo-bloco.test.ts`. O que ESTE arquivo mede é
 * outra coisa: que o bloco, executado, de fato tira `anon` e de fato NÃO tira
 * `authenticated`/`service_role` de quem precisa. Presença de bloco não é
 * comportamento — e o jeito trivial de deixar uma varredura de privilégio verde
 * é revogar de todo mundo e quebrar a leitura logada.
 */

const BASELINE = join(process.cwd(), "supabase", "baseline.sql");

/** Nome único para a sonda, para nunca colidir com função de verdade. */
const SONDA = "fn_sonda_definer_nasce_exposta";

/**
 * Extrai do `baseline.sql` o bloco `do $$ … end $$;` que segue o cabeçalho da
 * varredura. Extrair em vez de reescrever é o que dá valor ao teste: uma cópia
 * digitada aqui continuaria passando com o bloco APAGADO do baseline — o teste
 * estaria provando a si mesmo.
 */
function blocoDaVarredura(): string {
  const texto = readFileSync(BASELINE, "utf8");
  const cabecalho = /^-- ---- VARREDURA anon:/m.exec(texto);
  if (cabecalho === null) {
    throw new Error(
      "bloco da varredura de anon não encontrado em supabase/baseline.sql " +
        "(cabeçalho '-- ---- VARREDURA anon:'). Ele foi removido ou renomeado?",
    );
  }
  const daiPraFrente = texto.slice(cabecalho.index);
  const doBlock = /do \$\$[\s\S]*?end \$\$;/.exec(daiPraFrente);
  if (doBlock === null) {
    throw new Error(
      "cabeçalho da varredura existe mas o bloco `do $$ … end $$;` não — " +
        "o corpo da cura foi esvaziado e só o comentário sobrou.",
    );
  }
  return doBlock[0];
}

function privilegio(role: string, assinatura: string): boolean {
  return sql(`select has_function_privilege('${role}', '${assinatura}', 'EXECUTE');`) === "t";
}

function criaSonda(): string {
  sql(`
    drop function if exists public.${SONDA}(uuid);
    create function public.${SONDA}(p_org uuid) returns integer
      language sql security definer as $fn$ select 1 $fn$;
  `);
  return `public.${SONDA}(uuid)`;
}

function derrubaSonda(): void {
  sql(`drop function if exists public.${SONDA}(uuid);`);
}

describe("definer nova em public nasce exposta a anon, e a varredura cura", () => {
  it("o banco de teste tem o default ACL do Supabase (guarda do HARNESS)", () => {
    // A asserção mais importante do arquivo, e a que ninguém veria cair.
    // Sem esta entrada em pg_default_acl, o Postgres efêmero não é o banco do
    // produto e TODO o hardening-definer-varredura.test.ts passa a medir um
    // universo onde a classe de defeito não existe — verde por não medir nada.
    const acl = sql(`
      select coalesce(array_to_string(d.defaclacl, ' '), '(vazio)')
        from pg_default_acl d
        join pg_namespace n on n.oid = d.defaclnamespace
       where n.nspname = 'public' and d.defaclobjtype = 'f';
    `);
    expect(
      acl,
      "pg_default_acl de FUNCTIONS em public não concede EXECUTE a anon. O " +
        "prelude de scripts/test-db.sh perdeu o `alter default privileges … " +
        "grant all on functions to anon` que TODO projeto Supabase já tem. Sem " +
        "ele o banco efêmero deixa de ser o do produto e a varredura de definer " +
        "fica verde medindo o universo errado — foi assim que 6 funções ficaram " +
        "executáveis pela anon key com o CI verde (PR #189).",
    ).toMatch(/\banon=[a-zA-Z]*X/);
  });

  it("definer criada AGORA nasce com EXECUTE para anon (o mecanismo, não o catálogo)", () => {
    // Catálogo pode mentir; criar a função e perguntar pelo privilégio não.
    // Este é o caso que prova que a armadilha está ARMADA neste banco: é o que
    // uma migration 0117 qualquer produziria se copiasse uma função antiga.
    const sonda = criaSonda();
    try {
      expect(
        privilegio("anon", sonda),
        "definer nova NÃO nasceu exposta a anon — se isto passou a ser verdade " +
          "de propósito (o default ACL foi corrigido na origem), o bloco de " +
          "varredura do baseline virou redundante e este arquivo precisa ser " +
          "reescrito; se não, o instrumento está cego.",
      ).toBe(true);
      expect(privilegio("authenticated", sonda)).toBe(true);
      expect(privilegio("service_role", sonda)).toBe(true);
    } finally {
      derrubaSonda();
    }
  });

  it("a varredura do baseline tira anon da função nova e devolve authenticated/service_role", () => {
    const sonda = criaSonda();
    try {
      expect(privilegio("anon", sonda)).toBe(true);

      // Roda o bloco EXTRAÍDO do baseline — não uma cópia digitada aqui.
      sql(blocoDaVarredura());

      expect(
        privilegio("anon", sonda),
        "a varredura do baseline não removeu EXECUTE de anon numa definer nova " +
          "de public. As duas origens de EXECUTE pedem revokes diferentes: o " +
          "grant DIRETO a anon (que `revoke from public` não remove) e o grant a " +
          "PUBLIC (que `revoke from anon` não remove).",
      ).toBe(false);
      expect(
        privilegio("authenticated", sonda),
        "a varredura tirou EXECUTE de authenticated junto — as policies de RLS " +
          "são avaliadas com o papel de quem consulta; isso quebra leitura logada.",
      ).toBe(true);
      expect(
        privilegio("service_role", sonda),
        "a varredura tirou EXECUTE de service_role junto — a ingestão para.",
      ).toBe(true);
    } finally {
      derrubaSonda();
    }
  });

  it("depois da varredura, a leitura logada sob RLS continua funcionando", () => {
    // Sem este caso, o jeito trivial de deixar qualquer varredura de privilégio
    // verde é revogar de TODO MUNDO. Aqui a medida é comportamento: um SELECT
    // com o papel `authenticated` e as claims de JWT, que avalia a policy — se
    // `authenticated` perder EXECUTE em fn_user_org_ids(), isto não devolve zero
    // linhas, devolve `permission denied for function`.
    sql(blocoDaVarredura());

    const ORG = "dddddddd-0000-4000-8000-000000000189";
    const USER = "dddddddd-1111-4000-8000-000000000189";
    sql(`
      insert into auth.users (id, email) values ('${USER}', 'p189@invariant.test')
        on conflict do nothing;
      insert into public.organizations (id, slug, legal_name, display_name)
        values ('${ORG}', 'p189-inv', 'P189 Invariant', 'P189') on conflict do nothing;
      insert into public.user_organizations (user_id, organization_id, role, accepted_at)
        values ('${USER}', '${ORG}', 'admin', now()) on conflict do nothing;
      insert into public.contacts (id, organization_id, display_name)
        values ('dddddddd-3333-4000-8000-000000000189', '${ORG}', 'P189 Contact')
        on conflict do nothing;
    `);

    const lidoSobRls = sql(`
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${USER}"}', false);
      select count(*) from public.contacts where organization_id = '${ORG}';
    `)
      .split("\n")
      .at(-1);
    expect(lidoSobRls, "leitura sob RLS com papel authenticated parou de funcionar").toBe("1");

    const orgsDoHelper = sql(`
      set role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${USER}"}', false);
      select count(*) from public.fn_user_org_ids();
    `)
      .split("\n")
      .at(-1);
    expect(
      orgsDoHelper,
      "fn_user_org_ids() deixou de ser chamável por authenticated — toda policy " +
        "que a usa passa a barrar tudo",
    ).toBe("1");
  });
});
