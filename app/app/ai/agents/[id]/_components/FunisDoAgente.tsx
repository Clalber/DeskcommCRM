"use client";
/**
 * EM QUE FUNIS ESTE ASSISTENTE PODE MEXER (spec 17 passo 3).
 *
 * Medido na produção: uma organização com 4 funis e 5 assistentes de negócios
 * diferentes — um SDR, dois de suporte e uma atendente de clínica. Qualquer um
 * alcançava qualquer funil.
 *
 * Três coisas que esta tela faz de propósito:
 *
 *  1. **Nomeia o estado vazio.** Nenhum funil marcado é um estado LEGÍTIMO (é o
 *     default, e é falha fechada), mas quem liga o papel e não marca nada
 *     concluiria que quebrou. A frase diz o que acontece, não o que falta.
 *  2. **Avisa quando o funil de ENTRADA está de fora.** É o caso que produz um
 *     estado novo e silencioso: o sistema cria um card por conversa todo dia num
 *     funil que o assistente é proibido de tocar, enquanto ele conversa
 *     normalmente. "Atendido e não registrado" não existe hoje.
 *  3. **Não usa jargão.** Nada de "escopo" nem de nome de coluna: o dono do
 *     negócio lê "mexer em negócio", que é o que de fato acontece.
 */
import * as React from "react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { FunilDaResposta } from "@/hooks/pipelines/usePipelines";

interface Props {
  funis: FunilDaResposta[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

export function FunisDoAgente({ funis, value, onChange, disabled = false }: Props) {
  const marcados = new Set(value);

  function alternar(id: string, marcado: boolean): void {
    const proximo = new Set(marcados);
    if (marcado) proximo.add(id);
    else proximo.delete(id);
    onChange([...proximo]);
  }

  const funilDeEntrada = funis.find((f) => f.is_default);
  // O aviso mais importante desta tela, e o menos óbvio: o funil de entrada é
  // onde o sistema cria um card por conversa nova (spec 17 passo 1). Se ele
  // ficar de fora, o assistente conversa e os cards se acumulam sem que ele
  // possa tocá-los.
  const entradaDeFora = Boolean(funilDeEntrada && !marcados.has(funilDeEntrada.id) && value.length > 0);

  return (
    <Card className="space-y-3 p-4">
      <div>
        <h3 className="text-sm font-medium">Em que negócios ele pode mexer</h3>
        <p className="text-xs text-muted-foreground">
          Marque os funis que este assistente cuida. Ele conversa com qualquer cliente, mas só
          move, edita ou encerra negócio dos funis marcados aqui.
        </p>
      </div>

      {funis.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Você ainda não tem nenhum funil. Crie um em Funis para poder liberar o assistente.
        </p>
      ) : (
        <div className="space-y-2" data-testid="agente-funis">
          {funis.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              {/* `input` nativo, como o ToolPicker ao lado: o repo não tem
                  componente de checkbox, e introduzir um só para esta tela
                  criaria duas aparências para o mesmo controle na MESMA página. */}
              <input
                id={`funil-${f.id}`}
                data-testid={`funil-${f.id}`}
                type="checkbox"
                className="h-4 w-4 shrink-0 rounded border-border accent-primary"
                checked={marcados.has(f.id)}
                onChange={(e) => alternar(f.id, e.target.checked)}
                disabled={disabled}
                aria-label={f.name}
              />
              <Label htmlFor={`funil-${f.id}`} className="text-sm font-normal">
                {f.name}
                {f.is_default ? (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (é para cá que vão as conversas novas)
                  </span>
                ) : null}
              </Label>
            </div>
          ))}
        </div>
      )}

      {value.length === 0 ? (
        <p data-testid="agente-sem-funil" className="text-xs text-muted-foreground">
          Sem nenhum funil marcado, ele conversa com os clientes normalmente, mas não mexe em
          negócio nenhum — nem move, nem encerra, nem marca.
        </p>
      ) : null}

      {entradaDeFora ? (
        <p data-testid="agente-entrada-de-fora" className="text-xs text-warning-fg">
          As conversas novas viram negócio em <strong>{funilDeEntrada?.name}</strong>, que não está
          marcado. O assistente vai atender e os negócios vão se acumular ali sem que ele possa
          organizá-los.
        </p>
      ) : null}
    </Card>
  );
}
