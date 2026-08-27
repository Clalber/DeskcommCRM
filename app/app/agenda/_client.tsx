"use client";

import { addDays, endOfMonth, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import * as React from "react";

import { AvisoDaConexaoGoogle } from "./_components/AvisoDaConexaoGoogle";
import { CartaoDaConexaoGoogle } from "./_components/CartaoDaConexaoGoogle";

import { FiltroDePessoas } from "@/components/agenda/FiltroDePessoas";
import { GradeDaAgenda } from "@/components/agenda/GradeDaAgenda";
import { HistoricoDaAgenda } from "@/components/agenda/HistoricoDaAgenda";
import type { Agendamento, VisaoDaAgenda } from "@/components/agenda/tipos";
import { EmptyAgenda } from "@/components/empty";
import { Button } from "@/components/ui/button";
import { PainelDeMarcacao } from "@/components/agenda/PainelDeMarcacao";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAgendamentos } from "@/hooks/agenda/useAgendamentos";
import { useHorariosLivres } from "@/hooks/agenda/useHorariosLivres";
import { useMarcarAgendamento } from "@/hooks/agenda/useMarcarAgendamento";
import { usePessoasDaAgenda } from "@/hooks/agenda/usePessoasDaAgenda";
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
 * ⚠️ SEM DADO NENHUM até a frente 1 (API + motor) integrar. A tela cai no
 * estado vazio de propósito, e a razão é de SEGURANÇA PERCEBIDA, não de
 * pureza:
 *
 * dado falso PLAUSÍVEL numa tela real de produto multi-tenant é
 * indistinguível de VAZAMENTO. "Ana Prado", "Marina Alves", "Visita ao imóvel"
 * são nomes brasileiros críveis nos nichos que este produto atende — e o
 * relato que chega de quem vê isso não é "tem dado de teste na tela", é
 * "estou vendo paciente de outra clínica na minha agenda". O time então queima
 * horas caçando um furo de RLS que não existe. Achado do QAVivo, decisão 18.
 *
 * Repare na inversão, porque ela é o ponto: os MESMOS nomes são ACERTO na
 * vitrine (`/vitrine-agenda`), onde tornam o desenho julgável, e o pior
 * formato possível aqui. Mesmo dado, valor oposto conforme onde está pendurado.
 *
 * E o vazio é mais VERDADEIRO: numa instalação nova a agenda está vazia mesmo.
 * De quebra exercita o estado vazio, que é onde mora a primeira impressão.
 *
 * `data-fonte` declara isso no DOM para ser verificável de fora — e
 * `tests/unit/telas-sem-dado-de-mentira.test.ts` impede que alguém religue os
 * imports sem querer.
 */
export function AgendaClient({
  fusoDeApresentacao,
  googleConfigurado,
  contaConectada,
  enderecoDeRetorno,
  faltaNoGoogle,
  tiposIniciais,
  agendamentosIniciais,
}: {
  fusoDeApresentacao: string | null;
  googleConfigurado: boolean;
  contaConectada?: string | null;
  enderecoDeRetorno?: string;
  faltaNoGoogle: string[];
  /** Tipos ativos, resolvidos no servidor: não há rota que os liste ainda. */
  tiposIniciais: Array<{ id: string; nome: string; duracaoMin: number; donoId: string | null }>;
  /** A semana corrente, resolvida no servidor: `GET /agendamentos` não existe. */
  agendamentosIniciais: Agendamento[];
}) {
  const [marcando, setMarcando] = React.useState(false);
  const marcar = useMarcarAgendamento();
  // ⚠️ ERA `tiposIniciais[0] ?? null` — uma constante, sem seletor em lugar
  // nenhum. `page.tsx` ordena os tipos por NOME, então a tela marcava sempre o
  // primeiro em ordem alfabética e não havia como marcar outro: numa org com
  // "Atendimento", "Consulta", "Reunião", só "Atendimento" era alcançável pela
  // tela. As categorias existiam no banco, no seed e na API — e a tela oferecia
  // uma. Achado escrevendo a spec de marcar, não lendo o código.
  const [tipoId, setTipoId] = React.useState<string | null>(() => tiposIniciais[0]?.id ?? null);
  const tipo = tiposIniciais.find((t) => t.id === tipoId) ?? tiposIniciais[0] ?? null;
  const [visao, setVisao] = React.useState<VisaoDaAgenda>("semana");
  const [isolada, setIsolada] = React.useState<string | null>(null);
  const [ancora, setAncora] = React.useState(() => new Date());

  // AS PESSOAS SÃO REAIS: vêm de `/api/v1/team`, com a trilha de cor derivada do
  // `user_id`. Até esta linha o filtro por pessoa era invisível na tela do
  // produto — `FiltroDePessoas` devolve `null` com menos de duas pessoas, e a
  // lista estava vazia. Ele existia, estava provado na vitrine, e ninguém o via
  // aqui.
  const { data: pessoas = [] } = usePessoasDaAgenda();

  // A JANELA DE BUSCA PRECISA SER ESTÁVEL, e não era.
  //
  // ⚠️ Isto era `de: new Date().toISOString()` calculado no CORPO do render. A
  // chave do React Query inclui o recorte, e `new Date()` devolve milissegundos
  // diferentes a cada passagem — então cada resposta causava re-render, que
  // gerava chave nova, que disparava outra busca. O painel nunca estabilizava:
  // `horarios` ficava `undefined` entre as idas, `horariosPorDia` nascia vazio e
  // TODO dia aparecia "sem horário" — com a rota respondendo 200 e slots reais.
  //
  // Medido pela spec de marcar, que capturou as respostas: cinco 200 seguidos
  // com vagas, e a tela mostrando 42 dias apagados. Em produção isto é um laço
  // de requisições por usuário com o painel aberto.
  //
  // `useMemo` sem dependência de tempo: a janela é fixada quando o painel abre.
  const janelaDeBusca = React.useMemo(
    () => ({ de: new Date().toISOString(), ate: addDays(new Date(), 30).toISOString() }),
    // A janela só precisa mudar quando o painel REABRE ou o tipo muda — nunca a
    // cada render. `marcando` na lista é o que a renova entre duas aberturas.
    [marcando, tipo?.id],
  );

  // Os horários vêm da rota real — a mesma que a IA usa, então tela e agente
  // oferecem exatamente os mesmos horários. Só consulta quando o painel abre.
  const { data: horarios } = useHorariosLivres(
    marcando && tipo ? { event_type_id: tipo.id, de: janelaDeBusca.de, ate: janelaDeBusca.ate } : null,
  );

  const horariosPorDia = React.useMemo(() => {
    const mapa: Record<string, Array<{ instante: string; rotulo: string }>> = {};
    for (const s of horarios?.slots ?? []) {
      const d = new Date(s.inicio);
      const chave = format(d, "yyyy-MM-dd");
      (mapa[chave] ??= []).push({ instante: s.inicio, rotulo: format(d, "HH:mm") });
    }
    return mapa;
  }, [horarios]);

  // OS AGENDAMENTOS SÃO REAIS, e agora TAMBÉM se atualizam sem recarregar.
  //
  // ⚠️ O comentário que estava aqui dizia que `GET /api/v1/agenda/agendamentos`
  // "ainda não existe (a rota tem POST, PATCH e DELETE)". Era verdade quando foi
  // escrito e VENCEU: `grep -n "^export async function" app/api/v1/agenda/agendamentos/route.ts`
  // devolve GET:95. A prosa descrevia um estado, o estado mudou, e a frase ficou
  // — junto com o `useAgendamentos`, que existia inteiro e não era montado por
  // ninguém (1 ocorrência no repo: a própria definição).
  //
  // A prop do RSC segue sendo a PRIMEIRA pintura (sem piscar, sem spinner) e o
  // hook assume dali: `useMarcarAgendamento` já invalida `["agenda"]`, então
  // marcar pela tela repinta a grade sozinho.
  // O recorte acompanha o que a grade DESENHA — mesma visão, mesma âncora.
  // Instante ISO, nunca o filtro `dia`: o cabeçalho do hook mede por que
  // (`dia=` corta em UTC e some com o compromisso das 22h no fuso de São Paulo).
  const recorteDaGrade = React.useMemo(() => {
    const inicio =
      visao === "mes"
        ? startOfMonth(ancora)
        : visao === "semana"
          ? startOfWeek(ancora, { weekStartsOn: 0 })
          : startOfDay(ancora);
    const fim =
      visao === "mes" ? addDays(endOfMonth(ancora), 1) : addDays(inicio, visao === "semana" ? 7 : 1);
    return { de: inicio.toISOString(), ate: fim.toISOString() };
  }, [visao, ancora]);

  // A janela que o SERVIDOR pintou. Sem esta comparação, navegar para outra
  // semana mostraria os compromissos DESTA por um instante — o fallback estaria
  // respondendo a uma pergunta que ninguém fez. Cair para lista vazia é pior de
  // aparência e melhor de verdade: a grade fica vazia por um piscar, em vez de
  // mostrar compromisso no dia errado.
  const recorteDoServidor = React.useRef(recorteDaGrade).current;
  const naJanelaDoServidor =
    recorteDaGrade.de === recorteDoServidor.de && recorteDaGrade.ate === recorteDoServidor.ate;

  const { data: agendamentosVivos } = useAgendamentos(recorteDaGrade);
  const todos: Agendamento[] =
    agendamentosVivos ?? (naJanelaDoServidor ? agendamentosIniciais : []);

  const agendamentos = React.useMemo(
    () => (isolada === null ? todos : todos.filter((a) => a.responsavelId === isolada)),
    [isolada, todos],
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
      data-fonte={agendamentosIniciais.length > 0 ? "api" : "api-sem-dado"}
      data-fuso={fusoDeApresentacao ?? "organizacao"}
      className="flex h-full flex-col gap-4 p-6"
    >
      {/*
        Em Suspense porque `useSearchParams` obriga: sem a fronteira, o Next
        reprova o build da rota. Fallback nulo porque a ausência do aviso é o
        estado normal — quem chega pela navegação não tem query nenhuma.
      */}
      <React.Suspense fallback={null}>
        <AvisoDaConexaoGoogle />
      </React.Suspense>

      <CartaoDaConexaoGoogle
        configurado={googleConfigurado}
        falta={faltaNoGoogle}
        contaConectada={contaConectada}
        enderecoDeRetorno={enderecoDeRetorno}
      />

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
          {/*
            DESABILITADO COM O MOTIVO À VISTA, e não ligado a um `onClick` vazio.
            Enquanto a frente 1 não expõe `/api/v1/agenda` não há o que marcar, e
            um botão primário, com cor de ação e sem `disabled`, que não faz nada
            ao clique é pior do que não existir: quem clica conclui que o produto
            está quebrado e não tem o que reportar além de "não abre". É o
            anti-pattern de controle decorativo, e esta base já pagou por ele.

            O motivo vai em texto ao lado, não só no `title`: atributo de
            hover não existe para quem usa toque, que é o dono de clínica no
            celular.
          */}
          {!tipo && (
            // Sem NENHUM tipo de agendamento cadastrado não há o que marcar — e
            // isto é diferente de "a API não existe": a ação faz sentido, falta
            // configuração. Por isso o motivo à vista, e não um botão mudo.
            <span
              data-testid="motivo-novo-agendamento"
              className="hidden text-xs text-text-subtle sm:inline"
            >
              Cadastre um tipo de agendamento para começar
            </span>
          )}
          <Button
            size="sm"
            disabled={!tipo}
            title={tipo ? undefined : "Cadastre um tipo de agendamento para começar"}
            onClick={() => setMarcando(true)}
          >
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
          {/*
            `first-letter:uppercase` e NÃO `capitalize`: o `capitalize` do CSS
            maiúscula toda palavra, e o date-fns em pt-br devolve "23 de ago" —
            virava "23 De Ago". Preposição com maiúscula é o detalhe que faz o
            produto parecer traduzido em vez de escrito, e fica na primeira
            linha abaixo do título.
          */}
          <span
            data-testid="periodo"
            className="truncate text-sm font-semibold first-letter:uppercase"
          >
            {periodo}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <FiltroDePessoas pessoas={pessoas} isolada={isolada} onIsolar={setIsolada} />
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

      {/*
        O HISTÓRICO na tela do produto, e não só na vitrine. Ele aparece mesmo
        sem dado: as quatro abas com contador zero respondem "não há nada" sem
        gastar um clique, e some-lo faria a tela parecer menor do que é.
      */}
      <Sheet open={marcando} onOpenChange={setMarcando}>
        <SheetContent side="right" className="w-full sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>Novo agendamento</SheetTitle>
          </SheetHeader>
          {tiposIniciais.length > 1 && (
            <div className="mt-4" data-testid="tipos-de-agendamento">
              <p className="mb-2 text-xs font-medium text-text-muted">Tipo de agendamento</p>
              <div className="flex flex-wrap gap-1.5">
                {tiposIniciais.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    data-testid={`tipo-${t.id}`}
                    aria-pressed={t.id === tipo?.id}
                    onClick={() => setTipoId(t.id)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs transition-colors duration-fast",
                      t.id === tipo?.id
                        ? "border-transparent bg-accent text-accent-foreground"
                        : "border-border text-text-muted hover:border-border-strong hover:text-text",
                    )}
                  >
                    {t.nome}
                    <span className="ml-1 opacity-70 tabular-nums">{t.duracaoMin}min</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {tipo && (
            <div className="mt-4">
              <PainelDeMarcacao
                ancora={new Date()}
                agora={new Date()}
                responsavel={
                  // O DONO DO TIPO, não o primeiro da lista. A tela dizia "com
                  // <primeira pessoa>" enquanto oferecia a jornada de outra —
                  // e marcava na agenda da primeira, que não tinha jornada.
                  pessoas.find((p) => p.id === tipo.donoId) ??
                  pessoas[0] ?? { id: "", nome: "Você", trilha: 1 }
                }
                tipo={tipo.nome}
                duracaoMin={tipo.duracaoMin}
                horariosPorDia={horariosPorDia}
                publicouHorarios={horarios?.publicou_horarios ?? true}
                fusoSuposto={horarios?.fuso_suposto ?? false}
                fontesDefasadas={horarios?.fontes_defasadas}
                // ESTE é o fio que faltava. Sem ele o "Marcado ✓" era estado
                // local do React e nenhuma linha nascia no banco.
                onConfirmar={(instante) => {
                  // ⚠️ SEM `owner_user_id`, e é isto que conserta o 422.
                  //
                  // Isto mandava `pessoas[0]?.id` — a PRIMEIRA pessoa da lista.
                  // Os horários oferecidos vêm de `useHorariosLivres`, que NÃO
                  // manda dono, então a rota resolve `tipo.default_owner_user_id`.
                  // A tela oferecia a agenda de um e marcava na de outro: medido
                  // nesta org, 5 pessoas e só o dono do tipo com jornada, e o POST
                  // devolvia `agenda_disponibilidade_invalida` ("expected object,
                  // received undefined") enquanto a tela dizia "Marcado ✓".
                  //
                  // Omitir é o que faz oferta e marcação resolverem o dono pela
                  // MESMA regra (`_handler.ts:96`), por construção e não por sorte.
                  return marcar.mutateAsync({ event_type_id: tipo.id, starts_at: instante });
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <HistoricoDaAgenda
        agendamentos={agendamentos}
        pessoas={pessoas}
        agora={new Date()}
        className="max-h-[320px]"
      />

      {agendamentos.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-border bg-surface">
          <EmptyAgenda />
        </div>
      ) : (
        <GradeDaAgenda
          visao={visao}
          ancora={ancora}
          agora={new Date()}
          pessoas={pessoas}
          agendamentos={agendamentos}
          className="min-h-0 flex-1"
        />
      )}
    </div>
  );
}
