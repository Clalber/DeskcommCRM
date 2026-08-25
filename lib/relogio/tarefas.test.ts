import { describe, expect, it } from "vitest";

import { CAMINHO_DO_TICK, comandoCurlDoRelogio, TAREFAS_DO_RELOGIO } from "@/lib/relogio/tarefas";

describe("tarefas do relógio", () => {
  it("inclui o worker de follow-up — sem ele o SIM não anda", () => {
    expect(TAREFAS_DO_RELOGIO.map((t) => t.id)).toContain("followup-flow-worker");
  });

  it("o curl aponta para o tick e não interpola o segredo", () => {
    const cmd = comandoCurlDoRelogio("https://crm.exemplo.com/");
    expect(cmd).toContain("https://crm.exemplo.com" + CAMINHO_DO_TICK);
    expect(cmd).toContain("$INTERNAL_SECRET");
    expect(cmd).not.toMatch(/Bearer [a-zA-Z0-9]{8,}/);
  });
});
