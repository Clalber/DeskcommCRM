"use client";

import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { aiClassifyConfigSchema } from "@/lib/followup/graph-schema";
import {
  ALVOS_DA_CLASSIFICACAO,
  ESPERA_PELA_RESPOSTA,
  opcoes,
  type AlvoDaClassificacao,
} from "@/lib/followup/vocabulario";

import { msToMin, minToMs, type ConfigOf } from "./shared";

export function ClassifyForm({
  config,
  onChange,
}: {
  config: ConfigOf<"ai_classify">;
  onChange: (c: ConfigOf<"ai_classify">) => void;
}) {
  const [classesText, setClassesText] = useState(config.classes.join(", "));
  const [graceMin, setGraceMin] = useState(msToMin(config.grace_timeout_ms));
  const [target, setTarget] = useState(config.target);
  const [hint, setHint] = useState(config.hint ?? "");
  const [error, setError] = useState<string | null>(null);

  const commit = (next: { classesText: string; graceMin: number; target: AlvoDaClassificacao; hint: string }) => {
    const classes = next.classesText
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    const candidate = {
      classes,
      grace_timeout_ms: minToMs(next.graceMin),
      target: next.target,
      ...(next.hint.trim() ? { hint: next.hint } : {}),
    };
    const parsed = aiClassifyConfigSchema.safeParse(candidate);
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
        <Label htmlFor="classify-classes">Classes (separadas por vírgula)</Label>
        <Input
          id="classify-classes"
          value={classesText}
          onChange={(e) => {
            setClassesText(e.target.value);
            commit({ classesText: e.target.value, graceMin, target, hint });
          }}
          placeholder="interessado, sem interesse"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="classify-grace">{ESPERA_PELA_RESPOSTA.rotulo}</Label>
        <Input
          id="classify-grace"
          type="number"
          min={ESPERA_PELA_RESPOSTA.minimoMinutos}
          value={graceMin}
          onChange={(e) => {
            const v = Number(e.target.value);
            setGraceMin(v);
            commit({ classesText, graceMin: v, target, hint });
          }}
        />
        <p className="text-xs text-text-muted">{ESPERA_PELA_RESPOSTA.ajuda}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="classify-target">O que a IA vai ler</Label>
        <Select
          value={target}
          onValueChange={(v) => {
            const next = v as AlvoDaClassificacao;
            setTarget(next);
            commit({ classesText, graceMin, target: next, hint });
          }}
        >
          <SelectTrigger id="classify-target">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcoes(ALVOS_DA_CLASSIFICACAO).map(({ valor, rotulo }) => (
              <SelectItem key={valor} value={valor}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="classify-hint">Instrução (opcional)</Label>
        <Textarea
          id="classify-hint"
          maxLength={500}
          value={hint}
          onChange={(e) => {
            setHint(e.target.value);
            commit({ classesText, graceMin, target, hint: e.target.value });
          }}
        />
      </div>
      {error && <p className="text-xs text-error-fg">{error}</p>}
    </div>
  );
}
