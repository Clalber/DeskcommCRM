/**
 * O flywheel não escolhe modelo por conta própria.
 *
 * ⚠️ O DEFEITO QUE ESTE ARQUIVO EXISTE PARA IMPEDIR, medido em produção em
 * 2026-09-04: `lib/agent-engine/flywheel/live.ts` cravava
 * `const JUDGE_MODEL = 'claude-haiku-4-5'` e um `DISTILLER_MODEL` igual, e os
 * passava como `input.model`.
 *
 * Passar `model` no call site põe a escolha no degrau "variável de ambiente" da
 * precedência (`lib/ai/pontos/resolver.ts`), que herda o PROVIDER do padrão da
 * organização e usa ESTE modelId. A organização usava OpenRouter, o id era da
 * Anthropic, e toda rodada agendada morria com `claude-haiku-4-5 is not a valid
 * model ID` — todo dia, em silêncio, com a tela de Propostas parada.
 *
 * Um id de modelo é sempre de UM fornecedor. Cravá-lo aqui é apostar que a
 * instalação usa aquele fornecedor — e este produto é self-host, então essa
 * aposta é perdida por construção em qualquer cliente que escolha outro.
 *
 * A varredura é textual porque o defeito é textual: não há como um teste de
 * comportamento pegar "o autor voltou a escrever um id de modelo aqui".
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const LIVE = "lib/agent-engine/flywheel/live.ts";
const SEAM = "lib/agent-engine/edge/llm/run-model-call.ts";

/** Marcas de id de modelo de fornecedor, nas famílias que o produto conhece. */
const CARA_DE_MODELO = /['"`](?:claude|gpt|gemini|llama|mistral|deepseek|grok|o[134])[-\w.]*['"`]/i;

describe("o flywheel resolve o modelo pelo painel", () => {
  const fonte = readFileSync(LIVE, "utf-8");

  it("não crava id de modelo de fornecedor nenhum", () => {
    const linhas = fonte
      .split("\n")
      .map((l, i) => ({ n: i + 1, texto: l }))
      // Comentário é onde a história do defeito fica registrada — e ela CITA o
      // id antigo de propósito. Medir comentário aqui proibiria documentar.
      .filter(({ texto }) => !texto.trimStart().startsWith("//") && !texto.trimStart().startsWith("*"))
      .filter(({ texto }) => CARA_DE_MODELO.test(texto));

    expect(
      linhas.map(({ n, texto }) => `${LIVE}:${n}  ${texto.trim()}`),
      "id de modelo cravado no flywheel: ele vira `input.model`, herda o provider da org " +
        "e quebra em toda instalação cujo fornecedor não seja o desse id",
    ).toEqual([]);
  });

  it("as duas chamadas passam o ponto e NÃO passam modelo", () => {
    for (const ponto of ["flywheel_judge", "flywheel_distiller"]) {
      const i = fonte.indexOf(`purpose: '${ponto}'`);
      expect(i, `o ponto ${ponto} sumiu da chamada`).toBeGreaterThan(-1);
      // A janela cobre o objeto da chamada logo depois do `purpose`.
      const janela = fonte.slice(i, i + 220);
      expect(janela, `${ponto} voltou a impor um modelo no call site`).not.toMatch(/^\s*model:/m);
    }
  });

  it("a procedência gravada é a REAL, não um literal", () => {
    // O insert registrava `'anthropic'` fixo e a constante cravada, enquanto o
    // ponto no painel apontava para openai/gpt-5.4-mini. Quem auditasse qual
    // modelo deu qual veredito leria uma resposta falsa.
    expect(fonte, "voltou a gravar a família do juiz como literal").not.toContain("'anthropic',");
    expect(fonte).toContain("judgedCall.provider");
    expect(fonte).toContain("judgedCall.model");
  });
});

describe("a falha por modelo ausente diz QUAL ponto configurar", () => {
  it("a mensagem interpola o purpose", () => {
    const seam = readFileSync(SEAM, "utf-8");
    const i = seam.indexOf("modelo LLM não definido");
    expect(i, "a mensagem sumiu").toBeGreaterThan(-1);
    expect(
      seam.slice(i - 40, i + 200),
      'a mensagem voltou a dizer "o ponto" sem nomear qual — a tela tem mais de vinte',
    ).toContain("${purpose}");
  });
});
