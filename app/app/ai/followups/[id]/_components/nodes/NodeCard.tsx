"use client";

import { Handle, Position } from "@xyflow/react";

import type { LinhaDoCartao } from "@/lib/followup/cartao-do-no";
import type { FlowBranch } from "@/lib/followup/graph-schema";
import { rotuloDoRamo } from "@/lib/followup/rotulo-do-ramo";
import { cn } from "@/lib/utils";
import { useT } from "@/hooks/i18n/useT";
import type { NodeVisual } from "./nodeVisuals";

interface Props {
  id: string;
  visual: NodeVisual;
  label: string;
  subtitle: string;
  selected?: boolean;
  errors?: string[];
  showTarget?: boolean;
  showSource?: boolean;
  /**
   * As saídas do nó, quando ele tem mais de uma. Cada ramo vira UMA linha com
   * rótulo legível e a sua própria bolinha — era isso que faltava: com um handle
   * só não havia onde ligar "a aresta da regra 2", e desenhar bolinhas iguais
   * sem nome trocaria um problema por outro.
   */
  branches?: FlowBranch[];
  /**
   * As perguntas que o card levanta, respondidas nele mesmo (`cartao-do-no.ts`).
   *
   * Quando vêm, substituem o subtítulo de uma linha: um card de ação dizendo só
   * "Oi {{nome}}! Passando para l…" levanta "para quem? por onde?" e não
   * responde nenhuma das duas. Ausentes, o card é o de sempre — os tipos que
   * descrevem bem a própria config (espera, condição, classificar) não mudaram.
   */
  detalhes?: ReadonlyArray<LinhaDoCartao>;
  /** A ressalva de rodapé — regra que age sozinha e ninguém adivinha olhando. */
  rodape?: string | null;
  /** Prévia do que será enviado, com um exemplo do texto já resolvido. */
  mensagem?: { corpo: string; exemplo?: string | null; rotulo?: string } | null;
}

/**
 * Shared card shell for all 6 node types — a card, not a bare React Flow box:
 * icon chip + title + one-line subtitle + connection handles, left border in
 * the type's accent. Red ring + inline message when `errors` is non-empty
 * (publish 422 anchored to this node — Task 6.2 PublishBar wires this).
 */
export function NodeCard({
  id,
  visual,
  label,
  subtitle,
  selected,
  errors,
  showTarget = true,
  showSource = true,
  branches,
  detalhes,
  rodape,
  mensagem,
}: Props) {
  const t = useT();
  const Icon = visual.icon;
  const hasError = (errors?.length ?? 0) > 0;
  // Uma saída só continua sendo a bolinha de sempre no rodapé: não há o que
  // rotular, e mexer nisso quebraria o arrasto de todo nó não-ramificado.
  const branchRows = branches !== undefined && branches.length > 1 ? branches : null;
  const temDetalhes = (detalhes?.length ?? 0) > 0;

  return (
    <div
      className={cn(
        // Mais largo quando o card responde perguntas: com 224px, "quem marcou
        // o compromisso" vira "quem marcou o com…" — e um card truncado esconde
        // exatamente o que ele passou a existir para mostrar.
        temDetalhes ? "w-72" : "w-56",
        "rounded-md border border-l-4 border-border bg-surface shadow-sm transition-shadow",
        visual.borderClassName,
        selected && "ring-2 ring-accent-500 ring-offset-1 ring-offset-bg",
        hasError && "border-error ring-2 ring-error ring-offset-1 ring-offset-bg",
      )}
      data-testid={`node-card-${id}`}
      title={hasError ? errors!.join("; ") : undefined}
    >
      {showTarget && <Handle type="target" position={Position.Top} />}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            visual.chipClassName,
          )}
        >
          <Icon size={14} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text">{label}</p>
          {/* Com detalhes, o subtítulo VIRA o título de verdade e não trunca: é
              a frase que diz o que o card faz ("Quando faltar 1 hora para um
              compromisso"). O nome do usuário fica acima, como apelido. */}
          <p className={cn("text-xs text-text-muted", temDetalhes ? "leading-snug" : "truncate")}>
            {subtitle}
          </p>
        </div>
      </div>

      {temDetalhes && (
        <dl className="space-y-0.5 px-3 pb-2" data-testid={`node-detalhes-${id}`}>
          {detalhes!.map((linha) => (
            <div key={linha.rotulo} className="flex gap-1.5 text-xs leading-snug">
              <dt className="shrink-0 text-text-subtle">{t(linha.rotulo)}</dt>
              <dd className={cn("min-w-0 text-text", linha.forte && "font-medium")}>
                {linha.bruto ? linha.valor : t(linha.valor)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {mensagem && (
        <div className="mx-3 mb-2 rounded bg-surface-elevated px-2 py-1.5" data-testid={`node-mensagem-${id}`}>
          {/* No modo IA o que está aqui é a ORDEM para o modelo, não o texto que
              o cliente recebe. Sem este rótulo, os dois se leem igual. */}
          {mensagem.rotulo && (
            <p className="mb-0.5 text-[10px] uppercase tracking-wide text-text-subtle">
              {t(mensagem.rotulo)}
            </p>
          )}
          <p className="line-clamp-3 text-xs leading-snug text-text">{mensagem.corpo}</p>
          {/* O exemplo com as chaves resolvidas: `{{agendamento.hora}}` não diz
              nada a quem monta; «às 14:00» diz. */}
          {mensagem.exemplo && (
            <p className="mt-1 line-clamp-2 text-[11px] italic leading-snug text-text-subtle">
              {mensagem.exemplo}
            </p>
          )}
        </div>
      )}

      {rodape && (
        <p
          className="border-t border-border/60 px-3 py-1.5 text-[11px] leading-snug text-text-subtle"
          data-testid={`node-rodape-${id}`}
        >
          {t(rodape)}
        </p>
      )}
      {hasError && (
        <p
          className="border-t border-error/30 px-3 py-1.5 text-xs leading-snug text-error-fg"
          data-testid={`node-error-${id}`}
        >
          {errors![0]}
        </p>
      )}
      {branchRows !== null && (
        <ul className="border-t border-border" data-testid={`node-branches-${id}`}>
          {branchRows.map((branch) => (
            <li
              key={branch.id}
              className={cn(
                "relative flex items-center gap-1.5 border-t border-border/60 px-3 py-1 first:border-t-0",
                // A saída de escape é a única que não veio de uma regra do usuário:
                // fica em itálico e apagada para se ler como "o resto cai aqui".
                branch.kind === "fallback" && "italic text-text-muted",
              )}
              data-testid={`node-branch-${id}-${branch.id}`}
              title={t(rotuloDoRamo(branch))}
            >
              <span
                aria-hidden
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  branch.kind === "fallback" ? "bg-text-muted/50" : "bg-accent-500",
                )}
              />
              <span className="truncate text-xs leading-tight">{t(rotuloDoRamo(branch))}</span>
              <Handle
                type="source"
                id={branch.id}
                position={Position.Right}
                // Uma bolinha por LINHA: a saída sai ao lado do seu próprio rótulo,
                // que é o que torna "qual aresta sai de qual regra" visível. No
                // rodapé elas ficariam lado a lado, sem espaço para nome nenhum.
                style={{ top: "50%" }}
              />
            </li>
          ))}
        </ul>
      )}
      {showSource && branchRows === null && <Handle type="source" position={Position.Bottom} />}
    </div>
  );
}
