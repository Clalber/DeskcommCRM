#!/usr/bin/env tsx
/**
 * `pnpm release:nivel` — diz que número a próxima release PRECISA ter, e por quê.
 *
 * Existe porque o número era escolhido no olho, toda vez. A regra mora em
 * `lib/release/nivel-da-versao.ts` (com a calibração contra as 8 releases reais
 * no cabeçalho); aqui só se COLETA a evidência do git e se imprime o veredito.
 *
 * Rode antes de escrever a seção do CHANGELOG, não depois: o número decide como
 * o operador da VPS lê o que vai instalar.
 *
 *   pnpm release:nivel                 # desde a última tag até o HEAD
 *   pnpm release:nivel v1.4.0 v1.4.1   # confere um intervalo já lançado
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  nivelExigido,
  proximaVersao,
  type EvidenciaDaRelease,
} from "../lib/release/nivel-da-versao";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** As tags de release do PROJETO. A de fork (`v1.1.1-jmpo.1`) não é nossa. */
function tagsDeRelease(): string[] {
  return git("tag", "-l", "v*", "--sort=creatordate")
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t));
}

/** A seção de UMA versão do CHANGELOG, crua. `null` quando não existe. */
function secaoDoChangelog(texto: string, versao: string): string | null {
  const alvo = versao.replace(/^v/, "");
  const re = new RegExp(
    `^## \\[${alvo.replace(/\./g, "\\.")}\\][\\s\\S]*?(?=^## \\[|\\Z)`,
    "m",
  );
  return re.exec(texto)?.[0] ?? null;
}

/** Os `## [1.2.3]` do CHANGELOG, do topo para baixo. Ignora `[Não lançado]`. */
function versoesNumeradas(texto: string): string[] {
  return [...texto.matchAll(/^## \[(\d+\.\d+\.\d+)\]/gm)].map((m) => m[1] as string);
}

function coletar(de: string, ate: string, changelogDe: string): EvidenciaDaRelease {
  const arquivosNovos = git("diff", "--name-only", "--diff-filter=A", `${de}..${ate}`)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Porta nova = linha com `href:` ACRESCENTADA ao registry. Modificação de
  // rótulo não é capacidade nova, e `-U0` evita contar contexto.
  const portasNovas = git("diff", "-U0", `${de}..${ate}`, "--", "lib/navigation/registry.ts")
    .split("\n")
    .filter((l) => l.startsWith("+") && l.includes("href:")).length;

  return { arquivosNovos, portasNovas, secaoDoChangelog: changelogDe };
}

function main(): void {
  const [deArg, ateArg] = process.argv.slice(2);
  const tags = tagsDeRelease();
  const de = deArg ?? tags[tags.length - 1];
  const ate = ateArg ?? "HEAD";

  if (!de) {
    console.error("Não achei nenhuma tag de release (v1.2.3). Rode `git fetch --tags`.");
    process.exit(2);
  }

  const changelog = ateArg
    ? git("show", `${ate}:CHANGELOG.md`)
    : readFileSync("CHANGELOG.md", "utf8");

  // ── QUAL SEÇÃO DESCREVE ESTE INTERVALO ─────────────────────────────────────
  //
  // Três estados, e o do meio é o que interessa:
  //
  //  1. conferindo release passada (`ateArg`) → a seção daquela tag;
  //  2. CORTE JÁ ESCRITO: existe seção numerada acima da última tag e o
  //     `[Não lançado]` está vazio, porque o conteúdo migrou para ela. É o
  //     estado de um PR que já declarou o número — e é aqui que a conferência
  //     vale, porque o número ainda dá para mudar;
  //  3. em desenvolvimento → o `[Não lançado]`.
  //
  // Sem o estado 2 a ferramenta lia um `[Não lançado]` VAZIO e devolvia PATCH
  // com ar de veredito. É o pior desfecho possível: o número errado sai com a
  // bênção do instrumento, que é pior do que não ter instrumento.
  const jaLancadas = new Set(tags.map((t) => t.replace(/^v/, "")));
  const declarada = ateArg
    ? null
    : (versoesNumeradas(changelog).find((v) => !jaLancadas.has(v)) ?? null);

  const secao =
    (ateArg ? secaoDoChangelog(changelog, ate) : null) ??
    (declarada ? secaoDoChangelog(changelog, declarada) : null) ??
    secaoDoChangelog(changelog, "Não lançado") ??
    "";

  const veredito = nivelExigido(coletar(de, ate, secao));
  const alvo = proximaVersao(de, veredito.nivel);

  console.log(`\nintervalo   ${de} → ${ate}`);
  console.log(`nível       ${veredito.nivel.toUpperCase()}`);
  console.log(`versão      ${ateArg ? `${alvo}  (entregue: ${ate.replace(/^v/, "")})` : alvo}`);
  console.log(`\npor quê:`);
  for (const p of veredito.porques) console.log(`  · ${p}`);

  if (veredito.discordancias.length) {
    console.log(`\n⚠ a prosa e o código discordam:`);
    for (const d of veredito.discordancias) console.log(`  · ${d}`);
  }

  // A pendência BLOQUEIA o corte novo e apenas INFORMA numa conferência
  // histórica. O marcador não existia quando as 8 releases saíram, e reprovar o
  // passado por uma regra de hoje é catraca que nasce vermelha: ela some no
  // ruído e ninguém mais olha. Medido: das 8, seis têm bloco de atenção e
  // nenhuma tem o marcador — sem esta separação o instrumento reprovaria 7 de
  // 8 e esconderia a ÚNICA divergência de número que interessa.
  if (veredito.pendencias.length) {
    const historico = Boolean(ateArg);
    console.log(historico ? `\nnota (o marcador não existia nesta época):` : `\n✖ falta responder antes de cortar:`);
    for (const p of veredito.pendencias) console.log(`  · ${p}`);
    if (!historico) process.exit(1);
  }

  // Divergência entre o entregue e o exigido só é ERRO quando se confere um
  // intervalo já lançado — aí o número está no passado e o dado é histórico.
  if (ateArg && alvo !== ate.replace(/^v/, "")) {
    console.log(`\n✖ a ${ate} saiu como ${ate.replace(/^v/, "")} e o conteúdo pedia ${alvo}.`);
    process.exit(1);
  }
  if (!ateArg && declarada && declarada !== alvo) {
    console.log(`\n✖ o CHANGELOG declara ${declarada} e o conteúdo pede ${alvo}.`);
    process.exit(1);
  }
  if (!ateArg && declarada) {
    console.log(`\n✓ o CHANGELOG declara ${declarada}, que é o que o conteúdo pede.`);
  }
  console.log("");
}

main();
