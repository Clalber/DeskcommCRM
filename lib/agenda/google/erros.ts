/**
 * O mapa de desfechos de um erro do Google — a tabela que decide o
 * comportamento do sistema inteiro.
 *
 * ─── Por que uma tabela, e não um `catch` em cada chamada ─────────────────
 *
 * Errar esta classificação é o que produz sync que APAGA dado. Dois exemplos
 * concretos, e nenhum deles é hipotético:
 *
 *  - `410` na exclusão significa "já não existe" — que é exatamente o estado
 *    que queríamos. Tratar como falha trava o cancelamento do CRM para sempre
 *    por causa de um evento que a pessoa já apagou na mão do lado de lá.
 *  - `410` na sincronização incremental significa **outra coisa**: o
 *    `syncToken` morreu e o Google mandou recomeçar do zero. Tratar como
 *    "evento sumiu" faria apagar as linhas de uma agenda inteira.
 *
 * É o mesmo número, com desfechos opostos. Por isso a operação é parâmetro
 * OBRIGATÓRIO: um valor padrão escolheria em silêncio uma das duas leituras, e a
 * escolha errada é justamente a que destrói dado.
 *
 * ─── `invalid_grant` não chega como 401 ───────────────────────────────────
 *
 * A renovação de token falha com **HTTP 400** e `{"error":"invalid_grant"}` no
 * corpo — é assim que o Google diz "o usuário revogou o acesso" ou "este
 * refresh_token passou seis meses sem uso". Quem classifica só por status lê
 * isso como "requisição malformada", tenta de novo para sempre, e a agenda do
 * cliente fica desconectada sem ninguém ser avisado.
 *
 * ─── O que este arquivo NÃO decide ────────────────────────────────────────
 *
 * Ele nomeia o desfecho; não executa nenhum. Quanto esperar depois de `recuar`,
 * quando abrir aviso na Central, quando marcar a conexão como `token_expired` —
 * tudo isso é de quem chama. Aqui não há relógio, nem banco, nem rede.
 */

/** Qual chamada falhou. Muda o significado de `404` e de `410`. */
export type OperacaoNoGoogle =
  | "criar"
  | "atualizar"
  | "apagar"
  | "listar"
  | "sincronizar"
  | "disponibilidade"
  | "token";

export type DesfechoDoGoogle =
  /** O humano precisa reconectar a agenda. Nenhum retry resolve. */
  | "reautenticar"
  /** Cota/limite: esperar e tentar de novo, com folga crescente. */
  | "recuar"
  /** Credencial válida, mas sem direito sobre este calendário. */
  | "sem_permissao"
  /** O evento não está mais lá — nossa referência ficou órfã. */
  | "evento_sumiu"
  /** O `syncToken` morreu: limpar e ressincronizar a agenda inteira. */
  | "ressincronizar"
  /** O estado desejado já vale. Não é falha. */
  | "ja_esta_feito"
  /** Passageiro (5xx, rede). Tentar de novo mais tarde. */
  | "transitorio"
  /** Repetir não muda nada. Precisa de conserto humano ou de código. */
  | "permanente";

export interface ClassificacaoDoErro {
  desfecho: DesfechoDoGoogle;
  /** HTTP, quando havia. `null` em falha de rede. */
  status: number | null;
  /** O `reason` do Google (`rateLimitExceeded`, `notFound`, `invalid_grant`…). */
  motivo: string | null;
  /** Só quando o Google mandou `Retry-After` em segundos. */
  esperarSegundos: number | null;
  /** Frase curta para gravar em `google_sync_error` e mostrar a quem opera. */
  mensagem: string;
}

/** Cota estourada — o Google usa 403 para isto, não só 429. */
const MOTIVOS_DE_COTA = new Set([
  "ratelimitexceeded",
  "userratelimitexceeded",
  "quotaexceeded",
  "dailylimitexceeded",
]);

/** O app OAuth da instalação está errado — reconectar não conserta. */
const MOTIVOS_DE_APP_ERRADO = new Set(["invalid_client", "unauthorized_client", "redirect_uri_mismatch"]);

function ehNumero(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function comoObjeto(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : null;
}

/**
 * O status HTTP, de onde quer que ele esteja.
 *
 * As bibliotecas discordam: `googleapis` põe em `code`, `fetch` em
 * `response.status`, e o corpo de erro do Google repete em `error.code`. E
 * `code` também carrega string de rede (`ECONNRESET`), que não é status —
 * por isso a checagem de número.
 */
function extrairStatus(erro: unknown): number | null {
  const e = comoObjeto(erro);
  if (!e) return null;
  if (ehNumero(e.code)) return e.code;
  if (ehNumero(e.status)) return e.status;

  const resposta = comoObjeto(e.response);
  if (resposta && ehNumero(resposta.status)) return resposta.status;

  const dados = resposta ? comoObjeto(resposta.data) : null;
  const erroDoCorpo = dados ? comoObjeto(dados.error) : null;
  if (erroDoCorpo && ehNumero(erroDoCorpo.code)) return erroDoCorpo.code;

  return null;
}

/** Todos os `reason` que o erro carrega, em minúsculas, sem repetir. */
function extrairMotivos(erro: unknown): string[] {
  const achados: string[] = [];
  const e = comoObjeto(erro);
  if (!e) return achados;

  const empilhar = (v: unknown) => {
    if (typeof v === "string" && v.trim()) achados.push(v.trim().toLowerCase());
  };

  const listaDeReasons = (v: unknown) => {
    if (!Array.isArray(v)) return;
    for (const item of v) {
      const i = comoObjeto(item);
      if (i) empilhar(i.reason);
    }
  };

  // `{ error: "invalid_grant" }` — o formato do endpoint de token.
  empilhar(e.error);
  // `code` só entra como motivo quando NÃO é status (ECONNRESET, ETIMEDOUT…).
  if (typeof e.code === "string") empilhar(e.code);
  listaDeReasons(e.errors);

  const resposta = comoObjeto(e.response);
  const dados = resposta ? comoObjeto(resposta.data) : null;
  if (dados) {
    empilhar(dados.error);
    const erroDoCorpo = comoObjeto(dados.error);
    if (erroDoCorpo) {
      empilhar(erroDoCorpo.status);
      listaDeReasons(erroDoCorpo.errors);
    }
  }

  // A mensagem entra por último e só serve para os motivos que o Google manda
  // em texto puro na renovação de token — `googleapis` copia `invalid_grant`
  // para `message` e não preenche `errors[]`.
  if (typeof e.message === "string") {
    const m = e.message.toLowerCase();
    for (const conhecido of ["invalid_grant", ...MOTIVOS_DE_APP_ERRADO]) {
      if (m.includes(conhecido)) achados.push(conhecido);
    }
  }

  return [...new Set(achados)];
}

/**
 * `Retry-After`, quando veio em segundos.
 *
 * A forma em data HTTP é ignorada de propósito: convertê-la exigiria um relógio
 * aqui dentro, e esta camada não tem nenhum. Sem o número, quem chama aplica a
 * própria folga — nunca fica sem resposta.
 */
function extrairRetryAfter(erro: unknown): number | null {
  const e = comoObjeto(erro);
  const resposta = e ? comoObjeto(e.response) : null;
  const cabecalhos: unknown = resposta?.headers;
  if (!cabecalhos) return null;

  let bruto: unknown = null;
  if (typeof (cabecalhos as Headers).get === "function") {
    bruto = (cabecalhos as Headers).get("retry-after");
  } else {
    const obj = comoObjeto(cabecalhos);
    if (obj) {
      const chave = Object.keys(obj).find((k) => k.toLowerCase() === "retry-after");
      bruto = chave ? obj[chave] : null;
    }
  }

  if (bruto === null || bruto === undefined) return null;
  const segundos = Number(bruto);
  return Number.isFinite(segundos) && segundos >= 0 ? Math.ceil(segundos) : null;
}

const FRASE: Record<DesfechoDoGoogle, string> = {
  reautenticar: "a agenda do Google perdeu a autorização — é preciso reconectar",
  recuar: "o Google pediu para desacelerar (limite de uso)",
  sem_permissao: "sem permissão de escrita neste calendário",
  evento_sumiu: "o evento não existe mais no Google",
  ressincronizar: "a sincronização incremental expirou — recomeçar do zero",
  ja_esta_feito: "o Google já estava no estado desejado",
  transitorio: "falha passageira do Google — tentar de novo",
  permanente: "o Google recusou e repetir não muda o resultado",
};

export function classificarErroDoGoogle(erro: unknown, operacao: OperacaoNoGoogle): ClassificacaoDoErro {
  const status = extrairStatus(erro);
  const motivos = extrairMotivos(erro);
  const esperarSegundos = extrairRetryAfter(erro);
  const primeiroMotivo = motivos[0] ?? null;

  const tem = (nome: string) => motivos.includes(nome);
  const temCota = motivos.some((m) => MOTIVOS_DE_COTA.has(m));
  const temAppErrado = motivos.some((m) => MOTIVOS_DE_APP_ERRADO.has(m));

  const desfecho: DesfechoDoGoogle = (() => {
    // O app OAuth da instalação está mal configurado. Vem antes de tudo porque
    // o status é 400/401 e mandaria o dono para uma tela de reconexão que não
    // resolve — ele reconectaria para sempre.
    if (temAppErrado) return "permanente";
    if (tem("invalid_grant")) return "reautenticar";
    // O Google nomeia este caso: o `syncToken` morreu. Vale mais que o status,
    // porque é a única leitura possível dele.
    if (tem("fullsyncrequired")) return "ressincronizar";

    if (status === 401) return "reautenticar";
    if (status === 429) return "recuar";
    if (status === 403) return temCota ? "recuar" : "sem_permissao";

    if (status === 404) return operacao === "apagar" ? "ja_esta_feito" : "evento_sumiu";
    if (status === 410) {
      if (operacao === "apagar") return "ja_esta_feito";
      if (operacao === "listar" || operacao === "sincronizar") return "ressincronizar";
      return "evento_sumiu";
    }

    if (status !== null && status >= 500) return "transitorio";
    // Sem status é falha de rede (DNS, conexão cortada, timeout): o Google
    // nunca respondeu, então nada foi decidido do lado de lá.
    if (status === null) return "transitorio";
    return "permanente";
  })();

  const detalhe = primeiroMotivo ? ` (${primeiroMotivo})` : "";
  const numero = status !== null ? `HTTP ${status}` : "sem resposta";
  return {
    desfecho,
    status,
    motivo: primeiroMotivo,
    esperarSegundos,
    mensagem: `${FRASE[desfecho]} — ${numero}${detalhe}`,
  };
}

/**
 * Vale tentar de novo sozinho?
 *
 * `reautenticar`, `sem_permissao` e `permanente` ficam de fora porque nenhum
 * deles muda com o tempo: repetir só gasta cota e enche o log, escondendo o
 * pedido de socorro que deveria chegar a quem opera.
 */
export function deveTentarDeNovo(desfecho: DesfechoDoGoogle): boolean {
  return desfecho === "recuar" || desfecho === "transitorio" || desfecho === "ressincronizar";
}
