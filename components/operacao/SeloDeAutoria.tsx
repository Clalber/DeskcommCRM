"use client";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Robot, Users } from "@/lib/ui/icons";
import { autorNaTela, mudadoPorAgente } from "@/lib/operacao/autoria";
import { cn } from "@/lib/utils";

/**
 * Quem mexeu nesta configuração por último — ao lado do estado que ele mudou.
 *
 * ⚠️ EXISTE PORQUE O ESTADO SOZINHO PAROU DE RESPONDER A PERGUNTA CERTA. Enquanto
 * só uma pessoa `manager+` podia ligar uma regra automática, quem olhava a tela
 * era, por construção, quem tinha ligado. Com o assistente ligando regra que roda
 * sozinha, "Ativa" deixou de dizer o suficiente: falta **fui eu ou foi ele?**
 * (doutrina do sistema vivo, invariante 3 — o log existe no `api_audit_log` e
 * nenhuma tela de configuração o lê, então é log morto).
 *
 * ⚠️ O PESO VISUAL É DIFERENTE DE PROPÓSITO, e não é enfeite. Mudança feita por
 * gente é confirmação do que a pessoa acabou de fazer: fica discreta. Mudança
 * feita pelo assistente é NOTÍCIA — é o caso em que o usuário pode não saber que
 * aconteceu, e é o único motivo desta peça existir. Tratar os dois com o mesmo
 * cinza jogaria fora a informação que o dado carrega.
 *
 * ⚠️ SILÊNCIO QUANDO NÃO SE SABE. Linha anterior à migration 0101 não tem
 * autoria, e inventar "alterado por você" ali seria afirmar o que ninguém mediu.
 */
export function SeloDeAutoria({
  kind,
  em,
  className,
}: {
  kind: string | null;
  em: string | null;
  className?: string;
}) {
  const texto = autorNaTela(kind);
  if (!texto) return null;

  const doAgente = mudadoPorAgente(kind);
  const Icone = doAgente ? Robot : Users;

  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs",
        doAgente ? "font-medium text-accent" : "text-muted-foreground",
        className,
      )}
      data-autoria={kind ?? "desconhecida"}
    >
      <Icone className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {texto}
        {em ? ` ${formatDistanceToNowStrict(new Date(em), { addSuffix: true, locale: ptBR })}` : ""}
      </span>
    </p>
  );
}
