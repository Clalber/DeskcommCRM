"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { showApiError } from "@/components/feedback/ApiErrorToast";
import { apiClient } from "@/lib/api/client";

export interface ContaDeInstagram {
  id: string;
  appId: string | null;
  displayName: string | null;
  status: string;
  /** Tem token E conta. Sem os dois é conexão pela metade. */
  conectada: boolean;
  instagramUserId: string | null;
  tokenExpiraEm: string | null;
  /** Existe, não qual é — o segredo nunca volta num GET. */
  temVerifyToken: boolean;
  webhook: { callbackUrl: string; campos: string[] };
}

export interface EstadoDoCanalInstagram {
  /** A URL que precisa estar cadastrada como Redirect URI no aplicativo. */
  redirectUri: string;
  contas: ContaDeInstagram[];
}

export interface GuardarAplicativoInput {
  app_id: string;
  app_secret: string;
  verify_token: string;
  display_name?: string;
}

export function useInstagramChannel() {
  return useQuery({
    queryKey: ["instagram-channel"],
    queryFn: async () =>
      apiClient.get<{ data: EstadoDoCanalInstagram }>("/api/v1/channels/instagram"),
    staleTime: 15_000,
  });
}

export function useGuardarAplicativoInstagram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GuardarAplicativoInput) =>
      apiClient.post<{ data: { id: string; webhookUrl: string; redirectUri: string } }>(
        "/api/v1/channels/instagram",
        input,
      ),
    onError: showApiError,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["instagram-channel"] });
    },
  });
}
