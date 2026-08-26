"use client";

import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/lib/ui/icons";

/**
 * O cartão da agenda conectada — e o caso que importa é o de quem NÃO tem.
 *
 * `GOOGLE_CALENDAR_CLIENT_ID` e `_SECRET` são opcionais (decisão 3.1), então
 * **100% das instalações novas** chegam aqui sem elas. Isso não é borda: é a
 * primeira tela que todo self-hoster vê.
 *
 * Nesse estado o botão NÃO aparece. E não é o mesmo que aparecer desabilitado:
 *
 *   indisponível  (falta o meio, vai ter)      -> existe, disabled, diz o motivo
 *   sem sentido   (não se aplica aqui)         -> não existe
 *   NÃO INSTALADO (a instalação não tem isso)  -> não existe, E a tela explica
 *
 * A terceira é esta, e ela é diferente das outras duas porque quem lê PODE
 * agir — falta uma chave, e há um lugar onde se põe. Botão desabilitado aqui
 * diria "você não pode", quando o certo é "esta instalação ainda não tem".
 */
export function CartaoDaConexaoGoogle({
  configurado,
  falta,
  contaConectada,
}: {
  configurado: boolean;
  /** O que falta, PELO NOME — para a tela dizer em vez de só esconder o botão. */
  falta: string[];
  contaConectada?: string | null;
}) {
  if (!configurado) {
    return (
      <div
        data-testid="google-nao-configurado"
        className="rounded-lg border border-border bg-surface-elevated/50 p-3"
      >
        <p className="text-sm font-medium text-text">Sincronizar com o Google ainda não está disponível</p>
        <p className="mt-1 text-xs leading-4 text-text-muted">
          Esta instalação não tem as credenciais do Google cadastradas — não é nada que você
          tenha feito. Quem instalou o sistema precisa configurar
          {falta.length > 0 ? (
            <>
              {" "}
              <span data-testid="o-que-falta" className="font-mono text-[11px]">
                {falta.join(" e ")}
              </span>
            </>
          ) : (
            " as credenciais"
          )}
          . Até lá a agenda funciona normalmente, só não troca compromissos com o Google.
        </p>
      </div>
    );
  }

  if (contaConectada) {
    return (
      <div
        data-testid="google-conectado"
        className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3"
      >
        <GoogleLogo size={16} weight="bold" className="shrink-0 text-text-muted" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-sm">
          <span className="text-text-muted">Agenda conectada: </span>
          <span className="font-medium">{contaConectada}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <p className="min-w-0 flex-1 text-sm text-text-muted">
        Conecte sua agenda do Google para ver aqui o que já está marcado lá — e enviar para lá o
        que for marcado aqui.
      </p>
      <Button variant="outline" size="sm" data-testid="conectar-google" asChild>
        <a href="/api/v1/agenda/google/connect">
          <GoogleLogo size={16} weight="bold" aria-hidden />
          <span>Conectar Google</span>
        </a>
      </Button>
    </div>
  );
}
