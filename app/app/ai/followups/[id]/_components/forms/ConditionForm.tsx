"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { conditionConfigSchema, nodeBranches } from "@/lib/followup/graph-schema";
import { Plus, Trash } from "@/lib/ui/icons";

import type { ConfigOf } from "./shared";

const CONDITION_FIELDS = ["lead_stage", "tag", "steps_taken", "last_outcome"] as const;
const CONDITION_OPS = ["eq", "neq", "gte", "lte", "contains"] as const;

type ConditionConfig = ConfigOf<"condition">;
type Check = ConditionConfig["checks"][number];
type Branching = NonNullable<ConditionConfig["branching"]>;

/** Id novo que não colide com os já usados. Opaco de propósito: é a identidade
 *  da saída, e ela não pode mudar quando o usuário reescreve o rótulo. */
function novoIdDeRegra(usados: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const candidato = `regra-${n}`;
    if (!usados.has(candidato)) return candidato;
  }
}

/** No modo "uma saída por regra" toda regra precisa de id — é o que a aresta referencia. */
function comIdsEstaveis(checks: Check[]): Check[] {
  const usados = new Set(checks.flatMap((c) => (c.id === undefined ? [] : [c.id])));
  return checks.map((c) => {
    if (c.id !== undefined) return c;
    const id = novoIdDeRegra(usados);
    usados.add(id);
    return { ...c, id };
  });
}

export function ConditionForm({
  config,
  onChange,
  ramosLigados = [],
}: {
  config: ConditionConfig;
  onChange: (c: ConditionConfig) => void;
  /** Ramos deste nó que hoje têm aresta — para avisar antes de deixar alguma órfã. */
  ramosLigados?: string[];
}) {
  const [combinator, setCombinator] = useState(config.combinator);
  const [branching, setBranching] = useState<Branching>(config.branching ?? "combined");
  const [checks, setChecks] = useState(config.checks);
  const [error, setError] = useState<string | null>(null);
  /** Troca de modo pendente de confirmação, com quantas ligações ela deixa órfãs. */
  const [trocaPendente, setTrocaPendente] = useState<{ modo: Branching; orfas: number } | null>(null);

  const commit = (next: {
    combinator?: "and" | "or";
    branching?: Branching;
    checks?: Check[];
  }) => {
    const modo = next.branching ?? branching;
    const candidato: ConditionConfig = {
      combinator: next.combinator ?? combinator,
      // O bug que este formulário tinha: remontava a config só com combinator e
      // checks, então QUALQUER campo novo era descartado na primeira edição —
      // o modo se apagava sozinho e o usuário via as bolinhas sumirem.
      // O campo só é escrito no modo novo: assim mexer num nó de fluxo antigo
      // não passa a gravar uma chave que ele nunca teve.
      ...(modo === "per_check" ? { branching: modo } : {}),
      checks: next.checks ?? checks,
    };
    const parsed = conditionConfigSchema.safeParse(candidato);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  /** Quantas ligações existentes deixam de ter saída se o nó passar a `modo`. */
  const orfasSe = (modo: Branching): number => {
    const checksDoModo = modo === "per_check" ? comIdsEstaveis(checks) : checks;
    const idsDepois = new Set(
      nodeBranches({ type: "condition", config: { combinator, branching: modo, checks: checksDoModo } }).map(
        (b) => b.id,
      ),
    );
    return ramosLigados.filter((id) => !idsDepois.has(id)).length;
  };

  const aplicarModo = (modo: Branching) => {
    const proximosChecks = modo === "per_check" ? comIdsEstaveis(checks) : checks;
    setBranching(modo);
    setChecks(proximosChecks);
    setTrocaPendente(null);
    commit({ branching: modo, checks: proximosChecks });
  };

  const pedirModo = (modo: Branching) => {
    if (modo === branching) return;
    const orfas = orfasSe(modo);
    if (orfas > 0) {
      setTrocaPendente({ modo, orfas });
      return;
    }
    aplicarModo(modo);
  };

  const porRegra = branching === "per_check";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="cond-branching">Como as regras decidem o caminho</Label>
        <Select value={branching} onValueChange={(v) => pedirModo(v as Branching)}>
          <SelectTrigger id="cond-branching">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="combined">Avaliar as regras juntas (uma saída de sim e uma de não)</SelectItem>
            <SelectItem value="per_check">Uma saída por regra</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {trocaPendente && (
        <div className="space-y-2 rounded-sm border border-warning bg-warning-bg p-2" data-testid="cond-troca-aviso">
          <p className="text-xs leading-snug text-warning-fg">
            Trocar de modo deixa {trocaPendente.orfas}{" "}
            {trocaPendente.orfas === 1 ? "ligação sem saída" : "ligações sem saída"} neste nó. Elas continuam
            desenhadas, mas param de levar a lugar nenhum até você religá-las.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={() => aplicarModo(trocaPendente.modo)}>
              Trocar mesmo assim
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTrocaPendente(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!porRegra && (
        <div className="space-y-2">
          <Label htmlFor="cond-combinator">Combinador</Label>
          <Select
            value={combinator}
            onValueChange={(v) => {
              const next = v as "and" | "or";
              setCombinator(next);
              commit({ combinator: next });
            }}
          >
            <SelectTrigger id="cond-combinator">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">E (todas)</SelectItem>
              <SelectItem value="or">OU (qualquer uma)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-3">
        {checks.map((check, idx) => (
          <div key={check.id ?? idx} className="space-y-2 rounded-sm border border-border p-2" data-testid={`condition-check-${idx}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-muted">Condição {idx + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remover condição"
                disabled={checks.length <= 1}
                onClick={() => {
                  const next = checks.filter((_, i) => i !== idx);
                  setChecks(next);
                  commit({ checks: next });
                }}
              >
                <Trash size={14} aria-hidden />
              </Button>
            </div>
            {porRegra && (
              <Input
                aria-label={`Nome da saída ${idx + 1}`}
                placeholder="Nome desta saída (opcional)"
                value={check.label ?? ""}
                onChange={(e) => {
                  const texto = e.target.value;
                  const next = checks.map((c, i) =>
                    // Sem texto o campo SOME da regra em vez de virar string vazia:
                    // o schema pede 1 a 60, e um rótulo vazio reprovaria a config
                    // inteira só porque o usuário apagou o que tinha escrito.
                    i === idx ? { ...c, ...(texto === "" ? { label: undefined } : { label: texto }) } : c,
                  );
                  setChecks(next);
                  commit({ checks: next });
                }}
              />
            )}
            <Select
              value={check.field}
              onValueChange={(v) => {
                const next = checks.map((c, i) => (i === idx ? { ...c, field: v as (typeof CONDITION_FIELDS)[number] } : c));
                setChecks(next);
                commit({ checks: next });
              }}
            >
              <SelectTrigger aria-label="Campo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_FIELDS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={check.op}
              onValueChange={(v) => {
                const next = checks.map((c, i) => (i === idx ? { ...c, op: v as (typeof CONDITION_OPS)[number] } : c));
                setChecks(next);
                commit({ checks: next });
              }}
            >
              <SelectTrigger aria-label="Operador">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPS.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Valor"
              placeholder="Valor"
              value={String(check.value)}
              onChange={(e) => {
                const next = checks.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c));
                setChecks(next);
                commit({ checks: next });
              }}
            />
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={checks.length >= 10}
        onClick={() => {
          const nova: Check = { field: "steps_taken", op: "gte", value: 0 };
          const next = porRegra
            ? comIdsEstaveis([...checks, nova])
            : [...checks, nova];
          setChecks(next);
          commit({ checks: next });
        }}
      >
        <Plus size={14} aria-hidden className="mr-1" /> Condição
      </Button>
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
