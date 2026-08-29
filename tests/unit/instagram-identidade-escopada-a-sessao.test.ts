/**
 * A identidade do Instagram é escopada à SESSÃO, e o erro de banco nunca vira
 * "não encontrei".
 *
 * ─── O que está em jogo ─────────────────────────────────────────────────────
 *
 * O identificador que o Instagram manda (IGSID) é emitido pela CONTA que
 * recebe, não pela pessoa. A mesma pessoa falando com duas contas da mesma
 * organização tem DOIS ids, e ids de contas diferentes não são comparáveis.
 *
 * Um leitor que esquecesse o `channel_session_id` no filtro casaria a pessoa
 * pela conta errada — e a resposta sairia pela conta errada. Mensagem que sai
 * errada não volta.
 *
 * ─── Por que o erro de query importa tanto aqui ─────────────────────────────
 *
 * `null` significa "esta pessoa ainda não tem contato", e a ingestão responde
 * CRIANDO um. Um erro de banco devolvido como `null` — o atalho natural de quem
 * escreve `data?.contact_id ?? null` sem olhar o `error` — criaria um contato
 * novo a cada mensagem, e o histórico da conversa se partiria em pedaços sem
 * ninguém perceber. Por isso os casos de erro são metade deste arquivo.
 */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  contatoPorIdentidade,
  gravarIdentidade,
  identidadePorContato,
} from "@/lib/channels/instagram/identidade";

const ORG = "aaaaaaaa-0000-4000-8000-000000000001";
const SESSAO = "bbbbbbbb-0000-4000-8000-000000000001";
const CONTATO = "cccccccc-0000-4000-8000-000000000001";
const IGSID = "17841400000000001";

/** Registra os filtros aplicados — é sobre eles que as asserções falam. */
interface Espiao {
  filtros: Array<[string, unknown]>;
  tabela: string | null;
  upsert: { payload: unknown; opcoes: unknown } | null;
}

function fakeAdmin(
  resposta: { data: unknown; error: { message: string } | null },
): { admin: SupabaseClient; espiao: Espiao } {
  const espiao: Espiao = { filtros: [], tabela: null, upsert: null };
  const encadeavel: Record<string, unknown> = {};
  const proxy = new Proxy(encadeavel, {
    get(_t, prop) {
      if (prop === "maybeSingle") return async () => resposta;
      if (prop === "eq") {
        return (coluna: string, valor: unknown) => {
          espiao.filtros.push([coluna, valor]);
          return proxy;
        };
      }
      if (prop === "then") return undefined;
      return () => proxy;
    },
  });
  const admin = {
    from: (tabela: string) => {
      espiao.tabela = tabela;
      return {
        select: () => proxy,
        upsert: (payload: unknown, opcoes: unknown) => {
          espiao.upsert = { payload, opcoes };
          return { error: resposta.error };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { admin, espiao };
}

describe("identidade do Instagram — escopo e erro", () => {
  it("a busca por identidade filtra organização E sessão", async () => {
    const { admin, espiao } = fakeAdmin({ data: { contact_id: CONTATO }, error: null });

    const achado = await contatoPorIdentidade(admin, {
      organizationId: ORG,
      channelSessionId: SESSAO,
      providerUserId: IGSID,
    });

    expect(achado).toBe(CONTATO);
    expect(espiao.tabela).toBe("channel_contact_identities");
    // A asserção central. Sem `channel_session_id` a mesma pessoa seria casada
    // pela conta errada; sem `organization_id` a consulta atravessaria empresas,
    // porque quem chama usa service role e o RLS não a protege.
    expect(espiao.filtros).toEqual([
      ["organization_id", ORG],
      ["channel_session_id", SESSAO],
      ["provider_user_id", IGSID],
    ]);
  });

  it("ninguém encontrado devolve null — é assim que a ingestão sabe criar", async () => {
    const { admin } = fakeAdmin({ data: null, error: null });

    await expect(
      contatoPorIdentidade(admin, {
        organizationId: ORG,
        channelSessionId: SESSAO,
        providerUserId: IGSID,
      }),
    ).resolves.toBeNull();
  });

  it("erro de banco LANÇA — devolver null criaria contato duplicado por mensagem", async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: "permission denied" } });

    await expect(
      contatoPorIdentidade(admin, {
        organizationId: ORG,
        channelSessionId: SESSAO,
        providerUserId: IGSID,
      }),
    ).rejects.toThrow(/channel_contact_identity_lookup_failed.*permission denied/);
  });

  it("o caminho inverso — contato para identificador — tem o mesmo escopo", async () => {
    const { admin, espiao } = fakeAdmin({ data: { provider_user_id: IGSID }, error: null });

    const achado = await identidadePorContato(admin, {
      organizationId: ORG,
      channelSessionId: SESSAO,
      contactId: CONTATO,
    });

    expect(achado).toBe(IGSID);
    expect(espiao.filtros).toEqual([
      ["organization_id", ORG],
      ["channel_session_id", SESSAO],
      ["contact_id", CONTATO],
    ]);
  });

  it("o caminho inverso também LANÇA em erro de banco", async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: "timeout" } });

    await expect(
      identidadePorContato(admin, {
        organizationId: ORG,
        channelSessionId: SESSAO,
        contactId: CONTATO,
      }),
    ).rejects.toThrow(/channel_contact_identity_lookup_failed/);
  });

  it("a gravação tolera a corrida pelo par único da 0203", async () => {
    const { admin, espiao } = fakeAdmin({ data: null, error: null });

    await gravarIdentidade(admin, {
      organizationId: ORG,
      channelSessionId: SESSAO,
      contactId: CONTATO,
      providerUserId: IGSID,
    });

    expect(espiao.upsert?.payload).toMatchObject({
      organization_id: ORG,
      channel_session_id: SESSAO,
      contact_id: CONTATO,
      provider_user_id: IGSID,
    });
    // O par tem de bater com `channel_contact_identities_sessao_usuario_unique`
    // (0203). Errar as colunas aqui faz o upsert virar insert e a segunda
    // mensagem simultânea derrubar a ingestão — perder a linha é perder a
    // mensagem.
    expect(espiao.upsert?.opcoes).toMatchObject({
      onConflict: "channel_session_id,provider_user_id",
      ignoreDuplicates: true,
    });
  });

  it("erro na gravação LANÇA — amarração perdida em silêncio é conversa órfã", async () => {
    const { admin } = fakeAdmin({ data: null, error: { message: "deadlock detected" } });

    await expect(
      gravarIdentidade(admin, {
        organizationId: ORG,
        channelSessionId: SESSAO,
        contactId: CONTATO,
        providerUserId: IGSID,
      }),
    ).rejects.toThrow(/channel_contact_identity_write_failed/);
  });
});
