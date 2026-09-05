/**
 * Criar uma automação DUAS vezes com a mesma chave cria UMA regra.
 *
 * ⚠️ O defeito, medido em produção nesta instalação
 *
 * O dono clicou uma vez em salvar e ficou com duas automações idênticas na
 * tela. O banco mostra o que aconteceu, com os dois `request_id` distintos e as
 * duas linhas auditadas:
 *
 *   06:23:25.271  automation.rule_created  199ca4e8  req 22213ec5
 *   06:23:25.629  automation.rule_created  1d22bcad  req 6dbccacd
 *
 * 358ms de intervalo — o `backoffMs(1)` de `lib/api/client.ts` (200ms ± 50 de
 * jitter) mais o tempo do primeiro POST.
 *
 * ─── E o cliente estava CERTO ─────────────────────────────────────────────
 *
 * `lib/api/client.ts` retenta mutação quando a rede falha, reenviando a MESMA
 * `Idempotency-Key` — ela é gerada uma vez, FORA do laço, exatamente para isto.
 * A primeira requisição chegou ao banco e a resposta se perdeu no caminho (a
 * VPS vinha com `fetch failed` intermitente naquela madrugada); a retentativa
 * criou a cópia.
 *
 * A doutrina do repositório diz a frase inteira: **"quem falha é sempre a ROTA
 * que não lê o header"**. Antes deste conserto, só duas rotas do produto
 * honravam a chave — envio de mensagem e aprovação de LGPD.
 *
 * ─── As três direções que os casos abaixo travam ──────────────────────────
 *
 * Um teste que só provasse "não duplica" passaria com a rota recusando TUDO.
 * Por isso os controles opostos: chave nova cria, e corpo diferente na mesma
 * chave é ERRO — devolver a primeira regra ali esconderia a segunda que a
 * pessoa quis criar.
 */
import { describe, expect, it } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const ENDPOINT = "/api/v1/automation-rules";

interface Reserva {
  organizationId: string;
  chave: string | null;
  endpoint: string;
  requestHash: string;
}

/** Banco de reservas em memória, com a única regra que importa: a unicidade. */
function bancoDeReservas() {
  const linhas = new Map<string, { hash: string; estado: string; corpo: unknown }>();
  const chaveDe = (e: Reserva) => `${e.organizationId}|${e.chave}|${e.endpoint}`;

  return {
    linhas,
    reservar(e: Reserva): { estado: string; corpo?: unknown } {
      // Sem chave não há o que deduplicar — segue direto, como hoje.
      if (e.chave === null) return { estado: "livre" };
      const atual = linhas.get(chaveDe(e));
      if (atual === undefined) {
        linhas.set(chaveDe(e), { hash: e.requestHash, estado: "em_andamento", corpo: null });
        return { estado: "livre" };
      }
      // Mesma chave, corpo DIFERENTE: não é repetição, é erro de quem chama.
      if (atual.hash !== e.requestHash) return { estado: "conflito_de_corpo" };
      if (atual.estado === "concluida") return { estado: "repetida", corpo: atual.corpo };
      return { estado: "em_andamento" };
    },
    guardar(e: Reserva, corpo: unknown) {
      const l = linhas.get(chaveDe(e));
      if (l) {
        l.estado = "concluida";
        l.corpo = corpo;
      }
    },
    soltar(e: Reserva) {
      linhas.delete(chaveDe(e));
    },
  };
}

interface Cenario {
  chave: string | null;
  corpo: Record<string, unknown>;
  insertFalha?: boolean;
}

/**
 * Reproduz a sequência da rota. Ela é um route handler que precisa de sessão,
 * RBAC e cifra de segredo para rodar; a guarda contra divergência é a asserção
 * de artefato no fim, que reprova por texto se o call site mudar.
 */
function criarRegra(banco: ReturnType<typeof bancoDeReservas>, c: Cenario) {
  const escopo: Reserva = {
    organizationId: ORG,
    chave: c.chave,
    endpoint: ENDPOINT,
    requestHash: JSON.stringify(c.corpo),
  };
  const r = banco.reservar(escopo);

  if (r.estado === "repetida") return { status: 200, criou: false, corpo: r.corpo };
  if (r.estado === "em_andamento") return { status: 409, criou: false };
  if (r.estado === "conflito_de_corpo") return { status: 409, criou: false, conflito: true };

  if (c.insertFalha) {
    // Falha SOLTA a reserva: guardar o erro faria uma indisponibilidade curta
    // virar erro permanente por 24h para esta chave.
    banco.soltar(escopo);
    return { status: 500, criou: false };
  }

  const regra = { id: `regra-${banco.linhas.size}`, ...c.corpo };
  banco.guardar(escopo, regra);
  return { status: 201, criou: true, corpo: regra };
}

const CORPO = { name: "Notifica agendamento", trigger_event: "lead.stage_changed" };

describe("a retentativa não duplica a automação", () => {
  it("⚠️ mesma chave, mesmo corpo → UMA regra, e a segunda devolve a primeira", () => {
    // O caso medido: o dono clicou uma vez e ficou com duas na tela.
    const banco = bancoDeReservas();
    const primeira = criarRegra(banco, { chave: "k-1", corpo: CORPO });
    banco.guardar(
      { organizationId: ORG, chave: "k-1", endpoint: ENDPOINT, requestHash: JSON.stringify(CORPO) },
      primeira.corpo,
    );
    const segunda = criarRegra(banco, { chave: "k-1", corpo: CORPO });

    expect(primeira.criou, "a primeira não criou").toBe(true);
    expect(segunda.criou, "a retentativa criou uma SEGUNDA regra — o defeito voltou").toBe(false);
    expect(segunda.status, "a retentativa devolveu erro numa regra que existe").toBe(200);
    expect(segunda.corpo, "a retentativa não devolveu a regra da primeira").toEqual(primeira.corpo);
  });

  it("⚠️ chave NOVA cria uma regra nova (controle da direção oposta)", () => {
    // Sem este caso, "nunca criar" passaria no primeiro e a tela ficaria sem
    // conseguir criar automação nenhuma, em silêncio.
    const banco = bancoDeReservas();
    const a = criarRegra(banco, { chave: "k-1", corpo: CORPO });
    banco.guardar(
      { organizationId: ORG, chave: "k-1", endpoint: ENDPOINT, requestHash: JSON.stringify(CORPO) },
      a.corpo,
    );
    const b = criarRegra(banco, { chave: "k-2", corpo: { ...CORPO, name: "Outra" } });

    expect(b.criou, "chave nova não criou regra").toBe(true);
    expect(b.status).toBe(201);
  });

  it("⚠️ mesma chave com corpo DIFERENTE é erro, não repetição", () => {
    // Devolver a primeira regra aqui esconderia a segunda que a pessoa quis
    // criar — ela veria sucesso e uma automação que não é a dela.
    const banco = bancoDeReservas();
    criarRegra(banco, { chave: "k-1", corpo: CORPO });
    const outra = criarRegra(banco, { chave: "k-1", corpo: { ...CORPO, name: "Diferente" } });

    expect(outra.conflito, "corpo diferente passou como repetição").toBe(true);
    expect(outra.criou).toBe(false);
  });

  it("sem chave nenhuma, a rota segue criando (compatibilidade)", () => {
    // Cliente antigo, `curl` na mão, integração de terceiro: nada disso manda o
    // cabeçalho, e recusar aí quebraria quem já usa a API.
    const banco = bancoDeReservas();
    const a = criarRegra(banco, { chave: null, corpo: CORPO });
    const b = criarRegra(banco, { chave: null, corpo: CORPO });

    expect(a.criou).toBe(true);
    expect(b.criou, "sem chave, cada chamada é uma criação — e tem de continuar sendo").toBe(true);
  });

  it("⚠️ falha no insert SOLTA a reserva — a retentativa seguinte consegue criar", () => {
    // Guardar o erro faria uma indisponibilidade de rede de 2 segundos virar
    // "não consigo criar esta automação" por 24 horas.
    const banco = bancoDeReservas();
    const falhou = criarRegra(banco, { chave: "k-1", corpo: CORPO, insertFalha: true });
    const depois = criarRegra(banco, { chave: "k-1", corpo: CORPO });

    expect(falhou.status).toBe(500);
    expect(depois.criou, "a reserva ficou presa e travou a criação para sempre").toBe(true);
  });
});

describe("a guarda de artefato", () => {
  it("a rota continua reservando ANTES de inserir", async () => {
    // Os casos acima medem a REGRA. Este cobra o call site: a rota é um route
    // handler que precisa de sessão, RBAC e cifra para rodar, e sem esta guarda
    // alguém removeria a reserva com todos os verdes acima intactos.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("app/api/v1/automation-rules/route.ts", "utf8");

    expect(src, "a rota deixou de ler o cabeçalho de idempotência").toContain(
      "chaveDoCabecalho(req.headers)",
    );

    // A ORDEM é a proteção inteira: reservar depois de inserir não impede nada.
    //
    // ⚠️ Recortado no POST de propósito: o GET deste mesmo arquivo também lê
    // `automation_rules`, e um `indexOf` no arquivo inteiro acharia AQUELE —
    // medindo a ordem entre duas coisas que não têm relação. O teste reprovou
    // por isso antes de a asserção ficar honesta.
    const post = src.slice(src.indexOf("export async function POST"));
    const iReserva = post.indexOf("await reservarExecucao(");
    const iInsert = post.indexOf('.from("automation_rules")');
    expect(iReserva, "não reserva").toBeGreaterThan(-1);
    expect(iInsert, "não insere").toBeGreaterThan(-1);
    expect(iReserva, "o insert passou a vir ANTES da reserva").toBeLessThan(iInsert);

    expect(post, "a repetição deixou de devolver a regra da primeira tentativa").toContain(
      'reserva.estado === "repetida"',
    );
    expect(src, "falha deixou de soltar a reserva — a chave trava por 24h").toContain(
      "await soltarReserva(admin, escopo)",
    );
    expect(src, "o resultado não é guardado — toda retentativa recria").toContain(
      "await guardarResultado(admin, escopo",
    );
    // O hash do corpo é o que separa "repetição" de "chave reaproveitada".
    expect(src, "a reserva deixou de considerar o corpo do pedido").toContain(
      "hashDoPedido(parsed.data)",
    );
  });
});
