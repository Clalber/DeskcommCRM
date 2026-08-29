/**
 * GET/POST /api/v1/cron/instagram-token-refresh — o anti-morte do canal.
 *
 * ─── O que morre sem esta rodada ────────────────────────────────────────────
 *
 * O token de longa duração da Meta vale 60 dias. Renovar exige que ele esteja
 * VÁLIDO: passado o prazo não há renovação possível, só reconectar pela tela.
 * Quer dizer que a diferença entre um canal vivo e um canal morto é uma
 * requisição que alguém precisa lembrar de fazer dentro de dois meses.
 *
 * O Chatwoot — o sistema que serviu de referência para este canal — NÃO tem
 * esta rodada. A caixa de entrada de Instagram dele simplesmente para de receber
 * no sexagésimo dia, sem erro na tela, e quem descobre é o cliente que reclama
 * que ninguém respondeu. É o invariante 7 do Sistema Vivo em forma de rota: o
 * laço que fecha quando a conexão erra.
 *
 * ─── Por que não existe coluna "renovado em" ────────────────────────────────
 *
 * A Meta exige que o token tenha ao menos 24 horas de vida para ser renovado, e
 * a tentação é guardar a data da última renovação para conferir isso. Não é
 * preciso: um token de 60 dias que está a menos de 10 do vencimento tem, por
 * construção, cerca de 50 dias de idade. A janela de renovação já garante a
 * idade mínima com folga de cinquenta vezes, e uma coluna a mais seria um dado
 * que precisa ser mantido correto para responder a uma pergunta que a aritmética
 * já responde.
 *
 * ─── O que ela NÃO faz ──────────────────────────────────────────────────────
 *
 * - **Não renova o que não está para vencer.** Fora da janela, nada acontece.
 * - **Não desiste da rodada quando uma conexão falha.** Cada uma é tratada
 *   sozinha; um timeout numa conta não pode deixar as outras sem renovar.
 * - **Não audita rodada vazia.** Cron que não fez nada não é mutação — esta base
 *   já pagou 51.840 linhas por mês de batida vazia, e há um gate que varre o AST
 *   de toda rota de `cron/` para impedir a reincidência.
 * - **Não desconecta o canal ao primeiro erro.** O Chatwoot desconecta com UM
 *   erro de autorização; aqui a falha vira aviso na Central, e quem decide
 *   desconectar é uma pessoa.
 */
import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { CHANNEL_PROVIDER_INSTAGRAM } from "@/lib/channels/capabilities";
import { instagramGraphBaseUrl } from "@/lib/channels/instagram/credentials";
import { renovarTokenLongo } from "@/lib/channels/instagram/oauth";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * A partir de quando renovar. Dez dias antes do vencimento.
 *
 * A folga não é generosidade: uma instalação self-host pode ficar dias fora do
 * ar, e a renovação perdida é IRRECUPERÁVEL — vencido, o token não volta. Dez
 * dias de janela numa rodada de hora em hora dão 240 tentativas antes de a
 * conexão morrer.
 */
export const JANELA_DE_RENOVACAO_MS = 10 * 24 * 60 * 60 * 1000;

/** Teto por rodada: renovar tudo num tick estouraria a cota do aplicativo. */
export const TETO_POR_RODADA = 25;

export interface ResumoDaRodada {
  examinadas: number;
  renovadas: number;
  vencidas: number;
  falhas: number;
}

interface LinhaDeConexao {
  id: string;
  organization_id: string;
  display_name: string | null;
  instagram_token_encrypted: string | null;
  instagram_token_expires_at: string | null;
}

export async function renovarTokensDoInstagram(
  admin: ReturnType<typeof createAdminClient>,
  opcoes: { agora: Date },
): Promise<ResumoDaRodada> {
  const resumo: ResumoDaRodada = { examinadas: 0, renovadas: 0, vencidas: 0, falhas: 0 };

  const limite = new Date(opcoes.agora.getTime() + JANELA_DE_RENOVACAO_MS).toISOString();
  const { data, error } = await admin
    .from("channel_sessions")
    .select("id, organization_id, display_name, instagram_token_encrypted, instagram_token_expires_at")
    .eq("provider", CHANNEL_PROVIDER_INSTAGRAM)
    .not("instagram_token_encrypted", "is", null)
    .not("instagram_token_expires_at", "is", null)
    .lte("instagram_token_expires_at", limite)
    .order("instagram_token_expires_at", { ascending: true })
    .limit(TETO_POR_RODADA);

  if (error || !data) {
    if (error) logger.warn("[instagram.refresh] varredura falhou", { erro: error.message });
    return resumo;
  }

  for (const linha of data as unknown as LinhaDeConexao[]) {
    resumo.examinadas += 1;
    const vence = linha.instagram_token_expires_at
      ? new Date(linha.instagram_token_expires_at).getTime()
      : 0;

    // JÁ VENCEU. Não há renovação possível — a Meta recusa token expirado — e
    // insistir gastaria cota contra uma parede. O que resta é avisar, porque
    // este é o estado em que o canal está morto e ninguém percebeu.
    if (vence <= opcoes.agora.getTime()) {
      resumo.vencidas += 1;
      await avisar(admin, linha, {
        titulo: "A conexão do Instagram expirou",
        corpo:
          "O acesso concedido à Meta venceu e não pode mais ser renovado automaticamente. " +
          "As mensagens do Direct pararam de chegar. Reconecte a conta em Conexões para voltar a atender.",
      });
      continue;
    }

    const token = linha.instagram_token_encrypted
      ? await decryptWebhookSecret(admin, linha.instagram_token_encrypted)
      : null;
    if (!token) {
      // Decifra que falha é a chave da instalação ausente ou trocada — problema
      // de servidor, não de autorização. Não vira aviso de "reconecte": mandaria
      // a pessoa refazer uma conexão que está boa.
      resumo.falhas += 1;
      logger.warn("[instagram.refresh] token não decifrou", { channelSessionId: linha.id });
      continue;
    }

    const novo = await renovarTokenLongo({
      tokenLongo: token,
      baseUrl: instagramGraphBaseUrl(),
      agora: opcoes.agora,
    });
    if (!novo.ok) {
      resumo.falhas += 1;
      logger.warn("[instagram.refresh] renovação recusada", {
        channelSessionId: linha.id,
        motivo: novo.motivo,
      });
      // Avisa só quando o prazo está apertado. Uma falha a dez dias do
      // vencimento tem 239 tentativas pela frente e não merece assustar
      // ninguém; a três dias, merece.
      if (vence - opcoes.agora.getTime() < 3 * 24 * 60 * 60 * 1000) {
        await avisar(admin, linha, {
          titulo: "A conexão do Instagram está prestes a expirar",
          corpo:
            `A renovação automática vem falhando (${novo.motivo}). ` +
            "Se o acesso vencer, as mensagens do Direct param de chegar e será preciso reconectar a conta.",
        });
      }
      continue;
    }

    const cifrado = await encryptWebhookSecret(admin, novo.token);
    if (!cifrado) {
      resumo.falhas += 1;
      continue;
    }

    const { error: erroAoGravar } = await admin
      .from("channel_sessions")
      .update({
        instagram_token_encrypted: cifrado,
        instagram_token_expires_at: novo.expiraEm,
      })
      .eq("id", linha.id)
      // `organization_id` à mão mesmo com o id em mãos: é a regra da casa para
      // service role, e o custo é zero.
      .eq("organization_id", linha.organization_id);

    if (erroAoGravar) {
      // O token NOVO já existe do lado da Meta e não foi guardado aqui. O antigo
      // continua valendo até o prazo original, então a próxima rodada tenta de
      // novo — mas isso precisa aparecer no log, senão é uma renovação que se
      // perde em silêncio a cada hora.
      resumo.falhas += 1;
      logger.error("[instagram.refresh] token renovado mas não gravado", {
        channelSessionId: linha.id,
        erro: erroAoGravar.message,
      });
      continue;
    }

    resumo.renovadas += 1;
  }

  // Só audita rodada que fez alguma coisa.
  if (resumo.renovadas > 0 || resumo.vencidas > 0 || resumo.falhas > 0) {
    await audit({
      action: "channel.instagram.renovacao_executada",
      metadata: { ...resumo },
    });
  }

  return resumo;
}

/**
 * Abre o aviso na Central — `channel_credential_expiring`, o valor que a 0203
 * pôs no CHECK e que até agora nenhum código emitia.
 *
 * Um aviso por conexão e por dia: `ref_id` é a sessão, e a rodada de hora em
 * hora reabriria o mesmo aviso 24 vezes por dia se não conferisse antes.
 */
async function avisar(
  admin: ReturnType<typeof createAdminClient>,
  linha: LinhaDeConexao,
  texto: { titulo: string; corpo: string },
): Promise<void> {
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: jaAberto } = await admin
    .from("agent_inbox_items")
    .select("id")
    .eq("organization_id", linha.organization_id)
    .eq("kind", "channel_credential_expiring")
    .eq("ref_id", linha.id)
    .gte("created_at", desde)
    .maybeSingle();

  if (jaAberto) return;

  const { error } = await admin.from("agent_inbox_items").insert({
    organization_id: linha.organization_id,
    kind: "channel_credential_expiring",
    severity: "critical",
    title: texto.titulo,
    body: texto.corpo,
    ref_kind: "channel_session",
    ref_id: linha.id,
  });

  if (error) {
    // O aviso é o que torna a falha visível. Perdê-lo em silêncio recria
    // exatamente o defeito que esta rota existe para impedir.
    logger.error("[instagram.refresh] aviso não abriu", {
      channelSessionId: linha.id,
      erro: error.message,
    });
  }
}

function autorizado(req: NextRequest): boolean {
  const cabecalho = req.headers.get("authorization") ?? "";
  const aceitos = [env.INTERNAL_CRON_SECRET, env.INTERNAL_SECRET].filter(Boolean);
  // Fail-closed: sem segredo configurado, ninguém entra.
  return aceitos.length > 0 && aceitos.some((s) => cabecalho === `Bearer ${s}`);
}

async function executar(req: NextRequest): Promise<Response> {
  if (!autorizado(req)) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "cron secret inválido" } },
      { status: 401 },
    );
  }
  const resumo = await renovarTokensDoInstagram(createAdminClient(), { agora: new Date() });
  return NextResponse.json({ data: resumo });
}

export async function GET(req: NextRequest): Promise<Response> {
  return executar(req);
}

export async function POST(req: NextRequest): Promise<Response> {
  return executar(req);
}
