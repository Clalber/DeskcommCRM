/**
 * `channel_sessions.archived_at` — e o que fazer quando a coluna ainda não existe.
 *
 * Arquivar é como um canal "sai" do sistema sem levar o histórico junto
 * (migration 0100). A partir daí, TODO caminho que resolve uma sessão precisa
 * ignorar as arquivadas: a linha continua lá como âncora das FKs, mas para o
 * produto ela foi excluída — o número já foi deslogado no transporte e a
 * credencial do canal oficial já foi revogada.
 *
 * ─── Por que existe um fallback, e por que ele não é paliativo ───────────────
 * Neste projeto o código chega ao clone/produção por deploy, e aplicar a
 * migration é passo SEPARADO e manual — já aconteceu de a `main` subir sem ela
 * (memória `project_vercel_deploy_sem_gate_de_schema`). Nesse estado, uma
 * consulta que filtra `archived_at` volta com SQLSTATE 42703 do Postgres,
 * repassado pelo PostgREST. Quem trata isso como "não achei" mostra "nenhum
 * número conectado" numa org que tem canal ligado, ou descarta a mensagem que
 * acabou de entrar.
 *
 * Repetir a consulta SEM o filtro não é degradar: se a coluna não existe, NADA
 * está arquivado, então o resultado sem filtro é o resultado exato. O que o
 * `schemaOutdated` acrescenta é o aviso — o chamador pode dizer ao operador que
 * falta rodar a migration em vez de o sistema mentir em silêncio.
 */

/** Coluna que separa canal vivo de canal excluído pelo usuário. */
export const ARCHIVED_AT = "archived_at";

/** SQLSTATE do Postgres para "coluna não existe". O PostgREST o repassa em `error.code`. */
const UNDEFINED_COLUMN = "42703";

export interface DbErrorLike {
  code?: string | null;
  message?: string | null;
}

/** O erro é "a migration 0100 não rodou neste banco" — e não um erro de verdade. */
export function isArchivedColumnMissing(error: DbErrorLike | null | undefined): boolean {
  if (!error) return false;
  return error.code === UNDEFINED_COLUMN && (error.message ?? "").includes(ARCHIVED_AT);
}

/**
 * Roda a consulta que depende de `archived_at` e, só se o banco não tiver a
 * coluna, roda a alternativa sem ela.
 *
 * Duas closures em vez de um builder mutável porque o cliente do PostgREST é
 * thenable: reaproveitar o mesmo objeto na segunda tentativa reenviaria a
 * requisição já resolvida.
 */
export async function queryTolerantToMissingArchived<R extends { error: DbErrorLike | null }>(
  withArchived: () => PromiseLike<R>,
  withoutArchived: () => PromiseLike<R>,
): Promise<R & { schemaOutdated: boolean }> {
  const first = await withArchived();
  if (!isArchivedColumnMissing(first.error)) return { ...first, schemaOutdated: false };
  const fallback = await withoutArchived();
  return { ...fallback, schemaOutdated: true };
}
