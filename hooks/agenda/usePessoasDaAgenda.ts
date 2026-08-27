"use client";

import { useQuery } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { trilhaPadraoDoMembro } from "@/lib/agenda/tipos";
import { apiClient } from "@/lib/api/client";

import type { Pessoa } from "@/components/agenda/tipos";

interface MembroDto {
  user_id: string;
  email: string | null;
  full_name: string | null;
  revoked_at?: string | null;
}

/**
 * As pessoas da equipe, com a trilha de cor de cada uma.
 *
 * A cor NÃO vem da API: vem de `trilhaPadraoDoMembro(user_id)`, que deriva do id de
 * forma estável. É por isso que a pessoa não troca de cor entre um carregamento
 * e outro, nem quando alguém novo entra na equipe — e é o motivo de este hook
 * não precisar de nenhuma coluna de cor no banco.
 *
 * Quem foi revogado sai da lista: o filtro por pessoa é para quem atende hoje, e
 * uma agenda com ex-funcionário na barra confunde sem informar.
 */
export function usePessoasDaAgenda() {
  return useQuery({
    queryKey: ["agenda", "pessoas"],
    queryFn: async (): Promise<Pessoa[]> => {
      try {
        const r = await apiClient.get<{ data: MembroDto[] }>("/api/v1/team");
        const lista = (r as unknown as { data?: MembroDto[] }).data ?? (r as unknown as MembroDto[]);
        return (lista ?? [])
          .filter((m) => !m.revoked_at)
          .map((m) => ({
            id: m.user_id,
            // `full_name` pode vir null quando o service role não está
            // configurado — a rota degrada assim de propósito. O e-mail antes do
            // @ é melhor que "Sem nome": identifica a pessoa para quem trabalha
            // com ela todo dia.
            nome: m.full_name ?? m.email?.split("@")[0] ?? "Sem nome",
            trilha: trilhaPadraoDoMembro(m.user_id),
          }));
      } catch (err) {
        showApiError(err);
        throw err;
      }
    },
  });
}
