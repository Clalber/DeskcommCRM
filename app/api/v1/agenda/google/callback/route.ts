/**
 * GET /api/v1/agenda/google/callback — a volta do consentimento do Google.
 *
 * Confere o `state`, troca o código por tokens, descobre de quem é a agenda,
 * cifra e grava a conexão. É retorno de NAVEGADOR: todo desfecho — inclusive
 * cada falha — volta para `/app/agenda` com `?erro=<código>` ou `?ok=1`, nunca
 * JSON. É o mesmo contrato do callback da Nuvemshop, que é o precedente da casa.
 *
 * ─── Onde este arquivo se AFASTA do molde da Nuvemshop, de propósito ──────
 *
 * O callback da Nuvemshop chama `admin.rpc("fn_encrypt_oauth")` DIRETO, e no
 * erro devolve `?error=encrypt_failed`, que a tela traduz citando o nome de uma
 * variável de um produto de e-commerce. Aqui a cifra passa por
 * `encryptWebhookSecret`, que devolve `null` em vez de propagar a exceção do
 * Postgres, e o `null` vira uma recusa em português que não nomeia parceiro
 * nenhum. Copiar o molde ao pé da letra reproduziria o defeito que outras quatro
 * rotas acabaram de deixar de ter.
 *
 * ─── A ordem importa, e cada passo tem um motivo ──────────────────────────
 *
 * 1. `error` na query ANTES de tudo: quem clicou "Cancelar" na tela do Google
 *    volta por aqui, e isso não é falha — é uma pessoa desistindo. Tratar como
 *    erro encheria o log e assustaria quem só mudou de ideia.
 * 2. `state` ANTES do `code`: sem saber de quem é o retorno não há org para
 *    auditar, e auditar sem org é linha órfã.
 * 3. escopo DEPOIS da troca e ANTES de gravar: a tela do Google deixa desmarcar
 *    escopo por escopo, e uma conexão gravada como saudável sem
 *    `calendar.events` só falharia no primeiro agendamento — longe daqui, com
 *    uma mensagem que culpa o calendário.
 * 4. cifra ANTES do upsert: gravar o token em claro por um instante é gravá-lo
 *    em claro.
 */

import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { configuracaoDoGoogle } from "@/lib/agenda/google/config";
import { verificarEstado } from "@/lib/agenda/google/estado";
import { escoposFaltando } from "@/lib/agenda/google/oauth";
import { trocarCodigoPorToken } from "@/lib/agenda/google/token";
import { contaDaAgendaPrimaria } from "@/lib/agenda/google/calendarios";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

function voltar(parametro: string): NextResponse {
  const base = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(new URL(`/app/agenda?${parametro}`, base));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const recusa = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const stateBruto = url.searchParams.get("state");

  // 1. A pessoa desistiu. Não é falha: é alguém clicando "Cancelar".
  if (recusa) return voltar("erro=conexao_cancelada");

  // 2. Quem está voltando? Sem isto não há org para auditar.
  const estado = verificarEstado(stateBruto, { segredo: env.INTERNAL_SECRET, agora: new Date() });
  if (!estado) {
    // Um motivo só para assinatura inválida, prazo vencido e formato estranho:
    // distinguir na URL entregaria a um atacante a diferença que ele precisa
    // para calibrar. O detalhe fica no audit, que é do servidor.
    await audit({
      action: "agenda.google.conexao_falhou",
      metadata: { reason: "state_invalido" },
    });
    return voltar("erro=retorno_nao_verificavel");
  }
  const { organizationId, userId } = estado;

  if (!code) {
    await audit({
      action: "agenda.google.conexao_falhou",
      organizationId,
      metadata: { reason: "sem_codigo", user_id: userId },
    });
    return voltar("erro=retorno_incompleto");
  }

  const app = configuracaoDoGoogle();
  if (!app) return voltar("erro=google_nao_configurado");

  // 3. Troca o código pelos tokens.
  const leitura = await trocarCodigoPorToken(app, code, { agora: new Date() });
  if (!leitura.ok) {
    await audit({
      action: "agenda.google.conexao_falhou",
      organizationId,
      metadata: { reason: leitura.motivo, detalhe: leitura.detalhe, user_id: userId },
    });
    return voltar("erro=troca_de_codigo_falhou");
  }
  const token = leitura.token;

  // 4. A pessoa desmarcou algum escopo obrigatório?
  const faltando = escoposFaltando(token.scope);
  if (faltando.length > 0) {
    await audit({
      action: "agenda.google.conexao_falhou",
      organizationId,
      metadata: { reason: "scope_missing", faltando, user_id: userId },
    });
    return voltar("erro=permissao_incompleta");
  }

  // 5. De quem é a agenda, e em que fuso ela vive.
  const conta = await contaDaAgendaPrimaria(token.access_token);
  if (!conta.ok) {
    await audit({
      action: "agenda.google.conexao_falhou",
      organizationId,
      metadata: { reason: "conta_indisponivel", detalhe: conta.detalhe, user_id: userId },
    });
    return voltar("erro=conta_indisponivel");
  }

  // 6. Cifra ANTES de gravar. `encryptWebhookSecret` devolve `null` quando a
  //    chave de cifra da instalação não está ativa — e aqui isso vira uma
  //    recusa em português, não a exceção do Postgres que nomeia um parceiro.
  const admin = createAdminClient();

  // ⚠️ SEM `refresh_token` A CONEXÃO NASCE MORTA, e o pior é que ela nasce
  // parecendo viva. Todo o argumento do `prompt=consent` na rota de ida existe
  // para garantir que ele venha; se ainda assim não vier, gravar `healthy` faz a
  // agenda funcionar por uma hora e parar calada — o relato chega no dia
  // seguinte como "minha agenda parou de sincronizar", longe daqui.
  //
  // Reconexão é o caso legítimo em que ele pode faltar: quem já tem uma chave
  // guardada para ESTA conta não precisa de outra. Por isso a decisão depende do
  // que já existe, e não só do que veio agora.
  let refreshJaGuardado = false;
  if (!token.refresh_token) {
    const { data: existente } = await admin
      .from("calendar_connections")
      .select("oauth_refresh_token_encrypted")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .eq("provider", "google_calendar")
      .eq("account_email", conta.conta.email)
      .maybeSingle();
    refreshJaGuardado = Boolean(existente?.oauth_refresh_token_encrypted);

    if (!refreshJaGuardado) {
      await audit({
        action: "agenda.google.conexao_falhou",
        organizationId,
        metadata: { reason: "sem_token_de_renovacao", user_id: userId },
      });
      return voltar("erro=sem_token_de_renovacao");
    }
  }

  const accessCifrado = await encryptWebhookSecret(admin, token.access_token);
  const refreshCifrado = token.refresh_token ? await encryptWebhookSecret(admin, token.refresh_token) : null;
  if (!accessCifrado || (token.refresh_token && !refreshCifrado)) {
    await audit({
      action: "agenda.google.conexao_falhou",
      organizationId,
      metadata: { reason: "cifra_indisponivel", user_id: userId },
    });
    return voltar("erro=cifra_indisponivel");
  }

  // 7. Grava. `organization_id` e `user_id` vêm do `state` ASSINADO, nunca da
  //    query — service role bypassa RLS, então a fonte confiável é obrigatória.
  const { error: erroAoGravar } = await admin.from("calendar_connections").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      provider: "google_calendar",
      account_email: conta.conta.email,
      oauth_access_token_encrypted: accessCifrado,
      // Quando o Google não reenviou a chave e já havia uma guardada, a coluna
      // fica FORA do upsert: `on conflict do update` só toca o que recebe, então
      // omitir preserva. Mandar `null` aqui apagaria a chave que faz a conexão
      // sobreviver à primeira hora — é a mesma armadilha de `fundirTokens`, um
      // andar acima.
      ...(refreshCifrado ? { oauth_refresh_token_encrypted: refreshCifrado } : {}),
      token_expires_at: token.expira_em,
      scopes: token.scope,
      status: "healthy",
      last_sync_error: null,
    },
    { onConflict: "organization_id,user_id,provider,account_email" },
  );

  if (erroAoGravar) {
    await audit({
      action: "agenda.google.conexao_falhou",
      organizationId,
      metadata: { reason: "upsert_falhou", detalhe: erroAoGravar.message, user_id: userId },
    });
    return voltar("erro=nao_consegui_guardar");
  }

  await audit({
    action: "agenda.google.conexao_concluida",
    organizationId,
    metadata: { user_id: userId, account_email: conta.conta.email, fuso: conta.conta.fuso },
  });

  return voltar("ok=agenda_conectada");
}
