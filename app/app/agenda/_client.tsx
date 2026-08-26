"use client";

import { addDays, format, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";

import { AGENDAMENTOS, PESSOAS } from "@/components/agenda/dados-de-mentira";
import { FiltroDePessoas } from "@/components/agenda/FiltroDePessoas";
import { GradeDaAgenda } from "@/components/agenda/GradeDaAgenda";
import type { VisaoDaAgenda } from "@/components/agenda/tipos";
import { EmptyAgenda } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { CalendarPlus, CaretLeft, CaretRight } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

const VISOES: Array<{ id: VisaoDaAgenda; rotulo: string }> = [
  { id: "dia", rotulo: "Dia" },
  { id: "semana", rotulo: "Semana" },
  { id: "mes", rotulo: "Mês" },
];

/**
 * A tela da Agenda.
 *
 * ⚠️ AINDA COM DADOS DE MENTIRA, e isto é deliberado, não esquecimento: a
 * frente 1 (API + motor) não está integrada, e ligar isto a `/api/v1/agenda`
 * antes disso produziria uma tela que quebra em runtime sem ninguém saber por
 * quê. O que troca quando a frente 1 subir é a ORIGEM — o hook no lugar do
 * import — e nada do desenho abaixo.
 *
 * O `data-fonte` no container existe para essa troca ser VERIFICÁVEL de fora:
 * enquanto disser "mentira", nenhuma prova desta tela vale como prova de
 * integração, e um teste pode cobrar isso em vez de confiar em quem escreveu.
 */
export function AgendaClient({ fusoDeApresentacao }: { fusoDeApresentacao: string | null }) {
  const [visao, setVisao] = React.useState<VisaoDaAgenda>("semana");
  const [isolada, setIsolada] = React.useState<string | null>(null);
  const [ancora, setAncora] = React.useState(() => new Date());

  const agendamentos = React.useMemo(
    () => (isolada === null ? AGENDAMENTOS : AGENDAMENTOS.filter((a) => a.responsavelId === isolada)),
    [isolada],
  );

  const passo = visao === "mes" ? 30 : visao === "semana" ? 7 : 1;
  const periodo =
    visao === "mes"
      ? format(ancora, "MMMM 'de' yyyy", { locale: ptBR })
      : visao === "semana"
        ? `${format(startOfWeek(ancora, { weekStartsOn: 0 }), "d 'de' MMM", { locale: ptBR })} — ${format(addDays(startOfWeek(ancora, { weekStartsOn: 0 }), 6), "d 'de' MMM", { locale: ptBR })}`
        : format(ancora, "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <div
      data-testid="tela-agenda"
      data-fonte="mentira"
      data-fuso={fusoDeApresentacao ?? "organizacao"}
      className="flex h-full flex-col gap-4 p-6"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground">
            O que está marcado, com quem, e quem atende — seu e da equipe.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAncora(new Date())}>
            Hoje
          </Button>
          <Button size="sm">
            <CalendarPlus size={16} weight="bold" aria-hidden />
            <span>Novo agendamento</span>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Período anterior"
              data-testid="periodo-anterior"
              onClick={() => setAncora((d) => addDays(d, -passo))}
            >
              <CaretLeft size={16} weight="bold" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Próximo período"
              data-testid="periodo-seguinte"
              onClick={() => setAncora((d) => addDays(d, passo))}
            >
              <CaretRight size={16} weight="bold" aria-hidden />
            </Button>
          </div>
          <span data-testid="periodo" className="truncate text-sm font-semibold capitalize">
            {periodo}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <FiltroDePessoas pessoas={PESSOAS} isolada={isolada} onIsolar={setIsolada} />
          <div
            data-testid="alternador-de-visao"
            className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
          >
            {VISOES.map((v) => (
              <button
                key={v.id}
                type="button"
                data-testid={`visao-${v.id}`}
                aria-pressed={visao === v.id}
                onClick={() => setVisao(v.id)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs transition-colors duration-fast ease-out",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                  visao === v.id
                    ? "bg-accent font-semibold text-accent-fg"
                    : "text-text-muted hover:bg-surface-elevated hover:text-text",
                )}
              >
                {v.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>

      {agendamentos.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-surface">
          <EmptyAgenda />
        </div>
      ) : (
        <GradeDaAgenda
          visao={visao}
          ancora={ancora}
          agora={new Date()}
          pessoas={PESSOAS}
          agendamentos={agendamentos}
          className="min-h-0 flex-1"
        />
      )}
    </div>
  );
}
