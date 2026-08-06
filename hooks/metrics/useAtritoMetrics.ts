"use client";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { AtritoRaw, Par } from "@/lib/metrics/atrito";

export interface AtritoMetrics {
  window: { from: string; to: string };
  escopo: AtritoRaw["escopo"];
  /** Pares eficiência/dano — nunca uma lista solta de números (doutrina §3.3). */
  pares: Par[];
  componentes: { cliente: AtritoRaw["cliente"]; empresa: AtritoRaw["empresa"] };
}

/** Spec 16 — o Índice de Atrito. Mede o propósito, não a atividade. */
export function useAtritoMetrics() {
  return useQuery({
    queryKey: ["metrics", "atrito"],
    queryFn: async () => apiClient.get<{ data: AtritoMetrics }>("/api/v1/metrics/atrito"),
    staleTime: 30_000,
  });
}
