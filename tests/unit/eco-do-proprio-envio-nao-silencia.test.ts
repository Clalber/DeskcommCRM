/**
 * O eco do próprio envio NÃO pode silenciar a IA.
 *
 * ─── O defeito, medido duas vezes em produção ───────────────────────────────
 *
 * Toda mensagem que o CRM manda volta pelo webhook como `fromMe=true`. O dedup
 * por `external_id` cobre isso — mas só depois que a linha do envio recebe o id,
 * e ela nasce com `external_id` NULL. O eco que chega nesse intervalo não casa
 * com nada e é lido como "o dono digitou no celular".
 *
 * As duas janelas medidas, com os ids reais:
 *
 *   2026-09-02   eco `true_10200698331209@lid_3EB0…`   900ms antes
 *   2026-09-03   eco `true_246604204343525@lid_3EB0…`  279ms antes
 *
 * "Antes" é antes de a linha do envio receber o `external_id`, não antes de ela
 * existir: em todo caminho de envio a linha nasce antes da chamada ao adapter.
 * É por isso que "existe envio nosso em voo" é um sinal utilizável.
 *
 * O custo é `HUMAN_TAKEOVER_SILENCE_MS` — três horas. Nas duas vezes o cliente
 * escreveu e não recebeu nada; a tela mostrava "Automático pausado", que é um
 * estado legítimo, então ninguém procurou defeito.
 *
 * ─── Por que a guarda é "existe envio em voo", e por que só AQUI ────────────
 *
 * `removerEcoDoProprioEnvio` (`app/api/v1/messages/_handler.ts`) recusa esse
 * mesmo sinal, e com razão: lá a decisão é APAGAR uma linha, e um falso
 * positivo descartaria a mensagem que o atendente digitou no celular enquanto o
 * envio estava em voo — o defeito #108, e permanente.
 *
 * Aqui a decisão é outra e a assimetria se inverte:
 *
 *   • silenciar por engano      → 3 horas de conversa morta, sem rastro na tela
 *   • não silenciar por engano  → a IA responde UMA vez por cima do humano, e a
 *     próxima mensagem dele (já sem envio em voo) silencia normalmente
 *
 * A mensagem entra no histórico nos dois casos. A guarda decide só se o bot
 * cala — e calar errado é o dano grande.
 *
 * ─── O segundo caso é o que impede o conserto de virar buraco ──────────────
 *
 * Sem envio em voo, `fromMe` É retomada humana e TEM de silenciar. Sem esse
 * caso, "nunca silenciar" passaria no primeiro e o atendente que assume pelo
 * celular seria atropelado pela IA a cada mensagem.
 */
import { describe, expect, it, vi } from "vitest";

import { silenciarSeForRetomadaHumana } from "@/lib/waha/ingest";

const ORG = "11111111-1111-4111-8111-111111111111";
const CONVERSA = "22222222-2222-4222-8222-222222222222";

interface Consulta {
  tabela: string;
  filtros: Record<string, unknown>;
  statusAlvo: string[] | null;
  recorteDeIdade: string | null;
}

/**
 * Dublê do admin client. `messages` responde se há envio em voo; `conversations`
 * é o alvo do silenciamento — a leitura devolve `bot_silenced_until` nulo para
 * que `silenciarBotPorRetomadaHumana` chegue até o UPDATE.
 *
 * `idadeDoEnvioMs` é o que separa o eco de verdade (segundos) de um `queued`
 * abandonado (minutos): o dublê aplica o mesmo recorte de `created_at` que a
 * consulta real pede, então uma linha velha some da resposta sozinha.
 */
function adminFalso(temEnvioEmVoo: boolean, opcoes?: { idadeDoEnvioMs?: number; erro?: string }) {
  const consultas: Consulta[] = [];
  const silenciamentos: Record<string, unknown>[] = [];
  const idadeDoEnvioMs = opcoes?.idadeDoEnvioMs ?? 300;

  const from = (tabela: string) => {
    const filtros: Record<string, unknown> = {};
    let statusAlvo: string[] | null = null;
    let recorteDeIdade: string | null = null;
    let atualizacao: Record<string, unknown> | null = null;
    const ctx: Record<string, unknown> = {};

    const finalizar = () => {
      consultas.push({ tabela, filtros, statusAlvo, recorteDeIdade });
      if (atualizacao) silenciamentos.push(atualizacao);
    };

    Object.assign(ctx, {
      select: () => ctx,
      update: (d: Record<string, unknown>) => {
        atualizacao = d;
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
      gte: (col: string, val: string) => {
        if (col === "created_at") recorteDeIdade = val;
        return ctx;
      },
      limit: () => ctx,
      maybeSingle: async () => {
        finalizar();
        if (tabela === "messages") {
          if (opcoes?.erro) return { data: null, error: { message: opcoes.erro } };
          // O recorte de idade é aplicado de verdade: linha mais velha que a
          // janela pedida simplesmente não volta, como no Postgres.
          const dentroDaJanela =
            recorteDeIdade === null ||
            Date.now() - idadeDoEnvioMs >= new Date(recorteDeIdade).getTime();
          return {
            data: temEnvioEmVoo && dentroDaJanela ? { id: "msg-em-voo" } : null,
            error: null,
          };
        }
        // Conversa sem silêncio em vigor — o caminho que segue até o UPDATE.
        return { data: { bot_silenced_until: null }, error: null };
      },
      // O builder do supabase-js é "thenable": é aqui que o UPDATE resolve.
      then: (aceitar: (v: unknown) => unknown) => {
        finalizar();
        return Promise.resolve({ data: null, error: null }).then(aceitar);
      },
    });
    return ctx;
  };

  return { admin: { from } as never, consultas, silenciamentos };
}

describe("eco do próprio envio não silencia a IA", () => {
  it("⚠️ existe envio em voo → é ECO, e o bot NÃO é silenciado", async () => {
    // O caso das duas medições. Sem esta guarda, três horas de silêncio.
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { admin, silenciamentos } = adminFalso(true);

    const silenciou = await silenciarSeForRetomadaHumana(admin, ORG, CONVERSA);

    expect(silenciou, "silenciou ao receber a própria mensagem de volta").toBe(false);
    expect(
      silenciamentos,
      "escreveu `bot_silenced_until` — três horas de conversa morta",
    ).toHaveLength(0);
    // O rastro importa: sem ele a supressão vira mais um comportamento mudo,
    // que foi o que tornou o defeito original tão caro de achar.
    expect(info, "a supressão não deixou rastro nenhum no log").toHaveBeenCalledWith(
      expect.stringContaining("bot NÃO silenciado"),
      expect.objectContaining({ conversation_id: CONVERSA, organization_id: ORG }),
    );
    info.mockRestore();
  });

  it("⚠️ SEM envio em voo → é retomada humana de verdade, e silencia", async () => {
    // O controle na direção oposta. Sem ele, "nunca silenciar" passaria no caso
    // acima e o atendente que assume pelo celular seria atropelado pela IA.
    const { admin, silenciamentos } = adminFalso(false);

    const silenciou = await silenciarSeForRetomadaHumana(admin, ORG, CONVERSA);

    expect(
      silenciou,
      "não silenciou uma retomada humana legítima — a IA vai responder por cima do atendente",
    ).toBe(true);
    expect(silenciamentos, "não escreveu o silêncio").toHaveLength(1);
    expect(silenciamentos[0]).toHaveProperty("bot_silenced_until");
  });

  it("a consulta de envio em voo é ESCOPADA à conversa e à organização", async () => {
    // Um envio em voo em OUTRA conversa não pode calar esta decisão. Sem os dois
    // filtros, qualquer mensagem saindo em qualquer lugar da instalação
    // suprimiria o silenciamento de todas as conversas ao mesmo tempo.
    const { admin, consultas } = adminFalso(true);
    await silenciarSeForRetomadaHumana(admin, ORG, CONVERSA);

    const emMessages = consultas.find((c) => c.tabela === "messages");
    expect(emMessages, "não consultou `messages` para decidir").toBeDefined();
    expect(emMessages!.filtros.organization_id, "consulta sem filtro de organização").toBe(ORG);
    expect(emMessages!.filtros.conversation_id, "consulta sem filtro de conversa").toBe(CONVERSA);
    expect(emMessages!.filtros.direction, "não restringiu a outbound").toBe("outbound");
  });

  it("⚠️ envio VELHO não conta — senão a guarda fica aberta para sempre", async () => {
    // O buraco que a auditoria achou: uma linha `queued` do composer com a
    // sessão fora do ar não tem coletor nenhum (o cron pula `queued`, o
    // watchdog só olha `sent_via='ai'`). Sem recorte de idade ela fica lá, e
    // TODA retomada humana daquela conversa passa a ser lida como eco — a IA
    // nunca mais cala. Trocaria um defeito de 3 horas por um permanente.
    const { admin, silenciamentos } = adminFalso(true, { idadeDoEnvioMs: 30 * 60 * 1000 });

    const silenciou = await silenciarSeForRetomadaHumana(admin, ORG, CONVERSA);

    expect(
      silenciou,
      "um `queued` abandonado suprimiu a retomada humana — a IA não cala mais nesta conversa",
    ).toBe(true);
    expect(silenciamentos, "não silenciou").toHaveLength(1);
  });

  it("⚠️ erro na consulta NÃO silencia, e deixa rastro", async () => {
    // A borda cai para o lado frouxo de propósito, pela mesma assimetria: se um
    // erro de banco fosse lido como "não há envio em voo", ele silenciaria por
    // 3 horas — o dano grande — e silenciaria mudo.
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    const { admin, silenciamentos } = adminFalso(false, { erro: "connection reset" });

    const silenciou = await silenciarSeForRetomadaHumana(admin, ORG, CONVERSA);

    expect(silenciou, "erro de banco virou silêncio de 3 horas").toBe(false);
    expect(silenciamentos, "escreveu `bot_silenced_until` em cima de um erro").toHaveLength(0);
    expect(erro, "falhou em silêncio — sem log nenhum").toHaveBeenCalledWith(
      expect.stringContaining("bot NÃO silenciado por precaução"),
      expect.objectContaining({ erro: "connection reset" }),
    );
    erro.mockRestore();
  });

  it("⚠️ os DOIS estados de voo contam, não só um", async () => {
    // `queued` é o envio esperando a sessão do canal; `sending` é o que já foi
    // para o adapter. O eco pode chegar em qualquer um dos dois — a janela
    // medida de 279ms cai em `sending`, a de 900ms podia estar em `queued`.
    const { admin, consultas } = adminFalso(true);
    await silenciarSeForRetomadaHumana(admin, ORG, CONVERSA);

    const emMessages = consultas.find((c) => c.tabela === "messages");
    expect(emMessages!.statusAlvo, "cobriu só um dos estados de envio em voo").toEqual([
      "queued",
      "sending",
    ]);
  });

  it("a janela é generosa — 10 minutos, não 1", async () => {
    // O valor é escolha, não detalhe: janela curta demais devolve o defeito
    // original (eco de um envio lento chega fora dela e silencia por 3 horas).
    // Pela assimetria, o erro barato é o do lado frouxo.
    const { admin, consultas } = adminFalso(true);
    await silenciarSeForRetomadaHumana(admin, ORG, CONVERSA);

    const emMessages = consultas.find((c) => c.tabela === "messages");
    expect(emMessages!.recorteDeIdade, "a consulta não recorta por idade").not.toBeNull();
    const janelaMs = Date.now() - new Date(emMessages!.recorteDeIdade!).getTime();
    // 2× o `STUCK_AFTER_MS` do cron `recover-stuck-messages`, com folga para o
    // relógio do teste. Apertar isto reabre o defeito de 3 horas.
    expect(janelaMs, "a janela encolheu abaixo de 10 minutos").toBeGreaterThanOrEqual(
      10 * 60 * 1000 - 5000,
    );
    expect(janelaMs, "a janela virou grande demais para significar 'em voo'").toBeLessThan(
      20 * 60 * 1000,
    );
  });
});

describe("a guarda de artefato", () => {
  it("a ingestão de `fromMe` continua passando pela decisão", async () => {
    // Os casos acima exercitam a função de verdade, mas não provam que o
    // webhook a CHAMA: `handleOutboundFromUserPhone` precisa de sessão, banco e
    // payload para rodar. Sem esta guarda, alguém voltaria a chamar
    // `silenciarBotPorRetomadaHumana` direto e tudo seguiria verde.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/waha/ingest.ts", "utf8");

    expect(
      src,
      "a ingestão de fromMe deixou de passar pela decisão de eco",
    ).toContain(
      "await silenciarSeForRetomadaHumana(admin, session.organization_id, conversationId)",
    );
    // O silenciamento direto só pode aparecer DENTRO da própria decisão — se
    // voltar a ser chamado do fluxo de ingestão, o defeito volta junto.
    const chamadasDiretas = src.match(/await silenciarBotPorRetomadaHumana\(/g) ?? [];
    expect(
      chamadasDiretas,
      "voltou a silenciar direto do fluxo de ingestão, sem checar o eco",
    ).toHaveLength(1);
  });
});
