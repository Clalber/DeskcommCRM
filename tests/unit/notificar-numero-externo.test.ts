/**
 * Avisar um número NOSSO — as decisões que este recurso não pode perder.
 *
 * ⚠️ O pedido: "não vou ficar com a plataforma aberta 24h". Quando o lead chega
 * a uma etapa escolhida, um número fora da plataforma recebe o aviso.
 *
 * As quatro coisas que os casos abaixo travam, e o que custa perder cada uma:
 *
 *  1. **Só número REGISTRADO.** Sem a amarra, um erro de digitação na regra vira
 *     disparo pelo número da empresa para qualquer número do mundo.
 *  2. **Reserva ANTES do envio.** O `event-log/drain` devolve à fila evento
 *     preso há 10min e `consumed_by` só é gravado depois do handler inteiro:
 *     sem reserva, um crash entre enviar e registrar toca o celular duas vezes.
 *  3. **`externalId: null` é FALHA.** O adapter do WAHA devolve isso SEM lançar
 *     quando não há configuração. Registrar `sent` aí seria mentir para quem
 *     confia que seria avisado.
 *  4. **O eco não vira contato — mas só o ECO.** A supressão é por identidade do
 *     envio, nunca por "o número está cadastrado": esta última mataria o
 *     registro de mensagens legítimas para aquele número (defeito #108).
 */
import { describe, expect, it, vi } from "vitest";

const ORG = "11111111-1111-4111-8111-111111111111";
const OUTRA_ORG = "99999999-9999-4999-8999-999999999999";
const REGRA = "22222222-2222-4222-8222-222222222222";
const EVENTO = "33333333-3333-4333-8333-333333333333";
const NUMERO_ID = "44444444-4444-4444-8444-444444444444";
const SESSAO = "55555555-5555-4555-8555-555555555555";
const FONE = "+5519997403473";

interface Cenario {
  numeroExisteNaOrg?: boolean;
  sessaoStatus?: string;
  provider?: string;
  adapterConfigurado?: boolean;
  quota?: number;
  reservaDuplicada?: boolean;
  externalId?: string | null;
}

interface Registro {
  enviosAoAdapter: Array<Record<string, unknown>>;
  reservas: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
  pacing: number;
  filtros: Record<string, Record<string, unknown>>;
}

/**
 * Exercita a MESMA sequência de decisão do executor. Ele importa o registry de
 * ações e o adapter real no topo do módulo, o que exigiria um grafo de mocks
 * maior que o comportamento medido; a guarda contra divergência é a asserção de
 * artefato no fim do arquivo, que reprova por texto se o call site mudar.
 */
async function decidir(c: Cenario = {}): Promise<{ resultado: string; motivo?: string; reg: Registro }> {
  const reg: Registro = { enviosAoAdapter: [], reservas: [], updates: [], pacing: 0, filtros: {} };
  const numeroExiste = c.numeroExisteNaOrg ?? true;
  const status = c.sessaoStatus ?? "WORKING";
  const provider = c.provider ?? "waha";
  const configurado = c.adapterConfigurado ?? true;
  const quota = c.quota ?? 1;
  const externalId = c.externalId === undefined ? "WAMID123" : c.externalId;

  // 1. O número, SEMPRE escopado à organização do contexto.
  reg.filtros.numero = { id: NUMERO_ID, organization_id: ORG };
  if (!numeroExiste) return { resultado: "skipped", motivo: "numero_nao_registrado", reg };

  // 2. Pré-voo do canal.
  if (status !== "WORKING") return { resultado: "skipped", motivo: "canal_fora_do_ar", reg };
  // Capacidade, não nome de provider: hoje só o WAHA manda texto livre fora da
  // janela de 24h, e o atendente nunca escreveu para o número da empresa.
  if (provider !== "waha") return { resultado: "skipped", motivo: "canal_sem_texto_livre", reg };
  if (!configurado) return { resultado: "skipped", motivo: "canal_sem_configuracao", reg };

  // 3. Teto por hora, por incremento ATÔMICO (nunca count-depois-envia).
  if (quota > 20) return { resultado: "skipped", motivo: "teto_atingido", reg };

  // 4. A RESERVA, antes do envio.
  if (c.reservaDuplicada) return { resultado: "skipped", motivo: "ja_notificado", reg };
  reg.reservas.push({
    organization_id: ORG,
    rule_id: REGRA,
    event_id: EVENTO,
    notify_number_id: NUMERO_ID,
    status: "reserved",
  });

  // 5. O envio.
  reg.enviosAoAdapter.push({ to: FONE, sessionRef: "sessao-x" });

  const sucesso = externalId !== null;
  reg.updates.push({ status: sucesso ? "sent" : "failed", external_id: externalId });
  if (!sucesso) return { resultado: "failed", motivo: "adapter_devolveu_null", reg };

  reg.pacing += 1;
  return { resultado: "success", reg };
}

describe("o aviso só vai para número registrado", () => {
  it("⚠️ número que não está na tabela → NÃO envia", async () => {
    // Sem esta amarra, o motor de automação vira um enviador de WhatsApp
    // arbitrário: erro de digitação na regra dispara pelo número da empresa.
    const r = await decidir({ numeroExisteNaOrg: false });
    expect(r.resultado).toBe("skipped");
    expect(r.motivo).toBe("numero_nao_registrado");
    expect(r.reg.enviosAoAdapter, "enviou para número não registrado").toHaveLength(0);
  });

  it("a consulta do número é escopada à ORGANIZAÇÃO do contexto", async () => {
    // O admin client bypassa RLS. Sem o filtro explícito, um id de número de
    // outra organização viraria envio cross-tenant pelo número desta.
    const r = await decidir();
    expect(r.reg.filtros.numero?.organization_id, "consulta sem filtro de organização").toBe(ORG);
    expect(r.reg.filtros.numero?.organization_id).not.toBe(OUTRA_ORG);
  });
});

describe("o pré-voo do canal", () => {
  it("⚠️ canal fora do ar → recusa com motivo, não falha crua", async () => {
    const r = await decidir({ sessaoStatus: "STOPPED" });
    expect(r.resultado).toBe("skipped");
    expect(r.motivo).toBe("canal_fora_do_ar");
  });

  it("⚠️ canal sem texto livre fora da janela → recusa ANTES de tentar", async () => {
    // O atendente nunca escreveu para o número da empresa, então não existe
    // janela de 24h aberta: por Cloud API o aviso falharia sempre. Melhor
    // recusar com motivo legível que acumular falha silenciosa.
    for (const provider of ["meta_cloud", "zernio", "meta_instagram"]) {
      const r = await decidir({ provider });
      expect(r.motivo, `${provider} deveria ser recusado`).toBe("canal_sem_texto_livre");
      expect(r.reg.enviosAoAdapter, `tentou enviar por ${provider}`).toHaveLength(0);
    }
  });

  it("canal WAHA configurado passa (controle da direção oposta)", async () => {
    // Sem este caso, "recusar sempre" passaria nos dois acima e o recurso
    // nasceria morto, em silêncio.
    const r = await decidir({ provider: "waha" });
    expect(r.resultado).toBe("success");
    expect(r.reg.enviosAoAdapter).toHaveLength(1);
  });
});

describe("a reserva antes do envio", () => {
  it("⚠️ a reserva é gravada ANTES de o adapter ser chamado", async () => {
    // A ordem é a proteção inteira: reserva depois do envio não impede nada,
    // porque o crash acontece no meio.
    const r = await decidir();
    expect(r.reg.reservas, "não reservou").toHaveLength(1);
    expect(r.reg.reservas[0]!.status).toBe("reserved");
  });

  it("⚠️ evento reentregue → UM aviso, não dois", async () => {
    // O drain devolve à fila evento preso em `processing` há mais de 10min, e
    // `consumed_by` só é gravado depois do handler inteiro. Sem a reserva, o
    // celular do dono toca duas vezes pelo mesmo lead.
    const r = await decidir({ reservaDuplicada: true });
    expect(r.motivo, "reenvio duplicado não foi barrado").toBe("ja_notificado");
    expect(r.reg.enviosAoAdapter, "enviou de novo no retry").toHaveLength(0);
  });

  it("a chave da reserva inclui o NÚMERO", async () => {
    // Uma regra aceita até 10 ações: dois avisos para números diferentes no
    // mesmo evento são legítimos. Chave sem o número deduplicaria o segundo.
    const r = await decidir();
    const chave = r.reg.reservas[0]!;
    for (const campo of ["organization_id", "rule_id", "event_id", "notify_number_id"]) {
      expect(chave[campo], `a chave não considera ${campo}`).toBeDefined();
    }
  });
});

describe("o teto por hora", () => {
  it("⚠️ acima do teto → não envia", async () => {
    // Sem teto, o primeiro dia de uso real termina com a pessoa silenciando a
    // conversa — e aí nenhum aviso chega nunca mais.
    const r = await decidir({ quota: 21 });
    expect(r.motivo).toBe("teto_atingido");
    expect(r.reg.enviosAoAdapter).toHaveLength(0);
  });

  it("dentro do teto envia (controle)", async () => {
    const r = await decidir({ quota: 20 });
    expect(r.resultado).toBe("success");
  });
});

describe("o desfecho do envio", () => {
  it("⚠️ `externalId: null` é FALHA, nunca sucesso", async () => {
    // O adapter do WAHA devolve `{externalId: null}` SEM lançar quando não há
    // configuração. Gravar `sent` aqui registraria um aviso que nunca saiu —
    // e quem configurou confia que seria avisado.
    const r = await decidir({ externalId: null });
    expect(r.resultado, "null virou sucesso").toBe("failed");
    expect(r.reg.updates[0]!.status).toBe("failed");
    expect(r.reg.pacing, "contabilizou no anti-ban um envio que não saiu").toBe(0);
  });

  it("⚠️ envio bem-sucedido CONTA no anti-banimento", async () => {
    // O aviso sai pelo MESMO número que atende cliente. Hoje nenhuma ação de
    // automação alimenta o `pacing_ledger` (`checkDailyLimit` lê uma tabela sem
    // escritor no produto) — esta não herda a falha.
    const r = await decidir();
    expect(r.reg.pacing, "o envio não contou no pacing_ledger").toBe(1);
  });

  it("o `external_id` é gravado depois que o adapter responde", async () => {
    const r = await decidir();
    expect(r.reg.updates[0]!.external_id).toBe("WAMID123");
    expect(r.reg.updates[0]!.status).toBe("sent");
  });
});

describe("a guarda de artefato", () => {
  it("o executor mantém a ordem e as decisões", async () => {
    // Os casos acima medem a REGRA. Este cobra o call site: o executor importa
    // adapter e registry no topo do módulo, e sem esta guarda alguém inverteria
    // reserva e envio — ou trocaria o gate de capability por nome de provider —
    // com todos os verdes acima intactos.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/automation/actions/notify-number.ts", "utf8");

    // A reserva vem ANTES do envio. Se a ordem inverter, a proteção some.
    // O `insert` da reserva, não qualquer menção à tabela: o `update` do
    // desfecho também casa com `.from("org_notify_sends")` e mascararia a
    // inversão.
    const iReserva = src.indexOf('.from("org_notify_sends")\n    .insert(');
    const iEnvio = src.indexOf("await adapter.send(");
    expect(iReserva, "não reserva").toBeGreaterThan(-1);
    expect(iEnvio, "não envia").toBeGreaterThan(-1);
    expect(iReserva, "o envio passou a vir ANTES da reserva").toBeLessThan(iEnvio);

    expect(src, "deixou de capturar o 23505 da reserva").toContain('"23505"');
    expect(src, "o número deixou de ser escopado à organização").toContain(
      'eq("organization_id", ctx.organizationId)',
    );
    expect(src, "o gate virou nome de provider em vez de capacidade").toContain(
      "capabilitiesOf(provider).freeformOutsideWindow",
    );
    // O desfecho tem de ser CONDICIONAL. `contains("externalId !== null")` era
    // frouxo: sobrava a mesma expressão noutra linha e a sabotagem passava.
    expect(src, "`externalId: null` deixou de ser falha").toContain(
      'status: externalId !== null ? "sent" : "failed"',
    );
    // A CHAMADA, não a existência da função: apagar a chamada deixava o helper
    // no arquivo e a asserção anterior verde.
    expect(src, "o envio deixou de contar no anti-banimento").toContain(
      "await registrarNoPacing(ctx, sessionId)",
    );
    // O audit referencia o CADASTRO, nunca o telefone: número da equipe é dado
    // pessoal, e registro operacional não é cópia de dado pessoal.
    expect(src, "o audit passou a registrar o telefone cru").not.toMatch(
      /metadata:[\s\S]{0,200}phone_e164/,
    );
  });

  it("a ingestão suprime o eco por IDENTIDADE, nunca por número cadastrado", async () => {
    // A distinção é o defeito #108 inteiro: suprimir porque "o número está
    // cadastrado" apagaria mensagem legítima para aquele número, para sempre.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("lib/waha/ingest.ts", "utf8");

    expect(src, "a supressão do eco de notificação sumiu").toContain("ehEcoDeNotificacaoNossa");
    expect(src, "deixou de casar por identidade do envio").toMatch(
      /in\("external_id", idCandidates\)/,
    );
    expect(src, "deixou de considerar a reserva EM VOO").toContain('.eq("status", "reserved")');
    // Comparação de telefone nunca é igualdade crua: 12 ou 13 dígitos são a
    // mesma pessoa, e o eco pode vir num formato e o cadastro noutro.
    expect(src, "voltou a comparar telefone por igualdade crua").toContain("samePhone(");
    // E o inbound NUNCA é suprimido: a resposta do atendente é mensagem de
    // gente, e apagá-la seria pior que o problema original.
    const iFuncao = src.indexOf("async function ehEcoDeNotificacaoNossa");
    const iChamada = src.indexOf("await ehEcoDeNotificacaoNossa(");
    expect(iChamada, "a supressão não é chamada em lugar nenhum").toBeGreaterThan(iFuncao);
    const antesDaChamada = src.slice(0, iChamada);
    expect(
      antesDaChamada.lastIndexOf("async function handleOutboundFromUserPhone"),
      "a supressão saiu do caminho fromMe — se foi para o inbound, apaga mensagem de gente",
    ).toBeGreaterThan(antesDaChamada.lastIndexOf("async function handleInbound"));
  });
});
