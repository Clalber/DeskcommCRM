"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Connection,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  toReactFlow,
  fromReactFlow,
  graphsEqual,
  toFlowNode,
  type RFNode,
  type RFEdge,
  type RFNodeData,
} from "@/lib/followup/graph-mappers";
import Link from "next/link";

import { triggerConfigSchema } from "@/lib/followup/api-schemas";
import { rotuloDaArestaNoCanvas } from "@/lib/followup/cartao-do-no";
import {
  branchIdForCondition,
  conditionForBranch,
  type FlowEdge,
  type FlowGraph,
  type NodeType,
} from "@/lib/followup/graph-schema";
import { useFollowupFlow, type FollowupFlowDetailRow } from "@/hooks/followup/useFollowupFlow";
import { useT } from "@/hooks/i18n/useT";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Plus, X } from "@/lib/ui/icons";
import { NodeConfigPanel } from "./NodeConfigPanel";
import { GatilhoDoFluxoProvider } from "./nodes/GatilhoDoFluxo";
import { EdgeConfigPanel } from "./EdgeConfigPanel";
import { NodePalette } from "./NodePalette";
import { PublishBar } from "./PublishBar";
import { NODE_VISUALS } from "./nodes/nodeVisuals";
import { TriggerNode } from "./nodes/TriggerNode";
import { WaitNode } from "./nodes/WaitNode";
import { ConditionNode } from "./nodes/ConditionNode";
import { ClassifyNode } from "./nodes/ClassifyNode";
import { MatchReplyNode } from "./nodes/MatchReplyNode";
import { RepeatNode } from "./nodes/RepeatNode";
import { ActionNode } from "./nodes/ActionNode";
import { EndNode } from "./nodes/EndNode";

const EMPTY_GRAPH: FlowGraph = { nodes: [], edges: [] };
const DND_MIME = "application/x-followup-node-type";

// Defined outside the component — React Flow warns (and re-mounts nodes) if
// nodeTypes is a fresh object every render.
const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  wait: WaitNode,
  condition: ConditionNode,
  ai_classify: ClassifyNode,
  match_reply: MatchReplyNode,
  repeat: RepeatNode,
  action: ActionNode,
  end: EndNode,
};

interface Props {
  flowId: string;
  initialData: FollowupFlowDetailRow;
}

function FlowCanvasInner({ flowId, initialData }: Props) {
  const t = useT();
  const { data: flow } = useFollowupFlow(flowId, { initialData });
  // `initial` seeds React Flow state ONCE on mount — it must NOT react to
  // `flow` changing on every refetch (that would clobber in-progress edits).
  const initial = useMemo(
    () => toReactFlow(initialData.draft_graph ?? EMPTY_GRAPH),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<RFNode>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<RFEdge>(initial.edges);
  const [savedGraph, setSavedGraph] = useState<FlowGraph>(initialData.draft_graph ?? EMPTY_GRAPH);
  const nextId = useRef(1);
  const nextEdgeId = useRef(1);
  const { screenToFlowPosition } = useReactFlow();
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // O gatilho do FLUXO (não de nó nenhum): é ele que o card de gatilho descreve
  // e que decide se o aviso do cadastro da Agenda aparece. Parseado, nunca
  // confiado cru — a linha vem do banco.
  const gatilho = useMemo(() => {
    const lido = triggerConfigSchema.safeParse(flow?.trigger_config);
    return lido.success ? lido.data : null;
  }, [flow?.trigger_config]);

  const liveGraph = useMemo(() => fromReactFlow(nodes, edges), [nodes, edges]);
  const dirty = useMemo(() => !graphsEqual(liveGraph, savedGraph), [liveGraph, savedGraph]);

  const markNodeErrors = useCallback(
    (errorsByNode: Record<string, string[]>) => {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, errors: errorsByNode[n.id] } })));
    },
    [setNodes],
  );
  const clearNodeErrors = useCallback(() => {
    setNodes((nds) => nds.map((n) => (n.data.errors ? { ...n, data: { ...n.data, errors: undefined } } : n)));
  }, [setNodes]);

  // Node and edge selection are mutually exclusive — opening one panel closes the other's.
  const onNodeClick = useCallback<NodeMouseHandler<RFNode>>((_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);
  const onEdgeClick = useCallback<EdgeMouseHandler<RFEdge>>((_, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  const updateNodeData = useCallback(
    (id: string, patch: Partial<RFNodeData>) => {
      setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes],
  );
  const updateEdgeCondition = useCallback(
    (id: string, condition: FlowEdge["condition"]) => {
      setEdges((eds) =>
        eds.map((e) => (e.id === id ? { ...e, data: { priority: e.data?.priority ?? 0, condition } } : e)),
      );
    },
    [setEdges],
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null;
  const selectedEdgeSource = selectedEdge ? (nodes.find((n) => n.id === selectedEdge.source) ?? null) : null;
  const selectedEdgeTarget = selectedEdge ? (nodes.find((n) => n.id === selectedEdge.target) ?? null) : null;

  // Wire label: derived at render time from `data.condition`, never persisted on the edge
  // itself — `condition` alone stays the source of truth the mapper round-trips.
  // Num nó que ramifica o texto vem do RAMO (o rótulo que o usuário leu na
  // bolinha de onde arrastou), não da condição crua: `conditionLabel` sozinho
  // mostraria o id do ramo, que não é palavra nenhuma para quem não programa.
  const edgesForRender = useMemo(
    () =>
      edges.map((e) => {
        const source = nodes.find((n) => n.id === e.source);
        return {
          ...e,
          // A decisão inteira mora em `cartao-do-no.ts`, e o canvas só a chama.
          // Reimplementá-la aqui foi o defeito: o `branch` do fallback era
          // sempre encontrado (`nodeBranches` devolve um para TODO nó), então o
          // rótulo por tipo de origem nunca corria e as setas seguiam dizendo
          // "Sempre" — com o teste da função isolada verde o tempo todo.
          label: t(
            rotuloDaArestaNoCanvas(
              e.data?.condition ?? { type: "always" },
              source ? toFlowNode(source) : undefined,
            ),
          ),
          selected: e.id === selectedEdgeId,
        };
      }),
    [edges, nodes, selectedEdgeId, t],
  );

  // Quais saídas do nó selecionado já têm aresta. Quem sabe isso é o canvas —
  // o formulário não vê o grafo, e sem esse dado ele trocaria o modo do nó
  // deixando ligações órfãs sem conseguir dizer quantas.
  const ramosLigadosDoSelecionado = useMemo(() => {
    if (!selectedNode) return [];
    const source = toFlowNode(selectedNode);
    return edges
      .filter((e) => e.source === selectedNode.id)
      .map((e) => branchIdForCondition(source, e.data?.condition ?? { type: "always" }))
      .filter((id): id is string => id !== null);
  }, [selectedNode, edges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      // A bolinha de onde o usuário arrastou É a saída escolhida: o React Flow
      // devolve o id do ramo em `sourceHandle`. Antes a aresta nascia sempre
      // `always` e o usuário tinha que ir ao painel dizer de novo, de qual regra
      // ela saía — o que, com uma bolinha só, era impossível de expressar.
      const source = nodes.find((n) => n.id === connection.source);
      const fromBranch =
        source && connection.sourceHandle
          ? conditionForBranch(toFlowNode(source), connection.sourceHandle)
          : null;
      const newEdge: RFEdge = {
        id: `edge-${nextEdgeId.current++}`,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
        data: { priority: 0, condition: fromBranch ?? { type: "always" } },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges, nodes],
  );

  const addNodeAt = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      const visual = NODE_VISUALS[type];
      const id = `${type}-${nextId.current++}`;
      const newNode: RFNode = {
        id,
        type,
        position,
        data: { label: t(visual.defaultLabel), config: visual.defaultConfig() },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [setNodes, t],
  );

  const onPaletteAdd = useCallback(
    (type: NodeType) => {
      const index = nodes.length;
      // 310px, e não 220: o card com detalhes tem 288px de largura (`w-72`), e
      // com o passo antigo quatro nós adicionados pela paleta nasciam
      // sobrepostos em 68px. O desenho nascer feio é o tipo de coisa que o
      // operador atribui a si mesmo, não à ferramenta.
      addNodeAt(type, { x: 80 + (index % 4) * 310, y: 80 + Math.floor(index / 4) * 190 });
    },
    [nodes.length, addNodeAt],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData(DND_MIME) as NodeType | "";
      if (!type) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNodeAt(type, position);
    },
    [screenToFlowPosition, addNodeAt],
  );

  return (
    <div className="flex h-full min-h-[600px] w-full flex-col">
      {flow && (
        <PublishBar
          flowId={flowId}
          flow={flow}
          graph={liveGraph}
          dirty={dirty}
          onSaved={setSavedGraph}
          onPublishErrors={markNodeErrors}
          onPublishSuccess={clearNodeErrors}
        />
      )}
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAdd={onPaletteAdd} />
        {/* Abaixo de `lg` a paleta fixa de 224px não cabe do lado do canvas —
            vira um drawer, disparado por este botão flutuante. */}
        <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
          <SheetContent side="left" className="w-72 max-w-[85vw] gap-0 p-0 lg:hidden">
            <SheetTitle className="sr-only">{t("Adicionar nó")}</SheetTitle>
            <NodePalette
              variant="mobile"
              onAdd={(type) => {
                onPaletteAdd(type);
                setPaletteOpen(false);
              }}
            />
          </SheetContent>
        </Sheet>

        <div className="relative h-full flex-1" data-testid="flow-canvas" onDragOver={onDragOver} onDrop={onDrop}>
          {/* O gatilho alcança os cards por CONTEXTO, não por `data` do nó: o
              `data` é semeado uma vez na montagem (de propósito, para um
              refetch não atropelar edição em andamento), e o gatilho muda no
              meio da sessão — o painel do topo salva e o card acompanha. */}
          <GatilhoDoFluxoProvider triggerConfig={flow?.trigger_config}>
          <ReactFlow
            nodes={nodes}
            edges={edgesForRender}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
          </GatilhoDoFluxoProvider>

          {/* ⚠️ A METADE DA CONFIGURAÇÃO QUE MORA NOUTRA TELA.
              O gatilho de compromisso só alcança os tipos de atendimento com o
              lembrete ligado em Ajustes › Agenda — e o fluxo publicado sem
              nenhum tipo ligado fica `active` sem falar com ninguém. O desenho
              tem de admitir que depende de um cadastro que não está aqui. */}
          {gatilho?.kind === "appointment_upcoming" && (
            <Link
              href="/app/settings/tenant/agenda"
              data-testid="canvas-aviso-agenda"
              className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-dashed border-border bg-surface/95 px-3 py-1.5 text-xs text-text-muted shadow-sm hover:text-text"
            >
              {t("Só vale para os tipos com o lembrete ligado — abrir Ajustes › Agenda")}
            </Link>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="absolute bottom-4 left-4 z-10 shadow-md lg:hidden"
            onClick={() => setPaletteOpen(true)}
          >
            <Plus size={14} aria-hidden /> {t("Adicionar nó")}
          </Button>
        </div>

        {/*
          Docked panel em telas grandes (`lg:`) — NÃO é overlay ali: o canvas
          continua clicável, então trocar de nó/aresta selecionado funciona com
          o painel aberto. Abaixo de `lg` os 384px (`w-96`) sozinhos já passavam
          da largura de QUALQUER celular, e como o pai é `overflow-hidden`, o
          painel não ganhava scroll — ficava certo, cortado, inacessível. Vira
          bottom sheet (`fixed`, ancorado embaixo, com teto de altura e X pra
          fechar) só nesse intervalo de tela.
        */}
        {selectedNode && (
          <aside
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-t-lg border-t border-border bg-surface shadow-lg lg:static lg:z-auto lg:h-full lg:w-96 lg:max-h-none lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
            data-testid="node-config-sheet"
          >
            {/* Barra própria pro X, não sobreposta ao conteúdo — um botão
                flutuante por cima do cabeçalho do painel colidiria com rótulo
                comprido (texto sobre texto). */}
            <div className="flex shrink-0 justify-end p-2 lg:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedNodeId(null)}
                aria-label={t("Fechar")}
              >
                <X size={16} aria-hidden />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-0 lg:pt-4">
              <NodeConfigPanel
                key={selectedNode.id}
                node={selectedNode}
                onChange={(patch) => updateNodeData(selectedNode.id, patch)}
                ramosLigados={ramosLigadosDoSelecionado}
              />
            </div>
          </aside>
        )}

        {selectedEdge && (
          <aside
            className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-t-lg border-t border-border bg-surface shadow-lg lg:static lg:z-auto lg:h-full lg:w-96 lg:max-h-none lg:shrink-0 lg:rounded-none lg:border-l lg:border-t-0 lg:shadow-none"
            data-testid="edge-config-sheet"
          >
            <div className="flex shrink-0 justify-end p-2 lg:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setSelectedEdgeId(null)}
                aria-label={t("Fechar")}
              >
                <X size={16} aria-hidden />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pt-0 lg:pt-4">
              <EdgeConfigPanel
                key={selectedEdge.id}
                sourceNode={selectedEdgeSource ? toFlowNode(selectedEdgeSource) : undefined}
                targetNode={selectedEdgeTarget ? toFlowNode(selectedEdgeTarget) : undefined}
                condition={selectedEdge.data?.condition ?? { type: "always" }}
                onChange={(condition) => updateEdgeCondition(selectedEdge.id, condition)}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

export function FlowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
