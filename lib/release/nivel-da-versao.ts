/**
 * QUE NÚMERO ESTA RELEASE PRECISA TER — decidido por regra, não por olho.
 *
 * ## O buraco que isto fecha
 *
 * O número da versão era escolhido à mão, toda vez, sem nenhuma verificação.
 * Medido em 2026-08-26 no SHA 1037d7e9: os cinco checks obrigatórios
 * (`verify`, `invariants`, `build-and-size`, `e2e`, `imagens-ok`) não leem o
 * CHANGELOG nem a tag; `grep -ciE "major|minor|patch" CONTRIBUTING.md` devolve
 * `0`; e `docs/doctrine/packaging.md` — que governa tudo o mais sobre
 * distribuição — nunca disse COMO escolher entre os três.
 *
 * O resultado não foi teórico. Em 8 releases:
 *
 *   - **v1.4.1 saiu como PATCH** e o CHANGELOG dela abre `### Adicionado`, com
 *     três formas novas de conectar o WhatsApp no onboarding. Capacidade nova
 *     viajando sob um número que promete "só consertos".
 *   - **v1.3.0 saiu como MINOR** (o número CERTO) e o CHANGELOG dela não tem
 *     `### Adicionado` nenhum — enquanto o diff traz 6 rotas de API novas e uma
 *     aba inteira, `<TabsTrigger value="parceiro">Provedor parceiro`. Quem lesse
 *     as notas não ficava sabendo do recurso que acabara de instalar.
 *
 * Os dois defeitos são a MESMA falha vista de dois lados: ninguém confere o
 * número contra o conteúdo, e ninguém confere a prosa contra o código.
 *
 * ## Por que a regra é composta, e não estrutural
 *
 * A primeira versão desta regra olhava só a ESTRUTURA — rota nova, tela nova,
 * porta nova na navegação. Medida contra as 8 releases, ela acertou 7 e errou a
 * v1.6.0: a ingestão de formulários do Respondi é capacidade nova que entrou em
 * `lib/webhooks/respondi.ts`, alcançável por uma rota que já existia. Estrutura
 * não vê capacidade acrescentada a arquivo existente — e era exatamente esse o
 * caso da v1.4.1, o defeito que se quer pegar.
 *
 * A segunda fonte, `### Adicionado` no CHANGELOG, vê o que a estrutura não vê.
 * Sozinha ela seria fraca: quem escreve a seção é quem escolhe o número, então
 * a catraca se satisfaria pelo próprio autor. Juntas, as duas se cobrem — e a
 * DISCORDÂNCIA entre elas é informação, não ruído (é o caso da v1.3.0).
 *
 * Calibração, contra as 8 releases reais (o comando está no teste):
 *
 * ```
 * intervalo          estrutura  Adicionado   piso    entregue   veredito
 * v1.0.0→v1.1.0        sim        sim        minor   minor      ok
 * v1.1.0→v1.2.0        sim        sim        minor   minor      ok
 * v1.2.0→v1.2.1        não        não        patch   patch      ok
 * v1.2.1→v1.3.0        sim        não        minor   minor      ok  (+discordância)
 * v1.3.0→v1.4.0        sim        sim        minor   minor      ok
 * v1.4.0→v1.4.1        não        sim        minor   PATCH      PEGA O DEFEITO
 * v1.4.1→v1.5.0        sim        sim        minor   minor      ok
 * v1.5.0→v1.6.0        não        sim        minor   minor      ok
 * ```
 *
 * 7 concordâncias e 1 divergência, e a divergência é o defeito medido. Uma regra
 * que reprovasse as 7 corretas seria uma catraca que nasce vermelha; uma que não
 * reprovasse a v1.4.1 não seria instrumento nenhum.
 *
 * ## O MAJOR não se detecta, se DECLARA — e por quê
 *
 * A tentação é derivar MAJOR do SQL. Foi medido e não funciona: `drop policy`
 * aparece **24 vezes** nas 2 migrations da v1.2.1, porque todo refactor de RLS
 * derruba e recria a policy. Um detector por assinatura reprovaria quase toda
 * release — catraca que nasce vermelha, e que por isso ninguém respeita.
 *
 * O que separa MAJOR do resto neste produto não é a forma do SQL: é se o
 * operador da VPS precisa FAZER alguma coisa. E isso o projeto já escreve — no
 * bloco `### ⚠️ Requer atenção`. Duas releases provam que a pergunta nunca foi
 * feita:
 *
 *   - **v1.2.1 (PATCH)**: a migration 0150 faz `drop policy
 *     channel_sessions_tenant_isolation_all` e recria exigindo
 *     `fn_role_at_least(organization_id, 'admin')` — e o aviso manda "promova a
 *     pessoa a administrador ANTES de atualizar".
 *   - **v1.4.0 (MINOR)**: a migration 0165 faz `set meta_phone_number_id =
 *     … || '-conflito-' || s.id::text` em linha já gravada, e o aviso manda
 *     reconectar o número pela tela.
 *
 * Então o marcador `exige-acao-do-operador` é obrigatório em todo bloco de
 * atenção NOVO. Ele não adivinha: ele obriga a resposta no momento em que o
 * aviso é escrito, que é o único momento em que quem escreve sabe a resposta.
 * Seções já lançadas ficam de fora — reescrever release publicada é o defeito
 * que a doutrina de CHANGELOG já proíbe.
 */

export type Nivel = "major" | "minor" | "patch";

/** Ordem de severidade: usada para tirar o PISO entre dois vereditos. */
const PESO: Record<Nivel, number> = { patch: 0, minor: 1, major: 2 };

export function maisAlto(a: Nivel, b: Nivel): Nivel {
  return PESO[a] >= PESO[b] ? a : b;
}

export interface EvidenciaDaRelease {
  /**
   * Caminhos ADICIONADOS no intervalo (`git diff --diff-filter=A --name-only`).
   * Só os adicionados: arquivo modificado não distingue capacidade de conserto.
   */
  arquivosNovos: string[];
  /** Linhas com `href:` acrescentadas a `lib/navigation/registry.ts`. */
  portasNovas: number;
  /** A seção do CHANGELOG da versão que se vai cortar, crua. */
  secaoDoChangelog: string;
}

export interface Veredito {
  nivel: Nivel;
  /** Por que este nível, em linguagem que cabe numa mensagem de erro. */
  porques: string[];
  /**
   * Onde a prosa e o código discordam. NÃO muda o nível — é o achado da v1.3.0:
   * o número estava certo e as notas escondiam um recurso inteiro.
   */
  discordancias: string[];
  /** Perguntas que o autor precisa responder para o veredito ser confiável. */
  pendencias: string[];
}

const ROTA_NOVA = /^app\/api\/.*\/route\.ts$/;
const TELA_NOVA = /^app\/.*\/page\.tsx$/;

/** `### ⚠️ Requer atenção`, com ou sem emoji, heading ou negrito. */
const BLOCO_DE_ATENCAO = /^(#{2,4}\s+|\*{1,2})?⚠️?\s*Requer atenção/im;
/** `<!-- exige-acao-do-operador: sim -->` */
const MARCADOR_DE_ACAO = /<!--\s*exige-acao-do-operador:\s*(sim|nao|não)\s*-->/i;
const SECAO_ADICIONADO = /^###\s+Adicionado\s*$/im;

export function nivelExigido(e: EvidenciaDaRelease): Veredito {
  const porques: string[] = [];
  const discordancias: string[] = [];
  const pendencias: string[] = [];

  const rotas = e.arquivosNovos.filter((f) => ROTA_NOVA.test(f));
  const telas = e.arquivosNovos.filter((f) => TELA_NOVA.test(f));
  const temEstrutura = rotas.length > 0 || telas.length > 0 || e.portasNovas > 0;
  const declaraAdicionado = SECAO_ADICIONADO.test(e.secaoDoChangelog);

  let nivel: Nivel = "patch";

  if (temEstrutura) {
    nivel = maisAlto(nivel, "minor");
    const partes: string[] = [];
    if (rotas.length) partes.push(`${rotas.length} rota(s) de API nova(s) (${rotas.slice(0, 3).join(", ")})`);
    if (telas.length) partes.push(`${telas.length} tela(s) nova(s) (${telas.slice(0, 3).join(", ")})`);
    if (e.portasNovas) partes.push(`${e.portasNovas} porta(s) nova(s) na navegação`);
    porques.push(`capacidade nova no CÓDIGO: ${partes.join("; ")}`);
  }

  if (declaraAdicionado) {
    nivel = maisAlto(nivel, "minor");
    porques.push("o CHANGELOG desta versão abre `### Adicionado` — quem anuncia capacidade nova está acima de patch");
  }

  // A DISCORDÂNCIA é o achado da v1.3.0, e ela corre nos dois sentidos.
  if (temEstrutura && !declaraAdicionado) {
    discordancias.push(
      "o código entrega capacidade nova e as notas não a anunciam — quem atualizar " +
        "recebe um recurso sem ficar sabendo que ele existe (foi o caso da v1.3.0: " +
        "6 rotas novas e a aba 'Provedor parceiro', com um CHANGELOG só de correções)",
    );
  }
  if (declaraAdicionado && !temEstrutura) {
    // NÃO é defeito: capacidade cabe em arquivo existente (foi o caso da v1.6.0).
    porques.push(
      "a capacidade nova não abriu rota nem tela — entrou em arquivo que já existia, " +
        "que é legítimo e é por isso que a estrutura sozinha não decide",
    );
  }

  // ── O MAJOR, que se declara ────────────────────────────────────────────────
  const temAtencao = BLOCO_DE_ATENCAO.test(e.secaoDoChangelog);
  if (temAtencao) {
    const m = MARCADOR_DE_ACAO.exec(e.secaoDoChangelog);
    if (!m) {
      pendencias.push(
        "esta versão tem `### ⚠️ Requer atenção` e não diz se o operador precisa AGIR. " +
          "Acrescente `<!-- exige-acao-do-operador: sim -->` ou `<!-- exige-acao-do-operador: nao -->` " +
          "dentro do bloco. `sim` = a atualização não se aplica sozinha (editar arquivo, promover " +
          "usuário, reconectar canal, rodar o update duas vezes) e a release é MAJOR.",
      );
    } else if (/sim/i.test(m[1] ?? "")) {
      nivel = maisAlto(nivel, "major");
      porques.push(
        "o bloco de atenção declara `exige-acao-do-operador: sim` — a atualização não se aplica " +
          "sozinha, e um número que promete rotina esconde isso de quem vai aplicá-la",
      );
    }
  }

  if (porques.length === 0) {
    porques.push("nenhuma capacidade nova e nenhuma ação do operador — só conserta o que já devia funcionar");
  }

  return { nivel, porques, discordancias, pendencias };
}

/** `1.6.0` + minor → `1.7.0`. Aceita e devolve sem o `v`. */
export function proximaVersao(ultima: string, nivel: Nivel): string {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(ultima.trim());
  if (!m) throw new Error(`versão anterior ilegível: ${ultima}`);
  const [maior, menor, correcao] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (nivel === "major") return `${maior + 1}.0.0`;
  if (nivel === "minor") return `${maior}.${menor + 1}.0`;
  return `${maior}.${menor}.${correcao + 1}`;
}
