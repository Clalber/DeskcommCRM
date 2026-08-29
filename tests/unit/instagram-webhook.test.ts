/**
 * O webhook do Instagram: assinatura, handshake e leitura de payload.
 *
 * ─── Por que os payloads são os REAIS ───────────────────────────────────────
 *
 * Os envelopes deste arquivo seguem o formato documentado pela Meta
 * (`entry[].messaging[]`, `message.mid`, `is_echo`, `reply_to`, `attachments`).
 * Um mock escrito por quem escreve o parser concorda com o parser por
 * construção — mede a própria opinião, não o contrato do fio.
 *
 * ─── O que este arquivo protege ─────────────────────────────────────────────
 *
 * 1. **A assinatura.** Sem HMAC, quem descobrir a URL manda o que quiser: cria
 *    conversa, injeta mensagem, dispara o agente. `verify_token` não protege
 *    disso — ele só é conferido UMA vez, no cadastro.
 * 2. **O parser nunca lança.** A Meta acrescenta tipo de evento sem avisar. Um
 *    parser que estoura derruba o lote INTEIRO, e as mensagens boas que vieram
 *    junto se perdem.
 * 3. **A inversão do eco.** Na mensagem que a conta enviou, quem fala é ela: o
 *    interlocutor está em `recipient`, não em `sender`. Ler `sender` sempre
 *    amarraria a conversa ao id da própria conta — todas as conversas viravam
 *    uma só.
 */
import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  instagramVerificationChallenge,
  parseInstagramWebhook,
  verifyInstagramSignature,
} from "@/lib/channels/instagram/webhook";

const SEGREDO = "app-secret-de-teste";
const CONTA = "17841400000000001";
const PESSOA = "9876543210000001";

function assinar(corpo: string, segredo = SEGREDO): string {
  return `sha256=${createHmac("sha256", segredo).update(corpo, "utf8").digest("hex")}`;
}

/** Envelope no formato que a Meta manda. */
function envelope(messaging: unknown[]): Record<string, unknown> {
  return { object: "instagram", entry: [{ id: CONTA, time: 1735000000000, messaging }] };
}

const MENSAGEM_DE_TEXTO = {
  sender: { id: PESSOA },
  recipient: { id: CONTA },
  timestamp: 1735000000000,
  message: { mid: "aWdfZG1fMTox", text: "Oi, vocês entregam em Campinas?" },
};

describe("assinatura do webhook", () => {
  it("aceita a assinatura correta sobre o corpo CRU", () => {
    const corpo = JSON.stringify(envelope([MENSAGEM_DE_TEXTO]));
    expect(verifyInstagramSignature(corpo, assinar(corpo), SEGREDO)).toBe(true);
  });

  it("recusa corpo adulterado — é o ataque que ela existe para barrar", () => {
    const corpo = JSON.stringify(envelope([MENSAGEM_DE_TEXTO]));
    const assinatura = assinar(corpo);
    const adulterado = corpo.replace("Campinas", "Sorocaba");
    expect(verifyInstagramSignature(adulterado, assinatura, SEGREDO)).toBe(false);
  });

  it("recusa assinatura de outro segredo", () => {
    const corpo = JSON.stringify(envelope([MENSAGEM_DE_TEXTO]));
    expect(verifyInstagramSignature(corpo, assinar(corpo, "outro"), SEGREDO)).toBe(false);
  });

  it("recusa sem estourar quando o header falta, é curto ou não tem prefixo", () => {
    const corpo = "{}";
    // `timingSafeEqual` LANÇA com buffers de tamanhos diferentes; um throw aqui
    // viraria 500 num caminho que deve responder 401.
    expect(verifyInstagramSignature(corpo, null, SEGREDO)).toBe(false);
    expect(verifyInstagramSignature(corpo, "sha256=abcd", SEGREDO)).toBe(false);
    expect(verifyInstagramSignature(corpo, "sha1=abcd", SEGREDO)).toBe(false);
    expect(verifyInstagramSignature(corpo, assinar(corpo), "")).toBe(false);
  });
});

describe("handshake de verificação", () => {
  const params = (o: Record<string, string>) => new URLSearchParams(o);

  it("devolve o desafio quando o token confere", () => {
    const p = params({
      "hub.mode": "subscribe",
      "hub.verify_token": "meu-token",
      "hub.challenge": "1158201444",
    });
    expect(instagramVerificationChallenge(p, "meu-token")).toBe("1158201444");
  });

  it("recusa token errado, modo errado e token vazio dos dois lados", () => {
    const base = { "hub.mode": "subscribe", "hub.challenge": "123" };
    expect(instagramVerificationChallenge(params({ ...base, "hub.verify_token": "x" }), "y")).toBeNull();
    expect(
      instagramVerificationChallenge(
        params({ ...base, "hub.mode": "unsubscribe", "hub.verify_token": "y" }),
        "y",
      ),
    ).toBeNull();
    // Token vazio dos dois lados não casa. Quem barra é a guarda do token
    // RECEBIDO — medido por sabotagem: remover `!verifyTokenEsperado` da função
    // não derruba este caso, porque `""` já morre antes. A guarda do esperado é
    // redundante e fica como cinto de segurança, não como a proteção efetiva.
    expect(instagramVerificationChallenge(params({ ...base, "hub.verify_token": "" }), "")).toBeNull();
  });
});

describe("leitura do payload", () => {
  it("lê uma mensagem de texto com os campos que a ingestão precisa", () => {
    const { eventos, ignorados } = parseInstagramWebhook(envelope([MENSAGEM_DE_TEXTO]));

    expect(ignorados).toBe(0);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({
      externalId: "aWdfZG1fMTox",
      providerUserId: PESSOA,
      contaId: CONTA,
      texto: "Oi, vocês entregam em Campinas?",
      ehEco: false,
      midias: [],
    });
  });

  it("INVERTE os papéis no eco — senão toda conversa vira uma só", () => {
    const eco = {
      sender: { id: CONTA },
      recipient: { id: PESSOA },
      timestamp: 1735000001000,
      message: { mid: "aWdfZG1fMToy", text: "Entregamos sim!", is_echo: true },
    };

    const { eventos } = parseInstagramWebhook(envelope([eco]));

    expect(eventos[0]?.ehEco).toBe(true);
    // A asserção central: o INTERLOCUTOR continua sendo a pessoa, e a conta
    // continua sendo a conta — mesmo com os campos trocados no fio.
    expect(eventos[0]?.providerUserId).toBe(PESSOA);
    expect(eventos[0]?.contaId).toBe(CONTA);
  });

  it("lê anexos por URL e o `reply_to`", () => {
    const comMidia = {
      sender: { id: PESSOA },
      recipient: { id: CONTA },
      timestamp: 1735000002000,
      message: {
        mid: "aWdfZG1fMTaz",
        attachments: [{ type: "image", payload: { url: "https://lookaside.fbsbx.com/x.jpg" } }],
        reply_to: { mid: "aWdfZG1fMTox" },
      },
    };

    const { eventos } = parseInstagramWebhook(envelope([comMidia]));

    expect(eventos[0]?.midias).toEqual([
      { tipo: "image", url: "https://lookaside.fbsbx.com/x.jpg" },
    ]);
    expect(eventos[0]?.respostaA).toBe("aWdfZG1fMTox");
    expect(eventos[0]?.texto).toBeNull();
  });

  it("lê `standby` — conta com dois integradores não perde mensagem", () => {
    const env = {
      object: "instagram",
      entry: [{ id: CONTA, time: 1, standby: [MENSAGEM_DE_TEXTO] }],
    };
    expect(parseInstagramWebhook(env).eventos).toHaveLength(1);
  });

  it("conta o que não trata em vez de estourar", () => {
    const env = envelope([
      { sender: { id: PESSOA }, recipient: { id: CONTA }, read: { mid: "x" } },
      { sender: { id: PESSOA }, recipient: { id: CONTA }, reaction: { emoji: "❤️" } },
      // Mensagem sem texto e sem mídia: nada a mostrar na conversa.
      { sender: { id: PESSOA }, recipient: { id: CONTA }, message: { mid: "y", is_unsupported: true } },
    ]);
    const { eventos, ignorados } = parseInstagramWebhook(env);
    expect(eventos).toHaveLength(0);
    expect(ignorados).toBe(3);
  });

  it("NUNCA lança — payload torto derrubaria o lote inteiro", () => {
    // Cada um destes já apareceu em alguma integração da Meta: campo ausente,
    // tipo trocado, array onde se esperava objeto.
    const tortos: unknown[] = [
      null,
      undefined,
      {},
      { object: "page", entry: [] },
      { object: "instagram", entry: "não é array" },
      { object: "instagram", entry: [{ messaging: "nem isto" }] },
      { object: "instagram", entry: [{ messaging: [{ message: { mid: 42 } }] }] },
      { object: "instagram", entry: [{ messaging: [{ sender: { id: PESSOA } }] }] },
    ];

    for (const t of tortos) {
      expect(() => parseInstagramWebhook(t)).not.toThrow();
      expect(parseInstagramWebhook(t).eventos).toEqual([]);
    }
  });

  it("lê o lote INTEIRO mesmo com um evento ruim no meio", () => {
    // O caso que motiva "nunca lança": a Meta manda várias mensagens num POST,
    // e uma torta não pode levar as boas junto.
    const env = envelope([
      MENSAGEM_DE_TEXTO,
      { sender: {}, message: { mid: null } },
      {
        sender: { id: PESSOA },
        recipient: { id: CONTA },
        timestamp: 1735000003000,
        message: { mid: "aWdfZG1fMTo0", text: "segunda mensagem" },
      },
    ]);

    const { eventos, ignorados } = parseInstagramWebhook(env);
    expect(eventos).toHaveLength(2);
    expect(ignorados).toBe(1);
  });
});
