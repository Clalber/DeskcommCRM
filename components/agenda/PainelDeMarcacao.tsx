"use client";

import { addDays, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { CaretLeft, CaretRight, CheckCircle, Clock, MapPin, Warning } from "@/lib/ui/icons";
import { cn } from "@/lib/utils";

import { AvatarDaPessoa } from "./AvatarDaPessoa";
import type { HorarioLivre, Pessoa } from "./tipos";

/**
 * O painel de marcar — os três tempos.
 *
 * A máquina é a mesma do Booker do cal.com (`selecting_date` → `selecting_time`
 * → `booking`), e o motivo de copiá-la é medido, não estético: escolher dia e
 * escolher horário são decisões de granularidade diferente, e mostrar as duas
 * juntas de saída faz o olho ter de escolher onde começar. O que NÃO se copia é
 * o pixel — a tela é deste produto.
 *
 * O truque que dá a sensação de fluidez está no CSS (`.agenda-coluna-horarios`
 * no globals.css): a coluna de horários tem largura zero até haver um dia
 * escolhido, e então entra pela direita enquanto o painel cresce.
 */
export type TempoDaMarcacao = "escolhendo-dia" | "escolhendo-horario" | "confirmando" | "marcado";

export function PainelDeMarcacao({
  ancora,
  agora,
  responsavel,
  tipo = "Consulta",
  duracaoMin = 30,
  local = "Presencial · Sala 2",
  fuso = "America/Sao_Paulo",
  horariosPorDia,
  quemSeraAtendido,
  onConfirmar,
  className,
}: {
  ancora: Date;
  agora: Date;
  responsavel: Pessoa;
  tipo?: string;
  duracaoMin?: number;
  local?: string;
  fuso?: string;
  /** `yyyy-MM-dd` → horários livres. Dia ausente = sem horário, nasce apagado. */
  horariosPorDia: Record<string, HorarioLivre[]>;
  /**
   * Quem vai ser atendido, e se ele aceita receber mensagem.
   *
   * `aceitaMensagem: false` NÃO impede marcar — opt-out é vontade sobre o
   * canal, e marcar consulta não é consentir em receber mensagem (decisão 10 da
   * entrega). O que ele impede é o LEMBRETE, e é justamente por isso que a tela
   * tem de dizer isso aqui, antes de confirmar: o produto não mandar é uma
   * decisão; o produto não avisar que não ia mandar é um bug.
   */
  quemSeraAtendido?: { nome: string; aceitaMensagem: boolean };
  onConfirmar?: (instante: string) => void;
  className?: string;
}) {
  const [dia, setDia] = React.useState<Date | null>(null);
  const [horario, setHorario] = React.useState<HorarioLivre | null>(null);
  const [marcado, setMarcado] = React.useState<HorarioLivre | null>(null);
  const [mes, setMes] = React.useState(() => startOfMonth(ancora));

  const tempo: TempoDaMarcacao = marcado
    ? "marcado"
    : horario
      ? "confirmando"
      : dia
        ? "escolhendo-horario"
        : "escolhendo-dia";

  const semanas = React.useMemo(() => {
    const primeiro = startOfWeek(startOfMonth(mes), { weekStartsOn: 0 });
    return Array.from({ length: 6 }, (_, s) =>
      Array.from({ length: 7 }, (_, d) => addDays(primeiro, s * 7 + d)),
    );
  }, [mes]);

  const doDia = dia ? (horariosPorDia[format(dia, "yyyy-MM-dd")] ?? []) : [];

  if (tempo === "marcado" && marcado) {
    return (
      <div
        data-testid="painel-de-marcacao"
        data-tempo="marcado"
        className={cn("rounded-lg border border-border bg-surface p-6", className)}
      >
        <div className="flex flex-col items-center text-center">
          <CheckCircle size={32} weight="duotone" className="text-success" aria-hidden />
          {/* "Marcado." — ponto final. Exclamação em sucesso é anti-pattern
              declarado do design system deste produto, e emoji em UI funcional
              também. */}
          <h3 className="mt-3 text-base font-semibold">Marcado.</h3>
          <p className="mt-1 text-sm text-text-muted">
            {format(new Date(marcado.instante), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
          </p>
          <p className="mt-0.5 text-xs text-text-subtle">
            {tipo} · {duracaoMin} min · com {responsavel.nome}
          </p>
          {quemSeraAtendido && !quemSeraAtendido.aceitaMensagem && (
            // Repetido aqui de propósito: o aviso do passo anterior sumiu da
            // tela junto com o formulário, e quem fecha o painel agora não tem
            // como saber que aquele agendamento não terá lembrete.
            <p data-testid="aviso-sem-lembrete-no-resumo" className="mt-2 text-xs text-warning">
              Sem lembrete automático — {quemSeraAtendido.nome} pediu para não receber mensagens.
            </p>
          )}
          <div className="mt-5 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setMarcado(null); setHorario(null); setDia(null); }}>
              Marcar outro
            </Button>
            <Button size="sm" data-testid="ver-na-agenda">Ver na agenda</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="painel-de-marcacao"
      data-tempo={tempo}
      className={cn(
        // `md:w-fit` é o que faz o painel CRESCER quando a coluna entra, em vez de
        // redistribuir o espaço por dentro. Medido: esticado à largura do
        // container ele ficava em 1104px nos dois estados, e a coluna só
        // aparecia às custas do corpo encolher — o mini-calendário diminuía na
        // frente de quem tinha acabado de clicar nele, que é o oposto da
        // sensação de "abriu" que a máquina de três tempos existe para dar.
        //
        // No celular continua ocupando tudo: lá não há para onde crescer, e os
        // três tempos empilham.
        "flex min-h-[450px] flex-col overflow-hidden rounded-lg border border-border bg-surface md:w-fit md:flex-row",
        className,
      )}
    >
      {/* CONTEXTO — o que se está marcando. Sem esta coluna o painel vira
          formulário cego: a pessoa escolhe um horário sem lembrar de quê. */}
      <aside
        data-testid="contexto-da-marcacao"
        className="shrink-0 border-b border-border bg-surface-elevated/50 p-4 md:w-[240px] md:border-b-0 md:border-r lg:w-[280px]"
      >
        <div className="flex items-center gap-2">
          <AvatarDaPessoa pessoa={responsavel} tamanho="sm" />
          <span className="truncate text-sm font-semibold">{responsavel.nome}</span>
        </div>
        <h3 className="mt-3 text-base font-semibold leading-tight">{tipo}</h3>
        <dl className="mt-3 space-y-2 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <Clock size={14} aria-hidden />
            <dd className="tabular-nums">{duracaoMin} minutos</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={14} aria-hidden />
            <dd className="truncate">{local}</dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-[11px] leading-4 text-text-subtle">
          Horários no fuso <span className="font-mono">{fuso.replace("_", " ")}</span>.
        </p>
      </aside>

      {/* CORPO — o mês. 420–480px é a faixa medida no cal.com; aqui ela é
          `min-width` e não largura fixa, porque no celular a coluna ocupa tudo. */}
      <div
        data-testid="corpo-da-marcacao"
        className="flex min-w-0 flex-1 flex-col p-4 md:min-w-[420px]"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold first-letter:uppercase">
            {format(mes, "MMMM 'de' yyyy", { locale: ptBR })}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mês anterior"
              data-testid="mes-anterior"
              onClick={() => setMes((m) => startOfMonth(addDays(startOfMonth(m), -1)))}
            >
              <CaretLeft size={16} weight="bold" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Próximo mês"
              data-testid="mes-seguinte"
              onClick={() => setMes((m) => startOfMonth(addDays(startOfMonth(m), 32)))}
            >
              <CaretRight size={16} weight="bold" aria-hidden />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {semanas[0]?.map((d) => (
            <span key={`c-${d.toISOString()}`} className="pb-1 text-[10px] font-semibold uppercase text-text-subtle">
              {format(d, "EEEEEE", { locale: ptBR }).replace(".", "")}
            </span>
          ))}
          {semanas.flat().map((d) => {
            const chave = format(d, "yyyy-MM-dd");
            const livres = horariosPorDia[chave] ?? [];
            // Dia sem horário nasce apagado E não clicável. Oferecer o clique e
            // depois dizer "não tem nada" gasta uma interação para entregar a
            // mesma informação que a cor já dava.
            const disponivel = livres.length > 0 && isSameMonth(d, mes);
            const escolhido = dia !== null && isSameDay(d, dia);
            return (
              <button
                key={chave}
                type="button"
                data-testid={`dia-${chave}`}
                data-disponivel={disponivel}
                disabled={!disponivel}
                aria-label={
                  disponivel
                    ? `${format(d, "d 'de' MMMM", { locale: ptBR })} — ${livres.length} horários`
                    : `${format(d, "d 'de' MMMM", { locale: ptBR })} — sem horário`
                }
                onClick={() => { setDia(d); setHorario(null); }}
                className={cn(
                  "flex h-9 items-center justify-center rounded-sm text-sm tabular-nums transition-colors duration-fast ease-out",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                  !isSameMonth(d, mes) && "text-text-subtle/50",
                  disponivel && !escolhido && "bg-accent-soft text-text hover:bg-accent hover:text-accent-fg",
                  escolhido && "bg-accent font-semibold text-accent-fg",
                  !disponivel && "cursor-default text-text-subtle/60",
                  isSameDay(d, agora) && !escolhido && "ring-1 ring-inset ring-border-strong",
                )}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>

        {tempo === "confirmando" && horario && (
          <div className="mt-4 border-t border-border pt-4" data-testid="confirmacao">
            <p className="text-sm">
              <span className="text-text-muted">Confirmar </span>
              <span className="font-semibold">
                {format(new Date(horario.instante), "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </span>
            </p>

            {quemSeraAtendido && !quemSeraAtendido.aceitaMensagem && (
              // Aviso, não bloqueio: o botão de confirmar continua ativo logo
              // abaixo. E ele diz o que FAZER no lugar ("combine por telefone"),
              // porque uma tela que só informa a restrição deixa a pessoa parada
              // decidindo sozinha o que fazer com a informação.
              <div
                data-testid="aviso-sem-lembrete"
                role="status"
                className="mt-3 flex gap-2 rounded-sm border border-warning/40 bg-warning-bg p-2.5"
              >
                <Warning size={16} weight="fill" className="mt-0.5 shrink-0 text-warning" aria-hidden />
                <p className="text-xs leading-4 text-text">
                  <span className="font-semibold">{quemSeraAtendido.nome} pediu para não receber
                  mensagens.</span>{" "}
                  O lembrete não será enviado — combine por telefone.
                </p>
              </div>
            )}
            <div className="mt-3 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setHorario(null)}>
                Voltar
              </Button>
              <Button
                size="sm"
                data-testid="confirmar-marcacao"
                onClick={() => { setMarcado(horario); onConfirmar?.(horario.instante); }}
              >
                Confirmar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* HORÁRIOS — a coluna que não estava lá. */}
      <div
        data-testid="coluna-de-horarios"
        data-aberta={tempo !== "escolhendo-dia"}
        className="agenda-coluna-horarios shrink-0"
      >
        <div className="flex h-full w-[240px] flex-col p-3 lg:w-[280px]">
          <p className="mb-2 shrink-0 text-xs font-semibold text-text-muted first-letter:uppercase">
            {dia ? format(dia, "EEEE, d 'de' MMM", { locale: ptBR }) : ""}
          </p>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {doDia.map((h) => (
              <button
                key={h.instante}
                type="button"
                data-testid={`horario-${h.rotulo}`}
                onClick={() => setHorario(h)}
                className={cn(
                  // Alvo de toque generoso: quem marca consulta faz isso no
                  // celular, com o cliente esperando na frente.
                  "h-11 shrink-0 rounded-sm border text-sm tabular-nums transition-colors duration-fast ease-out",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                  horario?.instante === h.instante
                    ? "border-accent bg-accent font-semibold text-accent-fg"
                    : "border-border bg-surface text-text hover:border-accent hover:bg-accent-soft",
                )}
              >
                {h.rotulo}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
