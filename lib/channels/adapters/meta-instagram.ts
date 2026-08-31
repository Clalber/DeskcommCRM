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

import { assertDestinoResolvidoSeguro } from "@/lib/automation/outbound-ip";
import { assertSafeOutboundUrl } from "@/lib/automation/outbound-url";
import { logger } from "@/lib/logger";
import { MAX_MEDIA_BYTES, MediaTooLargeError, type FetchedMedia } from "@/lib/messaging/media/types";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  instagramCredsForAccount,
  type InstagramCredentials,
} from "../instagram/credentials";
import { assinarAplicativoNaConta, contaEstaAssinada } from "../instagram/oauth";
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
  /** Só o host `graph.instagram.com` manda. Quando vem, é a palavra final. */
  is_transient?: boolean;
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
 * `10 / 2534022` — "This message is sent outside of allowed window" — está na
 * tabela oficial de códigos da Meta. A página responde 500 hoje; o texto veio do
 * arquivo da mesma URL. Há DOIS subcódigos irmãos (`2018278`, `2018065`) e um
 * `1545041` que a tabela simplificada chama de "messaging window closed" — a
 * própria Meta é inconsistente aqui, então tratamos a família inteira.
 */
export function ehForaDaJanela(erro: ErroDaMeta | null): boolean {
  if (erro?.code !== 10) return erro?.error_subcode === 1545041;
  return true;
}

/**
 * A pessoa não pode receber — bloqueou, desativou ou está indisponível.
 *
 * `551` e `10 / 2018108` e `200 / 1545041`. É DEFINITIVO e precisa ser separado
 * de "falhou": retentar mensagem para quem bloqueou é gastar cota e insistir com
 * alguém que pediu para não ser incomodado.
 */
export function ehDestinatarioIndisponivel(erro: ErroDaMeta | null): boolean {
  if (erro?.code === 551) return true;
  if (erro?.code === 10 && erro?.error_subcode === 2018108) return true;
  return erro?.code === 200 && erro?.error_subcode === 1545041;
}

/**
 * Vale retentar?
 *
 * É a pergunta que decide se a mensagem volta para a fila ou morre. Errar para
 * o lado "retenta" com erro definitivo queima cota contra uma parede; errar
 * para o lado "desiste" com erro transitório perde mensagem que teria saído.
 *
 * A lista vem da tabela oficial de tratamento de erro da Graph API — os códigos
 * cujo "What To Do" é literalmente *"Wait and retry the operation"* — mais o
 * `is_transient`, que o host `graph.instagram.com` manda no corpo (ele usa
 * `IGApiException`, não `OAuthException`, e sinaliza transitoriedade explícita).
 */
export function valeRetentar(erro: ErroDaMeta | null): boolean {
  if (!erro) return false;
  if (erro.is_transient === true) return true;
  // 1/2 indisponibilidade, 4/17/32/341/613 cota, 368 bloqueio temporário por
  // política, 80002 o balde de uso de negócio do Instagram.
  return [1, 2, 4, 17, 32, 341, 368, 613, 80002].includes(erro.code ?? -1);
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


/**
 * De onde a Meta serve anexo do Direct.
 *
 * ⚠️ Esta lista fecha um furo que as guardas genéricas de SSRF NÃO fecham.
 * `assertSafeOutboundUrl` e `assertDestinoResolvidoSeguro` julgam a PRIMEIRA
 * URL; um host público aprovado por elas que responda `302` apontando para a
 * rede interna é seguido sem ninguém revalidar. É o bypass clássico de
 * validar-e-depois-buscar, e o canal intermediado tem o mesmo buraco.
 *
 * Com a lista, o alvo deixa de ser "qualquer host público" e passa a ser "a CDN
 * da Meta" — e o redirecionamento para fora dela morre por construção, em vez
 * de depender de mais uma checagem que alguém pode esquecer de repetir.
 *
 * Os valores foram MEDIDOS, não presumidos: as três mídias que chegaram em
 * produção vieram de `lookaside.fbsbx.com`. Os outros dois entram porque a Meta
 * serve foto de perfil e mídia de feed deles, e falhar fechado num host legítimo
 * seria trocar um risco por uma falha de produto.
 *
 * Se a Meta mudar de host, isto falha FECHADO e VISÍVEL — a mídia não baixa e o
 * erro nomeia o host recusado. É melhor que o contrário: abrir para a internet
 * inteira por precaução.
 */
const HOSTS_DE_MIDIA_DA_META = [
  "lookaside.fbsbx.com",
  ".cdninstagram.com",
  ".fbcdn.net",
] as const;

export function hostEhDaMeta(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return HOSTS_DE_MIDIA_DA_META.some((p) => (p.startsWith(".") ? h.endsWith(p) : h === p));
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
          : ehDestinatarioIndisponivel(erro)
            ? "esta pessoa não está recebendo mensagens suas"
            : detalhe;
      // O sufixo diz a quem lê o log se a fila deve insistir. Sem ele, "falhou"
      // é a mesma palavra para "tente de novo em um minuto" e para "nunca vai
      // funcionar" — e quem decide fica sem a informação que precisa.
      const seguir = valeRetentar(erro) ? " [transitório]" : " [definitivo]";
      throw new Error(`${CODIGOS.sendFailed}: ${rotulo}${seguir}`);
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
      if (!corpo?.id) return { reachable: true, status: "FAILED", detail: null };

      // ─── REPARO: alcançável NÃO é o mesmo que recebendo ────────────────────
      //
      // Token válido e `/me` respondendo não significam que a mensagem chega. A
      // conta profissional precisa estar INSCRITA no aplicativo, por chamada de
      // API — e uma conta que nunca foi inscrita, ou que perdeu a inscrição,
      // fica `WORKING` e muda. Foi exatamente esse estado que custou horas de
      // investigação na primeira conexão real.
      //
      // Conferir e reassinar aqui fecha o laço sozinho, na rodada de saúde que
      // já roda a cada cinco minutos, sem ninguém intervir — e repara também
      // quem conectou ANTES de o fluxo de conexão passar a assinar.
      const inscricao = await contaEstaAssinada({
        token: c.token,
        baseUrl: c.baseUrl,
        graphVersion: c.graphVersion,
      });

      // Não conseguir PERGUNTAR não rebaixa a conexão: seria falha de rede
      // nossa virando "canal quebrado" na tela do cliente.
      if (inscricao.ok && !inscricao.assinada) {
        const reassinada = await assinarAplicativoNaConta({
          token: c.token,
          baseUrl: c.baseUrl,
          graphVersion: c.graphVersion,
        });
        if (!reassinada.ok) {
          return {
            reachable: true,
            status: "FAILED",
            detail: `conta sem inscrição do aplicativo: ${reassinada.motivo}`,
          };
        }
      }

      return { reachable: true, status: "WORKING", detail: null };
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

  /**
   * Quem é a pessoa do outro lado.
   *
   * ─── Por que isto não roda na entrada da mensagem ───────────────────────────
   *
   * Porque é uma chamada de rede, e o caminho de entrada precisa gravar a
   * mensagem e devolver 200 rápido — a Meta reentrega o lote inteiro quando
   * demora. Quem chama é a rodada de perfis, fora do caminho quente.
   *
   * ─── A pergunta só funciona depois de a pessoa escrever ─────────────────────
   *
   * O IGSID é escopado à conta, e a Meta só o resolve para quem já mandou
   * mensagem para ela. Não é limitação nossa: é como o canal funciona, e é por
   * isso que o contato nasce com nome provisório em vez de nascer certo.
   */
  async fetchProfile(entrada: {
    organizationId: string;
    sessionRef: string;
    recipient: string;
  }): Promise<{ nome: string | null; username: string | null; fotoUrl: string | null } | null> {
    const admin = createAdminClient();
    const c = await instagramCredsForAccount(admin, {
      organizationId: entrada.organizationId,
      instagramUserId: entrada.sessionRef,
    });
    if (!c) return null;

    const u = new URL(`/${c.graphVersion}/${entrada.recipient}`, c.baseUrl);
    u.searchParams.set("fields", "name,username,profile_pic");

    let r: Response;
    try {
      // Token no CABEÇALHO, como em todo o resto deste arquivo: na query ele
      // entra no log de qualquer proxy no caminho.
      r = await fetch(u.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${c.token}` },
      });
    } catch {
      // Falha de rede é "não deu para perguntar", NÃO "pessoa sem perfil".
      // Confundir os dois faria a rodada carimbar o contato como consultado e
      // não voltar nele — o nome ficaria provisório para sempre.
      return null;
    }

    if (!r.ok) return null;

    const dados = (await r.json().catch(() => null)) as {
      name?: unknown;
      username?: unknown;
      profile_pic?: unknown;
    } | null;
    if (!dados) return null;

    const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : null);
    return {
      nome: str(dados.name),
      username: str(dados.username),
      // A URL é ASSINADA E TEMPORÁRIA. Quem chama baixa os bytes; guardar a URL
      // produziria um avatar que quebra sozinho em alguns dias.
      fotoUrl: str(dados.profile_pic),
    };
  },

  /**
   * Baixa os bytes de uma mídia que chegou pelo Direct.
   *
   * ─── O que a ausência deste método custava ──────────────────────────────────
   *
   * O worker de persistência testa a PRESENÇA dele (`workers/media-persist-worker.ts`)
   * e, sem ele, devolve `canal_sem_midia_de_entrada` e segue em frente. Medido em
   * produção: imagem e áudio chegavam na conversa com `media_url` gravada, o
   * evento de download era processado com sucesso, e os bytes nunca eram
   * buscados — o atendente via "imagem" sem imagem, e o agente de IA recebia uma
   * mensagem sem conteúdo. Nada falhava; só não acontecia.
   *
   * ─── SEM credencial no cabeçalho, e isso é a decisão de segurança ───────────
   *
   * A URL do anexo vem do PAYLOAD do webhook. O canal intermediado manda a chave
   * do tenant neste fetch, e o comentário dele nomeia o preço: um payload
   * hostil faz o servidor ENTREGAR a credencial ao host que o atacante escolheu.
   *
   * Aqui não mandamos nada. A CDN da Meta serve o anexo por URL já assinada, com
   * o token embutido nos parâmetros dela — então o cabeçalho de autorização é
   * desnecessário, e não mandá-lo apaga essa classe inteira de risco em vez de
   * mitigá-la. Se um dia a Meta passar a exigir cabeçalho, a resposta certa NÃO
   * é acrescentá-lo aqui: é reconstruir a URL sobre uma base fixa, como o canal
   * por QR faz.
   *
   * As duas guardas continuam, porque o payload segue sendo entrada externa e
   * porque o servidor buscando URL escolhida por terceiro é SSRF mesmo sem
   * credencial junto — dá para varrer rede interna e ler metadado de nuvem.
   */
  async fetchInboundMedia(input: {
    organizationId: string;
    sessionRef: string;
    url: string;
    hintMime?: string | null;
  }): Promise<FetchedMedia> {
    // A recusa barata primeiro (esquema, http em produção, IPv6 literal, faixa
    // privada), depois a que paga DNS e julga o IP resolvido — é esse par que
    // fecha o rebinding, e é o mesmo que o repo já usa no webhook de saída.
    assertSafeOutboundUrl(input.url);
    const alvo = new URL(input.url);
    // A lista PRIMEIRO: ela é o que impede o redirecionamento para fora da CDN,
    // e é barata. As genéricas continuam depois, porque um host da Meta
    // sequestrado por DNS ainda seria endereço interno.
    if (!hostEhDaMeta(alvo.hostname)) {
      throw new Error(`instagram_media_failed: host não é da Meta (${alvo.hostname})`);
    }
    await assertDestinoResolvidoSeguro(alvo.hostname);

    let r: Response;
    try {
      r = await fetch(input.url, {
        // ⚠️ Nenhum `Authorization`. Ver o parágrafo acima — é decisão, não
        // esquecimento.
        // ⚠️ `manual`, e NÃO `follow`. As guardas acima julgam a primeira URL;
        // seguir redirecionamento às cegas as anula, porque o destino final
        // nunca é revalidado. Medido em produção: a CDN da Meta responde 200
        // direto, com zero redirecionamentos — então não seguir não custa nada,
        // e um 3xx aqui passa a ser sinal de que algo mudou, não silêncio.
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw new Error(
        `instagram_media_failed: ${e instanceof Error ? e.message : "rede"}`,
      );
    }

    // Um 3xx com `redirect: "manual"` não é `ok`, então cai no ramo abaixo com o
    // status na mensagem — que é o desfecho certo: alguém precisa olhar para
    // onde a Meta passou a apontar antes de nós seguirmos para lá.
    if (!r.ok) {
      // O status distingue os dois desfechos que importam a quem investiga:
      // 403/404 é URL VENCIDA (a Meta expira o anexo, e retentar não traz de
      // volta), 5xx é indisponibilidade que passa.
      throw new Error(`instagram_media_failed: ${r.status} ${r.statusText}`.trim());
    }

    // ⚠️ O teto é conferido pelo CABEÇALHO antes de ler o corpo. Só medir
    // depois de `arrayBuffer()` significa que um arquivo de gigabytes já entrou
    // na memória do worker — que atende todas as organizações da instalação.
    const declarado = Number(r.headers.get("content-length") ?? "0");
    if (Number.isFinite(declarado) && declarado > MAX_MEDIA_BYTES) {
      throw new MediaTooLargeError();
    }

    const buffer = Buffer.from(await r.arrayBuffer());
    // E de novo depois: `content-length` é declaração do outro lado, não
    // promessa. Sem esta segunda conferência, quem omitisse o cabeçalho passaria
    // reto pela primeira.
    if (buffer.byteLength > MAX_MEDIA_BYTES) throw new MediaTooLargeError();

    // O `content-type` da RESPOSTA manda sobre a dica do webhook: é o que o
    // arquivo realmente é, e é ele que vai no upload.
    const mime =
      r.headers.get("content-type")?.split(";")[0]?.trim() ||
      input.hintMime ||
      "application/octet-stream";
    return { buffer, mime };
  },

  /**
   * O "digitando…" do Direct.
   *
   * A Meta expõe isto no MESMO endereço do envio, trocando `message` por
   * `sender_action`. Não é uma API à parte, e é por isso que reusa a credencial
   * e o caminho já provados por `send` em vez de abrir um segundo.
   *
   * ─── Por que NUNCA lança, e por que isso é a parte importante ──────────────
   *
   * O contrato manda devolver `boolean`, e o comentário dele nomeia o preço de
   * fazer diferente: um `await` sem `try` no meio da cadeia de envio derrubaria
   * a MENSAGEM por causa do enfeite. O `send` deste mesmo arquivo lança de
   * propósito — mensagem que não saiu precisa virar status e retentativa. Aqui é
   * o oposto: sinal de presença que não saiu não precisa virar nada.
   *
   * Então tudo é engolido: credencial ausente, rede caída, recusa da Meta,
   * estouro de prazo. O `false` diz "não aceitou"; ninguém acima precisa saber
   * mais que isso, e o log estruturado guarda o motivo para quem investigar.
   *
   * ─── O prazo é curto de propósito ─────────────────────────────────────────
   *
   * 5s, contra os 30s da busca de mídia. O indicador vive segundos e quem o quer
   * aceso renova; um sinal que chega depois de 20s chega depois da resposta que
   * ele deveria anunciar — e, pior, teria segurado a cadeia de envio esse tempo
   * todo esperando por um enfeite.
   */
  async setTyping(input: {
    organizationId: string;
    sessionRef: string;
    recipient: string;
    typing: boolean;
  }): Promise<boolean> {
    try {
      const admin = createAdminClient();
      const c = await creds(admin, input.organizationId, input.sessionRef);

      const r = await fetch(`${c.baseUrl}/${c.graphVersion}/${c.instagramUserId}/messages`, {
        method: "POST",
        headers: {
          // Mesma decisão do `send`: token no cabeçalho, nunca na query — ali
          // ele vira credencial no log de qualquer proxy do caminho.
          Authorization: `Bearer ${c.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { id: input.recipient },
          sender_action: input.typing ? "typing_on" : "typing_off",
        }),
        signal: AbortSignal.timeout(5_000),
      });

      // A Meta responde 200 com corpo de erro em alguns casos — o mesmo motivo
      // pelo qual `send` consulta `lerErro` em vez de confiar só no status.
      const corpo = (await r.json().catch(() => null)) as unknown;
      const erro = lerErro(corpo);
      if (!r.ok || erro) {
        logger.debug("[instagram.setTyping] a Meta recusou o sinal", {
          status: r.status,
          motivo: erro?.message,
          organizationId: input.organizationId,
        });
        return false;
      }
      return true;
    } catch (err) {
      logger.debug("[instagram.setTyping] não deu para sinalizar", {
        erro: err instanceof Error ? err.message : String(err),
        organizationId: input.organizationId,
      });
      return false;
    }
  },

  codes: CODIGOS,
};
