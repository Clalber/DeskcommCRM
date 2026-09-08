"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { triggerConfigSchema, type TriggerConfig } from "@/lib/followup/api-schemas";

/**
 * O `trigger_config` do FLUXO, ao alcance dos cards do canvas.
 *
 * ## Por que um contexto, e não `data` do nó
 *
 * O React Flow só entrega props aos nós por `data`, e o `data` deste canvas é
 * semeado UMA vez, na montagem (`toReactFlow(initialData.draft_graph)`) — de
 * propósito, para um refetch não atropelar edição em andamento. O gatilho, ao
 * contrário, muda no meio da sessão: o painel do topo salva e o card tem de
 * acompanhar na hora. Enfiá-lo no `data` obrigaria a reescrever todos os nós a
 * cada mudança de gatilho, e é justamente o que aquele `useMemo` evita.
 *
 * ## Por que o card do gatilho precisa disto
 *
 * A config do nó `trigger` é `{}` por contrato — não há o que descrever a partir
 * dela. Enquanto o card só olhava para si mesmo, ele imprimia `Início do fluxo`
 * para os seis tipos de gatilho, e a resposta ("olha a Agenda, dispara 1 hora
 * antes") vivia num botão fora do desenho.
 *
 * Parseia com o Zod em vez de confiar no jsonb: a linha vem do banco e pode ter
 * sido escrita por uma versão futura do produto, ou à mão. Config que não
 * parseia vira `null`, e o card cai no texto genérico — feio e honesto.
 */
const GatilhoDoFluxoContext = createContext<TriggerConfig | null>(null);

export function GatilhoDoFluxoProvider({
  triggerConfig,
  children,
}: {
  triggerConfig: unknown;
  children: ReactNode;
}) {
  const valor = useMemo(() => {
    const lido = triggerConfigSchema.safeParse(triggerConfig);
    return lido.success ? lido.data : null;
  }, [triggerConfig]);
  return <GatilhoDoFluxoContext.Provider value={valor}>{children}</GatilhoDoFluxoContext.Provider>;
}

/** `null` fora do provider ou com config ilegível — nunca lança. */
export function useGatilhoDoFluxo(): TriggerConfig | null {
  return useContext(GatilhoDoFluxoContext);
}
