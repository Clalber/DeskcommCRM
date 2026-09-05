import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * O CRON DO FOLLOW-UP TEM DE LIGAR AS DUAS PEÇAS DO LEMBRETE DE COMPROMISSO.
 *
 * ─── Por que esta cerca existe, e por que ela lê TEXTO ───────────────────────
 *
 * As duas peças desta entrega são invisíveis para todos os gates:
 *
 *   1. `runAppointmentSweep` — sem a chamada no tick, o gatilho existe, tem
 *      teste unitário verde, aparece na tela, salva no banco e NUNCA roda.
 *   2. `resolverTexto` — é um campo OPCIONAL de `TickDeps` (opcional de
 *      propósito: dezenas de testes montam `deps` parciais). Sem a linha no
 *      cron, o corpo entra na fila com `{{agendamento.hora}}` literal e é isso
 *      que chega ao WhatsApp do cliente.
 *
 * Nos dois casos `typecheck`, `lint` e a suíte inteira passam. É exatamente o
 * modo de falha que o repo já pagou: refactor perde a chamada, nenhum gate
 * acusa, e o defeito aparece na conversa de um cliente.
 *
 * Ler o texto do arquivo é grosseiro e é o instrumento certo aqui: importar a
 * rota exigiria env, Supabase e o segredo do cron para provar uma coisa que é
 * estrutural — a ligação existe ou não existe. O que se perde (um `if (false)`
 * em volta passaria) é menor que o que se ganha: hoje não há cerca nenhuma.
 */

const ROTA = join(
  __dirname,
  "..",
  "..",
  "app",
  "api",
  "v1",
  "cron",
  "followup-flow-worker",
  "route.ts",
);

const fonte = readFileSync(ROTA, "utf8");

describe("followup-flow-worker liga o gatilho de compromisso", () => {
  it("chama runAppointmentSweep no tick", () => {
    expect(fonte).toContain("runAppointmentSweep(");
  });

  it("monta o adapter real do sweep, não um dublê", () => {
    expect(fonte).toContain("createSupabaseCompromissoSweepDb(admin)");
  });

  it("injeta o resolvedor de variáveis nas deps do motor", () => {
    // Se esta linha sumir, o cliente recebe a chave crua. Ver o cabeçalho.
    expect(fonte).toMatch(/resolverTexto:\s*criarResolvedorDeTexto\(admin\)/);
  });

  it("audita a varredura de compromisso, e só quando ela fez algo", () => {
    expect(fonte).toContain("followup.appointment_sweep_run");
    // `sem_lembrete_ligado` na condição é o que faz a OMISSÃO aparecer: o
    // operador que armou o fluxo e não ligou nenhum tipo não tem outro sinal.
    expect(fonte).toContain("compromissos.sem_lembrete_ligado");
  });

  it("a falha da varredura de compromisso não derruba o tick", () => {
    // O `runFollowupTick` já rodou e foi auditado antes; um throw aqui não pode
    // transformar um tick bem-sucedido em 500.
    expect(fonte).toContain("runAppointmentSweep threw");
  });
});
