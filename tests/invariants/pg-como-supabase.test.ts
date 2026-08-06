import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { pgComoSupabase } from "../pg-como-supabase";

/**
 * O INSTRUMENTO, medido antes de medir.
 *
 * `tests/pg-como-supabase.ts` é o que permite exercitar código que fala
 * `supabase.from(...)` contra o Postgres real do `test:db`. Um adaptador que
 * ignorasse um `.eq()` faria os testes que dependem dele passarem **pelo motivo
 * errado** — e nada vermelharia.
 *
 * Cada caso aqui é a sabotagem de uma peça do adaptador: filtro que não filtra,
 * ordem que não ordena, `maybeSingle` que engole duplicata, erro de constraint
 * que vira exceção em vez de `{error}`. Se um deles for removido, o teste que o
 * usa perde a garantia sem avisar.
 */
const container = process.env.TEST_DB_CONTAINER;
if (!container) {
  throw new Error("TEST_DB_CONTAINER not set — rode via `pnpm test:db` (scripts/test-db.sh)");
}

const PORT = Number(process.env.TEST_DB_PORT ?? 54329);
const pool = new pg.Pool({
  connectionString: `postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres`,
  max: 2,
});
const db = pgComoSupabase(pool);

const ORG = "ada57e00-0000-4000-8000-000000000001";

beforeAll(async () => {
  await pool.query(
    `insert into organizations (id, slug, legal_name, display_name)
     values ($1, 'org-adaptador', 'Adaptador LTDA', 'Adaptador') on conflict (id) do nothing`,
    [ORG],
  );
  // O trigger fn_seed_default_pipeline_for_org já criou "Pedidos". Estes são
  // funis EXTRA, com `position` fora de ordem alfabética de propósito.
  await pool.query(
    `insert into crm_pipelines (organization_id, name, slug, is_default, position) values
       ($1, 'Zulu',  'zulu',  false, 10),
       ($1, 'Alfa',  'alfa',  false, 30),
       ($1, 'Bravo', 'bravo', false, 20)
     on conflict do nothing`,
    [ORG],
  );
});

afterAll(async () => {
  await pool.query("delete from organizations where id = $1", [ORG]);
  await pool.end();
});

describe("o adaptador FILTRA", () => {
  it("`.eq` restringe de verdade — sem isto, todo teste que o usa mede a tabela inteira", async () => {
    const { data, error } = await db
      .from("crm_pipelines")
      .select("name")
      .eq("organization_id", ORG)
      .eq("slug", "bravo")
      .maybeSingle();

    expect(error).toBeNull();
    // Se `.eq("slug",...)` fosse ignorado, viriam 4 linhas e `maybeSingle`
    // devolveria erro — a asserção abaixo morre nos dois casos.
    expect((data as { name: string } | null)?.name).toBe("Bravo");
  });

  it("filtro que não casa devolve `data: null` SEM erro — 'não achei' ≠ 'falhou'", async () => {
    const { data, error } = await db
      .from("crm_pipelines")
      .select("name")
      .eq("organization_id", ORG)
      .eq("slug", "nao-existe-este")
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});

describe("o adaptador ORDENA", () => {
  it("`.order(asc).limit(1)` traz o de menor valor, não o primeiro que o Postgres devolver", async () => {
    // Sem ordenação real o Postgres devolveria em ordem de heap — que aqui é a
    // ordem de inserção, e daria 'Zulu'. O caso só passa com ORDER BY aplicado.
    const { data } = await db
      .from("crm_pipelines")
      .select("name,position")
      .eq("organization_id", ORG)
      .eq("is_default", false)
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    expect((data as { name: string } | null)?.name).toBe("Zulu"); // position 10
  });

  it("descendente inverte — a opção `ascending` é lida, não decorativa", async () => {
    const { data } = await db
      .from("crm_pipelines")
      .select("name")
      .eq("organization_id", ORG)
      .eq("is_default", false)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();

    expect((data as { name: string } | null)?.name).toBe("Alfa"); // position 30
  });
});

describe("o adaptador distingue os desfechos que o PostgREST distingue", () => {
  it("`maybeSingle` com MAIS DE UMA linha é ERRO — engolir a duplicata esconderia dado incoerente", async () => {
    const { data, error } = await db
      .from("crm_pipelines")
      .select("name")
      .eq("organization_id", ORG)
      .eq("is_default", false)
      .maybeSingle();

    expect(error, "3 funis não-default: tem de reclamar").not.toBeNull();
    expect(data).toBeNull();
  });

  it("`insert().select().single()` devolve a linha criada", async () => {
    const { data, error } = await db
      .from("crm_pipelines")
      .insert({ organization_id: ORG, name: "Criado", slug: "criado-pelo-adaptador", position: 99 })
      .select("id,name")
      .single();

    expect(error).toBeNull();
    expect((data as { id: string; name: string }).name).toBe("Criado");
    expect((data as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("violação de constraint vira `{error}`, NUNCA exceção — o chamador trata desfecho, não catch", async () => {
    // `organization_id` inexistente: viola a FK.
    const { data, error } = await db
      .from("crm_pipelines")
      .insert({
        organization_id: "ada57e00-0000-4000-8000-0000000000ff",
        name: "Órfão",
        slug: "orfao",
        position: 1,
      })
      .select("id")
      .single();

    expect(data).toBeNull();
    expect(error?.message).toMatch(/foreign key|violates/i);
  });
});

describe("o que NÃO está implementado estoura", () => {
  it("método ausente lança em vez de devolver vazio — vazio silencioso é teste verde medindo nada", () => {
    expect(() => db.from("crm_pipelines").update({} as never)).toThrow(/não está implementado/);
    expect(() => db.from("crm_pipelines").select("id").neq("id", "x")).toThrow(/não está implementado/);
  });
});
