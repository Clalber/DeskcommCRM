"use client";

import type { NodeProps } from "@xyflow/react";

import { conteudoDoCartao } from "@/lib/followup/cartao-do-no";
import type { RFNode } from "@/lib/followup/graph-mappers";
import { useT } from "@/hooks/i18n/useT";

import { NodeCard } from "./NodeCard";
import { useGatilhoDoFluxo } from "./GatilhoDoFluxo";
import { NODE_VISUALS, describeNodeConfig } from "./nodeVisuals";

/**
 * O card que diz POR QUE o fluxo existe.
 *
 * ⚠️ Ele NÃO se descreve pela própria config — ela é `{}`. Descreve-se pelo
 * `trigger_config` do fluxo, que chega pelo contexto. Enquanto olhava só para
 * si, este card imprimia `Início do fluxo` para os seis tipos de gatilho: a
 * caixa mais importante do desenho era a única que não dizia nada.
 */
export function TriggerNode({ id, data, selected }: NodeProps<RFNode>) {
  const t = useT();
  const gatilho = useGatilhoDoFluxo();
  const cartao = conteudoDoCartao("trigger", data.config, gatilho);

  return (
    <NodeCard
      id={id}
      visual={NODE_VISUALS.trigger}
      label={data.label}
      // Sem gatilho legível, volta ao texto genérico de antes — nunca a um
      // palpite sobre o que o fluxo faria.
      subtitle={cartao.titulo ?? describeNodeConfig("trigger", data.config, t)}
      detalhes={cartao.linhas}
      rodape={cartao.rodape}
      selected={selected}
      errors={data.errors}
      showTarget={false}
    />
  );
}
