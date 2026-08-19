import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api/client";

import { useEtapasDeGatilho } from "./useEtapasDeGatilho";

vi.mock("@/lib/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useEtapasDeGatilho", () => {
  it("não quebra quando a resposta de um funil vem sem o envelope esperado", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (path: string) => {
      if (path === "/api/v1/pipelines") {
        return { data: [{ id: "p1", name: "Funil 1" }] } as never;
      }
      // Simula sessão expirada / proxy devolvendo algo fora do contrato —
      // sem `data.etapas`, exatamente o caso que derrubava a tela inteira.
      return {} as never;
    });

    const { result } = renderHook(() => useEtapasDeGatilho(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.carregando).toBe(false));
    expect(result.current.etapas).toEqual([]);
  });
});
