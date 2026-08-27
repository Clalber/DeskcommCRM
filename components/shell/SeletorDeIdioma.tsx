"use client";
import { useTransition } from "react";
import { toast } from "sonner";

import { trocarIdioma } from "@/app/actions/settings/trocarIdioma";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useT } from "@/hooks/i18n/useT";
import { useAplicarIdioma, useIdioma } from "@/lib/i18n/IdiomaProvider";
import { IDIOMAS, type Idioma } from "@/lib/i18n/idiomas";
import { Check } from "@/lib/ui/icons";

/**
 * Trocar de idioma no TOPO, em dois cliques, de qualquer tela.
 *
 * ─── Por que aqui, e não só em Configurações ───────────────────────────────
 *
 * Porque quem precisa dele é justamente quem NÃO acha Configurações: alguém que
 * abriu o sistema num idioma que não lê. Enterrar a troca a três telas de
 * distância transforma "está em português" num beco — a pessoa teria de
 * navegar, em português, até a tela que resolve o problema de estar em
 * português. O botão fica ao lado do controle de tema, que é o lugar onde este
 * produto já guarda o que muda a APARÊNCIA e não os dados.
 *
 * ─── O rótulo é o código, e é de propósito ─────────────────────────────────
 *
 * "PT" / "ES" são legíveis nos dois idiomas e cabem no mesmo espaço de um
 * ícone. Um ícone de globo diria "idioma" sem dizer QUAL — e saber qual está
 * em vigor é metade da pergunta de quem procura este botão.
 */
const NOME_DO_IDIOMA: Record<Idioma, { curto: string; completo: string }> = {
  // Cada língua no nome dela própria: é assim que se reconhece a sua numa
  // lista que você não sabe ler.
  "pt-BR": { curto: "PT", completo: "Português (BR)" },
  es: { curto: "ES", completo: "Español" },
};

export function SeletorDeIdioma() {
  const t = useT();
  const idioma = useIdioma();
  const aplicar = useAplicarIdioma();
  const [salvando, startTransition] = useTransition();

  const escolher = (novo: Idioma) => {
    if (novo === idioma) return;
    const anterior = idioma;
    // Pinta primeiro: quem clica quer ver o efeito no clique, não depois do
    // round-trip. Se o servidor recusar, voltamos ao anterior e dizemos.
    aplicar(novo);
    startTransition(async () => {
      const r = await trocarIdioma(novo);
      if (!r.ok) {
        aplicar(anterior);
        toast.error(t("Não foi possível trocar o idioma. Tente de novo."));
      }
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={salvando}
          aria-label={`${t("Idioma")}: ${NOME_DO_IDIOMA[idioma].completo}`}
          data-testid="seletor-de-idioma"
        >
          <span className="text-xs font-semibold tabular-nums">
            {NOME_DO_IDIOMA[idioma].curto}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {IDIOMAS.map((codigo) => (
          <DropdownMenuItem
            key={codigo}
            onClick={() => escolher(codigo)}
            data-testid={`idioma-${codigo}`}
            aria-current={codigo === idioma}
          >
            <Check
              size={16}
              className={`mr-2 ${codigo === idioma ? "" : "invisible"}`}
              aria-hidden
            />
            {NOME_DO_IDIOMA[codigo].completo}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
