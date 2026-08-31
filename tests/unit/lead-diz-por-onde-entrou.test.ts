/**
 * A timeline diz por onde a pessoa entrou — e não chuta.
 *
 * ─── O defeito, visto na tela por quem opera ────────────────────────────────
 *
 * `lead_created` tinha um rótulo fixo: "Entrou pelo WhatsApp". Valeu enquanto
 * havia um canal só. No dia em que o primeiro contato chegou pelo Instagram, a
 * timeline dele afirmava um canal que a pessoa nunca usou — e o `source` do
 * lead gravava `whatsapp` no banco, contaminando qualquer relatório de origem.
 *
 * Afirmação errada na timeline é pior que ausência: ela manda quem investiga
 * procurar a conversa no canal errado.
 *
 * ─── O que este arquivo protege ─────────────────────────────────────────────
 *
 * Que o rótulo siga o CANAL, e que a linha antiga — gravada antes desta
 * mudança, sem canal no payload — continue lendo exatamente como lia. Uma
 * correção que reescrevesse o passado seria outro defeito.
 */
import { describe, expect, it } from "vitest";

import { activityLabel } from "@/lib/leads/activity-vocabulary";

describe("o rótulo de nascimento do lead", () => {
  it("diz Instagram quando a conversa nasceu no Instagram", () => {
    expect(activityLabel("lead_created", { channel: "instagram" })).toBe("Entrou pelo Instagram");
  });

  it("diz WhatsApp quando a conversa nasceu no WhatsApp", () => {
    expect(activityLabel("lead_created", { channel: "whatsapp" })).toBe("Entrou pelo WhatsApp");
  });

  it("LINHA ANTIGA, sem canal no payload, lê como sempre leu", () => {
    // As linhas gravadas antes desta mudança não têm `channel`. Elas são de
    // WhatsApp — era o único canal — e precisam continuar dizendo isso.
    expect(activityLabel("lead_created")).toBe("Entrou pelo WhatsApp");
    expect(activityLabel("lead_created", { conversation_id: "abc" })).toBe("Entrou pelo WhatsApp");
    expect(activityLabel("lead_created", null)).toBe("Entrou pelo WhatsApp");
  });

  it("canal desconhecido não inventa rótulo", () => {
    // Um canal futuro que ainda não tenha rótulo próprio cai no padrão em vez
    // de mostrar o nome cru na tela do operador.
    expect(activityLabel("lead_created", { channel: "telegram" })).toBe("Entrou pelo WhatsApp");
    expect(activityLabel("lead_created", { channel: 123 })).toBe("Entrou pelo WhatsApp");
  });

  it("o segundo parâmetro não afeta OUTRAS atividades", () => {
    // O controle: só `lead_created` consulta o canal. Se a leitura passasse a
    // olhar payload para todo tipo, um payload com `channel` mudaria rótulos
    // que nada têm a ver com canal de entrada.
    expect(activityLabel("note", { channel: "instagram" })).toBe(activityLabel("note"));
    expect(activityLabel("stage_changed", { channel: "instagram" })).toBe(
      activityLabel("stage_changed"),
    );
  });
});

describe("quem GRAVA o canal", () => {
  it("lê da conversa em vez de presumir, e só quando o lead nasce", async () => {
    const { readFileSync } = await import("node:fs");
    const fonte = readFileSync("lib/leads/nascimento-do-lead.ts", "utf8");

    // O literal sumiu dos dois lugares onde ele mentia.
    expect(fonte).not.toContain('source: rotuloDeAnuncio ? contato!.source : "whatsapp"');
    expect(fonte).not.toContain('reason: "primeira mensagem recebida no WhatsApp"');

    // E o canal entra no payload — é ele que a leitura consulta.
    expect(fonte).toContain("channel: canalDeEntrada");

    // A consulta vem DEPOIS da decisão de criar: no topo da função ela rodaria
    // a cada mensagem recebida, para nada, no caminho mais quente do produto.
    // Medir o INSERT, não a primeira menção a `crm_leads` — o arquivo consulta
    // a tabela antes, para decidir se o lead já existe. A primeira versão desta
    // sonda comparou com essa consulta e ficou vermelha por instrumento
    // errado, não por defeito. É a segunda vez hoje que uma sonda de `indexOf`
    // me engana pelo mesmo motivo.
    const consulta = fonte.indexOf('.from("conversations")');
    const insere = fonte.indexOf('.from("crm_leads")\n    .insert(');
    expect(consulta).toBeGreaterThan(-1);
    expect(insere).toBeGreaterThan(-1);
    expect(insere).toBeGreaterThan(consulta);
  });
});
