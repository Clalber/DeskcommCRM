/**
 * Marcar reunião ENCERRA o follow-up de silêncio.
 *
 * ─── O defeito, medido em 2026-09-02 ────────────────────────────────────────
 *
 * O follow-up de silêncio existe para uma pergunta: "a pessoa sumiu, como trago
 * ela de volta?". Responder encerra o follow-up (`aplicarTextoNosFollowups`).
 * Marcar reunião não encerrava nada.
 *
 * E o caminho REAL do agendamento é marcar e sair da conversa — a pessoa
 * conseguiu o que queria e não escreve mais. Duas horas depois o primeiro toque
 * disparava, e a instrução dele diz, com todas as letras:
 *
 *     "Se havia horário oferecido, ofereça de novo os mesmos."
 *
 * Ou seja: oferecer horário a quem JÁ TEM REUNIÃO MARCADA. É o mesmo defeito que
 * o agente cometeu na conversa do dia 02 às 23h20 — marcou às 23h16, reofereceu
 * às 23h20 e criou uma segunda reunião —, só que automático, sem ninguém para
 * corrigir, e de madrugada, quando a janela de envio desta instalação está
 * aberta 24 horas.
 *
 * ─── Os dois casos, e por que cada um existe ───────────────────────────────
 *
 * O primeiro prova o conserto. O segundo é o controle na direção oposta:
 * CANCELAR um compromisso não pode encerrar o follow-up — ali a pessoa continua
 * sem reunião, e o follow-up é exatamente o que deve trazê-la de volta. Sem
 * esse caso, "encerrar sempre" passaria no primeiro e mataria o follow-up
 * justamente de quem mais precisa dele.
 *
 * ─── Duas armadilhas que a medição pegou antes deste arquivo existir ───────
 *
 * 1. `outcome: "agendou"` seria RECUSADO pelo banco. O CHECK aceita
 *    `converted | replied | exhausted | opted_out | handoff`, e o valor certo é
 *    `converted` — marcar reunião é a conversão que este follow-up persegue.
 * 2. Filtrar só `status = 'active'` deixaria passar o caso mais comum:
 *    `waiting_reply` é o estado de quem JÁ recebeu um toque e está sendo
 *    esperado — e é nele que a pessoa costuma estar quando finalmente marca.
 *
 * As duas viraram asserção aqui, porque as duas passariam despercebidas: a
 * primeira falha em runtime dentro de um `catch` que só loga, e a segunda não
 * falha nunca — só deixa o toque sair.
 */
import { describe, expect, it } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONTATO = "22222222-2222-4222-8222-222222222222";

/** Toda escrita em `followup_enrollments`, com os filtros que a acompanharam. */
interface Escrita {
  dados: Record<string, unknown>;
  filtros: Record<string, unknown>;
  statusAlvo: string[] | null;
}

function supabaseFalso(registro: Escrita[]) {
  return {
    from(tabela: string) {
      const ctx: Record<string, unknown> = {};
      const filtros: Record<string, unknown> = {};
      let dados: Record<string, unknown> = {};
      let statusAlvo: string[] | null = null;
      let anotado = false;

      const anota = () => {
        if (tabela === "followup_enrollments" && !anotado) {
          anotado = true;
          registro.push({ dados, filtros, statusAlvo });
        }
      };

      Object.assign(ctx, {
        insert: async () => ({ data: null, error: null }),
        select: () => ctx,
        update: (d: Record<string, unknown>) => {
          dados = d;
          return ctx;
        },
        eq: (col: string, val: unknown) => {
          filtros[col] = val;
          return ctx;
        },
        in: (col: string, vals: string[]) => {
          if (col === "status") statusAlvo = vals;
          return ctx;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        single: async () => ({ data: null, error: null }),
        // O builder do supabase-js é "thenable": é aqui que o update resolve.
        then: (aceitar: (v: unknown) => unknown) => {
          anota();
          return Promise.resolve({ data: null, error: null }).then(aceitar);
        },
      });
      return ctx;
    },
  };
}

/**
 * Exercita o trecho do handler que encerra o follow-up. Ele não é exportado — o
 * arquivo é uma rota —, então o caso reproduz a MESMA cadeia de chamadas, e a
 * guarda contra divergência é a asserção de artefato no fim do arquivo: se o
 * handler mudar a forma, o teste reprova por texto.
 */
async function encerrarComo(transicao: string): Promise<Escrita[]> {
  const registro: Escrita[] = [];
  const supabase = supabaseFalso(registro);
  const contactId = CONTATO;

  if (contactId && transicao !== "cancelled") {
    // `as never` porque o dublê é `Record<string, unknown>` e o `tsc` estrito não
    // encadeia sobre `unknown`. O tipo real é do supabase-js, e reproduzi-lo aqui
    // seria copiar o builder inteiro para provar uma linha de comportamento.
    await (supabase.from("followup_enrollments") as never as {
      update: (d: Record<string, unknown>) => {
        eq: (c: string, v: unknown) => {
          eq: (c: string, v: unknown) => { in: (c: string, v: string[]) => Promise<unknown> };
        };
      };
    })
      .update({
        status: "completed",
        outcome: "converted",
        cancel_reason: "reuniao_marcada",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", ORG)
      .eq("contact_id", contactId)
      .in("status", ["active", "waiting_reply"]);
  }
  return registro;
}

describe("marcar reunião encerra o follow-up de silêncio", () => {
  it("⚠️ agendamento confirmado ENCERRA, com o desfecho que o banco aceita", async () => {
    const escritas = await encerrarComo("confirmed");

    expect(escritas, "não encerrou nada — o toque sairia em 2 horas").toHaveLength(1);
    const e = escritas[0]!;
    expect(e.dados.status).toBe("completed");
    // `agendou` seria recusado pelo CHECK e a falha morreria num log.
    expect(
      e.dados.outcome,
      "desfecho fora do vocabulário do banco — o UPDATE seria recusado em silêncio",
    ).toBe("converted");
    expect(e.dados.cancel_reason).toBe("reuniao_marcada");
    expect(e.filtros.organization_id).toBe(ORG);
    expect(e.filtros.contact_id).toBe(CONTATO);
  });

  it("⚠️ pega os DOIS estados vivos, não só `active`", async () => {
    // `waiting_reply` é o estado de quem já recebeu um toque e está sendo
    // esperado — o caso mais comum de quem marca depois de ser tocado.
    const e = (await encerrarComo("confirmed"))[0]!;
    expect(e.statusAlvo, "filtrou por um estado só — o outro segue tocando").toEqual([
      "active",
      "waiting_reply",
    ]);
  });

  it("CANCELAR um compromisso NÃO encerra — ali o follow-up é o que salva", async () => {
    // O controle na direção oposta. Sem ele, "encerrar sempre" passaria no
    // primeiro caso e mataria o follow-up de quem ficou sem reunião.
    const escritas = await encerrarComo("cancelled");
    expect(
      escritas,
      "encerrou o follow-up de quem CANCELOU — é justamente quem precisa dele",
    ).toHaveLength(0);
  });
});

describe("a guarda de artefato", () => {
  it("o handler continua encerrando o follow-up ao marcar", async () => {
    // Este caso existe porque o trecho vive numa ROTA e não pode ser importado.
    // Sem ele, alguém removeria o bloco do handler e os casos acima seguiriam
    // verdes — provando apenas que a cópia deste arquivo funciona.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/api/v1/agenda/agendamentos/_handler.ts", "utf8");

    expect(src, "o bloco que encerra o follow-up sumiu do handler").toContain(
      'from("followup_enrollments")',
    );
    expect(src, "o desfecho deixou de ser `converted`").toContain('outcome: "converted"');
    expect(src, "voltou a filtrar por um estado só").toContain(
      '.in("status", ["active", "waiting_reply"])',
    );
    expect(src, "a guarda do cancelamento sumiu").toContain('args.transicao !== "cancelled"');
  });
});
