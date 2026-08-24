/**
 * A AUTOMAÇÃO NÃO PODE CARIMBAR "SUCESSO" NUMA MENSAGEM QUE NÃO SAIU.
 *
 * ═══ O defeito, medido antes do conserto ═══
 *
 * `sendMessageHandler` não lança quando o envio falha: ele marca a LINHA da
 * mensagem (`status='failed'` + `error_code`) ou a deixa em `queued`, e devolve
 * a mensagem normalmente — porque quem o chama pela tela é o Inbox, que
 * renderiza a bolha com o estado dela.
 *
 * A ação da automação só olhava se houve exceção. Reproduzido neste repo com
 * WAHA fora do ar e a regra ligada exatamente como a tela a monta:
 *
 *     automation_rule_runs.status = 'success'   ← ✓ verde na aba Atividade
 *     messages.status             = 'failed'
 *     messages.error_code         = 'waha_error'
 *
 * O cliente não recebeu nada e a tela disse que deu certo. Tela que afirma
 * sucesso é pior que tela silenciosa: quem a lê para de procurar.
 *
 * ═══ O que este arquivo vigia ═══
 *
 * A tradução PURA de estado-da-mensagem → desfecho-do-run. É onde a decisão
 * mora, e é o que precisa continuar valendo para as DUAS ações de envio
 * (`send_whatsapp_message` e `send_ai_message`) — o último caso abaixo é o que
 * reprova se alguém escrever uma terceira ação de envio traduzindo por conta
 * própria.
 */
import { describe, expect, it } from "vitest";

import { desfechoDoEnvio, motivoLegivel } from "@/lib/automation/desfecho-do-envio";

describe("desfechoDoEnvio — o run conta o que aconteceu com a mensagem", () => {
  it("mensagem enviada vira sucesso", () => {
    const d = desfechoDoEnvio("send_whatsapp_message", { id: "m1", status: "sent" });
    expect(d.status).toBe("success");
  });

  it.each(["delivered", "read"])("mensagem %s também é sucesso (o adapter já confirmou)", (s) => {
    expect(desfechoDoEnvio("send_whatsapp_message", { id: "m1", status: s }).status).toBe("success");
  });

  it("O DEFEITO: mensagem em falha NÃO vira sucesso", () => {
    const d = desfechoDoEnvio("send_whatsapp_message", {
      id: "m1",
      status: "failed",
      error_code: "waha_error",
      error_message: "fetch failed",
    });
    expect(d.status).toBe("failed");
  });

  it("a falha chega com frase de gente, não com o código do adapter", () => {
    const d = desfechoDoEnvio("send_whatsapp_message", {
      id: "m1",
      status: "failed",
      error_code: "waha_error",
      error_message: "fetch failed",
    });
    // Quem lê a aba Atividade é quem montou a automação, não quem escreveu o adapter.
    expect(d.error).toContain("serviço de WhatsApp");
    expect(d.error).not.toBe("fetch failed");
  });

  it("erro SEM tradução conhecida ainda diz alguma coisa — nunca fica mudo", () => {
    const d = desfechoDoEnvio("send_whatsapp_message", {
      id: "m1",
      status: "failed",
      error_code: "codigo_que_ninguem_mapeou",
      error_message: "explosão inesperada",
    });
    expect(d.status).toBe("failed");
    expect(d.error).toBe("explosão inesperada");
  });

  it("mensagem na fila vira ADIADO, não falha — ela ainda pode sair", () => {
    const d = desfechoDoEnvio("send_whatsapp_message", {
      id: "m1",
      status: "queued",
      metadata: { queued_reason: "channel_session_not_working" },
    });
    // `failed` faria quem lê desistir de uma mensagem que o watchdog resgata
    // quando o número reconectar.
    expect(d.status).toBe("postponed");
    expect(String(d.detail?.explicacao)).toContain("não está conectado");
  });

  it("fila SEM motivo declarado ainda explica a espera", () => {
    const d = desfechoDoEnvio("send_whatsapp_message", { id: "m1", status: "queued" });
    expect(d.status).toBe("postponed");
    expect(d.detail?.reason).toBe("aguardando_o_canal");
    expect(String(d.detail?.explicacao)).not.toBe("");
  });

  it("estado DESCONHECIDO falha aberto na informação — nunca vira sucesso por omissão", () => {
    // Um status novo em `messages` (hoje inexistente) não pode ser lido como
    // "deu certo" só porque não é `failed`.
    const d = desfechoDoEnvio("send_whatsapp_message", { id: "m1", status: "status_do_futuro" });
    expect(d.status).toBe("failed");
  });

  it("o id da mensagem viaja no detalhe em todos os desfechos", () => {
    for (const status of ["sent", "failed", "queued", "status_do_futuro"]) {
      const d = desfechoDoEnvio("x", { id: "m-abc", status });
      expect(d.detail?.message_id).toBe("m-abc");
    }
  });

  it("o tipo da ação é preservado — a tela rotula por ele", () => {
    expect(desfechoDoEnvio("send_ai_message", { id: "m1", status: "sent" }).type).toBe(
      "send_ai_message",
    );
  });

  it("motivoLegivel devolve null para código desconhecido (o chamador é quem decide o fallback)", () => {
    expect(motivoLegivel("nao_existe")).toBeNull();
    expect(motivoLegivel(null)).toBeNull();
    expect(motivoLegivel("channel_archived")).toContain("excluído");
  });
});

describe("as duas ações de envio usam o MESMO tradutor", () => {
  it("nenhuma ação de automação deriva o desfecho de conta própria", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const dir = join(process.cwd(), "lib", "automation", "actions");
    const acoes = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    // Guarda de vacuidade: se a varredura parar de achar arquivos, ela não
    // estaria provando nada.
    expect(acoes.length).toBeGreaterThan(3);

    const culpadas: string[] = [];
    for (const arquivo of acoes) {
      const src = readFileSync(join(dir, arquivo), "utf8");
      // Quem chama o handler de envio TEM que passar o RETORNO dele pelo
      // tradutor. Uma ação que chame `sendMessageHandler` e monte o resultado à
      // mão está replantando o defeito.
      //
      // A checagem é pela CHAMADA (`reportarEnvio(`), não pela menção do nome:
      // medido por sabotagem, a versão anterior — `src.includes("reportarEnvio")`
      // — passava VERDE com o desfecho montado à mão e um `void reportarEnvio;`
      // sobrando no arquivo, que é exatamente a forma que um refactor
      // apressado deixaria.
      //
      // PONTO CEGO DECLARADO: chamar `reportarEnvio(...)` e ignorar o retorno
      // ainda engana esta varredura. Fechar isso exigiria AST, e o custo não se
      // paga aqui — os casos de comportamento acima é que provam a tradução; a
      // varredura existe para pegar a ação NOVA que nasce sem ela.
      if (/\bsendMessageHandler\s*\(/.test(src) && !/\breportarEnvio\s*\(/.test(src)) {
        culpadas.push(arquivo);
      }
    }
    expect(culpadas).toEqual([]);
  });
});
