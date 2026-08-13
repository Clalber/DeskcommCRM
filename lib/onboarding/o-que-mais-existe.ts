/**
 * O que mais existe no sistema, além do que a pessoa acabou de montar.
 *
 * O wizard terminava com um botão que entregava o dono numa caixa de conversas
 * vazia. Ele tinha acabado de montar um funcionário e não fazia ideia de que
 * existe um lugar onde a IA pede ajuda, outro que mostra quem esfriou, outro
 * onde ela propõe as próprias melhorias. Descobrir isso ficava por conta da
 * curiosidade — e a maioria não volta para explorar menu.
 *
 * As frases NÃO são escritas aqui: vêm do registro de navegação, que já as tem
 * em português de dono de negócio e é a mesma fonte que alimenta o menu, o hub
 * e a busca. Uma segunda redação divergiria na primeira vez que alguém mudasse
 * uma das duas.
 *
 * A seleção é curada de propósito. São 34 destinos no produto; despejar todos
 * no fim do wizard seria trocar "não sei o que existe" por "não sei por onde
 * começar".
 */
import { NAV_DESTINATIONS } from "@/lib/navigation/registry";

/**
 * Na ordem em que fazem sentido para quem acabou de montar o funcionário.
 *
 * `comoChamar` existe porque os rótulos do menu ainda são "Inbox", "Kanban",
 * "Follow-ups", "Alertas" — nomes que quem instalou o sistema há dez minutos não
 * reconhece. Aqui a peça é apresentada pelo que ela FAZ. O menu continua com os
 * nomes dele (mudá-los é outra frente, com contrato de teste próprio); o que
 * este arquivo não faz é reescrever a DESCRIÇÃO, que segue vindo do registro.
 */
const CURADORIA: { href: string; comoChamar: string; porQue: string }[] = [
  {
    href: "/app/inbox",
    comoChamar: "As conversas",
    porQue: "É aqui que as conversas chegam, com você e ele atendendo lado a lado.",
  },
  {
    href: "/app/kanban",
    comoChamar: "O quadro de clientes",
    porQue: "Cada cliente vira um card, e ele mesmo move o card conforme a conversa anda.",
  },
  {
    href: "/app/ai/followups",
    comoChamar: "Voltar a falar com quem sumiu",
    porQue: "Para nenhum cliente sumir no silêncio — ele volta a falar sozinho, na hora certa.",
  },
  {
    href: "/app/radar",
    comoChamar: "O que está esfriando",
    porQue: "Quem esfriou e ainda está aberto, para você agir antes de perder.",
  },
  {
    href: "/app/ai/inbox",
    comoChamar: "Quando ele pede ajuda",
    porQue: "Quando ele trava em algo que só uma pessoa resolve, o pedido aparece aqui.",
  },
  {
    href: "/app/ai/proposals",
    comoChamar: "As ideias dele",
    porQue: "Com o tempo ele sugere as próprias melhorias — e você decide se entram.",
  },
];

export interface PecaDoSistema {
  href: string;
  /** Como a peça é apresentada a quem acabou de montar o funcionário. */
  comoChamar: string;
  /** O nome que ela tem no menu — para a pessoa reencontrá-la depois. */
  label: string;
  /** A frase do registro — a mesma do menu e da busca. */
  descricao: string;
  /** Por que ela importa para quem acabou de montar o funcionário. */
  porQue: string;
}

export function oQueMaisExiste(): PecaDoSistema[] {
  const porHref = new Map(NAV_DESTINATIONS.map((d) => [d.href as string, d]));
  return CURADORIA.flatMap((c) => {
    const d = porHref.get(c.href);
    // Destino que saiu do registro não vira card órfão apontando para o vazio.
    if (!d) return [];
    return [
      {
        href: c.href,
        comoChamar: c.comoChamar,
        label: d.label,
        descricao: d.description,
        porQue: c.porQue,
      },
    ];
  });
}
