"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAtritoMetrics } from "@/hooks/metrics/useAtritoMetrics";
import { formatarMedida, type Medida, type Par } from "@/lib/metrics/atrito";

/**
 * Índice de Atrito (spec 16) — a medida do PROPÓSITO.
 *
 * Desenho imposto pela doutrina §3.3: eficiência e dano ficam no MESMO cartão,
 * lado a lado. Não é preferência estética — separados (abas, seções, telas), a
 * métrica de eficiência vence sempre, porque é a que sobe e a que alguém pede
 * para ver. O tipo `Par` torna impossível renderizar uma eficiência sozinha.
 *
 * Fica ACIMA do funil e da performance por atendente de propósito (§3.6): é o
 * número que pertence ao sistema inteiro, e ao qual as métricas de área se
 * subordinam. Embaixo, viraria rodapé.
 */

function MedidaLinha({ m }: { m: Medida }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-sm">{m.rotulo}</p>
        {m.nota ? <p className="mt-0.5 text-xs text-muted-foreground">{m.nota}</p> : null}
      </div>
      <span className="shrink-0 text-sm font-medium tabular-nums">{formatarMedida(m)}</span>
    </div>
  );
}

function ParCard({ par }: { par: Par }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-normal text-muted-foreground">{par.titulo}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row">
        {/* Eficiência — o que o sistema é empurrado a maximizar. */}
        <div className="sm:w-48 sm:shrink-0">
          <p className="text-2xl font-semibold tabular-nums">{formatarMedida(par.eficiencia)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{par.eficiencia.rotulo}</p>
          {par.eficiencia.nota ? (
            <p className="mt-1 text-xs text-muted-foreground">{par.eficiencia.nota}</p>
          ) : null}
        </div>

        {/* O custo disso. Mesmo cartão, sempre. */}
        <div className="min-w-0 flex-1 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
            O que isso custou
          </p>
          {par.danos.map((d) => (
            <MedidaLinha key={d.chave} m={d} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function AtritoPanel() {
  const { data, isLoading, isError } = useAtritoMetrics();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Carregando o índice de atrito…</p>;
  }
  // Falha aberta na informação: dizer que não carregou é melhor que sumir com a
  // seção — seção ausente lê-se como "não há atrito" (doutrina cap. 4.5).
  if (isError || !data) {
    return <p className="text-sm text-destructive">Erro ao carregar o índice de atrito.</p>;
  }

  const { escopo, pares } = data.data;
  const temMedidaAusente = pares.some(
    (p) => p.eficiencia.valor === null || p.danos.some((d) => d.valor === null),
  );

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-base font-medium">Atrito</h2>
        <p className="text-sm text-muted-foreground">
          O que o resultado custou para os dois lados.{" "}
          {escopo.demandas === 0 ? (
            <>Nenhuma demanda encerrada no período — os números abaixo ainda não têm base.</>
          ) : (
            <>
              Base: {escopo.demandas}{" "}
              {escopo.demandas === 1 ? "demanda encerrada" : "demandas encerradas"} nos últimos 30
              dias, entre as que passaram por atendimento humano.
            </>
          )}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {pares.map((p) => (
          <ParCard key={p.chave} par={p} />
        ))}
      </div>

      {/* A legenda só existe se houver o que legendar. Explicar um símbolo que
          não está na tela é ruído, e ruído compete com o que importava. */}
      {temMedidaAusente ? (
        <p className="text-xs text-muted-foreground">
          &quot;—&quot; significa que não houve dado suficiente para medir, e não que o valor seja zero.
        </p>
      ) : null}
    </section>
  );
}
