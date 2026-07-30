/**
 * Issue #64 — o teto existe e conta as duas coisas.
 *
 * Sem Upstash configurado o `checkRateLimit` cai para o contador em memória do
 * processo, que é exatamente o que este teste quer exercitar: o caminho real,
 * sem mock do limitador. O que se mocka é só o `headers()` do Next, para
 * escolher o IP de cada tentativa.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { headers } from "next/headers";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

function comIp(ip: string) {
  vi.mocked(headers).mockResolvedValue({
    get: (k: string) => (k === "x-forwarded-for" ? ip : null),
  } as never);
}

describe("authRateLimited", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("barra ao estourar o teto por IP", async () => {
    const { authRateLimited } = await import("./rate-limit");
    comIp("203.0.113.10");
    const limites = { ip: 3, windowSec: 300 };

    const veredito: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      veredito.push(await authRateLimited("teste_ip", null, limites));
    }

    expect(veredito).toEqual([false, false, false, true]);
  });

  it("barra por identificador mesmo com o IP mudando a cada tentativa", async () => {
    const { authRateLimited } = await import("./rate-limit");
    const limites = { ip: 100, id: 2, windowSec: 300 };
    const alvo = "vitima@example.com";

    const veredito: boolean[] = [];
    for (let i = 0; i < 3; i++) {
      comIp(`198.51.100.${i}`); // IP diferente a cada tentativa: o ataque distribuído
      veredito.push(await authRateLimited("teste_id", alvo, limites));
    }

    // Se só houvesse contagem por IP, os três passariam.
    expect(veredito).toEqual([false, false, true]);
  });

  it("conta identificadores diferentes em baldes separados", async () => {
    const { authRateLimited } = await import("./rate-limit");
    comIp("203.0.113.20");
    const limites = { ip: 100, id: 1, windowSec: 300 };

    expect(await authRateLimited("teste_sep", "a@example.com", limites)).toBe(false);
    expect(await authRateLimited("teste_sep", "b@example.com", limites)).toBe(false);
    expect(await authRateLimited("teste_sep", "a@example.com", limites)).toBe(true);
  });

  it("não põe o e-mail em claro na chave do contador", async () => {
    const rl = await import("@/lib/ai/dispatcher/rate-limit");
    const spy = vi.spyOn(rl, "checkRateLimit");
    vi.resetModules();
    const { authRateLimited } = await import("./rate-limit");
    comIp("203.0.113.30");

    await authRateLimited("teste_pii", "cliente@example.com", { ip: 10, id: 10, windowSec: 300 });

    const chaves = spy.mock.calls.map((c) => c[0]).join(" ");
    expect(chaves).not.toContain("cliente@example.com");
    expect(chaves).not.toContain("203.0.113.30");
  });
});
