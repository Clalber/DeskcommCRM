import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * PLAYBOOK SEMEADO E `description` DE FERRAMENTA FALAM COM O MESMO MODELO, NA MESMA JANELA.
 *
 * ## O defeito que fez este teste existir
 *
 * O playbook `agendamento` (`supabase/baseline.sql`) manda, ao remarcar, "cancele/substitua
 * o anterior explicitamente". A `description` de `crm_reschedule_appointment` manda o
 * oposto: remarcar é o MESMO compromisso mudando de hora, e cancelar+marcar faz o cliente
 * receber dois avisos contraditórios.
 *
 * Os dois textos chegam ao modelo **juntos** — `serializeStablePrefix`
 * (`lib/agent-engine/edge/llm/stable-prefix.ts:92`) serializa `tools` E `system`, e o
 * `system` é o corpo do playbook. Não dá para prever qual vence.
 *
 * E o gatilho que injeta esse playbook é a própria palavra "remarcar": a frase
 * "preciso remarcar minha consulta" é o gatilho literal.
 *
 * ## ⚠️ O QUE ESTE GATE **NÃO** PROVA — e sem esta ressalva o verde mente
 *
 * Ele cobra que o corpo do playbook **CITE** o nome da ferramenta. Isso prova que o
 * playbook **conhece** a ferramenta; **não prova que ele concorda com ela**. Um corpo pode
 * citar `crm_reschedule_appointment` e mandar cancelar-e-remarcar na linha seguinte, e este
 * teste fica verde.
 *
 * Conhecer é pré-condição de concordar, e a omissão é a parte mecanizável — por isso o gate
 * vale. Mas quem ler o verde como "não há contradição" está lendo mais do que está escrito.
 * A contradição continua sendo trabalho de revisão humana.
 *
 * ## E o limite de alcance
 *
 * Só alcança playbook **semeado** (que vive no `baseline.sql`, versionado). Playbook que o
 * cliente escreveu no banco dele é invisível para qualquer gate estático — para esse lado, o
 * caminho é checar na MONTAGEM do prompt, em runtime, onde o corpo real do tenant já está.
 */
const RAIZ = process.cwd();
const BASELINE = path.join(RAIZ, "supabase/baseline.sql");

/**
 * A declaração: playbook semeado → ferramentas que falam da MESMA ação.
 *
 * Quem escreve ferramenta nova declara aqui, e o gate cobra a citação. É o mesmo padrão de
 * `prova-em-tela`: endereço declarado tem de ser real.
 */
const PLAYBOOK_FALA_DE: Record<string, string[]> = {
  agendamento: [
    "crm_find_free_slots",
    "crm_book_appointment",
    "crm_reschedule_appointment",
    "crm_cancel_appointment",
  ],
};

/** Extrai os corpos `$body$…$body$` do baseline, com o nome do playbook. */
function playbooksSemeados(): Map<string, string> {
  const sql = readFileSync(BASELINE, "utf8");
  const achados = new Map<string, string>();
  const re = /values\s*\(\s*null,\s*'([a-z_]+)',[\s\S]*?\$body\$([\s\S]*?)\$body\$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql)) !== null) achados.set(m[1]!, m[2]!);
  return achados;
}

/**
 * ⚠️ A LISTA ESTÁ VAZIA, E ISSO É O ESTADO CERTO — não um esquecimento.
 *
 * Ela nasceu com `agendamento` dentro: o corpo do playbook era anterior às ferramentas de
 * agenda e a catraca teria nascido vermelha. A dívida foi PAGA na migration 0191, que
 * publicou o corpo novo e repontou `skill_pointers` — e o Arquiteto mediu o desfecho da
 * forma errada antes, num pg17 efêmero: aplicar o corpo novo no formato `if not exists` da
 * 0069 deixava **1 versão, ponteiro no corpo ANTIGO e NENHUM erro**. Um bloco que vira
 * no-op e não reclama é indistinguível de um que funcionou.
 *
 * ⚠️ E POR QUE A ENTRADA NÃO PODIA FICAR DEPOIS DE PAGA: enquanto ela existe, o `continue`
 * abaixo pula justamente o playbook que ela nomeia. Antes do pagamento isso era dívida
 * declarada; depois, viraria um DESLIGADOR PERMANENTE da vigilância sobre esse playbook —
 * verde e cego, no lugar exato onde o gate foi feito para olhar. (O argumento é do
 * Arquiteto, que provou que sem a entrada fica verde e mesmo assim não a removeu, porque
 * o arquivo vive noutra árvore.)
 *
 * Se alguma dívida nova entrar aqui, ela vem com motivo escrito — e sai no dia em que for
 * paga, não no dia em que alguém lembrar.
 */
const DIVIDA_CONGELADA: Record<string, string> = {};

describe("playbook semeado cita a ferramenta que fala da mesma ação", () => {
  const corpos = playbooksSemeados();

  it("CONTROLE: a varredura acha os playbooks do baseline", () => {
    // Sem isto, uma mudança no formato do seed devolveria zero corpos e o teste abaixo
    // passaria varrendo o vazio — verde por instrumento morto.
    expect(corpos.size).toBeGreaterThan(0);
    expect([...corpos.keys()]).toContain("agendamento");
  });

  it("CONTROLE: os corpos têm conteúdo, não são casca vazia", () => {
    for (const [nome, corpo] of corpos) {
      expect(corpo.length, `corpo de ${nome} veio vazio`).toBeGreaterThan(200);
    }
  });

  it("toda dívida congelada explica o porquê, e o playbook dela existe", () => {
    // Allowlist sem razão vira depósito, e depósito não é exceção: é a regra desmontada.
    // E se o playbook sumir do baseline, a entrada aqui vira lixo que esconde o gate.
    for (const [playbook, motivo] of Object.entries(DIVIDA_CONGELADA)) {
      expect(motivo.length, `${playbook} está congelado sem motivo escrito`).toBeGreaterThan(40);
      expect(corpos.has(playbook), `${playbook} está congelado e não existe no baseline`).toBe(true);
    }
  });

  it("todo playbook declarado cita as ferramentas que falam da mesma ação", () => {
    const faltando: string[] = [];
    for (const [playbook, ferramentas] of Object.entries(PLAYBOOK_FALA_DE)) {
      if (DIVIDA_CONGELADA[playbook]) continue; // nomeada acima, com dono e endereço.
      const corpo = corpos.get(playbook);
      if (corpo === undefined) {
        faltando.push(`${playbook} → o playbook não existe no baseline`);
        continue;
      }
      for (const f of ferramentas) {
        if (!corpo.includes(f)) faltando.push(`${playbook} → não cita ${f}`);
      }
    }

    expect(
      faltando,
      "Playbook semeado fala de uma ação para a qual existe ferramenta, e não a nomeia. " +
        "Os dois textos chegam ao modelo na MESMA janela (tools + system em " +
        "`serializeStablePrefix`), e o playbook que não conhece a ferramenta manda o modelo " +
        "fazer à mão o que ele tem capacidade de fazer — ou, pior, manda o CONTRÁRIO. " +
        "⚠️ Citar não é concordar: este gate pega a OMISSÃO, não a contradição.",
    ).toEqual([]);
  });
});
