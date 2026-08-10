"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUpdateTriggerConfig } from "@/hooks/followup/useFollowupFlow";
import { useEtapasDeGatilho } from "@/hooks/followup/useEtapasDeGatilho";

/**
 * Controle de `trigger_config` do pointer (Task 8.5) — como o fluxo começa.
 *
 * ⚠️ SÓ APARECE AQUI O QUE TEM MOTOR VIVO, e essa disciplina é a razão de o
 * controle ser confiável: `manual` (POST manual), `silence` (silence-sweep) e
 * `stage_change` (`lib/followup/gatilho-etapa.ts`, consumidor de
 * `lead.stage_changed` no `event_log`). `conversation_end` continua no schema
 * sem produtor — não é oferecido, e o publish o recusa se chegar por API crua.
 * Dado antigo com um kind que não sabemos armar é mostrado como
 * «(indisponível)» em vez de mentir «Manual».
 *
 * ⚠️ A ETAPA É ESCOLHIDA PELO NOME, NUNCA POR UUID. O `trigger_config` guarda
 * `stage_id`; a tela resolve id → nome com `useEtapasDeGatilho`, e agrupa por
 * funil porque duas etapas podem se chamar «Proposta» em funis diferentes.
 *
 * ⚠️ O RÓTULO DIZ QUANDO, NÃO SÓ O QUÊ. O disparo depende de dois crons de um
 * minuto (o dreno do `event_log` e o tick do motor), então a tela promete
 * «poucos minutos», não «na hora» — prometer instantâneo seria o controle
 * mentindo sobre a própria função.
 */
type TriggerKind = "manual" | "silence" | "stage_change";

interface TriggerFormState {
  kind: TriggerKind;
  thresholdMinutes: number;
  segments: string;
  stageId: string;
  cancelOnReply: boolean;
}

const DEFAULT_THRESHOLD_MINUTES = 60;
const MIN_THRESHOLD_MINUTES = 5;

const KIND_LABEL: Record<TriggerKind, string> = {
  manual: "Manual",
  silence: "Silêncio",
  stage_change: "Etapa do funil",
};

function parseTriggerConfig(raw: Record<string, unknown>): TriggerFormState {
  const kind: TriggerKind =
    raw.kind === "silence" ? "silence" : raw.kind === "stage_change" ? "stage_change" : "manual";
  const params =
    (raw.params as { threshold_minutes?: number; segments?: string[]; stage_id?: string } | undefined) ?? {};
  return {
    kind,
    thresholdMinutes:
      kind === "silence" && typeof params.threshold_minutes === "number"
        ? params.threshold_minutes
        : DEFAULT_THRESHOLD_MINUTES,
    segments: kind === "silence" && Array.isArray(params.segments) ? params.segments.join(", ") : "",
    stageId: kind === "stage_change" && typeof params.stage_id === "string" ? params.stage_id : "",
    cancelOnReply: raw.cancel_on_reply === true,
  };
}

function toTriggerConfig(form: TriggerFormState): Record<string, unknown> {
  const cancelOnReply = form.cancelOnReply ? { cancel_on_reply: true } : {};
  if (form.kind === "manual") return { kind: "manual", ...cancelOnReply };

  if (form.kind === "stage_change") {
    return { kind: "stage_change", params: { stage_id: form.stageId }, ...cancelOnReply };
  }

  const segments = form.segments
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    kind: "silence",
    params: { threshold_minutes: form.thresholdMinutes, ...(segments.length > 0 ? { segments } : {}) },
    ...cancelOnReply,
  };
}

function summaryLabel(cfg: Record<string, unknown>, nomeDaEtapa: string | null): string {
  if (cfg.kind === "silence") {
    const minutes = (cfg.params as { threshold_minutes?: number } | undefined)?.threshold_minutes;
    return `Gatilho: Silêncio${typeof minutes === "number" ? ` (${minutes} min)` : ""}`;
  }
  if (cfg.kind === "stage_change") {
    // Enquanto os nomes não chegaram (ou a etapa sumiu do funil) o rótulo diz o
    // TIPO em vez de vazar o uuid — que é justamente o que esta tela não faz.
    return nomeDaEtapa ? `Gatilho: entrou em «${nomeDaEtapa}»` : "Gatilho: Etapa do funil";
  }
  if (cfg.kind === "manual" || cfg.kind === undefined) return "Gatilho: Manual";
  // conversation_end de dados antigos (API crua) — sem UI própria, mas mostrado
  // com transparência em vez de mentir "Manual".
  return `Gatilho: ${String(cfg.kind)} (indisponível)`;
}

interface Props {
  flowId: string;
  triggerConfig: Record<string, unknown>;
}

export function TriggerConfigControl({ flowId, triggerConfig }: Props) {
  const update = useUpdateTriggerConfig(flowId);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<TriggerFormState>(() => parseTriggerConfig(triggerConfig));
  const [form, setForm] = useState<TriggerFormState>(saved);

  // A leitura das etapas acompanha o botão, não o popover: o rótulo fechado
  // precisa do nome da etapa para não exibir «Etapa do funil» genérico num
  // fluxo já configurado.
  const { etapas, carregando: etapasCarregando } = useEtapasDeGatilho();
  const etapaSalva = etapas.find((e) => e.stageId === parseTriggerConfig(triggerConfig).stageId);

  // Re-sincroniza com o valor persistido quando o popover está FECHADO — nunca
  // no meio de uma edição em andamento (mesma doutrina do `savedGraph` do canvas).
  useEffect(() => {
    if (open) return;
    const next = parseTriggerConfig(triggerConfig);
    setSaved(next);
    setForm(next);
  }, [triggerConfig, open]);

  const thresholdInvalid =
    form.kind === "silence" && (!Number.isFinite(form.thresholdMinutes) || form.thresholdMinutes < MIN_THRESHOLD_MINUTES);
  // Gatilho de etapa sem etapa escolhida não é rascunho: é um fluxo que ficaria
  // ativo sem nunca disparar. O publish recusa; o Salvar recusa antes.
  const stageInvalid = form.kind === "stage_change" && form.stageId.trim().length === 0;
  const dirty =
    form.kind !== saved.kind ||
    form.cancelOnReply !== saved.cancelOnReply ||
    (form.kind === "silence" && (form.thresholdMinutes !== saved.thresholdMinutes || form.segments !== saved.segments)) ||
    (form.kind === "stage_change" && form.stageId !== saved.stageId);

  const onSave = () => {
    if (thresholdInvalid || stageInvalid) return;
    update.mutate(toTriggerConfig(form), {
      onSuccess: () => {
        setSaved(form);
        setOpen(false);
      },
    });
  };

  // Agrupa por funil preservando a ordem em que as etapas chegaram (ordem do
  // funil) — duas etapas homônimas em funis diferentes precisam do cabeçalho
  // para serem distinguíveis.
  const funis: Array<{ id: string; nome: string; etapas: typeof etapas }> = [];
  for (const etapa of etapas) {
    let grupo = funis.find((f) => f.id === etapa.pipelineId);
    if (!grupo) {
      grupo = { id: etapa.pipelineId, nome: etapa.pipelineName, etapas: [] };
      funis.push(grupo);
    }
    grupo.etapas.push(etapa);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" data-testid="trigger-config-button">
          {summaryLabel(triggerConfig, etapaSalva?.stageName ?? null)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end" data-testid="trigger-config-panel">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="trigger-kind">Tipo de gatilho</Label>
            <Select value={form.kind} onValueChange={(v) => setForm((f) => ({ ...f, kind: v as TriggerKind }))}>
              <SelectTrigger id="trigger-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{KIND_LABEL.manual}</SelectItem>
                <SelectItem value="silence">{KIND_LABEL.silence}</SelectItem>
                <SelectItem value="stage_change">{KIND_LABEL.stage_change}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.kind === "stage_change" && (
            <div className="space-y-2">
              <Label htmlFor="trigger-stage">Etapa que dispara o fluxo</Label>
              <Select
                value={form.stageId}
                onValueChange={(v) => setForm((f) => ({ ...f, stageId: v }))}
                disabled={etapasCarregando || etapas.length === 0}
              >
                <SelectTrigger id="trigger-stage" data-testid="trigger-stage-select" aria-invalid={stageInvalid}>
                  <SelectValue placeholder={etapasCarregando ? "Carregando etapas…" : "Escolha a etapa"} />
                </SelectTrigger>
                <SelectContent>
                  {funis.map((funil) => (
                    <SelectGroup key={funil.id}>
                      <SelectLabel>{funil.nome}</SelectLabel>
                      {funil.etapas.map((etapa) => (
                        <SelectItem key={etapa.stageId} value={etapa.stageId}>
                          {etapa.stageName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              {!etapasCarregando && etapas.length === 0 && (
                <p className="text-xs text-error-fg">
                  Nenhuma etapa ativa encontrada — crie o funil antes de armar este gatilho.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                O fluxo começa quando um negócio entra nesta etapa, por arrasto no quadro ou por
                automação. A entrada na fila leva poucos minutos, não é instantânea.
              </p>
            </div>
          )}

          {form.kind === "silence" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="trigger-threshold">Minutos de silêncio</Label>
                <Input
                  id="trigger-threshold"
                  type="number"
                  min={MIN_THRESHOLD_MINUTES}
                  value={form.thresholdMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, thresholdMinutes: Number(e.target.value) }))}
                  aria-invalid={thresholdInvalid}
                />
                {thresholdInvalid && (
                  <p className="text-xs text-error-fg">Mínimo de {MIN_THRESHOLD_MINUTES} minutos.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-segments">Segmentos (tags, opcional)</Label>
                <Input
                  id="trigger-segments"
                  placeholder="ex: vip, carrinho-abandonado"
                  value={form.segments}
                  onChange={(e) => setForm((f) => ({ ...f, segments: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="trigger-cancel-on-reply">Cancelar se o lead responder</Label>
            <Switch
              id="trigger-cancel-on-reply"
              checked={form.cancelOnReply}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, cancelOnReply: checked }))}
            />
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!dirty || thresholdInvalid || stageInvalid || update.isPending}
            onClick={onSave}
            data-testid="trigger-config-save"
          >
            {update.isPending ? "Salvando…" : "Salvar gatilho"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
