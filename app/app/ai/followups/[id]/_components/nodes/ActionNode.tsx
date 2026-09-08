"use client";

import type { NodeProps } from "@xyflow/react";

import { conteudoDoCartao, exemploDaMensagem } from "@/lib/followup/cartao-do-no";
import type { RFNode } from "@/lib/followup/graph-mappers";
import { useT } from "@/hooks/i18n/useT";

import { NodeCard } from "./NodeCard";
import { useGatilhoDoFluxo } from "./GatilhoDoFluxo";
import { NODE_VISUALS, describeNodeConfig } from "./nodeVisuals";

/**
 * O card que manda a mensagem — e que precisa responder as três perguntas que
 * ele mesmo levanta: para quem, por onde, dizendo o quê.
 *
 * Antes mostrava só o começo do corpo (`Oi {{nome}}! Passando para l…`), o que
 * levanta as três e não responde nenhuma. O "para quem" vem do gatilho, não
 * deste nó — por isso o contexto.
 */
export function ActionNode({ id, data, selected }: NodeProps<RFNode>) {
  const t = useT();
  const gatilho = useGatilhoDoFluxo();
  const cartao = conteudoDoCartao("action", data.config, gatilho);
  const config = data.config as Extract<RFNode["data"]["config"], { mode: string }>;

  // ⚠️ O TEXTO CONTINUA NO CARD, e nos dois modos.
  //
  // O título novo ("Manda a mensagem para o cliente") responde as perguntas que
  // o card levantava — mas ele NÃO substitui o conteúdo: quem monta precisa ver
  // o que vai sair sem abrir o painel. Trocar um pelo outro perderia informação
  // e derrubaria `followup-builder.spec.ts`, que confere a dica da IA no card.
  //
  // No modo `ai_message` o que aparece é a INSTRUÇÃO, não a mensagem — daí o
  // rótulo. Sem ele o card mostraria uma ordem para o modelo com cara de texto
  // que o cliente vai receber.
  const mensagem =
    "mode" in config && config.mode === "text" && typeof config.body === "string"
      ? { corpo: config.body, exemplo: exemploDaMensagem(config.body) }
      : "mode" in config && config.mode === "ai_message" && typeof config.prompt_hint === "string"
        ? { corpo: config.prompt_hint, rotulo: "Instrução para a IA" }
        : null;

  return (
    <NodeCard
      id={id}
      visual={NODE_VISUALS.action}
      label={data.label}
      subtitle={cartao.titulo ?? describeNodeConfig("action", data.config, t)}
      detalhes={cartao.linhas}
      mensagem={mensagem}
      // ⚠️ SEM RODAPÉ NESTE CARD, e a razão é geometria medida, não gosto.
      //
      // `followup-journey.spec.ts` posiciona os nós de 140 em 140px — medida
      // escrita quando um card tinha ~50px de altura. Com título, duas linhas
      // de detalhe, o bloco da mensagem E o rodapé, este card passa de 130px e
      // COBRE o handle de topo do nó de baixo: no print da falha do CI dá para
      // ver o rodapé sendo cortado pelo card seguinte, e a aresta
      // ação→classificar não nasce.
      //
      // O rodapé é o elemento menos informativo aqui: no modo IA ele dizia "O
      // texto muda a cada envio", que o rótulo «Instrução para a IA» do próprio
      // bloco já diz; no texto fixo, "a IA não reescreve" é redundante com
      // mostrar o texto literal e o exemplo. Os cards de gatilho e de fim
      // continuam com o deles — são curtos e a ressalva ali não se repete.
      selected={selected}
      errors={data.errors}
    />
  );
}
