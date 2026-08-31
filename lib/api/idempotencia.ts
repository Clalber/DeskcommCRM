/**
 * Idempotência de servidor para POST que produz EFEITO EXTERNO.
 *
 * ─── O defeito que isto existe para matar ───────────────────────────────────
 *
 * Medido em produção: toda mensagem enviada pela tela chegava DUAS vezes ao
 * cliente final. Duas requisições HTTP reais, com identificadores distintos,
 * separadas por 1,43 s e 1,56 s, ambas com `external_id` da Meta — ou seja, as
 * duas foram aceitas pela plataforma e a pessoa do outro lado recebeu a frase
 * repetida.
 *
 * O cliente HTTP deste produto **já cumpre a parte dele**: `lib/api/client.ts`
 * gera o header `Idempotency-Key` UMA vez, fora do laço de retentativa, e
 * reenvia a MESMA chave em todas as tentativas. Quem não cumpria era o
 * servidor, que tratava cada POST como intenção nova.
 *
 * ⚠️ E isto já estava escrito no repositório. A migration 0204 documenta
 * duplicação por retentativa de mutação, cita este mesmo cliente HTTP, e conclui
 * que quem não honrava a chave era a rota. O precedente estava a um `grep` de
 * distância quando o defeito voltou noutro lugar.
 *
 * ─── Por que RESERVA-PRIMEIRO, e não consulta-depois-grava ──────────────────
 *
 * O padrão que já existia numa rota irmã consulta a chave, executa, e só então
 * grava o resultado. Para efeito rápido serve; para um envio que chama a Meta e
 * demora mais de um segundo, NÃO: a segunda requisição chega enquanto a
 * primeira ainda está em voo, não encontra nada gravado, e as duas mandam.
 *
 * Aqui a posse é tomada ANTES de executar, com `insert` competindo pela trava
 * única `(organization_id, key, endpoint)`. Quem perde a corrida não executa.
 *
 * ─── Por que só o SUCESSO é guardado ────────────────────────────────────────
 *
 * Falha apaga a reserva. Guardar erro faria uma indisponibilidade de dez
 * segundos virar erro permanente por 24 horas para aquela chave — e o
 * atendente, sem entender, reenviaria à mão.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * `status_code` da linha enquanto o dono ainda executa.
 *
 * Zero não é status HTTP nenhum, e é isso que o torna seguro: nenhum leitor
 * pode confundir a reserva com uma resposta pronta. Um `102` seria ambíguo.
 */
const EM_EXECUCAO = 0;

/** Quanto esperar pelo dono antes de desistir. */
const ESPERA_TOTAL_MS = 4_000;
const PASSO_MS = 400;

export type Reserva =
  | { estado: "dono" }
  /** Outro já executou; devolva ISTO, e não um erro. */
  | { estado: "repetida"; corpo: Record<string, unknown>; status: number }
  /** Outro ainda executa e não terminou a tempo. */
  | { estado: "em_andamento" }
  /** Sem chave no header: caller antigo ou server-to-server. Siga em frente. */
  | { estado: "sem_chave" };

export function hashDoPedido(corpo: unknown): string {
  return createHash("sha256").update(JSON.stringify(corpo ?? null)).digest("hex");
}

export function chaveDoCabecalho(headers: Headers): string | null {
  const v = headers.get("Idempotency-Key") ?? headers.get("idempotency-key");
  return v && v.length >= 8 ? v : null;
}

interface Escopo {
  organizationId: string;
  chave: string | null;
  endpoint: string;
  requestHash: string;
}

/**
 * Toma posse da execução, ou diz o que fazer no lugar dela.
 *
 * NUNCA lança: uma falha da própria idempotência não pode impedir a mensagem de
 * sair. Ela degrada para `dono` — melhor uma duplicata rara do que um canal
 * mudo, que é o desfecho que o operador não consegue contornar.
 */
export async function reservarExecucao(
  admin: SupabaseClient,
  escopo: Escopo,
): Promise<Reserva> {
  const { organizationId, chave, endpoint, requestHash } = escopo;
  if (!chave) return { estado: "sem_chave" };

  const { error } = await admin.from("idempotency_keys").insert({
    organization_id: organizationId,
    key: chave,
    endpoint,
    // `bytea` na tabela; o PostgREST aceita o hex com o prefixo.
    request_hash: `\\x${requestHash}`,
    status_code: EM_EXECUCAO,
    response_body: {},
  });

  if (!error) return { estado: "dono" };

  // 23505 = alguém chegou primeiro com esta chave. É o caminho ESPERADO da
  // retentativa, não um erro.
  if ((error as { code?: string }).code !== "23505") {
    return { estado: "dono" };
  }

  const ate = Date.now() + ESPERA_TOTAL_MS;
  for (;;) {
    const { data } = await admin
      .from("idempotency_keys")
      .select("status_code, response_body")
      .eq("organization_id", organizationId)
      .eq("key", chave)
      .eq("endpoint", endpoint)
      .maybeSingle();

    const linha = data as { status_code: number; response_body: unknown } | null;

    // O dono terminou e gravou. Devolvemos o resultado DELE — a mesma mensagem,
    // com o mesmo id. Responder erro aqui faria o atendente ver falha numa
    // mensagem que saiu, e reenviar à mão: a duplicata voltaria pela porta da
    // frente.
    if (linha && linha.status_code !== EM_EXECUCAO) {
      return {
        estado: "repetida",
        corpo: (linha.response_body ?? {}) as Record<string, unknown>,
        status: linha.status_code,
      };
    }

    // A reserva sumiu: o dono falhou e a apagou. Quem chegou depois assume.
    if (!linha) return { estado: "dono" };

    if (Date.now() >= ate) return { estado: "em_andamento" };
    await new Promise((r) => setTimeout(r, PASSO_MS));
  }
}

/** Guarda o resultado do dono. Só sucesso passa por aqui. */
export async function guardarResultado(
  admin: SupabaseClient,
  escopo: Escopo,
  resultado: { status: number; corpo: Record<string, unknown> },
): Promise<void> {
  if (!escopo.chave) return;
  await admin
    .from("idempotency_keys")
    .update({ status_code: resultado.status, response_body: resultado.corpo })
    .eq("organization_id", escopo.organizationId)
    .eq("key", escopo.chave)
    .eq("endpoint", escopo.endpoint);
}

/**
 * Solta a reserva quando a execução falhou.
 *
 * Sem isto, um erro transitório trancaria aquela chave por 24 horas e a
 * retentativa — que é justamente o que deveria salvar a mensagem — encontraria
 * uma reserva morta.
 */
export async function soltarReserva(
  admin: SupabaseClient,
  escopo: Escopo,
): Promise<void> {
  if (!escopo.chave) return;
  await admin
    .from("idempotency_keys")
    .delete()
    .eq("organization_id", escopo.organizationId)
    .eq("key", escopo.chave)
    .eq("endpoint", escopo.endpoint)
    .eq("status_code", EM_EXECUCAO);
}
