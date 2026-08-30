/**
 * O handshake de cadastro do webhook lê o segredo CERTO.
 *
 * ─── O defeito que este arquivo existe para não deixar voltar ───────────────
 *
 * A migration 0208 separou dois segredos que dividiam uma coluna: o App Secret,
 * que assina o HMAC de cada mensagem, e o verify token, que a Meta devolve uma
 * única vez ao cadastrar a URL. A separação criou a coluna nova, a tela passou a
 * gravar nela — e o leitor do handshake continuou lendo a coluna antiga.
 *
 * Ninguém percebeu porque **o handshake não tinha um teste sequer**. A auditoria
 * adversarial disse isso com todas as letras ("zero testes de rota"), e a
 * previsão dela se cumpriu na primeira conexão real: a Meta mandou o token
 * certo, comparamos com o App Secret, e ela respondeu "não foi possível validar
 * a URL de callback ou o token de verificação" — uma mensagem que aponta para a
 * URL, que estava certa, e não para o único lugar onde o defeito morava.
 *
 * Medido em produção na 2.2.0, com o cliente esperando na tela.
 */
import { describe, expect, it } from "vitest";

import { segredoDoHandshake } from "@/lib/channels/inbound";
import { CHANNEL_PROVIDER_INSTAGRAM, CHANNEL_PROVIDER_ZERNIO } from "@/lib/channels/capabilities";

const APP_SECRET = "\\xAPPSECRET_que_assina_as_mensagens";
const VERIFY = "\\xVERIFYTOKEN_que_a_meta_devolve";

describe("qual segredo prova a origem no cadastro", () => {
  it("no canal que SEPARA os dois, é o verify token — nunca o App Secret", () => {
    const escolhido = segredoDoHandshake({
      provider: CHANNEL_PROVIDER_INSTAGRAM,
      webhook_secret_encrypted: APP_SECRET,
      instagram_verify_token_encrypted: VERIFY,
    });

    expect(escolhido).toBe(VERIFY);
    // A asserção que importa tanto quanto: o segredo que ASSINA não é oferecido
    // ao handshake. Se fosse, o operador teria de colá-lo no painel da Meta —
    // um segredo de assinatura num campo de configuração que o dashboard exibe.
    expect(escolhido).not.toBe(APP_SECRET);
  });

  it("sem verify token gravado NÃO cai no App Secret — recusa", () => {
    // Este é o caso que desfaria a 0208 em silêncio. `null` faz a rota
    // responder 404, e o operador descobre que falta configuração; um fallback
    // faria o App Secret virar verify token sem ninguém decidir isso.
    expect(
      segredoDoHandshake({
        provider: CHANNEL_PROVIDER_INSTAGRAM,
        webhook_secret_encrypted: APP_SECRET,
        instagram_verify_token_encrypted: null,
      }),
    ).toBeNull();
  });

  it("canal que NÃO separa segue usando a coluna única", () => {
    // O controle: sem ele, uma função que devolvesse sempre a coluna nova
    // passaria nos dois casos acima e quebraria o canal irmão.
    expect(
      segredoDoHandshake({
        provider: CHANNEL_PROVIDER_ZERNIO,
        webhook_secret_encrypted: APP_SECRET,
        instagram_verify_token_encrypted: null,
      }),
    ).toBe(APP_SECRET);
  });
});

describe("a rota traz as colunas de que o handshake precisa", () => {
  it("o select inclui a coluna do verify token", async () => {
    // A guarda contra o defeito na OUTRA ponta: a função pode escolher certo e a
    // rota não ter trazido a coluna do banco — e aí o valor chega `undefined`,
    // o handshake responde 404, e o sintoma é idêntico ao que já pagamos.
    const { COLUNAS_DO_HANDSHAKE } = await import("@/lib/channels/inbound");
    expect(COLUNAS_DO_HANDSHAKE).toContain("instagram_verify_token_encrypted");
    expect(COLUNAS_DO_HANDSHAKE).toContain("webhook_secret_encrypted");

    const { readFileSync } = await import("node:fs");
    const rota = readFileSync(
      "app/api/v1/webhooks/channel/[token]/route.ts",
      "utf8",
    );
    // A rota usa a CONSTANTE, e não uma lista de colunas escrita à mão: duas
    // listas divergem na primeira que alguém editar, e a que fica para trás é
    // sempre a do arquivo que ninguém abriu.
    expect(rota).toContain("COLUNAS_DO_HANDSHAKE");
    expect(rota).toContain("segredoDoHandshake");
  });
});
