"use client";
/**
 * O painel do papel SEGURANÇA (spec 16 §3.3 e §6) — o terceiro papel, que existia
 * no motor e não existia na tela.
 *
 * ═══ O DEFEITO QUE ISTO FECHA ═══
 *
 * A cadeia de dez conferências roda desde sempre e é boa: veto instrutivo, trace
 * por linha, custo zero nas determinísticas. Mas o dono do negócio **não sabia
 * que ela existia**. A própria spec 16 §3.3 escreveu que o que faltava ao
 * terceiro papel era *superfície* — e o épico foi entregue com dois papéis na
 * tela e o terceiro como um `<details>` que só aparece depois de rodar um teste.
 *
 * Mecanismo invisível que funciona é pior do que não existir: quando barra, a
 * pessoa não sabe o que barrou; quando falha, falha sem culpado. É o anti-exemplo
 * literal do invariante 6 da doutrina.
 *
 * ═══ POR QUE NÃO HÁ NENHUM INTERRUPTOR AQUI ═══
 *
 * Nove das dez não se desligam, e isso é decisão de produto, não rigidez: um
 * botão que queima o número do cliente, ou que escreve para quem pediu para
 * parar, não é preferência — é sabotagem do negócio dele, e **oferecer** o
 * controle já ensina que é opcional. Onde não há escolha, a tela diz por quê em
 * uma linha; onde há (as duas que custam uma consulta ao modelo), ela diz o custo
 * e de onde a decisão vem hoje.
 *
 * As duas configuráveis ainda são decididas no servidor. A tela DIZ isso, em vez
 * de mostrar um interruptor que ela grava e o motor ignora — que é exatamente o
 * defeito de "tela oferece o que o código ignora". Quando o motor passar a ler a
 * escolha por organização, o interruptor entra aqui; até lá, controle decorativo
 * é pior que controle ausente.
 */
import * as React from "react";

import { Card } from "@/components/ui/card";

import {
  CONFERENCIAS_DE_SAIDA,
  CONFERENCIA_DE_ENTRADA,
  type ConferenciaDeSaida,
} from "@/lib/ai/guardrails/lista-de-conferencia";

function Conferencia({ c, ordem }: { c: ConferenciaDeSaida; ordem: number | null }) {
  return (
    <li data-testid={`conferencia-${c.nome}`} className="flex gap-3 py-3">
      <span
        aria-hidden
        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
      >
        {ordem ?? "•"}
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">{c.rotulo}</p>
        <p className="text-xs text-muted-foreground">{c.oQueProtege}</p>
        {c.escolha === null ? (
          <p data-testid={`conferencia-${c.nome}-fixa`} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Isto não se desliga.</span>{" "}
            {c.porQueNaoSeDesliga}
          </p>
        ) : (
          <p data-testid={`conferencia-${c.nome}-escolha`} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Ligada</span> — a escolha vem da
            configuração do servidor. Custa {c.escolha.custo}. O modelo usado se escolhe em{" "}
            <a className="underline underline-offset-2" href="/app/ai/providers">
              Provedores de IA
            </a>
            .
          </p>
        )}
      </div>
    </li>
  );
}

export function PainelDeSeguranca() {
  return (
    <div className="space-y-4" data-testid="painel-de-seguranca">
      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-medium">Antes de cada mensagem sair</h3>
        <p className="text-xs text-muted-foreground">
          O assistente escreve, e o sistema confere. São {CONFERENCIAS_DE_SAIDA.length} verificações,
          nesta ordem — a primeira que barra interrompe as seguintes, e o assistente recebe de volta
          o motivo para reescrever.
        </p>
        <ul className="divide-y">
          {CONFERENCIAS_DE_SAIDA.map((c, i) => (
            <Conferencia key={c.nome} c={c} ordem={i + 1} />
          ))}
        </ul>
      </Card>

      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-medium">Antes de o assistente ler</h3>
        <p className="text-xs text-muted-foreground">
          Esta roda sobre a mensagem que chega, antes das outras — por isso aparece separada.
        </p>
        <ul className="divide-y">
          <Conferencia c={CONFERENCIA_DE_ENTRADA} ordem={null} />
        </ul>
      </Card>
    </div>
  );
}
