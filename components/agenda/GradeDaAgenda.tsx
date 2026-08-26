"use client";

import {
  addDays,
  differenceInMinutes,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";

import { cn } from "@/lib/utils";

import { corDaTrilha, fundoDaTrilha } from "./paleta";
import type { Compromisso, Pessoa, VisaoDaAgenda } from "./tipos";

/**
 * Altura de uma hora, em pixels. É a régua de toda a grade: posição e duração
 * de um bloco saem daqui, e o teste mede contra este número.
 *
 * 48px e não os 56px da linha de lista do produto: numa semana de trabalho de
 * 14 horas, 56 dá 784px de rolagem e o dia deixa de caber numa tela de notebook.
 * 48 mantém 12h visíveis em 1080p — e um compromisso de 30 minutos ainda tem
 * 24px, altura suficiente para uma linha de texto legível.
 */
const ALTURA_DA_HORA = 48;

/** A janela que a grade desenha. Fora dela, rola. */
const PRIMEIRA_HORA = 7;
const ULTIMA_HORA = 21;

const HORAS = Array.from(
  { length: ULTIMA_HORA - PRIMEIRA_HORA + 1 },
  (_, i) => PRIMEIRA_HORA + i,
);

function minutosDesdeOTopo(d: Date): number {
  return (d.getHours() - PRIMEIRA_HORA) * 60 + d.getMinutes();
}

function pixelsDe(minutos: number): number {
  return (minutos / 60) * ALTURA_DA_HORA;
}

function diasDaSemanaDe(ancora: Date): Date[] {
  const inicio = startOfWeek(ancora, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(inicio, i));
}

/**
 * O bloco de um compromisso dentro de um dia.
 *
 * A faixa lateral tem 3px, e não os 2px do card do funil, porque ali a cor diz
 * *estado* (informação secundária, ao lado de um título de duas linhas) e aqui
 * ela diz *de quem é* — que é o que se lê primeiro num bloco de 24px de altura,
 * antes de qualquer texto.
 */
function BlocoDeCompromisso({
  compromisso,
  pessoa,
  onAbrir,
}: {
  compromisso: Compromisso;
  pessoa: Pessoa | undefined;
  onAbrir?: (id: string) => void;
}) {
  const comeca = new Date(compromisso.comeca);
  const termina = new Date(compromisso.termina);
  const duracao = Math.max(differenceInMinutes(termina, comeca), 15);
  const trilha = pessoa?.trilha ?? 1;
  const doGoogle = compromisso.origem === "google";
  const cancelado = compromisso.situacao === "cancelado";

  return (
    <button
      type="button"
      data-testid={`compromisso-${compromisso.id}`}
      data-origem={compromisso.origem}
      data-trilha={trilha}
      data-situacao={compromisso.situacao}
      // Ocupação do Google não abre: não há o que editar deste lado. Deixar o
      // clique disponível prometeria uma ação que não existe — o defeito do
      // "controle decorativo" que esta base já pagou uma vez.
      disabled={doGoogle}
      onClick={doGoogle ? undefined : () => onAbrir?.(compromisso.id)}
      aria-label={`${compromisso.titulo}, ${format(comeca, "HH:mm")} às ${format(termina, "HH:mm")}${
        pessoa ? `, com ${pessoa.nome}` : ""
      }${doGoogle ? ", ocupado na agenda do Google" : ""}`}
      className={cn(
        "absolute left-0.5 right-0.5 flex flex-col items-start overflow-hidden rounded-sm px-1.5 py-0.5 text-left",
        "border border-border/60 transition-colors duration-fast ease-out",
        doGoogle ? "cursor-default" : "cursor-pointer hover:border-border-strong",
        cancelado && "opacity-55",
      )}
      style={{
        top: pixelsDe(minutosDesdeOTopo(comeca)),
        height: Math.max(pixelsDe(duracao) - 2, 18),
        background: doGoogle
          ? // Hachura: diz "ocupado" sem fingir que é um compromisso nosso. A cor
            // é neutra de propósito — a agenda de fora não pertence a ninguém da
            // equipe, então não recebe trilha.
            "repeating-linear-gradient(135deg, var(--color-surface-elevated) 0 6px, var(--color-surface) 6px 12px)"
          : fundoDaTrilha(trilha),
        opacity: doGoogle ? 0.75 : undefined,
      }}
    >
      <span
        aria-hidden
        data-testid={`faixa-${compromisso.id}`}
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-sm"
        style={{ backgroundColor: doGoogle ? "var(--color-border-strong)" : corDaTrilha(trilha) }}
      />
      <span className="ml-1 truncate text-[11px] font-semibold leading-4 text-text">
        {compromisso.titulo}
      </span>
      {duracao >= 45 && (
        <span className="ml-1 truncate text-[10px] leading-3 tabular-nums text-text-muted">
          {format(comeca, "HH:mm")}
          {compromisso.quemSeraAtendido ? ` · ${compromisso.quemSeraAtendido}` : ""}
        </span>
      )}
    </button>
  );
}

/** A régua do agora — a linha que faz a tela parecer viva em vez de impressa. */
function ReguaDoAgora({ agora }: { agora: Date }) {
  const minutos = minutosDesdeOTopo(agora);
  if (minutos < 0 || minutos > (ULTIMA_HORA - PRIMEIRA_HORA + 1) * 60) return null;
  return (
    <div
      data-testid="regua-do-agora"
      aria-hidden
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top: pixelsDe(minutos) }}
    >
      {/* Vermelho, e não a accent: a accent é trocável pelo revendedor e além
          disso é a cor de "nosso", não de "agora". Vermelho para a linha do
          instante é convenção de calendário há vinte anos — aqui no tom terroso
          do produto (`--color-error`), não no vermelho puro que a doutrina bane. */}
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-error" />
      <span className="h-px flex-1 bg-error" />
    </div>
  );
}

function ColunaDeHoras() {
  return (
    <div className="w-12 shrink-0 select-none border-r border-border" aria-hidden>
      <div className="h-8 border-b border-border" />
      {HORAS.map((h) => (
        <div
          key={h}
          className="relative border-b border-border/50 text-right"
          style={{ height: ALTURA_DA_HORA }}
        >
          <span className="absolute -top-1.5 right-1 text-[10px] tabular-nums text-text-subtle">
            {String(h).padStart(2, "0")}h
          </span>
        </div>
      ))}
    </div>
  );
}

function ColunaDeDia({
  dia,
  agora,
  compromissos,
  pessoas,
  onAbrir,
  destacado,
}: {
  dia: Date;
  agora: Date;
  compromissos: Compromisso[];
  pessoas: Pessoa[];
  onAbrir?: (id: string) => void;
  destacado: boolean;
}) {
  const doDia = compromissos.filter((c) => isSameDay(new Date(c.comeca), dia));
  const ehHoje = isSameDay(dia, agora);

  return (
    <div
      data-testid={`coluna-dia-${format(dia, "yyyy-MM-dd")}`}
      className={cn(
        "relative min-w-0 flex-1 border-r border-border last:border-r-0",
        destacado && "bg-surface-elevated/40",
      )}
    >
      <div
        className={cn(
          "sticky top-0 z-20 flex h-8 items-center justify-center gap-1.5 border-b border-border bg-surface px-2",
        )}
      >
        <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-text-muted">
          {format(dia, "EEE", { locale: ptBR }).replace(".", "")}
        </span>
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums",
            ehHoje ? "bg-accent text-accent-fg font-semibold" : "text-text",
          )}
        >
          {format(dia, "d")}
        </span>
      </div>

      <div className="relative" style={{ height: HORAS.length * ALTURA_DA_HORA }}>
        {HORAS.map((h) => (
          <div
            key={h}
            className="border-b border-border/50"
            style={{ height: ALTURA_DA_HORA }}
          />
        ))}
        {doDia.map((c) => (
          <BlocoDeCompromisso
            key={c.id}
            compromisso={c}
            pessoa={pessoas.find((p) => p.id === c.responsavelId)}
            onAbrir={onAbrir}
          />
        ))}
        {ehHoje && <ReguaDoAgora agora={agora} />}
      </div>
    </div>
  );
}

function VisaoDeMes({
  ancora,
  agora,
  compromissos,
  pessoas,
}: {
  ancora: Date;
  agora: Date;
  compromissos: Compromisso[];
  pessoas: Pessoa[];
}) {
  const primeiro = startOfWeek(startOfMonth(ancora), { weekStartsOn: 0 });
  // SEIS semanas sempre, mesmo quando o mês cabe em cinco.
  //
  // Um mês que ocupa 5 linhas e outro que ocupa 6 fariam a célula mudar de
  // altura ao virar o mês — a grade "pula" e quem estava olhando um dia perde
  // a referência. O custo é uma linha de dias do mês seguinte, que já nasce
  // esmaecida.
  const semanas: Date[][] = Array.from({ length: 6 }, (_, s) =>
    Array.from({ length: 7 }, (_, d) => addDays(primeiro, s * 7 + d)),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {semanas[0]?.map((d) => (
          <div
            key={`cab-${d.toISOString()}`}
            className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
          >
            {format(d, "EEEEEE", { locale: ptBR }).replace(".", "")}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
        {semanas.flat().map((d) => {
          const doDia = compromissos.filter((c) => isSameDay(new Date(c.comeca), d));
          const doMes = isSameMonth(d, ancora);
          return (
            <div
              key={d.toISOString()}
              data-testid={`celula-mes-${format(d, "yyyy-MM-dd")}`}
              className={cn(
                "min-h-20 border-b border-r border-border p-1",
                !doMes && "bg-surface-elevated/30",
              )}
            >
              <div className="mb-1 flex items-center justify-between px-0.5">
                <span
                  className={cn(
                    "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums",
                    isSameDay(d, agora)
                      ? "bg-accent font-semibold text-accent-fg"
                      : doMes
                        ? "text-text"
                        : "text-text-subtle",
                  )}
                >
                  {format(d, "d")}
                </span>
                {doDia.length > 2 && (
                  <span className="text-[10px] tabular-nums text-text-subtle">
                    +{doDia.length - 2}
                  </span>
                )}
              </div>
              <div className="space-y-0.5">
                {doDia.slice(0, 2).map((c) => {
                  const trilha = pessoas.find((p) => p.id === c.responsavelId)?.trilha ?? 1;
                  return (
                    <div
                      key={c.id}
                      data-testid={`chip-mes-${c.id}`}
                      className="flex items-center gap-1 rounded-sm px-1 py-0.5"
                      style={{ background: fundoDaTrilha(trilha, 14) }}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: corDaTrilha(trilha) }}
                      />
                      <span className="truncate text-[10px] leading-4 text-text">
                        {format(new Date(c.comeca), "HH:mm")} {c.titulo}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GradeDaAgenda({
  visao,
  ancora,
  agora,
  pessoas,
  compromissos,
  onAbrirCompromisso,
  className,
}: {
  visao: VisaoDaAgenda;
  /** O período que a grade mostra. */
  ancora: Date;
  /**
   * O instante do "agora" — INJETADO, nunca `new Date()` aqui dentro.
   *
   * Um relógio lido dentro do componente daria à vitrine e ao teste dois
   * relógios diferentes, e a asserção sobre a posição da régua passaria a
   * depender do minuto em que a suíte rodou.
   */
  agora: Date;
  pessoas: Pessoa[];
  compromissos: Compromisso[];
  onAbrirCompromisso?: (id: string) => void;
  className?: string;
}) {
  const dias = visao === "dia" ? [ancora] : diasDaSemanaDe(ancora);

  return (
    <div
      data-testid="grade-da-agenda"
      data-visao={visao}
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-surface",
        className,
      )}
    >
      {visao === "mes" ? (
        <VisaoDeMes ancora={ancora} agora={agora} compromissos={compromissos} pessoas={pessoas} />
      ) : (
        // A rolagem mora AQUI dentro, e não na página: `html, body` têm
        // `overflow-x: hidden` no globals.css, então uma grade que estourasse a
        // largura simplesmente sumiria pela direita, sem barra para trazê-la de volta.
        <div className="flex min-h-0 flex-1 overflow-auto">
          <ColunaDeHoras />
          <div className="flex min-w-0 flex-1">
            {dias.map((d) => (
              <ColunaDeDia
                key={d.toISOString()}
                dia={d}
                agora={agora}
                compromissos={compromissos}
                pessoas={pessoas}
                onAbrir={onAbrirCompromisso}
                destacado={visao === "semana" && isSameDay(d, agora)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export const ALTURA_DA_HORA_PX = ALTURA_DA_HORA;
export const JANELA_DA_GRADE = { primeira: PRIMEIRA_HORA, ultima: ULTIMA_HORA };
