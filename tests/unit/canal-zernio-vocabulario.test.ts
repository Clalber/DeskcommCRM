import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * O vocabulário do terceiro canal — o que entra ANTES do transporte.
 *
 * O adapter ainda não existe. Isso é decisão, não pendência: o tipo, a matriz
 * de capabilities, a coluna de ref e os CHECKs do banco nascem juntos, e o
 * transporte chega depois encontrando o schema pronto. O caminho inverso obriga
 * a uma migration de correção sobre dados que já existem.
 *
 * O que se prova aqui é justamente que essa meia-instalação é HONESTA: o canal
 * é conhecido pelo sistema inteiro, e tentar enviar por ele falha ALTO em vez
 * de aceitar a mensagem e deixá-la parada esperando um transporte que não há.
 */
import {
  CHANNEL_CAPABILITIES,
  CHANNEL_PROVIDER_ZERNIO,
  capabilitiesOf,
} from "@/lib/channels/capabilities";
import { getAdapter } from "@/lib/channels";
import { CHANNEL_SESSION_REF_COLUMNS, resolveSessionRef } from "@/lib/channels/session-ref";

const ZERNIO = CHANNEL_PROVIDER_ZERNIO;

describe("capabilities do canal intermediado", () => {
  it("descreve o PERMITIDO, que é o do canal oficial — quem intermedeia muda o transporte", () => {
    expect(capabilitiesOf(ZERNIO)).toEqual({
      freeformOutsideWindow: false,
      requiresTemplates: true,
      banRisk: false,
      minIntervalMs: 6000,
      voiceNote: "opus-only",
      groups: "limited",
      costPerMessage: true,
    });
  });

  it("não herda o perfil do canal por QR — o que muda é o risco, e errar aqui desarma o anti-ban", () => {
    const porQr = CHANNEL_CAPABILITIES.waha;
    expect(capabilitiesOf(ZERNIO).banRisk).toBe(false);
    expect(porQr.banRisk).toBe(true);
    expect(capabilitiesOf(ZERNIO).requiresTemplates).not.toBe(porQr.requiresTemplates);
  });

  it("voiceNote é opus-only: o provider tem a flag mas NÃO converte", () => {
    // Ler o booleano do provider como "ele resolve para mim" é o erro que manda
    // mp3 e entrega anexo de música em vez de bolha de voz.
    expect(capabilitiesOf(ZERNIO).voiceNote).toBe("opus-only");
  });
});

describe("identificador da sessão", () => {
  it("resolve pelo id do INTERMEDIÁRIO, não pelo da Meta", () => {
    expect(
      resolveSessionRef({ provider: ZERNIO as "zernio", zernio_account_id: "acc_123" }),
    ).toBe("acc_123");
  });

  it("a coluna entra no select — sem ela o ref volta indefinido em runtime", () => {
    expect(CHANNEL_SESSION_REF_COLUMNS).toContain("zernio_account_id");
  });

  it("cada canal resolve pela SUA coluna — nenhum cai na do outro", () => {
    expect(resolveSessionRef({ provider: "waha", waha_session_name: "s1" })).toBe("s1");
    expect(
      resolveSessionRef({ provider: "meta_cloud", meta_phone_number_id: "pn1" }),
    ).toBe("pn1");
  });
});

describe("sem transporte, falha ALTO", () => {
  it("pedir o adapter lança em vez de devolver um dublê mudo", () => {
    // Um adapter que aceitasse e devolvesse `{externalId: null}` faria o
    // handler gravar `queued` — mensagem parada, sem erro, esperando um
    // transporte que não existe. Ninguém descobre até o cliente reclamar.
    expect(() => getAdapter(ZERNIO)).toThrow(/zernio/);
  });

  it("e NÃO cai no canal por QR por default — enviar pelo canal errado é pior que não enviar", () => {
    let caiuNoOutro = false;
    try {
      caiuNoOutro = getAdapter(ZERNIO).provider === "waha";
    } catch {
      caiuNoOutro = false;
    }
    expect(caiuNoOutro).toBe(false);
  });
});

describe("banco e TypeScript falam o mesmo vocabulário", () => {
  // O `pnpm test:db` prova isto contra um Postgres real; aqui é a leitura do
  // artefato que o self-hoster de fato aplica — o baseline, não as migrations.
  const baseline = readFileSync("supabase/baseline.sql", "utf8");

  it("o CHECK de provider do baseline conhece o canal novo", () => {
    expect(baseline).toMatch(/channel_sessions_provider_check[\s\S]{0,300}'zernio'/);
  });

  it("o CHECK de ref exige a coluna do canal novo", () => {
    expect(baseline).toMatch(/provider = 'zernio'\s+and zernio_account_id\s+is not null/);
  });

  it("os CHECKs são RECRIADOS, não protegidos por duplicate_object", () => {
    // Num clone eles já existem na versão de dois providers. `exception when
    // duplicate_object` engoliria a versão nova em silêncio: `update.sh` verde
    // e o banco recusando a sessão do canal novo.
    expect(baseline).toContain("drop constraint if exists channel_sessions_provider_check");
    expect(baseline).toContain("drop constraint if exists channel_sessions_provider_ref_check");
  });

  it("a coluna nasce antes do CHECK que a referencia", () => {
    const col = baseline.indexOf("add column if not exists zernio_account_id");
    const check = baseline.indexOf("provider = 'zernio'");
    expect(col).toBeGreaterThan(-1);
    expect(col).toBeLessThan(check);
  });

  it("a migration versionada existe junto do apêndice — clone atualiza pelas duas vias", () => {
    const mig = readFileSync(
      "supabase/migrations/20260808020000_0116_canal_zernio_vocabulario.sql",
      "utf8",
    );
    expect(mig).toContain("zernio_account_id");
    expect(readFileSync("supabase/migrations/MANIFEST.md", "utf8")).toContain(
      "0116_canal_zernio_vocabulario",
    );
  });
});
