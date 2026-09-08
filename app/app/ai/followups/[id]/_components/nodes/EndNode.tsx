"use client";

import type { NodeProps } from "@xyflow/react";

import { conteudoDoCartao } from "@/lib/followup/cartao-do-no";
import type { RFNode } from "@/lib/followup/graph-mappers";
import { useT } from "@/hooks/i18n/useT";

import { NodeCard } from "./NodeCard";
import { NODE_VISUALS, describeNodeConfig } from "./nodeVisuals";

/**
 * O card do fim. Mostrava o TIPO do desfecho (`Personalizado`), que não é o
 * desfecho — agora diz o que fica registrado e o que acontece com o contato
 * depois. Não depende do gatilho: o fim é sobre o acompanhamento, não sobre a
 * origem dele.
 */
export function EndNode({ id, data, selected }: NodeProps<RFNode>) {
  const t = useT();
  const cartao = conteudoDoCartao("end", data.config, null);

  return (
    <NodeCard
      id={id}
      visual={NODE_VISUALS.end}
      label={data.label}
      subtitle={cartao.titulo ?? describeNodeConfig("end", data.config, t)}
      detalhes={cartao.linhas}
      rodape={cartao.rodape}
      selected={selected}
      errors={data.errors}
      showSource={false}
    />
  );
}
