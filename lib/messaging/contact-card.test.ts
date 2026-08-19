import { describe, expect, it } from "vitest";

import {
  buildVcard,
  metaContactsPayload,
  parseDialablePhone,
  parseMetaInboundContact,
  parseVcard,
  phoneToWhatsappId,
  resolveSharedContact,
  sharedContactFromMetadata,
  wahaContactPayload,
} from "./contact-card";

describe("contact-card", () => {
  it("parseVcard extrai nome e telefone", () => {
    const vcard = buildVcard("Maria Silva", "+5511999887766");
    const parsed = parseVcard(vcard);
    expect(parsed?.name).toBe("Maria Silva");
    expect(parsed?.phone_number).toBe("+5511999887766");
  });

  it("sharedContactFromMetadata lê objeto gravado", () => {
    const c = sharedContactFromMetadata({
      shared_contact: { contact_id: "abc", name: "João", phone_number: "+5511888777666" },
    });
    expect(c?.contact_id).toBe("abc");
    expect(c?.name).toBe("João");
  });

  it("resolveSharedContact prioriza metadata", () => {
    const c = resolveSharedContact({
      type: "contact",
      body: "BEGIN:VCARD...",
      metadata: { shared_contact: { name: "CRM", phone_number: "+5511000000000" } },
    });
    expect(c?.name).toBe("CRM");
  });

  it("wahaContactPayload inclui whatsappId só com dígitos", () => {
    const p = wahaContactPayload("Ana", "+55 11 99999-8888");
    expect(p.whatsappId).toBe(phoneToWhatsappId("+5511999998888"));
    expect(p.fullName).toBe("Ana");
  });

  it("metaContactsPayload monta formatted_name e wa_id", () => {
    const [c] = metaContactsPayload("Maria Silva", "+5511999887766");
    expect(c?.name.formatted_name).toBe("Maria Silva");
    expect(c?.name.first_name).toBe("Maria");
    expect(c?.name.last_name).toBe("Silva");
    expect(c?.phones[0]?.wa_id).toBe("5511999887766");
  });

  it("parseMetaInboundContact lê payload da Meta", () => {
    const c = parseMetaInboundContact({
      contacts: [{
        name: { formatted_name: "João", first_name: "João" },
        phones: [{ phone: "+5511888777666", wa_id: "5511888777666", type: "CELL" }],
      }],
    });
    expect(c?.name).toBe("João");
    expect(c?.phone_number).toBe("+5511888777666");
  });

  it("parseDialablePhone aceita E.164 com +", () => {
    expect(parseDialablePhone("+5532984793302")).toBe("+5532984793302");
  });

  it("parseDialablePhone rejeita curto demais", () => {
    expect(parseDialablePhone("123")).toBeNull();
  });
});
