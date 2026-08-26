"use client";

import { format, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AvatarDaPessoa } from "./AvatarDaPessoa";
import { corDaTrilha } from "./paleta";
import type { Agendamento, Pessoa, SituacaoDoAgendamento } from "./tipos";

/**
 * As quatro divisões do histórico.
 *
 * São as do cal.com em pt-br, e a ordem não é alfabética nem cronológica: é a
 * ordem em que quem atende PRECISA delas. "Próximos" primeiro porque é o que se
 * abre de manhã; "Aguardando confirmação" segundo porque é o que exige ação
 * hoje; passados e cancelados são consulta.
 */
const ABAS = [
  { id: "proximos", rotulo: "Próximos" },
  { id: "aguardando", rotulo: "Aguardando confirmação" },
  { id: "passados", rotulo: "Passados" },
  { id: "cancelados", rotulo: "Cancelados" },
] as const;

export type AbaDoHistorico = (typeof ABAS)[number]["id"];

/**
 * O rótulo de cada situação, na língua de quem usa.
 *
 * "Booking ACCEPTED" e "no-show" não aparecem: o produto renomeia termo técnico
 * na cara do usuário, e quem lê isto é dona de clínica, não engenheira.
 */
const SITUACAO: Record<SituacaoDoAgendamento, { rotulo: string; variante: "default" | "neutral" | "success" | "warning" | "error" }> = {
  confirmado: { rotulo: "Confirmado", variante: "default" },
  aguardando: { rotulo: "Aguardando confirmação", variante: "warning" },
  cancelado: { rotulo: "Cancelado", variante: "neutral" },
  realizado: { rotulo: "Realizado", variante: "success" },
  faltou: { rotulo: "Faltou", variante: "error" },
};

function separar(agendamentos: Agendamento[], agora: Date): Record<AbaDoHistorico, Agendamento[]> {
  const vazio: Record<AbaDoHistorico, Agendamento[]> = {
    proximos: [], aguardando: [], passados: [], cancelados: [],
  };
  for (const a of agendamentos) {
    // Cancelado sai das outras abas SEMPRE, mesmo sendo futuro: quem abre
    // "Próximos" está perguntando o que vai acontecer, e um cancelado ali seria
    // uma resposta errada com cara de certa.
    if (a.situacao === "cancelado") { vazio.cancelados.push(a); continue; }
    if (a.situacao === "aguardando") { vazio.aguardando.push(a); continue; }
    (isBefore(new Date(a.comeca), agora) ? vazio.passados : vazio.proximos).push(a);
  }
  return vazio;
}

/**
 * Histórico — LISTA, não grade.
 *
 * A grade responde "como está meu dia"; a lista responde "o que aconteceu com
 * esta pessoa". São perguntas diferentes, e espremer a segunda numa grade é o
 * que faz produto de agenda virar planilha.
 *
 * ⚠️ Alimentado pelo CHAMADOR. Este componente não busca nada: quando a frente 1
 * expuser a rota, o que muda é quem passa a prop.
 */
export function HistoricoDaAgenda({
  agendamentos,
  pessoas,
  agora,
  onRemarcar,
  onCancelar,
  onRealizado,
  onFaltou,
  className,
}: {
  agendamentos: Agendamento[];
  pessoas: Pessoa[];
  agora: Date;
  onRemarcar?: (id: string) => void;
  onCancelar?: (id: string) => void;
  /**
   * Decisão 17: sem estes dois, `realizado` e `faltou` ficam SEM ESCRITOR.
   * O vocabulário existe no tipo, o banco aceita, e nenhuma tela produz o
   * valor — e o aviso da Central que pede "este atendimento aconteceu?" não
   * tem para onde mandar o clique. Campo sem escritor é o mesmo defeito de
   * evento sem consumidor, visto do outro lado.
   */
  onRealizado?: (id: string) => void;
  onFaltou?: (id: string) => void;
  className?: string;
}) {
  const [aba, setAba] = React.useState<AbaDoHistorico>("proximos");
  const grupos = React.useMemo(() => separar(agendamentos, agora), [agendamentos, agora]);
  const daAba = grupos[aba];

  return (
    <div data-testid="historico-da-agenda" data-aba={aba} className={cn("flex min-h-0 flex-col", className)}>
      <div
        role="tablist"
        aria-label="Filtrar o histórico"
        className="flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
      >
        {ABAS.map((a) => {
          const n = grupos[a.id].length;
          return (
            <button
              key={a.id}
              role="tab"
              type="button"
              data-testid={`aba-${a.id}`}
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs transition-colors duration-fast ease-out",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500",
                aba === a.id
                  ? "bg-accent font-semibold text-accent-fg"
                  : "text-text-muted hover:bg-surface-elevated hover:text-text",
              )}
            >
              <span>{a.rotulo}</span>
              {/* O contador vem SEMPRE, inclusive zero: "Cancelados 0" responde a
                  pergunta sem gastar um clique, e some-lo faria a aba vazia
                  parecer não carregada. */}
              <span
                data-testid={`contador-${a.id}`}
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  aba === a.id ? "bg-accent-fg/20" : "bg-surface-elevated text-text-subtle",
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-surface">
        {daAba.length === 0 ? (
          <p data-testid="historico-vazio" className="p-8 text-center text-sm text-text-muted">
            {aba === "proximos" && "Nada marcado daqui para a frente."}
            {aba === "aguardando" && "Ninguém esperando confirmação."}
            {aba === "passados" && "Ainda não há atendimentos concluídos."}
            {aba === "cancelados" && "Nenhum cancelamento."}
          </p>
        ) : (
          <ul>
            {daAba.map((a) => {
              const pessoa = pessoas.find((p) => p.id === a.responsavelId);
              const situacao = SITUACAO[a.situacao];
              const comeca = new Date(a.comeca);
              return (
                <li
                  key={a.id}
                  data-testid={`linha-${a.id}`}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0"
                >
                  <span
                    aria-hidden
                    className="h-8 w-[3px] shrink-0 rounded-full"
                    style={{ backgroundColor: corDaTrilha(pessoa?.trilha ?? 1) }}
                  />
                  <div className="w-28 shrink-0">
                    <div className="text-sm font-medium tabular-nums first-letter:uppercase">
                      {format(comeca, "d 'de' MMM", { locale: ptBR })}
                    </div>
                    <div className="text-[11px] tabular-nums text-text-muted">
                      {format(comeca, "HH:mm")}
                      {" – "}
                      {format(new Date(a.termina), "HH:mm")}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{a.quemSeraAtendido ?? a.titulo}</div>
                    <div className="truncate text-[11px] text-text-muted">
                      {a.tipo ?? "Agendamento"}
                      {pessoa ? ` · com ${pessoa.nome}` : ""}
                    </div>
                  </div>
                  {pessoa && <AvatarDaPessoa pessoa={pessoa} tamanho="sm" />}
                  <Badge variant={situacao.variante} className="shrink-0">
                    {situacao.rotulo}
                  </Badge>
                  <div className="flex shrink-0 items-center gap-1">
                    {/*
                      Ação por aba, e a lista de CADA aba tem razão própria.
                      A primeira versão disto oferecia ação só em "próximos" e
                      "aguardando", com o argumento de que remarcar o que já
                      passou é ação sem sentido. O argumento vale para REMARCAR
                      e eu o generalizei para todas — errado: o passado tem as
                      duas ações mais importantes do histórico.
                    */}
                    {(aba === "proximos" || aba === "aguardando") && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`remarcar-${a.id}`}
                          disabled={!onRemarcar}
                          title={onRemarcar ? undefined : "Disponível quando a agenda estiver conectada"}
                          onClick={() => onRemarcar?.(a.id)}
                        >
                          Remarcar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`cancelar-${a.id}`}
                          disabled={!onCancelar}
                          title={onCancelar ? undefined : "Disponível quando a agenda estiver conectada"}
                          onClick={() => onCancelar?.(a.id)}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    {aba === "passados" && a.situacao !== "realizado" && a.situacao !== "faltou" && (
                      // Decisão 17. Só enquanto o desfecho NÃO foi registrado:
                      // oferecer "Realizado" num que já está realizado seria
                      // pedir de novo o que a pessoa já respondeu.
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`realizado-${a.id}`}
                          disabled={!onRealizado}
                          title={onRealizado ? undefined : "Disponível quando a agenda estiver conectada"}
                          onClick={() => onRealizado?.(a.id)}
                        >
                          Realizado
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`faltou-${a.id}`}
                          disabled={!onFaltou}
                          title={onFaltou ? undefined : "Disponível quando a agenda estiver conectada"}
                          onClick={() => onFaltou?.(a.id)}
                        >
                          Faltou
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
