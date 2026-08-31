/**
 * A mesma intenção não vira duas mensagens.
 *
 * ─── O defeito, medido em produção ──────────────────────────────────────────
 *
 * Toda mensagem enviada pela tela chegava DUAS vezes ao cliente final. Duas
 * requisições HTTP reais, com identificadores distintos, separadas por 1,43 s e
 * 1,56 s, **ambas com `external_id` da Meta** — as duas foram aceitas, e a
 * pessoa do outro lado recebeu a frase repetida.
 *
 * O cliente HTTP já cumpria a parte dele: gera a `Idempotency-Key` UMA vez,
 * fora do laço de retentativa, e reenvia a MESMA chave em todas as tentativas.
 * Quem não cumpria era o servidor.
 *
 * ⚠️ E a lição já estava escrita neste repositório. A migration 0204 documenta
 * duplicação por retentativa de mutação, cita o mesmo cliente HTTP e conclui que
 * quem não honrava a chave era a rota. Eu escrevi essa migration nesta mesma
 * sessão e, quando o defeito reapareceu noutro lugar, fui mexer na TELA.
 *
 * ─── Por que reserva-primeiro, e não consulta-depois-grava ──────────────────
 *
 * O envio chama a Meta dentro da requisição e demora mais de um segundo. Um
 * padrão que consulta, executa e só então grava deixa a segunda requisição
 * passar enquanto a primeira ainda fala com a Meta — e as duas mandam.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  chaveDoCabecalho,
  guardarResultado,
  hashDoPedido,
  reservarExecucao,
  soltarReserva,
} from "@/lib/api/idempotencia";

const ORG = "11111111-1111-4111-8111-111111111111";
const CHAVE = "chave-de-teste-0123456789";

/** As linhas que o banco tem, por (org, chave, endpoint). */
let tabela: Map<string, { status_code: number; response_body: unknown }>;

function bancoDublado() {
  const chaveDe = (f: Record<string, unknown>) =>
    `${f.organization_id}|${f.key}|${f.endpoint}`;

  const consulta = (op: "select" | "update" | "delete", valores?: Record<string, unknown>) => {
    const filtros: Record<string, unknown> = {};
    const alvo: Record<string, unknown> = {
      eq(coluna: string, valor: unknown) {
        filtros[coluna] = valor;
        return alvo;
      },
      select: () => alvo,
      maybeSingle: async () => {
        const linha = tabela.get(chaveDe(filtros));
        return { data: linha ?? null, error: null };
      },
      then(resolve: (v: unknown) => void) {
        const k = chaveDe(filtros);
        if (op === "update" && tabela.has(k)) {
          tabela.set(k, {
            status_code: valores?.status_code as number,
            response_body: valores?.response_body,
          });
        }
        if (op === "delete") {
          const atual = tabela.get(k);
          // O `delete` da soltura filtra por `status_code`: só apaga reserva,
          // nunca um resultado já gravado.
          if (atual && (filtros.status_code === undefined || atual.status_code === filtros.status_code)) {
            tabela.delete(k);
          }
        }
        resolve({ data: null, error: null });
      },
    };
    return alvo;
  };

  return {
    from: () => ({
      insert: async (v: Record<string, unknown>) => {
        const k = chaveDe(v);
        if (tabela.has(k)) return { error: { code: "23505" } };
        tabela.set(k, {
          status_code: v.status_code as number,
          response_body: v.response_body,
        });
        return { error: null };
      },
      select: () => consulta("select"),
      update: (v: Record<string, unknown>) => consulta("update", v),
      delete: () => consulta("delete"),
    }),
  };
}

const escopo = {
  organizationId: ORG,
  chave: CHAVE,
  endpoint: "/api/v1/messages",
  requestHash: hashDoPedido({ body: "oi" }),
};

beforeEach(() => {
  tabela = new Map();
});

describe("a chave que vem do cabeçalho", () => {
  it("é lida nas duas grafias", () => {
    expect(chaveDoCabecalho(new Headers({ "Idempotency-Key": CHAVE }))).toBe(CHAVE);
    expect(chaveDoCabecalho(new Headers({ "idempotency-key": CHAVE }))).toBe(CHAVE);
  });

  it("chave ausente ou curta demais não vale", () => {
    // Sem chave, o caller segue como antes — server-to-server antigo não quebra.
    expect(chaveDoCabecalho(new Headers())).toBeNull();
    expect(chaveDoCabecalho(new Headers({ "Idempotency-Key": "curta" }))).toBeNull();
  });
});

describe("a reserva", () => {
  it("a PRIMEIRA requisição é dona e executa", async () => {
    const r = await reservarExecucao(bancoDublado() as never, escopo);
    expect(r.estado).toBe("dono");
  });

  it("a SEGUNDA, depois de a primeira terminar, recebe a MESMA mensagem", async () => {
    // Este é o caso medido em produção: a retentativa chega 1,4 s depois, com a
    // primeira já concluída.
    await reservarExecucao(bancoDublado() as never, escopo);
    await guardarResultado(bancoDublado() as never, escopo, {
      status: 201,
      corpo: { id: "msg-1", body: "oi" },
    });

    const r = await reservarExecucao(bancoDublado() as never, escopo);
    expect(r.estado).toBe("repetida");
    if (r.estado !== "repetida") return;
    // O MESMO id. Devolver erro aqui faria o atendente ver falha numa mensagem
    // que saiu, e reenviar à mão — a duplicata voltaria pela porta da frente.
    expect(r.corpo).toEqual({ id: "msg-1", body: "oi" });
  });

  it("sem chave no cabeçalho, ninguém é barrado", async () => {
    const r = await reservarExecucao(bancoDublado() as never, { ...escopo, chave: null });
    expect(r.estado).toBe("sem_chave");
  });

  it("falha SOLTA a reserva — erro curto não pode trancar a chave por 24 horas", async () => {
    await reservarExecucao(bancoDublado() as never, escopo);
    await soltarReserva(bancoDublado() as never, escopo);

    // A retentativa, que é justamente o que salvaria a mensagem, precisa poder
    // executar. Guardar o erro faria uma indisponibilidade de dez segundos virar
    // falha permanente.
    const r = await reservarExecucao(bancoDublado() as never, escopo);
    expect(r.estado).toBe("dono");
  });

  it("a soltura NÃO apaga um resultado já gravado", async () => {
    // O controle: se a soltura apagasse resultado pronto, a repetição voltaria a
    // executar e a duplicata renasceria.
    await reservarExecucao(bancoDublado() as never, escopo);
    await guardarResultado(bancoDublado() as never, escopo, {
      status: 201,
      corpo: { id: "msg-1" },
    });
    await soltarReserva(bancoDublado() as never, escopo);

    const r = await reservarExecucao(bancoDublado() as never, escopo);
    expect(r.estado).toBe("repetida");
  });

  it("chave DIFERENTE é intenção diferente e passa", async () => {
    // Mandar "ok" duas vezes de propósito é uso legítimo. A chave é a
    // identidade da INTENÇÃO, nunca o conteúdo — deduplicar por corpo
    // engoliria mensagem que a pessoa quis mandar.
    await reservarExecucao(bancoDublado() as never, escopo);
    const r = await reservarExecucao(bancoDublado() as never, {
      ...escopo,
      chave: "outra-chave-9876543210",
    });
    expect(r.estado).toBe("dono");
  });

  it("endpoint diferente não colide", async () => {
    await reservarExecucao(bancoDublado() as never, escopo);
    const r = await reservarExecucao(bancoDublado() as never, {
      ...escopo,
      endpoint: "/api/v1/outra-coisa",
    });
    expect(r.estado).toBe("dono");
  });
});
