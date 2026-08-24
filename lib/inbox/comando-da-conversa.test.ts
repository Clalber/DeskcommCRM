/**
 * Guarda de `comandoDaConversa` — a função que a tela usa para dizer quem manda.
 *
 * O que estes casos vigiam não é a aritmética: é o ESPELHO entre a tela e o
 * motor. Cada caso aqui corresponde a um gate que existe no código de produção,
 * e o teste do espelho (no fim) reprova quando o motor ganha um gate novo sem
 * que esta função aprenda a explicá-lo — que é exatamente o modo de falha que
 * fez a tela e o banco divergirem no vocabulário da timeline.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  comandoDaConversa,
  ROTULO_DO_COMANDO,
  ROTULO_DO_MOTIVO,
  type FatosDoComando,
} from "./comando-da-conversa";

const AGORA = new Date("2026-08-24T12:00:00.000Z");
const ATENDENTE = "11111111-1111-4111-8111-111111111111";

function fatos(over: Partial<FatosDoComando> = {}): FatosDoComando {
  return { status: "open", assigned_to_user_id: null, ...over };
}

describe("comandoDaConversa — quem manda", () => {
  it("conversa aberta, sem dono e sem silêncio: o automático manda", () => {
    const r = comandoDaConversa(fatos(), AGORA);
    expect(r.comando).toEqual({ quem: "automatico" });
    expect(r.automaticoAtivo).toBe(true);
    expect(r.motivo).toBeNull();
  });

  it("com dono: a pessoa manda, e o nome vem junto quando o servidor o resolveu", () => {
    const r = comandoDaConversa(
      fatos({ assigned_to_user_id: ATENDENTE, assigned_to_user_name: "Maria Silva" }),
      AGORA,
    );
    expect(r.comando).toEqual({ quem: "humano", userId: ATENDENTE, nome: "Maria Silva" });
  });

  it("com dono e SEM nome resolvido: segue humano, com nome null — nunca some o dono", () => {
    // O degrade do lookup (sem service role) não pode virar "sem responsável":
    // seria uma afirmação sobre o atendimento feita em cima de falha de leitura.
    const r = comandoDaConversa(fatos({ assigned_to_user_id: ATENDENTE }), AGORA);
    expect(r.comando).toEqual({ quem: "humano", userId: ATENDENTE, nome: null });
  });

  it("sem dono e calado: é a fila — o automático saiu e ninguém pegou", () => {
    const r = comandoDaConversa(fatos({ status: "pending", bot_silenced_until: "infinity" }), AGORA);
    expect(r.comando).toEqual({ quem: "aguardando" });
    expect(r.automaticoAtivo).toBe(false);
    expect(r.motivo).toBe("pausado");
  });
});

describe("comandoDaConversa — o automático está ativo?", () => {
  it("'infinity' é silêncio DURÁVEL, não data inválida", () => {
    // `new Date("infinity")` é Invalid Date, e toda comparação com Invalid Date é
    // falsa: lido por engano, o silêncio para sempre leria como "já venceu".
    expect(Number.isNaN(new Date("infinity").getTime())).toBe(true);
    const r = comandoDaConversa(fatos({ bot_silenced_until: "infinity" }), AGORA);
    expect(r.automaticoAtivo).toBe(false);
  });

  it("silêncio no passado não cala nada", () => {
    const r = comandoDaConversa(
      fatos({ bot_silenced_until: "2026-08-24T11:55:00.000Z" }),
      AGORA,
    );
    expect(r.automaticoAtivo).toBe(true);
    expect(r.motivo).toBeNull();
  });

  it("silêncio finito no futuro sem dono: janela deslizante, e ela diz QUANDO volta", () => {
    const r = comandoDaConversa(
      fatos({ bot_silenced_until: "2026-08-24T12:04:00.000Z" }),
      AGORA,
    );
    expect(r.motivo).toBe("resposta_humana_recente");
    expect(r.silencioAte?.toISOString()).toBe("2026-08-24T12:04:00.000Z");
  });

  it("só 'resposta_humana_recente' traz o relógio — os outros motivos exigem alguém agir", () => {
    for (const f of [
      fatos({ bot_silenced_until: "infinity" }),
      fatos({ force_human: true }),
      fatos({ assigned_to_user_id: ATENDENTE, bot_silenced_until: "infinity" }),
    ]) {
      expect(comandoDaConversa(f, AGORA).silencioAte).toBeNull();
    }
  });

  it("force_human vence o silêncio local: o motivo nomeado é o do CONTATO", () => {
    // A ordem não é estética. Devolver o atendimento limpa a trava do CONTATO
    // inteiro; explicar o motivo MENOR faria a pessoa clicar esperando um efeito
    // menor do que o que vai acontecer.
    const r = comandoDaConversa(
      fatos({ force_human: true, bot_silenced_until: "infinity" }),
      AGORA,
    );
    expect(r.motivo).toBe("contato_travado");
  });

  it("dono + silêncio durável: o motivo é que alguém assumiu", () => {
    const r = comandoDaConversa(
      fatos({ status: "claimed", assigned_to_user_id: ATENDENTE, bot_silenced_until: "infinity" }),
      AGORA,
    );
    expect(r.motivo).toBe("atendente_no_comando");
  });

  it("valor ilegível falha FECHADA: trata como calado, nunca afirma que está ativo", () => {
    const r = comandoDaConversa(fatos({ bot_silenced_until: "isto-nao-e-data" }), AGORA);
    expect(r.automaticoAtivo).toBe(false);
  });
});

describe("comandoDaConversa — conversa encerrada", () => {
  it.each(["closed", "archived"])("%s: comando é 'encerrada' e não há motivo de silêncio", (status) => {
    const r = comandoDaConversa(fatos({ status }), AGORA);
    expect(r.comando).toEqual({ quem: "encerrada" });
    expect(r.automaticoAtivo).toBe(false);
    // Encerrada não é silêncio: é ausência de assunto. Nomear um motivo aqui
    // faria a tela oferecer "devolver ao automático" como se houvesse algo a
    // retomar.
    expect(r.motivo).toBeNull();
  });

  it("encerrada COM dono: o comando acabou, mesmo o produto não soltando o dono ao fechar", () => {
    const r = comandoDaConversa(
      fatos({ status: "closed", assigned_to_user_id: ATENDENTE, assigned_to_user_name: "Maria" }),
      AGORA,
    );
    expect(r.comando).toEqual({ quem: "encerrada" });
  });
});

describe("travaVigente — o fato que decide o botão de volta", () => {
  it("conversa encerrada LIMPA não tem trava: o botão de devolver não deve aparecer", () => {
    // O defeito que este caso existe para impedir: derivar o botão de
    // `!automaticoAtivo` o faria aparecer em TODA conversa fechada, e clicá-lo
    // reabriria uma conversa que ninguém pediu para reabrir.
    const r = comandoDaConversa(
      fatos({ status: "closed", assigned_to_user_id: ATENDENTE }),
      AGORA,
    );
    expect(r.automaticoAtivo).toBe(false);
    expect(r.travaVigente).toBe(false);
  });

  it("conversa encerrada COM trava pendurada: o botão de devolver PRECISA aparecer", () => {
    // O beco sem saída medido: o atendente assume, fecha e some. "Liberar" só
    // existe para o próprio dono e a rota recusa quem não é — sem esta porta,
    // nenhum colega consegue devolver o atendimento.
    for (const f of [
      fatos({ status: "closed", assigned_to_user_id: ATENDENTE, bot_silenced_until: "infinity" }),
      fatos({ status: "archived", force_human: true }),
    ]) {
      expect(comandoDaConversa(f, AGORA).travaVigente).toBe(true);
    }
  });

  it("dono humano SEM trava (a conversa que o rodízio distribuiu) não tem o que devolver", () => {
    // O rodízio atribui sem calar, de propósito. Aqui o gesto certo é pausar, não
    // devolver — e oferecer "devolver" seria oferecer o desfazer de algo que não
    // foi feito.
    const r = comandoDaConversa(
      fatos({ status: "claimed", assigned_to_user_id: ATENDENTE }),
      AGORA,
    );
    expect(r.automaticoAtivo).toBe(true);
    expect(r.travaVigente).toBe(false);
  });
});

describe("o espelho entre a tela e o motor", () => {
  /**
   * Os gates que calam o automático vivem em DOIS arquivos de produção. Se um
   * deles ganhar um gate novo, esta função passa a explicar menos do que o motor
   * faz — e a tela vira uma afirmação falsa sobre o comportamento. Este caso não
   * verifica a lógica: verifica que ninguém acrescentou gate sem passar por aqui.
   */
  const RAIZ = join(__dirname, "..", "..");

  it("o gate do motor moderno segue lendo exatamente force_human + bot_silenced_until", () => {
    const fonte = readFileSync(
      join(RAIZ, "lib/agent-engine/agent/human-handoff.ts"),
      "utf8",
    );
    const corpo = fonte.slice(fonte.indexOf("export async function isLeadInHandoff"));
    const sql = corpo.slice(corpo.indexOf("`"), corpo.indexOf("[tenantId, leadId]"));
    const colunas = ["force_human", "bot_silenced_until"];
    for (const c of colunas) expect(sql).toContain(c);
    // O controle: nenhuma OUTRA coluna de conversa entrou no gate sem que este
    // arquivo aprendesse a explicá-la.
    for (const naoEsperada of ["assignee_kind", "assigned_to_user_id", "last_handoff_at"]) {
      expect(sql).not.toContain(naoEsperada);
    }
  });

  it("o worker legado segue com os três guards que esta função espelha", () => {
    const fonte = readFileSync(join(RAIZ, "workers/ai-response-worker.ts"), "utf8");
    expect(fonte).toContain('skip("force_human")');
    expect(fonte).toContain('skip("assigned_to_human")');
    expect(fonte).toContain('skip("silenced_post_handoff")');
  });

  it("todo estado e todo motivo têm rótulo, e a palavra do estado é 'automático'", () => {
    expect(Object.keys(ROTULO_DO_COMANDO).sort()).toEqual(
      ["aguardando", "automatico", "encerrada", "humano"],
    );
    expect(Object.keys(ROTULO_DO_MOTIVO)).toHaveLength(4);
    // "IA" no rótulo colidiria com o léxico que o produto já fixou em quatro
    // arquivos e que `handoff-por-orcamento.test.ts` usa como sabotagem-controle.
    for (const rotulo of Object.values(ROTULO_DO_MOTIVO)) {
      expect(rotulo).not.toMatch(/\bIA\b/);
    }
  });
});
