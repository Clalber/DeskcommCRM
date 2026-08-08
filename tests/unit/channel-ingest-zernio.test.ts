import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ingestão: webhook → contato, conversa, mensagem.
 *
 * O que este módulo existe para gravar é `provider_conversation_id`. Uma
 * ingestão que salva a mensagem e esquece a thread deixa o inbox mostrando a
 * conversa e o operador SEM CONSEGUIR RESPONDER — porque o endereço deste canal
 * não se deriva do contato, e é só aqui que ele chega.
 *
 * Metade dos casos prova o que a ingestão RECUSA. Um webhook que aceita o que
 * não devia escreve lixo no banco de quem instalou, e ninguém descobre até a
 * conversa errada aparecer no inbox.
 */

const ops: { tabela: string; op: string; payload?: unknown }[] = [];
let rpcResposta: Record<string, unknown> = {
  fn_upsert_wa_contact: "contact-1",
  fn_upsert_wa_conversation: "conv-1",
};
let insertErro: { code?: string; message: string } | null = null;

/** Imita o builder do PostgREST: encadeável, resolve no `maybeSingle`. */
function chain(tabela: string, op: string, payload?: unknown): Record<string, unknown> {
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "maybeSingle" || prop === "single") {
          return async () =>
            insertErro ? { data: null, error: insertErro } : { data: { id: "msg-1" }, error: null };
        }
        if (prop === "then") {
          return (ok: (v: unknown) => unknown) => ok({ data: null, error: null });
        }
        return (...args: unknown[]) => {
          if (prop === "update" || prop === "eq" || prop === "neq") {
            ops.push({ tabela, op: `${op}.${String(prop)}`, payload: args[0] });
          }
          return proxy;
        };
      },
    },
  ) as Record<string, unknown>;
  ops.push({ tabela, op, payload });
  return proxy;
}

const admin = {
  rpc: async (nome: string, args: unknown) => {
    ops.push({ tabela: "rpc", op: nome, payload: args });
    const v = rpcResposta[nome];
    return v === null ? { data: null, error: { message: "falhou" } } : { data: v, error: null };
  },
  from: (tabela: string) => ({
    insert: (payload: unknown) => chain(tabela, "insert", payload),
    update: (payload: unknown) => chain(tabela, "update", payload),
  }),
} as never;

import { ingestZernioInbound, waIdentityFrom } from "@/lib/channels/zernio/ingest";
import { verifyZernioSignature } from "@/lib/channels/zernio/webhook";
import { acceptsInboundWebhook, handleInboundWebhook } from "@/lib/channels/inbound";

const evento = (msg: Record<string, unknown> = {}) => ({
  id: "evt_1",
  event: "message.received",
  account: { id: "acc_1" },
  message: {
    id: "m_1",
    conversationId: "6a76a2dc4b8fe115e5f6c300",
    platform: "whatsapp",
    platformMessageId: "wamid.ABC",
    direction: "incoming",
    text: "hola",
    attachments: [],
    sender: { phoneNumber: "+595991733685", name: "Marcelo" },
    sentAt: "2026-08-08T01:00:00.000Z",
    ...msg,
  },
});

const ENTRADA = { organizationId: "org-1", channelSessionId: "sess-1" };

beforeEach(() => {
  ops.length = 0;
  insertErro = null;
  rpcResposta = { fn_upsert_wa_contact: "contact-1", fn_upsert_wa_conversation: "conv-1" };
});

describe("identidade → wa_identity", () => {
  it("telefone vira phone:, o mesmo vocabulário do canal por QR", () => {
    expect(
      waIdentityFrom({ phone: "+595991733685", bsuid: null, username: null, displayName: null, anchor: { kind: "phone", value: "+595991733685" } }),
    ).toBe("phone:+595991733685");
  });

  it("BSUID vira lid: — mesma NATUREZA de id, então é o MESMO contato nos dois canais", () => {
    // Inventar um terceiro prefixo criaria dois contatos para uma pessoa só.
    expect(
      waIdentityFrom({ phone: null, bsuid: "BS_1", username: null, displayName: null, anchor: { kind: "bsuid", value: "BS_1" } }),
    ).toBe("lid:BS_1");
  });

  it("sem âncora devolve null", () => {
    expect(
      waIdentityFrom({ phone: null, bsuid: null, username: "@x", displayName: null, anchor: null }),
    ).toBeNull();
  });
});

describe("o que a ingestão GRAVA", () => {
  it("grava a thread do provider — é o motivo deste módulo existir", async () => {
    const r = await ingestZernioInbound(admin, { ...ENTRADA, payload: evento() });
    expect(r.status).toBe("ingested");
    const update = ops.find((o) => o.tabela === "conversations" && o.op === "update");
    expect(update?.payload).toEqual({ provider_conversation_id: "6a76a2dc4b8fe115e5f6c300" });
  });

  it("a mensagem entra como inbound com o wamid como external_id", async () => {
    await ingestZernioInbound(admin, { ...ENTRADA, payload: evento() });
    const ins = ops.find((o) => o.tabela === "messages" && o.op === "insert");
    expect(ins?.payload).toMatchObject({
      organization_id: "org-1",
      conversation_id: "conv-1",
      external_id: "wamid.ABC",
      direction: "inbound",
      type: "text",
      body: "hola",
    });
  });

  it("anexo define o tipo e a url fica no metadata, não no body", async () => {
    await ingestZernioInbound(admin, {
      ...ENTRADA,
      payload: evento({ attachments: [{ type: "image", url: "https://z/media/1" }] }),
    });
    const ins = ops.find((o) => o.tabela === "messages" && o.op === "insert")?.payload as Record<string, unknown>;
    expect(ins.type).toBe("image");
    // A url é endpoint AUTENTICADO e expira: guardar é ponteiro, não conteúdo.
    expect(ins.metadata).toEqual({ provider_attachments: [{ type: "image", url: "https://z/media/1" }] });
  });

  it("reusa a RPC do canal por QR para o contato — a corrida já está resolvida lá", async () => {
    await ingestZernioInbound(admin, { ...ENTRADA, payload: evento() });
    const rpc = ops.find((o) => o.op === "fn_upsert_wa_contact");
    expect(rpc?.payload).toMatchObject({ p_org: "org-1", p_kind: "phone", p_phone: "+595991733685" });
  });
});

describe("o que a ingestão RECUSA", () => {
  const recusa = async (payload: unknown, motivo: string) => {
    const r = await ingestZernioInbound(admin, { ...ENTRADA, payload });
    expect(r.status).toBe("ignored");
    expect(r.reason).toBe(motivo);
    expect(ops.some((o) => o.tabela === "messages")).toBe(false);
  };

  it("eco do próprio envio — ingeri-lo duplicaria toda mensagem enviada", () =>
    recusa(evento({ direction: "outgoing" }), "nao_e_mensagem_recebida"));

  it("outra plataforma na mesma conta", () =>
    recusa(evento({ platform: "instagram" }), "nao_e_mensagem_recebida"));

  it("sem identidade utilizável — criar contato anônimo faria a próxima mensagem virar um segundo contato", () =>
    recusa(evento({ sender: { whatsappUsername: "@x" } }), "sem_identidade_utilizavel"));
});

describe("idempotência", () => {
  it("reentrega do MESMO evento devolve duplicate, não erro", async () => {
    // O provider reenvia o que não recebeu 200. Tratar como falha faria a rota
    // devolver 500 e ele reenviar de novo, para sempre.
    insertErro = { code: "23505", message: "duplicate key" };
    const r = await ingestZernioInbound(admin, { ...ENTRADA, payload: evento() });
    expect(r.status).toBe("duplicate");
  });

  it("outro erro de escrita LANÇA — aí a reentrega é o que queremos", async () => {
    insertErro = { code: "42501", message: "permission denied" };
    await expect(
      ingestZernioInbound(admin, { ...ENTRADA, payload: evento() }),
    ).rejects.toThrow(/zernio_ingest_insert_failed/);
  });
});

describe("a entrada do seam — o que a rota chama", () => {
  const SECRET = "segredo-longo-o-suficiente";
  const corpo = JSON.stringify(evento());
  const firma = createHmac("sha256", SECRET).update(corpo).digest("hex");
  const headers = (v: string | null) => new Headers(v ? { "x-zernio-signature": v } : {});
  const sessao = { id: "sess-1", organization_id: "org-1", provider: "zernio" };

  it("aceita o canal que recebe por aqui e recusa os outros", () => {
    expect(acceptsInboundWebhook("zernio")).toBe(true);
    expect(acceptsInboundWebhook("waha")).toBe(false);
    expect(acceptsInboundWebhook("meta_cloud")).toBe(false);
  });

  it("assinatura válida ingere", async () => {
    const r = await handleInboundWebhook(admin, {
      session: sessao,
      rawBody: corpo,
      headers: headers(firma),
      secret: SECRET,
    });
    expect(r.ok).toBe(true);
  });

  it("assinatura inválida NÃO ingere", async () => {
    const r = await handleInboundWebhook(admin, {
      session: sessao,
      rawBody: corpo,
      headers: headers("deadbeef"),
      secret: SECRET,
    });
    expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    expect(ops.some((o) => o.tabela === "messages")).toBe(false);
  });

  it("SEM segredo utilizável não processa — fail-closed, sem a exceção do vizinho", async () => {
    // Na rota do canal por QR, "não consegui verificar" já virou "processa
    // assim mesmo", e isso deixou toda instalação aceitando mensagem forjada.
    for (const s of [null, "curto"]) {
      const r = await handleInboundWebhook(admin, {
        session: sessao,
        rawBody: corpo,
        headers: headers(firma),
        secret: s,
      });
      expect(r).toMatchObject({ ok: false, code: "unauthorized" });
    }
    expect(ops.some((o) => o.tabela === "messages")).toBe(false);
  });

  it("canal que não recebe por esta rota devolve provider_mismatch", async () => {
    const r = await handleInboundWebhook(admin, {
      session: { ...sessao, provider: "waha" },
      rawBody: corpo,
      headers: headers(firma),
      secret: SECRET,
    });
    expect(r).toMatchObject({ ok: false, code: "provider_mismatch" });
  });

  it("json inválido com assinatura válida devolve invalid_json, não 500", async () => {
    const cru = "{nao é json";
    const f = createHmac("sha256", SECRET).update(cru).digest("hex");
    const r = await handleInboundWebhook(admin, {
      session: sessao,
      rawBody: cru,
      headers: headers(f),
      secret: SECRET,
    });
    expect(r).toMatchObject({ ok: false, code: "invalid_json" });
  });

  it("a assinatura cobre o CORPO — adulterar o payload invalida", () => {
    expect(verifyZernioSignature(corpo + " ", firma, SECRET)).toBe(false);
  });
});
