/**
 * Erro que não se cura não merece cinco chamadas de modelo.
 *
 * ─── O defeito ──────────────────────────────────────────────────────────────
 *
 * O motor do agente tratava TODA falha de envio como transitória: o turno
 * lançava, o job voltava para a fila **sem espera**, e o modelo rodava de novo,
 * até cinco vezes. Para "canal excluído" ou "contato sem endereço" — que só uma
 * pessoa resolve — isso chega ao mesmo lugar gastando cinco chamadas de IA, e o
 * operador vê a mesma mensagem falhar cinco vezes.
 *
 * ─── A assimetria que decide a régua ────────────────────────────────────────
 *
 * Errar para o lado "definitivo" **PERDE mensagem que teria saído**. Errar para
 * o lado "transitório" só gasta tokens. Por isso a lista é curta, e por isso
 * basta UMA falha transitória no lote para o run inteiro voltar a ser
 * retentável — é o oposto de otimizar, e é deliberado.
 */
import { describe, expect, it } from "vitest";

import {
  CODIGOS_DE_FALHA_DEFINITIVA,
  todasFalhasSaoDefinitivas,
} from "@/lib/channels/frases-de-falha";

describe("o que conta como definitivo", () => {
  it("canal excluído e contato sem endereço não se curam sozinhos", () => {
    expect(todasFalhasSaoDefinitivas(["channel_archived"])).toBe(true);
    expect(todasFalhasSaoDefinitivas(["missing_phone_number"])).toBe(true);
    expect(todasFalhasSaoDefinitivas(["channel_archived", "missing_phone_number"])).toBe(true);
  });

  it("erro de serviço ou de rede SEGUE retentável", () => {
    // Estes se curam com o tempo. Tratá-los como definitivos perderia mensagem
    // que sairia sozinha na tentativa seguinte — o desfecho que o operador não
    // consegue contornar.
    expect(todasFalhasSaoDefinitivas(["waha_error"])).toBe(false);
    expect(todasFalhasSaoDefinitivas(["meta_error"])).toBe(false);
    expect(todasFalhasSaoDefinitivas(["storage_sign_failed"])).toBe(false);
    expect(todasFalhasSaoDefinitivas(["instagram_send_failed"])).toBe(false);
  });

  it("UMA transitória no lote basta para o run inteiro ser retentado", () => {
    // A régua conservadora. Se o lote tem uma falha que se cura, o run volta —
    // mesmo que as outras sejam definitivas. É mais caro e é o lado certo de
    // errar.
    expect(todasFalhasSaoDefinitivas(["channel_archived", "waha_error"])).toBe(false);
  });

  it("código NULO nunca é definitivo", () => {
    // Sem código não há como afirmar que não se cura. Na dúvida, retenta.
    expect(todasFalhasSaoDefinitivas([null])).toBe(false);
    expect(todasFalhasSaoDefinitivas(["channel_archived", null])).toBe(false);
  });

  it("lote VAZIO não é definitivo — é ausência de falha", () => {
    // Guarda de vacuidade: `every` numa lista vazia devolve `true`, e sem esta
    // linha um lote sem falha nenhuma seria classificado como fatal — matando
    // job que não tinha problema algum.
    expect(todasFalhasSaoDefinitivas([])).toBe(false);
  });

  it("a lista é CURTA, e crescer nela é decisão perigosa", () => {
    // Não é preciosismo: cada código aqui é uma classe de mensagem que deixa de
    // ser retentada. Se alguém dobrar esta lista sem pensar, este caso obriga a
    // encarar o número.
    expect(CODIGOS_DE_FALHA_DEFINITIVA.length).toBeLessThanOrEqual(4);
  });
});

describe("a fiação até a fila", () => {
  it("o código do erro atravessa as três camadas até o turno", async () => {
    // O código nasce no handler, passa pelo envio do motor, pelo adapter do
    // motor, e chega ao turno. Se qualquer elo largar o campo, a decisão vira
    // sempre "transitório" e o laço volta — em silêncio, porque nada falha.
    const { readFileSync } = await import("node:fs");

    const envio = readFileSync("lib/agent-engine/edge/crm/send-message.ts", "utf8");
    expect(envio).toContain("errorCode");
    // O replay precisa trazer o código do banco: sem isso, uma falha definitiva
    // reconhecida depois de um crash voltaria a ser tratada como transitória.
    expect(envio).toContain("select id, status, error_code from messages");

    const adapter = readFileSync("lib/agent-engine/edge/channel/waha-adapter.ts", "utf8");
    expect(adapter).toContain("errorCode: outcome.errorCode");

    const turno = readFileSync("lib/agent-engine/agent/inbound-turn.ts", "utf8");
    expect(turno).toContain("todasFalhasSaoDefinitivas");
    expect(turno).toContain("fatal");
  });

  it("morre pelo caminho do `dead`, que ABRE alerta — nunca por cancelamento mudo", async () => {
    const { readFileSync } = await import("node:fs");
    const fila = readFileSync("lib/agent-engine/queue/queue.ts", "utf8");

    // O `case` decide `dead` quando é fatal OU quando esgotou as tentativas. O
    // ramo do alerta `job_dead` é o mesmo — e é por isso que não se usa
    // `cancelJob`: ele é silencioso por desenho, e trocar cinco tentativas
    // inúteis por silêncio seria piorar, não consertar.
    expect(fila).toContain("when $4 or attempts >= max_attempts then 'dead'");
    expect(fila).toContain("'job_dead'");

    const worker = readFileSync("workers/agent-worker/main.ts", "utf8");
    expect(worker).toContain("{ fatal }");
    // `cancelJob` continua existindo, para o veto de negócio — que é outra
    // coisa, e legitimamente silenciosa.
    expect(worker).toContain("cancelJob");
  });
});
