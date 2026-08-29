/**
 * Envio pelo Instagram Direct.
 *
 * ─── O que este arquivo NÃO decide ──────────────────────────────────────────
 *
 * Janela de 24 horas, teto diário, horário de envio, retentativa e ritmo são da
 * cadeia `before_send`. Um `if` de negócio aqui é o defeito que a doutrina de
 * restrição de canal existe para evitar: a mesma regra passaria a morar em dois
 * lugares, e o dia em que divergissem ninguém saberia qual vale.
 *
 * O adapter faz UMA coisa: pega o envelope, fala com a Meta, devolve o id ou
 * lança.
 *
 * ─── Duas diferenças que custam caro se esquecidas ──────────────────────────
 *
 * 1. **O destinatário é o IGSID, não o telefone.** E o IGSID é escopado à CONTA
 *    que recebe (ver `../instagram/identidade.ts`). Quem monta o envelope
 *    resolve isso; aqui só recusamos quando não veio.
 *
 * 2. **O texto tem limite em BYTES, não em caracteres.** A Meta recusa acima de
 *    1000 bytes, e em português acentuado cada "ã" custa dois. Contar caracteres
 *    deixaria passar mensagem que a API recusa — e a recusa vira mensagem
 *    perdida, porque não há retentativa que conserte texto grande demais.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  instagramCredsForAccount,
  type InstagramCredentials,
} from "../instagram/credentials";
import type { ChannelAdapter, ChannelHealth, OutboundEnvelope, RecipientInput } from "../types";

/** Teto da Meta para o corpo de texto. Bytes, não caracteres. */
export const LIMITE_DE_TEXTO_EM_BYTES = 1000;

const CODIGOS = {
  notConfigured: "instagram_not_configured",
  sendFailed: "instagram_send_failed",
  unknownError: "instagram_unknown_error",
} as const;

/** O erro da Meta, quando ela devolve um. */
interface ErroDaMeta {
  code?: number;
  error_subcode?: number;
  message?: string;
}

function lerErro(corpo: unknown): ErroDaMeta | null {
  const e = (corpo as { error?: ErroDaMeta } | null)?.error;
  return e && typeof e === "object" ? e : null;
}

/**
 * O erro diz que a credencial morreu?
 *
 * `190` é o código da Meta para token inválido ou expirado. Distinguir isso de
 * uma falha qualquer importa porque o desfecho é outro: token morto não se
 * resolve tentando de novo — alguém precisa reconectar a conta.
 *
 * ⚠️ NÃO desconectamos o canal ao primeiro 190, e isso é deliberado. O Chatwoot
 * desconecta com UM erro (`AUTHORIZATION_ERROR_THRESHOLD = 1`), e um 190
 * transitório derruba a caixa de entrada inteira e dispara e-mail ao
 * administrador. Aqui o erro sobe nomeado; quem decide desconectar é o cron de
 * saúde, que vê o histórico.
 */
export function ehCredencialMorta(erro: ErroDaMeta | null): boolean {
  return erro?.code === 190;
}

/**
 * O erro diz "fora da janela"?
 *
 * ⚠️ O par `10` / `2534022` vem de fonte SECUNDÁRIA: as páginas oficiais de
 * códigos de erro da Meta responderam 500 em todas as tentativas do
 * levantamento. Por isso a checagem é do código `10` (documentado, "permission
 * denied") e o subcódigo entra só como reforço — depender do subcódigo sozinho
 * seria construir sobre um número que ninguém conseguiu confirmar na fonte.
 */
export function ehForaDaJanela(erro: ErroDaMeta | null): boolean {
  return erro?.code === 10;
}

async function creds(
  admin: SupabaseClient,
  organizationId: string,
  sessionRef: string,
): Promise<InstagramCredentials> {
  const c = await instagramCredsForAccount(admin, {
    organizationId,
    instagramUserId: sessionRef,
  });
  // LANÇA em vez de devolver `{externalId: null}` sem erro: quem chama grava
  // `sent` quando o adapter não lança, e uma mensagem marcada como enviada que
  // nunca saiu é pior que uma falha visível.
  if (!c) throw new Error(CODIGOS.notConfigured);
  return c;
}

function corpoDoEnvelope(envelope: OutboundEnvelope): Record<string, unknown> {
  const destinatario = { id: envelope.to };

  // Mídia vai por URL pública, um envio por anexo — é o que a API aceita.
  if (envelope.media?.url) {
    const tipo = ["image", "audio", "video"].includes(envelope.kind) ? envelope.kind : "file";
    return {
      recipient: destinatario,
      message: { attachment: { type: tipo, payload: { url: envelope.media.url } } },
    };
  }

  const texto = envelope.body ?? "";
  const bytes = Buffer.byteLength(texto, "utf8");
  if (bytes > LIMITE_DE_TEXTO_EM_BYTES) {
    // Recusa ANTES de gastar a chamada. A Meta responderia erro e a mensagem
    // ficaria `failed` com uma razão que ninguém entende; aqui a razão nomeia o
    // limite e o tamanho medido.
    throw new Error(
      `${CODIGOS.sendFailed}: texto com ${bytes} bytes excede o limite de ${LIMITE_DE_TEXTO_EM_BYTES} da Meta`,
    );
  }

  return { recipient: destinatario, message: { text: texto } };
}

export const metaInstagramAdapter: ChannelAdapter = {
  provider: "meta_instagram",

  /**
   * O IGSID de quem vai receber.
   *
   * Síncrono e sem I/O por contrato — por isso quem monta o envelope precisa ter
   * resolvido a identidade antes. Devolver `null` faz o chamador falhar a
   * mensagem com "sem destinatário", que é o desfecho honesto: sem IGSID não há
   * para quem mandar, e inventar um mandaria para a pessoa errada.
   */
  resolveRecipient(input: RecipientInput): string | null {
    if (input.isGroup) return null; // a Meta não suporta grupo no Direct
    return input.providerUserId ?? null;
  },

  /**
   * Sempre `true`, e o `send` é quem recusa.
   *
   * O contrato deste método é síncrono e não pode ler banco — e a credencial
   * deste canal mora na SESSÃO, não no ambiente. Um `false` aqui significaria
   * "canal não configurado nesta instalação", que é falso: ele pode estar
   * conectado para uma organização e não para outra. É o mesmo raciocínio do
   * canal intermediado, e o oposto do defeito documentado no adapter oficial,
   * onde olhar só o env deixa canal conectado pela tela eternamente na fila.
   */
  isConfigured(): boolean {
    return true;
  },

  async send(envelope: OutboundEnvelope): Promise<{ externalId: string | null }> {
    const admin = createAdminClient();
    const c = await creds(admin, envelope.organizationId, envelope.sessionRef);

    const resposta = await fetch(
      `${c.baseUrl}/${c.graphVersion}/${c.instagramUserId}/messages`,
      {
        method: "POST",
        headers: {
          // Token no HEADER, nunca na query: query string vai para o log de
          // qualquer proxy no caminho, e ali ele vira credencial vazada.
          Authorization: `Bearer ${c.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(corpoDoEnvelope(envelope)),
      },
    );

    const corpo = (await resposta.json().catch(() => null)) as
      | { message_id?: string; recipient_id?: string }
      | null;
    const erro = lerErro(corpo);

    if (!resposta.ok || erro) {
      const detalhe = erro?.message ?? `HTTP ${resposta.status}`;
      const rotulo = ehCredencialMorta(erro)
        ? "credencial expirada — reconecte a conta"
        : ehForaDaJanela(erro)
          ? "fora da janela de 24h — só uma pessoa pode responder"
          : detalhe;
      throw new Error(`${CODIGOS.sendFailed}: ${rotulo}`);
    }

    // `message_id` ausente com HTTP 200 seria "enviado sem id": o CRM gravaria
    // `sent` e depois não conseguiria casar o eco que volta pelo webhook, e a
    // conversa mostraria a mesma mensagem duas vezes.
    return { externalId: corpo?.message_id ?? null };
  },

  /**
   * A conta responde?
   *
   * Obrigatório desde o momento em que este adapter é registrado — o invariante
   * de saúde dos canais cobra `checkHealth` de todo provider que TEM adapter, e
   * a razão é boa: sem ele o canal cai e ninguém fica sabendo até um cliente
   * reclamar.
   *
   * `reachable: false` significa "não deu para perguntar", NÃO "canal caído".
   * Confundir os dois faria uma falha de rede nossa aparecer como conta banida.
   */
  async checkHealth(escopo: {
    organizationId: string;
    sessionRef: string;
  }): Promise<ChannelHealth> {
    const admin = createAdminClient();
    const c = await instagramCredsForAccount(admin, {
      organizationId: escopo.organizationId,
      instagramUserId: escopo.sessionRef,
    });

    if (!c) {
      return { reachable: true, status: "STOPPED", detail: "conta não conectada" };
    }

    // A credencial vence, e o vencimento é sabido ANTES de perguntar à Meta —
    // é a diferença que permite avisar antes de parar de funcionar, em vez de
    // depois. O Chatwoot não tem isto: a caixa dele morre calada em 60 dias.
    if (c.expiresAt && new Date(c.expiresAt).getTime() <= Date.now()) {
      return { reachable: true, status: "FAILED", detail: "credencial vencida" };
    }

    try {
      const r = await fetch(`${c.baseUrl}/${c.graphVersion}/me?fields=id,username`, {
        headers: { Authorization: `Bearer ${c.token}` },
      });
      const corpo = (await r.json().catch(() => null)) as { id?: string } | null;
      const erro = lerErro(corpo);

      if (ehCredencialMorta(erro)) {
        return { reachable: true, status: "FAILED", detail: "credencial recusada pela Meta" };
      }
      if (!r.ok || erro) {
        return { reachable: true, status: "FAILED", detail: erro?.message ?? `HTTP ${r.status}` };
      }
      return { reachable: true, status: corpo?.id ? "WORKING" : "FAILED", detail: null };
    } catch (e) {
      // Rede nossa que falhou. `reachable: false` para o cron NÃO contar isto
      // como canal caído e sair marcando sessão que está perfeitamente viva.
      return {
        reachable: false,
        status: null,
        detail: e instanceof Error ? e.message : "falha de rede",
      };
    }
  },

  codes: CODIGOS,
};
