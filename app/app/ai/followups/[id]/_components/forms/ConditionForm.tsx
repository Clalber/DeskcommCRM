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
import {
  CAMPOS_DA_CONDICAO,
  COMBINADORES,
  comparador,
  comparadoresDoCampo,
  fraseDaCondicao,
  opcoes,
  type CampoDaCondicao,
  type Combinador,
  type OperadorDaCondicao,
} from "@/lib/followup/vocabulario";
import { Plus, Trash } from "@/lib/ui/icons";

import type { ConfigOf } from "./shared";

/**
 * Trocar de campo pode deixar o operador órfão: `gte` faz sentido em "passos
 * dados" e nunca é verdadeiro em "etiqueta". Em vez de manter na tela uma
 * escolha que o motor ignora, cai no primeiro operador que o campo novo
 * oferece.
 */
function operadorValidoPara(campo: CampoDaCondicao, atual: OperadorDaCondicao): OperadorDaCondicao {
  if (comparador(campo, atual).oferecido) return atual;
  return comparadoresDoCampo(campo)[0]!.op;
}

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

  const commit = (nextCombinator: Combinador, nextChecks: typeof checks) => {
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
        <Label htmlFor="cond-combinator">Seguir por aqui quando</Label>
        <Select
          value={combinator}
          onValueChange={(v) => {
            const next = v as Combinador;
            setCombinator(next);
            commit(next, checks);
          }}
        >
          <SelectTrigger id="cond-combinator">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes(COMBINADORES).map(({ valor, rotulo }) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
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
                const campo = v as CampoDaCondicao;
                const next = checks.map((c, i) =>
                  i === idx ? { ...c, field: campo, op: operadorValidoPara(campo, c.op) } : c,
                );
                setChecks(next);
                commit(combinator, next);
              }}
            >
              <SelectTrigger aria-label="Campo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CAMPOS_DA_CONDICAO) as CampoDaCondicao[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {CAMPOS_DA_CONDICAO[f].rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={check.op}
              onValueChange={(v) => {
                const next = checks.map((c, i) => (i === idx ? { ...c, op: v as OperadorDaCondicao } : c));
                setChecks(next);
                commit(combinator, next);
              }}
            >
              <SelectTrigger aria-label="Operador">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {comparadoresDoCampo(check.field).map(({ op, rotulo }) => (
                  <SelectItem key={op} value={op}>
                    {rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              aria-label="Valor"
              placeholder={CAMPOS_DA_CONDICAO[check.field].tipoDeValor === "numero" ? "Ex.: 3" : "Valor"}
              value={String(check.value)}
              onChange={(e) => {
                const next = checks.map((c, i) => (i === idx ? { ...c, value: e.target.value } : c));
                setChecks(next);
                commit(combinator, next);
              }}
            />
            {/* A frase inteira, para quem não tem certeza do que os três campos
                acima somam — e o aviso quando o motor nunca satisfaz o par. */}
            <p className="text-xs text-text-muted">{fraseDaCondicao(check.field, check.op, check.value)}</p>
            {comparador(check.field, check.op).aviso && (
              <p className="text-xs text-warning-fg">{comparador(check.field, check.op).aviso}</p>
            )}
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
