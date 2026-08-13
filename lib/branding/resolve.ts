/**
 * O resolvedor da marca — quem junta as camadas de configuração e NUNCA lança.
 *
 * "Nunca lança" não é zelo: este módulo é chamado no `app/layout.tsx`, que
 * embrulha o produto inteiro. Uma exceção aqui não deixa a marca feia — deixa
 * TODAS as telas em 500, inclusive o login, inclusive a tela onde o operador
 * corrigiria o valor que quebrou. O caminho degradado é sempre "o produto se
 * pinta com a cor dele", que é uma instalação funcionando.
 *
 * Isso NÃO é engolir erro (o repo proíbe, e com razão): toda recusa devolve um
 * `MotivoDaMarca` junto do resultado. O motivo é dado, não é log perdido —
 * quem o chama decide se o mostra, registra ou ignora.
 *
 * ── Para onde o motivo SAI (invariante 7 da doutrina Sistema Vivo) ────────────
 *
 * Nesta fase ele sai por dois lugares, e nenhum deles é um `return` que morre:
 *   (1) `app/layout.tsx` registra os motivos no logger estruturado, uma vez por
 *       resolução distinta (a derivação é memoizada, então não vira ruído por
 *       requisição);
 *   (2) o objeto atravessa inteiro para quem chamar.
 * Na fase seguinte, a tela de marca (`/app/settings/tenant/branding`, já
 * inventariada em `docs/design-system/screen-flow/03-screen-inventory.md:149`)
 * consome `motivos` como a lista de avisos ao lado do seletor de cor: é ali que
 * o revendedor descobre POR QUE o amarelo dele virou outro tom, em vez de
 * concluir que o produto está quebrado.
 */

import { resolveBranding, type Branding } from "@/lib/branding";

import {
  derivarMarca,
  type CodigoDeMotivo,
  type Marca,
  type Regua,
  type Tema,
} from "./contraste";
import { normalizarHex } from "./rampa";
import {
  ALGORITMO_ATUAL,
  ehPapelConhecido,
  envelopeDeSemente,
  esquemaDaCorDaMarca,
  FORMATO_ATUAL,
  type PapelDaSemente,
} from "./schema";

/** Códigos que nascem da RESOLUÇÃO (os da derivação vêm de `contraste.ts`). */
export type CodigoDaResolucao =
  | "cor_ausente"
  | "envelope_malformado"
  | "semente_invalida"
  | "formato_desconhecido"
  | "algoritmo_desconhecido"
  | "papel_desconhecido"
  | "papel_nao_pinta"
  | "derivacao_falhou";

/**
 * Mesma disciplina do `Motivo` de `contraste.ts`: emite FORMA, nunca
 * IDENTIDADE. Nenhum campo carrega o hex da marca de ninguém — com a tabela por
 * organização (fase seguinte) esses motivos passam a conviver num log só, e a
 * cor de uma empresa não tem por que aparecer no diagnóstico de outra.
 */
export type MotivoDaMarca = {
  readonly codigo: CodigoDaResolucao | CodigoDeMotivo;
  /** Qual camada produziu o motivo (`env`, `organizacao`, …). */
  readonly origem: string;
  readonly tema: Tema | null;
  readonly alvo: string | null;
  readonly detalhe: string;
};

/**
 * Uma camada de configuração. Campos ausentes NÃO apagam a camada de baixo —
 * é isso que "precedência por campo" quer dizer: quem configurou só o logo
 * continua com o nome que já tinha.
 */
export type CamadaDeMarca = {
  readonly origem: string;
  readonly nome?: string | null;
  readonly logoUrl?: string | null;
  /**
   * O envelope CRU, como veio da fonte — `unknown` de propósito: validar é
   * trabalho do resolvedor, e uma camada que já entregasse validado esconderia
   * de onde o dado inválido veio.
   */
  readonly cor?: unknown;
};

export type CorResolvida = {
  /** O hex do cliente, normalizado. Vai para `--color-brand` mesmo sem pintar. */
  readonly semente: string;
  readonly papel: PapelDaSemente | "desconhecido";
  /** Os tokens derivados. `null` quando a semente não pinta o produto. */
  readonly derivada: Marca | null;
};

export type MarcaResolvida = Branding & {
  readonly cor: CorResolvida | null;
  /** De qual camada veio cada campo — o que torna a precedência auditável. */
  readonly origens: {
    readonly nome: string;
    readonly logoUrl: string;
    readonly cor: string;
  };
  readonly motivos: readonly MotivoDaMarca[];
};

const PADRAO = "padrao";

/**
 * Tira qualquer hex de um texto livre antes de ele virar `detalhe`.
 *
 * A mensagem de exceção é o que torna uma falha diagnosticável — descartá-la
 * deixaria o registro completo por fora e inútil por dentro. Mas ela pode
 * conter o valor que a causou (`hexParaRgb` lança com o valor no texto), e a
 * regra de não vazar identidade vale para o caminho de erro também.
 */
function semIdentidade(texto: string): string {
  return texto.replace(/#[0-9a-fA-F]{3,8}/g, "#…");
}

/** O primeiro valor não-vazio, na ordem das camadas. `null` = ninguém definiu. */
function primeiroDefinido(
  camadas: readonly CamadaDeMarca[],
  ler: (c: CamadaDeMarca) => string | null | undefined,
): { valor: string; origem: string } | null {
  for (const camada of camadas) {
    const valor = (ler(camada) ?? "").trim();
    if (valor.length > 0) return { valor, origem: camada.origem };
  }
  return null;
}

/**
 * Cache da derivação, por régua e por semente.
 *
 * A derivação percorre até 21 deslocamentos × todos os pares × 2 temas, e o
 * `app/layout.tsx` a chamaria em TODA requisição para um valor que muda uma vez
 * por deploy. `WeakMap` na régua (e não um `Map` global por hex) porque teste e
 * preview passam réguas diferentes: cachear só pelo hex devolveria a marca de
 * uma régua ao chamador de outra. O tamanho é limitado pelo número de sementes
 * distintas — 1 nesta fase (o `.env`), uma por organização na fase seguinte.
 */
const memoria = new WeakMap<Regua, Map<string, Marca>>();

function derivarComCache(semente: string, regua: Regua): Marca {
  let porSemente = memoria.get(regua);
  if (!porSemente) {
    porSemente = new Map();
    memoria.set(regua, porSemente);
  }
  const guardada = porSemente.get(semente);
  if (guardada) return guardada;
  const nova = derivarMarca(semente, regua);
  porSemente.set(semente, nova);
  return nova;
}

/**
 * Valida um envelope cru e, se ele pintar, deriva os tokens.
 *
 * Devolve `null` em `cor` quando a camada não tem nada a dizer sobre cor —
 * assim o chamador sabe que pode continuar descendo as camadas.
 */
function resolverCor(
  cru: unknown,
  origem: string,
  regua: Regua,
): { cor: CorResolvida | null; motivos: MotivoDaMarca[] } {
  const motivos: MotivoDaMarca[] = [];
  const anotar = (
    codigo: CodigoDaResolucao,
    detalhe: string,
    alvo: string | null = null,
  ) => {
    motivos.push({ codigo, origem, tema: null, alvo, detalhe });
  };

  // Campo presente e vazio é anomalia (jsonb `{}`, `null` gravado); campo
  // AUSENTE é a instalação de fábrica e não merece aviso nenhum — avisar sobre o
  // caso normal ensina o operador a ignorar avisos.
  if (cru === null || (typeof cru === "object" && Object.keys(cru).length === 0)) {
    anotar("cor_ausente", "a camada declara cor, mas sem conteúdo");
    return { cor: null, motivos };
  }
  if (cru === undefined) return { cor: null, motivos };

  const lido = esquemaDaCorDaMarca.safeParse(cru);
  if (!lido.success) {
    // A distinção que importa para quem lê o diagnóstico: `semente_invalida` é
    // "o operador digitou uma cor errada" (o campo é string e não passou no
    // validador de hex — `code: "custom"`, do `.refine`); qualquer outra coisa,
    // inclusive campo AUSENTE ou de tipo errado no mesmo caminho, é forma do
    // envelope. Sem o `code`, um envelope sem `semente_hex` seria reportado como
    // cor mal digitada, e o operador iria procurar o erro no lugar errado.
    const noHex = lido.error.issues.some(
      (i) => i.path[0] === "semente_hex" && i.code === "custom",
    );
    if (noHex) {
      anotar("semente_invalida", "semente_hex não é um hex de cor (#rgb ou #rrggbb)");
    } else {
      const campos = [
        ...new Set(lido.error.issues.map((i) => i.path.join(".") || "(raiz)")),
      ].sort();
      anotar("envelope_malformado", `campos fora da forma esperada: ${campos.join(", ")}`);
    }
    return { cor: null, motivos };
  }

  const envelope = lido.data;

  // `format` governa o SIGNIFICADO dos campos. Se ele mudou, ler `semente_hex`
  // seria adivinhar — e o dano de pintar o produto inteiro com uma cor mal lida
  // é maior que o de não pintar. Cair no padrão do produto é a ação segura.
  if (envelope.format !== FORMATO_ATUAL) {
    anotar(
      "formato_desconhecido",
      `formato ${envelope.format} não é o desta versão (${FORMATO_ATUAL}); ` +
        `a cor do produto permanece`,
    );
    return { cor: null, motivos };
  }

  // `algo` é o oposto: o que se grava é ENTRADA, então esta versão sabe derivar
  // a partir dela mesmo que outra versão tenha gravado. Anotar e seguir é o
  // caminho certo — é justamente o que faz um rollback manter a marca no ar.
  if (envelope.algo !== ALGORITMO_ATUAL) {
    anotar(
      "algoritmo_desconhecido",
      `derivação gravada na versão ${envelope.algo}; esta instalação deriva na ` +
        `${ALGORITMO_ATUAL} e usa a semente como entrada`,
    );
  }

  const semente = normalizarHex(envelope.semente_hex);
  const papel = envelope.papel_da_semente;

  if (!ehPapelConhecido(papel)) {
    // Falhar fechado na AÇÃO (não pintar o produto com uma cor cujo alcance não
    // se entende) e aberto na INFORMAÇÃO (a identidade continua disponível em
    // `--color-brand`, que é inerte: nenhum componente muda de cor por ela).
    anotar(
      "papel_desconhecido",
      "papel da semente não é conhecido nesta versão; a cor não pinta a interface",
      "--color-brand",
    );
    return { cor: { semente, papel: "desconhecido", derivada: null }, motivos };
  }

  if (papel !== "accent") {
    anotar(
      "papel_nao_pinta",
      "a semente foi configurada só como identidade; a interface segue com a cor do produto",
      "--color-brand",
    );
    return { cor: { semente, papel, derivada: null }, motivos };
  }

  try {
    const derivada = derivarComCache(semente, regua);
    for (const m of derivada.motivos) {
      motivos.push({ codigo: m.codigo, origem, tema: m.tema, alvo: m.alvo, detalhe: m.detalhe });
    }
    return { cor: { semente, papel, derivada }, motivos };
  } catch (erro) {
    // Não é `catch` que silencia: o motivo sai com a mensagem real (sem o hex).
    // Existe porque a alternativa é a exceção subir até o layout e derrubar o
    // produto inteiro por causa de uma cor.
    anotar(
      "derivacao_falhou",
      semIdentidade(erro instanceof Error ? erro.message : String(erro)),
    );
    return { cor: { semente, papel, derivada: null }, motivos };
  }
}

/**
 * Junta as camadas, da MAIS específica para a MAIS genérica.
 *
 * O padrão do produto é o fundo implícito da pilha — não é uma camada que se
 * passa, é o que sobra quando ninguém definiu nada.
 *
 * Uma cor inválida numa camada de cima NÃO apaga a cor válida de baixo: ela é
 * anotada e a busca continua descendo. Numa instalação de revendedor, uma
 * organização que grava lixo tem de cair na marca do revendedor, não na nossa.
 */
export function resolverMarca(
  camadas: readonly CamadaDeMarca[],
  regua: Regua,
): MarcaResolvida {
  const nome = primeiroDefinido(camadas, (c) => c.nome);
  const logo = primeiroDefinido(camadas, (c) => c.logoUrl);
  const base = resolveBranding(nome?.valor, logo?.valor);

  const motivos: MotivoDaMarca[] = [];
  let cor: CorResolvida | null = null;
  let origemDaCor = PADRAO;

  for (const camada of camadas) {
    if (!("cor" in camada)) continue;
    const tentativa = resolverCor(camada.cor, camada.origem, regua);
    motivos.push(...tentativa.motivos);
    if (tentativa.cor) {
      cor = tentativa.cor;
      origemDaCor = camada.origem;
      break;
    }
  }

  return {
    ...base,
    cor,
    origens: {
      nome: nome?.origem ?? PADRAO,
      logoUrl: logo?.origem ?? PADRAO,
      cor: origemDaCor,
    },
    motivos,
  };
}

/**
 * A camada do `.env` — a única fonte desta fase, e a que nunca deixa de existir.
 *
 * Mesmo quando a tabela por organização entrar, é esta camada que pinta o login,
 * o e-mail de convite e o erro 500: telas onde ainda não há organização
 * resolvida (6 dos 8 call sites de `lib/branding` já estão nessa situação).
 *
 * Recebe a fonte, não a procura: é o que permite testar a precedência sem mexer
 * em `process.env` — mesmo desenho de `resolveBranding` em `lib/branding.ts`.
 */
export function camadaDoAmbiente(fonte: {
  APP_NAME?: string;
  APP_LOGO_URL?: string;
  APP_ACCENT_HEX?: string;
}): CamadaDeMarca {
  const hex = (fonte.APP_ACCENT_HEX ?? "").trim();
  // Chave declarada e vazia (`APP_ACCENT_HEX=`) é o estado que o `install.sh`
  // deixa quando o operador não responde — o mesmo caso que `resolveBranding`
  // trata para o nome. Não é cor ausente com defeito, é instalação de fábrica:
  // a camada simplesmente não fala sobre cor.
  if (hex.length === 0) return { origem: "env", nome: fonte.APP_NAME, logoUrl: fonte.APP_LOGO_URL };
  return {
    origem: "env",
    nome: fonte.APP_NAME,
    logoUrl: fonte.APP_LOGO_URL,
    cor: envelopeDeSemente(hex),
  };
}
