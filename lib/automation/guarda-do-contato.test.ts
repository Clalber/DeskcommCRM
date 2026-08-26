import { describe, expect, it } from "vitest";
import { checarGuardasDeContato } from "@/lib/automation/guarda-do-contato";
import type { ActionCtx } from "@/lib/automation/types";

/**
 * Testes puros (sem DB) do módulo compartilhado por send_whatsapp_message e
 * send_ai_message. A prova de integração via banco real fica em
 * tests/invariants/automation-send-whatsapp.test.ts (casos 6/7/8) — aqui é só
 * a lógica de decisão, isolada.
 */
function ctxComContato(contact: unknown): ActionCtx {
  return {
    admin: {} as ActionCtx["admin"],
    organizationId: "org-1",
    ruleId: "rule-1",
    ruleName: "regra de teste",
    event: {} as ActionCtx["event"],
    context: { contact },
    requestId: "req-1",
  };
}

describe("checarGuardasDeContato", () => {
  it("sem contato no contexto: no_contact", () => {
    const r = checarGuardasDeContato(ctxComContato(undefined));
    expect(r).toEqual({ ok: false, reason: "no_contact" });
  });

  it("contato bloqueado: contact_blocked", () => {
    const r = checarGuardasDeContato(
      ctxComContato({ id: "c1", is_blocked: true, phone_number: "+5511999999999" }),
    );
    expect(r).toEqual({ ok: false, reason: "contact_blocked" });
  });

  it("sem telefone: no_phone", () => {
    const r = checarGuardasDeContato(ctxComContato({ id: "c1", phone_number: null }));
    expect(r).toEqual({ ok: false, reason: "no_phone" });
  });

  it("sem objeto consent: no_consent", () => {
    const r = checarGuardasDeContato(
      ctxComContato({ id: "c1", phone_number: "+5511999999999" }),
    );
    expect(r).toEqual({ ok: false, reason: "no_consent" });
  });

  it("consent.marketing ausente: no_consent", () => {
    const r = checarGuardasDeContato(
      ctxComContato({ id: "c1", phone_number: "+5511999999999", consent: {} }),
    );
    expect(r).toEqual({ ok: false, reason: "no_consent" });
  });

  it("consent.marketing.granted_at explicitamente null (recusa): no_consent", () => {
    const r = checarGuardasDeContato(
      ctxComContato({
        id: "c1",
        phone_number: "+5511999999999",
        consent: { marketing: { granted_at: null } },
      }),
    );
    expect(r).toEqual({ ok: false, reason: "no_consent" });
  });

  it("consentimento concedido, tudo em ordem: ok, contato estreito devolvido", () => {
    const r = checarGuardasDeContato(
      ctxComContato({
        id: "c1",
        is_blocked: false,
        phone_number: "+5511999999999",
        consent: { marketing: { granted_at: "2026-08-25T00:00:00Z" } },
        // campo extra do contato que a guarda NÃO deve vazar no resultado
        cpf_hash: "segredo",
      }),
    );
    expect(r).toEqual({ ok: true, contact: { id: "c1", phone_number: "+5511999999999" } });
  });

  it("ordem das guardas: contato ausente vence sobre qualquer outro motivo", () => {
    // Não há como forjar um "contato bloqueado E ausente" — este teste apenas
    // documenta que a checagem de existência é a primeira.
    const r = checarGuardasDeContato(ctxComContato(null));
    expect(r).toEqual({ ok: false, reason: "no_contact" });
  });
});
