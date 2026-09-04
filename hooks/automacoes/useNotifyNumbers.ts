/**
 * Os números NOSSOS que podem ser avisados por automação.
 *
 * Fonte única para o seletor da ação "Avisar um número meu" e para a tela que
 * cadastra os números. A ação só envia para número desta lista — sem a amarra,
 * um erro de digitação na regra viraria disparo pelo número da empresa para
 * qualquer número do mundo.
 */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";

export interface NotifyNumber {
  id: string;
  phone_e164: string;
  label: string;
  created_at: string;
}

const CHAVE = ["notify-numbers"];

export function useNotifyNumbers() {
  const query = useQuery({
    queryKey: CHAVE,
    queryFn: async () => apiClient.get<{ data: NotifyNumber[] }>("/api/v1/notify-numbers"),
    staleTime: 30_000,
  });

  return {
    data: query.data?.data,
    isLoading: query.isLoading,
    /** Lista vazia por falha é indistinguível de "nenhum número cadastrado" —
     *  e a segunda leitura convida a cadastrar de novo o que já existe. */
    isError: query.isError,
  };
}

export function useCriarNotifyNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { phone: string; label: string }) =>
      apiClient.post<{
        data: NotifyNumber & { tambem_e_contato: { id: string; nome: string } | null };
      }>("/api/v1/notify-numbers", input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CHAVE });
    },
  });
}

export function useRemoverNotifyNumber() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/api/v1/notify-numbers/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: CHAVE });
    },
  });
}
