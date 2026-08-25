import { describe, expect, it } from "vitest";

import { inboundEhDestaPergunta, textoDoPayloadInbound } from "./aplicar-inbound";

describe("textoDoPayloadInbound", () => {
  it("lê body_preview do evento emitido pelo banco", () => {
    expect(textoDoPayloadInbound({ body_preview: "  Ian  ", contact_id: "x" })).toBe("Ian");
  });

  it("vazio quando o payload não traz texto", () => {
    expect(textoDoPayloadInbound({ contact_id: "x" })).toBe("");
  });

  it("lê body cru quando não há preview", () => {
    expect(textoDoPayloadInbound({ body: "sim" })).toBe("sim");
  });
});

describe("inboundEhDestaPergunta", () => {
  it("o SIM da pergunta anterior não conta na espera seguinte", () => {
    expect(inboundEhDestaPergunta("2026-08-25T18:11:00.000Z", "2026-08-25T19:18:00.000Z")).toBe(false);
  });

  it("a resposta depois da pergunta conta", () => {
    expect(inboundEhDestaPergunta("2026-08-25T19:25:00.000Z", "2026-08-25T19:19:00.000Z")).toBe(true);
  });
});
