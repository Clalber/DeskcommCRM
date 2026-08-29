/**
 * O orquestrador da entrada do Instagram — a peça que costura as outras.
 *
 * ─── Por que este arquivo existe ────────────────────────────────────────────
 *
 * `ingest.ts` tinha 189 linhas e ZERO testes. Uma auditoria por sabotagem mediu
 * o custo disso: apagar o tratamento de `23505` e remover a guarda anti-laço do
 * eco deixavam a suíte inteira VERDE. Quer dizer que as duas coisas mais caras
 * de errar neste canal — mensagem duplicada a cada reentrega e robô respondendo
 * a si mesmo em laço — não eram medidas por nada.
 *
 * O que se prova aqui é comportamento OBSERVÁVEL no banco: que linha foi
 * escrita, com que colunas, em que ordem, e o que NÃO foi escrito.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ingerirEntradaDoInstagram } from "@/lib/channels/instagram/ingest";
import type { EventoDeEntrada } from "@/lib/channels/instagram/webhook";

const ORG = "11111111-1111-4111-8111-111111111111";
const SESSAO = "22222222-2222-4222-8222-222222222222";
const CONTATO = "33333333-3333-4333-8333-333333333333";
const CONVERSA = "44444444-4444-4444-8444-444444444444";
const IGSID = "9876543210000001";

const efeitos = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/channels/pos-entrada", () => ({ aplicarEfeitosPosEntrada: efeitos }));

/** O que o dublê do banco devolve e o que ele registrou. */
interface Roteiro {
  /** Identidade já existente → o contato dela. `null` = pessoa nova. */
  identidade: string | null;
  /** Depois de `gravarIdentidade`, quem venceu a corrida. */
  identidadeDepois: string | null;
  /** Erro a devolver no insert de `messages`. */
  erroNaMensagem: { code?: string; message: string } | null;
  /** Linhas que o UPDATE de revogação encontra. */
  revogadas: { id: string }[];
}

let roteiro: Roteiro;
let escritas: { tabela: string; operacao: string; valores: Record<string, unknown> }[];
let rpcs: { nome: string; args: Record<string, unknown> }[];
let leiturasDeIdentidade = 0;

/**
 * Um dublê que REGISTRA em vez de só responder.
 *
 * A auditoria mostrou que o Proxy-que-responde-tudo do teste do adapter não
 * prova nada sobre a query: remover o filtro de organização passava com 20
 * casos verdes. Aqui os filtros e os valores ficam guardados, e é sobre eles
 * que as asserções falam.
 */
function bancoDublado() {
  const construirConsulta = (tabela: string, operacao: string, valores: Record<string, unknown>) => {
    const filtros: Record<string, unknown> = {};
    const encadeavel: Record<string, unknown> = {
      eq(coluna: string, valor: unknown) {
        filtros[coluna] = valor;
        return encadeavel;
      },
      is(coluna: string, valor: unknown) {
        filtros[coluna] = valor;
        return encadeavel;
      },
      select: () => encadeavel,
      maybeSingle: async () => resolver(tabela, operacao, filtros),
      single: async () => resolver(tabela, operacao, filtros),
      then: (resolve: (v: unknown) => void) =>
        resolve(resolver(tabela, operacao, filtros)),
    };
    if (operacao !== "select") escritas.push({ tabela, operacao, valores });
    return encadeavel;
  };

  const resolver = (tabela: string, operacao: string, _filtros: Record<string, unknown>) => {
    if (tabela === "channel_contact_identities") {
      leiturasDeIdentidade += 1;
      const alvo = leiturasDeIdentidade === 1 ? roteiro.identidade : roteiro.identidadeDepois;
      return { data: alvo ? { contact_id: alvo } : null, error: null };
    }
    if (tabela === "contacts") return { data: { id: CONTATO }, error: null };
    if (tabela === "messages" && operacao === "update") {
      return { data: roteiro.revogadas, error: null };
    }
    if (tabela === "messages") {
      if (roteiro.erroNaMensagem) return { data: null, error: roteiro.erroNaMensagem };
      return { data: { id: "msg-1" }, error: null };
    }
    return { data: null, error: null };
  };

  return {
    from(tabela: string) {
      return {
        select: () => construirConsulta(tabela, "select", {}),
        insert: (valores: Record<string, unknown>) => construirConsulta(tabela, "insert", valores),
        update: (valores: Record<string, unknown>) => construirConsulta(tabela, "update", valores),
        upsert: (valores: Record<string, unknown>) => construirConsulta(tabela, "upsert", valores),
      };
    },
    async rpc(nome: string, args: Record<string, unknown>) {
      rpcs.push({ nome, args });
      if (nome === "fn_upsert_conversation_do_canal") return { data: CONVERSA, error: null };
      return { data: null, error: null };
    },
  };
}

const evento = (extra: Partial<EventoDeEntrada> = {}): EventoDeEntrada => ({
  externalId: "mid.abc123",
  providerUserId: IGSID,
  contaId: "17841400000000001",
  texto: "Olá!",
  midias: [],
  timestamp: 1_756_000_000_000,
  ehEco: false,
  ehApagada: false,
  respostaA: null,
  emEspera: false,
  referencia: null,
  ehToqueEmBotao: false,
  cargaDoBotao: null,
  ...extra,
});

const ingerir = (e: EventoDeEntrada) =>
  ingerirEntradaDoInstagram(bancoDublado() as never, {
    organizationId: ORG,
    channelSessionId: SESSAO,
    evento: e,
  });

const mensagemEscrita = () =>
  escritas.find((x) => x.tabela === "messages" && x.operacao === "insert")?.valores;

beforeEach(() => {
  roteiro = {
    identidade: null,
    identidadeDepois: null,
    erroNaMensagem: null,
    revogadas: [],
  };
  escritas = [];
  rpcs = [];
  leiturasDeIdentidade = 0;
  efeitos.mockClear();
});

describe("a mensagem gravada", () => {
  it("nasce como `external_device` — senão o eco do próprio envio duplica na tela", async () => {
    await ingerir(evento());

    // O default da coluna é `crm`, e `removerEcoDoProprioEnvio` filtra por
    // `external_device`. Sem este valor o eco escapa da rede de deduplicação,
    // vira segunda linha, e a original fica presa em `queued` para sempre —
    // porque o UPDATE que lhe daria o `external_id` colide com a linha do eco.
    expect(mensagemEscrita()?.sent_via).toBe("external_device");
  });

  it("grava a mídia em `media_url`, não só no metadata — o worker não olha metadata", async () => {
    await ingerir(
      evento({ midias: [{ tipo: "image", url: "https://cdn.test/f.jpg" }], texto: null }),
    );

    const linha = mensagemEscrita();
    // A URL da Meta VENCE. Guardá-la onde o worker de persistência não lê fazia
    // ele sair com "no media_url" — e o atendente via "imagem" sem imagem.
    expect(linha?.media_url).toBe("https://cdn.test/f.jpg");
    expect(linha?.type).toBe("image");

    // E o pedido de download SAI, senão a URL vence antes de alguém abrir.
    expect(rpcs.some((r) => r.args.p_event_type === "media.persist_requested")).toBe(true);
  });

  it("o eco entra como saída e NÃO acorda o agente", async () => {
    await ingerir(evento({ ehEco: true }));

    expect(mensagemEscrita()?.direction).toBe("outbound");
    // Despachar aqui faria o robô responder à própria voz, em laço.
    expect(efeitos).not.toHaveBeenCalled();
  });

  it("a entrada de verdade acorda o agente", async () => {
    // O controle do caso acima: sem ele, um `aplicarEfeitosPosEntrada` que
    // nunca é chamado por engano passaria como se fosse a guarda do eco.
    await ingerir(evento());
    expect(efeitos).toHaveBeenCalledTimes(1);
  });
});

describe("reentrega e apagamento", () => {
  it("23505 é reentrega, não erro — a Meta reenvia por 36 horas", async () => {
    roteiro.erroNaMensagem = { code: "23505", message: "duplicate key" };

    await expect(ingerir(evento())).resolves.toEqual({ status: "duplicate" });
  });

  it("erro de escrita que NÃO é 23505 volta como falha — quem chama devolve 500", async () => {
    roteiro.erroNaMensagem = { message: "deadlock detected" };

    const r = await ingerir(evento());
    expect(r.status).toBe("failed");
    // Responder 200 aqui perdia a mensagem para sempre: a Meta só reenvia o que
    // não recebeu 200.
    expect(r).toMatchObject({ reason: expect.stringContaining("deadlock") });
  });

  it("apagar é UPDATE na mensagem existente, não linha nova", async () => {
    roteiro.revogadas = [{ id: "msg-original" }];

    const r = await ingerir(evento({ ehApagada: true, texto: null }));

    expect(r).toEqual({ status: "ingested", messageId: "msg-original" });
    const revogacao = escritas.find((x) => x.tabela === "messages" && x.operacao === "update");
    expect(revogacao?.valores.revoked_at).toEqual(expect.any(String));
    // O texto original SAI. Tratar apagamento como insert deixava o texto na
    // tela — problema de LGPD quando o que a pessoa apagou era dado sensível.
    expect(revogacao?.valores.body).toBeNull();
    // E não inseriu nada.
    expect(mensagemEscrita()).toBeUndefined();
  });

  it("apagamento que chega antes da mensagem não some — vira linha", async () => {
    roteiro.revogadas = [];
    const r = await ingerir(evento({ ehApagada: true, texto: null }));
    expect(r.status).toBe("ingested");
    expect(mensagemEscrita()).toBeDefined();
  });
});

describe("a corrida de duas mensagens da mesma pessoa nova", () => {
  it("quem PERDE a corrida da identidade adota o contato vencedor", async () => {
    // Duas execuções paralelas: nenhuma acha identidade, as duas criam contato.
    // A trava única deixa só uma identidade de pé — e a perdedora, sem releitura,
    // seguia usando o contato órfão dela. A conversa se partia em duas, com
    // leads separados.
    roteiro.identidade = null;
    roteiro.identidadeDepois = "contato-vencedor";

    await ingerir(evento());

    const conversa = rpcs.find((r) => r.nome === "fn_upsert_conversation_do_canal");
    expect(conversa?.args.p_contact).toBe("contato-vencedor");
    expect(mensagemEscrita()?.contact_id).toBe("contato-vencedor");
  });

  it("sem corrida, usa o contato que acabou de criar", async () => {
    // O controle: a releitura não pode trocar o contato quando não houve disputa.
    roteiro.identidade = null;
    roteiro.identidadeDepois = CONTATO;

    await ingerir(evento());
    expect(mensagemEscrita()?.contact_id).toBe(CONTATO);
  });

  it("pessoa já conhecida não cria contato nenhum", async () => {
    roteiro.identidade = CONTATO;

    await ingerir(evento());
    expect(escritas.some((x) => x.tabela === "contacts")).toBe(false);
  });
});

describe("a conversa e a janela de 24 horas", () => {
  it("nasce marcada como `instagram`, não como whatsapp", async () => {
    await ingerir(evento());

    const conversa = rpcs.find((r) => r.nome === "fn_upsert_conversation_do_canal");
    // A função irmã fixa `whatsapp` no corpo, e `whatsapp` é valor VÁLIDO: uma
    // conversa marcada errado some de toda tela que filtra por canal, sem erro.
    expect(conversa?.args.p_channel).toBe("instagram");
    expect(conversa?.args.p_org).toBe(ORG);
    expect(conversa?.args.p_session).toBe(SESSAO);
  });

  it("carimba a conversa — é o carimbo que abre a janela de 24h", async () => {
    await ingerir(evento());

    const carimbo = rpcs.find((r) => r.nome === "fn_mark_conversation_message");
    // Sem ele `last_inbound_at` não anda, e o guardrail deste canal lê exatamente
    // essa coluna: o agente ficaria vetado para quem acabou de escrever.
    expect(carimbo?.args.p_direction).toBe("inbound");
    expect(carimbo?.args.p_conv).toBe(CONVERSA);
  });

  it("o carimbo do eco é `outbound` — ele não pode reabrir a janela", async () => {
    await ingerir(evento({ ehEco: true }));

    const carimbo = rpcs.find((r) => r.nome === "fn_mark_conversation_message");
    expect(carimbo?.args.p_direction).toBe("outbound");
  });
});
