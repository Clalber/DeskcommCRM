/**
 * Índice de Atrito — montagem dos pares eficiência/dano (spec 16; doutrina
 * `docs/doctrine/sistema-vivo/03-medida-do-proposito.md` §3.3).
 *
 * A regra que este módulo EXISTE para materializar: toda medida que empurra o
 * sistema a fazer mais de alguma coisa é publicada junto da medida que denuncia
 * o custo dessa coisa — mesmo painel, mesmo destaque. Separadas, a de eficiência
 * vence sempre, porque é a que sobe. Por isso o formato de saída é o PAR, e não
 * uma lista de números: a tela não consegue renderizar uma eficiência sozinha
 * sem violar o tipo.
 *
 * Guardado por `tests/unit/atrito-par-eficiencia-dano.test.ts`, que reprova par
 * sem dano — o gate mecânico da doutrina, não um comentário pedindo cuidado.
 *
 * ⚠️ AUSÊNCIA DE DADO É `null`, NUNCA `0`. Denominador zero devolve null e a
 * tela mostra "—". Um zero aqui viraria "0% de contorno" numa org sem nenhum
 * envio — a frase tranquilizadora que a falta de medição não autoriza.
 */

/** Shape cru devolvido por `fn_atrito_metrics` (migration 0115). */
export interface AtritoRaw {
  escopo: { demandas: number; de: string; ate: string };
  cliente: {
    turnos_p50: number | null;
    turnos_p90: number | null;
    insistencia_media: number | null;
    insistencia_max: number | null;
    pedidos_de_humano: number;
    descadastros: number;
  };
  empresa: {
    intervencoes_por_demanda: number | null;
    espera_humana_p50_s: number | null;
    espera_humana_p90_s: number | null;
    retrabalho: number;
    vetos: number;
    execucoes_medidas: number;
    envios_por_ia: number;
    envios_humano_no_sistema: number;
    envios_humano_fora: number;
  };
  eficiencia: { ganhos: number; perdidos: number };
}

export type Unidade = "contagem" | "segundos" | "razao" | "media";

export interface Medida {
  chave: string;
  rotulo: string;
  valor: number | null;
  unidade: Unidade;
  /** Ressalva que viaja COM o número — proxy, escopo parcial, régua. */
  nota?: string;
}

export interface Par {
  chave: string;
  titulo: string;
  /** O que o sistema é empurrado a maximizar. */
  eficiencia: Medida;
  /** O custo disso. Nunca vazio — o teste reprova. */
  danos: Medida[];
}

/** Divisão que devolve null em vez de mentir com 0. */
export function razao(numerador: number, denominador: number): number | null {
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador)) return null;
  if (denominador <= 0) return null;
  return numerador / denominador;
}

/**
 * Quanto das respostas saiu do agente, sobre TODAS as saídas (IA + humano no
 * sistema + humano fora dele). Incluir o `external_device` no denominador é o
 * que impede a automação de parecer alta numa org onde o time responde pelo
 * celular: ali a IA não absorveu, ela apenas não foi usada.
 */
export function taxaDeAutomacao(e: AtritoRaw["empresa"]): number | null {
  return razao(e.envios_por_ia, e.envios_por_ia + e.envios_humano_no_sistema + e.envios_humano_fora);
}

/**
 * Das respostas dadas por gente, quantas saíram POR FORA do sistema.
 * Mede quantas vezes o operador contornou a própria ferramenta — o sinal de
 * atrito da empresa mais honesto que existe, porque ninguém o reporta.
 */
export function taxaDeContorno(e: AtritoRaw["empresa"]): number | null {
  return razao(e.envios_humano_fora, e.envios_humano_no_sistema + e.envios_humano_fora);
}

/** Vetos por execução medida — quanto o sistema precisou ser contido de si. */
export function vetosPorExecucao(e: AtritoRaw["empresa"]): number | null {
  return razao(e.vetos, e.execucoes_medidas);
}

const ESCOPO_PARCIAL =
  "Escopo: demandas que passaram por caso humano — não o total de conversas.";

export function montarPares(raw: AtritoRaw): Par[] {
  const { cliente, empresa, eficiencia } = raw;

  return [
    {
      chave: "conversao",
      titulo: "Conversão",
      eficiencia: {
        chave: "ganhos",
        rotulo: "Negócios ganhos",
        valor: eficiencia.ganhos,
        unidade: "contagem",
      },
      danos: [
        {
          chave: "turnos_p50",
          rotulo: "Turnos até o desfecho (mediana)",
          valor: cliente.turnos_p50,
          unidade: "media",
          nota: ESCOPO_PARCIAL,
        },
        {
          chave: "insistencia_media",
          rotulo: "Insistência do agente (média de retornos)",
          valor: cliente.insistencia_media,
          unidade: "media",
          nota: "Quantas vezes o agente voltou ao cliente por conta própria.",
        },
        // O MÁXIMO ao lado da média, e não no lugar dela. A spec 16 nasceu do
        // agente que insiste seis vezes: numa base de 40 demandas, seis retornos
        // num único cliente somem na média e é justamente esse caso que precisa
        // aparecer. Publicar só a média reintroduziria o defeito pelo lado da
        // exibição — o sistema mediria o dano e a tela o esconderia.
        {
          chave: "insistencia_max",
          rotulo: "Insistência no pior caso",
          valor: cliente.insistencia_max,
          unidade: "contagem",
          nota: "O cliente que mais recebeu retornos. A média esconde o exagero pontual.",
        },
        {
          chave: "descadastros",
          rotulo: "Descadastros no período",
          valor: cliente.descadastros,
          unidade: "contagem",
          nota: "Atrito máximo: a pessoa pediu para sair.",
        },
      ],
    },
    {
      chave: "automacao",
      titulo: "Automação",
      eficiencia: {
        chave: "taxa_automacao",
        rotulo: "Respostas dadas pelo agente",
        valor: taxaDeAutomacao(empresa),
        unidade: "razao",
      },
      danos: [
        {
          chave: "pedidos_de_humano",
          rotulo: "Passagens para humano",
          valor: cliente.pedidos_de_humano,
          unidade: "contagem",
          nota: "Confiança perdida na automação.",
        },
        {
          chave: "taxa_de_contorno",
          rotulo: "Respostas humanas fora do sistema",
          valor: taxaDeContorno(empresa),
          unidade: "razao",
          nota: "O time respondeu pelo celular, contornando a ferramenta.",
        },
      ],
    },
    {
      chave: "custo_humano",
      titulo: "Custo humano",
      eficiencia: {
        chave: "demandas",
        rotulo: "Demandas encerradas",
        valor: raw.escopo.demandas,
        unidade: "contagem",
        nota: ESCOPO_PARCIAL,
      },
      danos: [
        {
          chave: "intervencoes_por_demanda",
          rotulo: "Intervenções humanas por demanda",
          valor: empresa.intervencoes_por_demanda,
          unidade: "media",
        },
        {
          chave: "espera_humana_p50_s",
          rotulo: "Espera na fila humana (mediana)",
          valor: empresa.espera_humana_p50_s,
          unidade: "segundos",
        },
        {
          chave: "espera_humana_p90_s",
          rotulo: "Espera na fila humana (p90)",
          valor: empresa.espera_humana_p90_s,
          unidade: "segundos",
          // Mediana e p90 iguais denunciam base pequena, não uma fila homogênea.
          // Sem dizer isso, dois números idênticos lado a lado leem-se como bug.
          nota:
            empresa.espera_humana_p50_s !== null &&
            empresa.espera_humana_p50_s === empresa.espera_humana_p90_s
              ? "Igual à mediana: há poucas esperas medidas no período para os dois se separarem."
              : "O p90 é a experiência de quem espera mais — a mediana a esconde.",
        },
        {
          chave: "retrabalho",
          rotulo: "Demandas que precisaram subir de nível",
          valor: empresa.retrabalho,
          unidade: "contagem",
        },
      ],
    },
    {
      chave: "contencao",
      titulo: "Contenção",
      eficiencia: {
        chave: "envios_por_ia",
        rotulo: "Mensagens enviadas pelo agente",
        valor: empresa.envios_por_ia,
        unidade: "contagem",
      },
      danos: [
        {
          chave: "vetos_por_execucao",
          rotulo: "Vetos por execução",
          valor: vetosPorExecucao(empresa),
          unidade: "media",
          nota: "Quanto o sistema precisou ser contido de si mesmo antes de falar.",
        },
      ],
    },
  ];
}

/** Formatação para tela. `null` é "—" — nunca "0". */
export function formatarMedida(m: Medida): string {
  if (m.valor === null || !Number.isFinite(m.valor)) return "—";
  switch (m.unidade) {
    case "razao":
      return `${(m.valor * 100).toFixed(1)}%`;
    case "segundos":
      return formatarDuracao(m.valor);
    case "media":
      return m.valor.toFixed(1);
    case "contagem":
      return String(Math.round(m.valor));
  }
}

export function formatarDuracao(segundos: number): string {
  const s = Math.round(segundos);
  if (s < 60) return `${s}s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const restoMin = min % 60;
  return restoMin === 0 ? `${h}h` : `${h}h ${restoMin}min`;
}
