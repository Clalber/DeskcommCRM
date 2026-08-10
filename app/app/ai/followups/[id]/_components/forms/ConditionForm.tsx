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
import { conditionConfigSchema } from "@/lib/followup/graph-schema";
import { Plus, Trash } from "@/lib/ui/icons";

import type { ConfigOf } from "./shared";

const CONDITION_FIELDS = ["lead_stage", "tag", "steps_taken", "last_outcome"] as const;
const CONDITION_OPS = ["eq", "neq", "gte", "lte", "contains"] as const;

export function ConditionForm({
  config,
  onChange,
}: {
  config: ConfigOf<"condition">;
  onChange: (c: ConfigOf<"condition">) => void;
}) {
  const [combinator, setCombinator] = useState(config.combinator);
  const [checks, setChecks] = useState(config.checks);
  const [error, setError] = useState<string | null>(null);

  const commit = (nextCombinator: "and" | "or", nextChecks: typeof checks) => {
    const parsed = conditionConfigSchema.safeParse({ combinator: nextCombinator, checks: nextChecks });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Configuração inválida.");
      return;
    }
    setError(null);
    onChange(parsed.data);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="cond-combinator">Combinador</Label>
        <Select
          value={combinator}
          onValueChange={(v) => {
            const next = v as "and" | "or";
            setCombinator(next);
            commit(next, checks);
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

      <div className="space-y-3">
        {checks.map((check, idx) => (
          <div key={idx} className="space-y-2 rounded-sm border border-border p-2" data-testid={`condition-check-${idx}`}>
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
                  commit(combinator, next);
                }}
              >
                <Trash size={14} aria-hidden />
              </Button>
            </div>
            <Select
              value={check.field}
              onValueChange={(v) => {
                const next = checks.map((c, i) => (i === idx ? { ...c, field: v as (typeof CONDITION_FIELDS)[number] } : c));
                setChecks(next);
                commit(combinator, next);
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
                commit(combinator, next);
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
                commit(combinator, next);
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
          const next = [...checks, { field: "steps_taken" as const, op: "gte" as const, value: 0 }];
          setChecks(next);
          commit(combinator, next);
        }}
      >
        <Plus size={14} aria-hidden className="mr-1" /> Condição
      </Button>
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
