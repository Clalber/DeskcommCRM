import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { prefixoDoArquivo } from "@/components/auth/RecoveryCodesPanel";
import { DEFAULT_APP_NAME, resolveBranding } from "@/lib/branding";

const RAIZ = process.cwd();

describe("resolveBranding", () => {
  it("cai no padrão quando não há marca configurada", () => {
    expect(resolveBranding(undefined, undefined)).toEqual({
      name: DEFAULT_APP_NAME,
      logoUrl: null,
      initial: "D",
    });
  });

  it("trata string vazia e só-espaços como ausência de marca", () => {
    // `install.sh` grava a chave declarada mesmo quando o operador não responde
    // (APP_NAME=), então "vazio" chega como string — não como undefined. Tratar
    // isso como marca válida deixaria a interface sem nome nenhum.
    expect(resolveBranding("", "").name).toBe(DEFAULT_APP_NAME);
    expect(resolveBranding("   ", "   ").name).toBe(DEFAULT_APP_NAME);
    expect(resolveBranding("   ", "   ").logoUrl).toBeNull();
  });

  it("usa a marca configurada e deriva a inicial", () => {
    const b = resolveBranding("  Vendas Turbo  ", "  https://cdn.exemplo.com/logo.svg  ");
    expect(b.name).toBe("Vendas Turbo");
    expect(b.logoUrl).toBe("https://cdn.exemplo.com/logo.svg");
    expect(b.initial).toBe("V");
  });

  it("mantém o nome mas dispensa o logo quando só o nome é configurado", () => {
    const b = resolveBranding("Acme CRM", undefined);
    expect(b.name).toBe("Acme CRM");
    expect(b.logoUrl).toBeNull();
  });

  it("não parte code point ao derivar a inicial", () => {
    // `[0]` cru devolveria metade do par substituto e renderizaria caractere
    // inválido na sidebar recolhida.
    expect(resolveBranding("🚀 Foguete", null).initial).toBe("🚀");
    expect(resolveBranding("Ótimo CRM", null).initial).toBe("Ó");
  });
});

describe("guarda de white-label (self-host)", () => {
  const branding = fs.readFileSync(path.join(RAIZ, "lib/branding.ts"), "utf8");
  const publicEnvScript = fs.readFileSync(
    path.join(RAIZ, "app/public-env-script.tsx"),
    "utf8",
  );

  it("não usa prefixo NEXT_PUBLIC_ para a marca", () => {
    // POR QUE ESTE TESTE EXISTE: a convenção do Next empurra qualquer valor lido
    // no browser para NEXT_PUBLIC_*, e alguém vai "corrigir" isso um dia. Mas
    // NEXT_PUBLIC_* é queimada no bundle durante o `next build`, e o self-hoster
    // roda uma imagem PRÉ-BUILDADA: a marca dele nunca apareceria. O defeito
    // passaria em typecheck, lint e em toda a suíte, funcionaria em dev e na
    // Vercel, e falharia apenas na VPS de quem a feature existe para servir.
    expect(branding).not.toMatch(/NEXT_PUBLIC_APP_(NAME|LOGO_URL)/);
    expect(publicEnvScript).not.toMatch(/NEXT_PUBLIC_APP_(NAME|LOGO_URL)/);
  });

  it("injeta a marca em runtime pelo PublicEnvScript", () => {
    // Sem estas duas chaves no payload, os client components (Sidebar,
    // AdminSidebar) caem no padrão e só a marca do servidor muda — a instalação
    // ficaria com o nome do revendedor no título da aba e o nosso na sidebar.
    expect(publicEnvScript).toMatch(/APP_NAME:\s*env\.APP_NAME/);
    expect(publicEnvScript).toMatch(/APP_LOGO_URL:\s*env\.APP_LOGO_URL/);
  });

});

describe("nome do arquivo de códigos de recuperação", () => {
  // Este arquivo fica anos na pasta de downloads do usuário: é o artefato de
  // marca mais duradouro que o produto entrega, e nenhuma atualização conserta
  // o que já foi baixado. Por isso o prefixo sai da marca da instalação.

  it("deriva o prefixo da marca, sem acento e sem espaço", () => {
    expect(prefixoDoArquivo("Vendas Turbo")).toBe("vendas-turbo");
    expect(prefixoDoArquivo("Ótima Gestão")).toBe("otima-gestao");
    expect(prefixoDoArquivo(DEFAULT_APP_NAME)).toBe("deskcommcrm");
  });

  it("não devolve hífen pendurado nem repetido", () => {
    // `-recovery-codes.txt` vem logo depois: sobra de hífen viraria "acme--…".
    expect(prefixoDoArquivo("  Acme // CRM!  ")).toBe("acme-crm");
  });

  it("cai em 'crm' quando a marca não tem caractere aproveitável", () => {
    // Sem isto o `download` sairia vazio e o browser inventaria "download.txt" —
    // o usuário perderia de vista o arquivo com os códigos de recuperação dele.
    expect(prefixoDoArquivo("🚀")).toBe("crm");
    expect(prefixoDoArquivo("")).toBe("crm");
  });
});

/**
 * A catraca da marca — congela o que já vaza, reprova o que vazar de novo.
 *
 * A versão anterior deste gate ficava VERDE enquanto a marca vazava, por dois
 * furos independentes, e os dois só apareceram quando alguém foi olhar:
 *
 *  1. o padrão era `/Deskcomm/` — **case-sensitive**. Passavam
 *     `support@deskcomm.com.br` (tela de conta suspensa), `suporte@deskcomm.app`
 *     (tela de cobrança) e `deskcommcrm-recovery-codes.txt` (o arquivo que o
 *     usuário baixa e guarda por anos). Endereço e nome de arquivo são
 *     minúsculos por natureza — ou seja, o gate era cego justamente na forma em
 *     que a marca de fato aparece;
 *  2. a varredura cobria só `app/` e `components/`, e só `.tsx`. Ficavam fora
 *     `lib/` inteiro (e-mail de convite, rodapé do PDF de LGPD, remetente) e
 *     todo arquivo `.ts` — inclusive `app/actions/auth/enrollMfa.ts`, que está
 *     DENTRO de `app/` e escapava pela extensão. Esse é o pior deles: o nome vai
 *     para o app autenticador e fica no celular do usuário para sempre.
 *
 * MECANISMO. A varredura é `/deskcomm/i` sobre `.ts` e `.tsx` de `app/`,
 * `components/`, `lib/` e `workers/`. Cada arquivo com ocorrência precisa de uma
 * entrada em `MARCA_CONGELADA` com categoria, motivo escrito e o conjunto EXATO
 * de marcas encontradas. Arquivo novo reprova; marca nova em arquivo já
 * congelado reprova; marca que sumiu também reprova, e a correção é apagar a
 * linha da lista — é assim que ela só encolhe.
 *
 * MARCA ≠ PROTOCOLO — a distinção que precisa estar escrita, não subentendida.
 * Boa parte das ocorrências abaixo NÃO é marca: é identificador técnico.
 * `X-Deskcomm-Signature` é contrato de fio com receptores de terceiros, o cookie
 * `sb-deskcomm-auth` é a sessão de quem já está logado. Quem "completar o
 * whitelabel" renomeando isso derruba integração de cliente em produção — em
 * silêncio, porque o receptor não erra: ele apenas deixa de reconhecer. Por isso
 * a categoria é campo obrigatório: sem ela, a lista viraria uma pilha de
 * pendências indistinguíveis e alguém trataria contrato como pendência.
 */

type CategoriaDeMarca =
  /** Contrato de fio: alguém FORA deste processo casa a string por igualdade
   *  (header de webhook, nome do servidor MCP, user-agent). Nunca renomear. */
  | "PROTOCOLO"
  /** Chave de cookie, de storage do browser ou de contêiner. Não sai para
   *  terceiro, mas renomear desloga a base instalada ou perde estado local. */
  | "INFRA"
  /** Vazamento real de marca, visível ao usuário final. Declara a fase que o
   *  resolve — pendência sem prazo é pendência esquecida. */
  | "DIVIDA"
  /** Só desenvolvimento: fixture de teste. Não embarca na imagem. */
  | "DEV"
  /** A definição do nome padrão do produto. Tem de existir em UM lugar. */
  | "PADRAO";

type EntradaDeMarca = {
  categoria: CategoriaDeMarca;
  /** Por que esta ocorrência pode ficar. Quem adiciona linha aqui escreve isto. */
  motivo: string;
  /** Fase que remove a ocorrência. Obrigatório — e só faz sentido — em `DIVIDA`. */
  fase?: number;
  /** Conjunto EXATO de marcas do arquivo, como `marcasNoTexto` as normaliza. */
  marcas: string[];
};

const MARCA_CONGELADA: Record<string, EntradaDeMarca> = {
  // ─── PROTOCOLO — contrato de fio. Renomear quebra integração alheia. ───
  "app/api/v1/webhooks/in/[token]/route.ts": {
    categoria: "PROTOCOLO",
    motivo:
      "header que o webhook de ENTRADA exige de quem envia. Renomear invalida a assinatura de todo integrador já configurado, e o sintoma para ele é 401 sem explicação",
    marcas: ["x-deskcomm-signature"],
  },
  "lib/automation/actions/call-webhook.ts": {
    categoria: "PROTOCOLO",
    motivo:
      "headers do webhook de SAÍDA. O receptor do cliente lê o nome exato para rotear e para conferir o HMAC; renomear faz o payload chegar e ser descartado calado",
    marcas: ["x-deskcomm-event", "x-deskcomm-signature"],
  },
  "lib/automation/actions/call-webhook.test.ts": {
    categoria: "PROTOCOLO",
    motivo:
      "é a guarda do contrato acima: este teste é o que reprova quem renomear o header. Trocar a string aqui para 'limpar a marca' desarmaria a única proteção que o contrato tem",
    marcas: ["x-deskcomm-event", "x-deskcomm-signature", "x-deskcomm-signature"],
  },
  "lib/mcp/server.ts": {
    categoria: "PROTOCOLO",
    motivo:
      "nome do servidor MCP, que o cliente (Claude Desktop e afins) grava na própria configuração. Renomear derruba as conexões já configuradas de quem usa",
    marcas: ["deskcomm-crm"],
  },
  "lib/supabase/admin.ts": {
    categoria: "PROTOCOLO",
    motivo:
      "`X-Client-Info` enviado ao Supabase — identifica o cliente nos logs e na telemetria DELES. Não é texto de interface e nunca chega ao usuário",
    marcas: ["deskcomm-crm"],
  },
  "lib/nuvemshop/config.ts": {
    categoria: "PROTOCOLO",
    motivo:
      "User-Agent exigido pela Nuvemshop, que identifica a aplicação registrada na plataforma deles. Trocar pelo nome do revendedor descreveria uma aplicação que não existe lá",
    marcas: ["deskcommcrm"],
  },

  // ─── INFRA — cookie/storage/contêiner. Renomear desloga ou perde estado. ───
  "app/layout.tsx": {
    categoria: "INFRA",
    motivo:
      "chave de localStorage do tema, lida no script anti-flash. Renomear faz todo mundo voltar ao tema claro no próximo acesso — e o par com lib/theme.tsx tem de mudar junto",
    marcas: ["deskcomm-theme"],
  },
  "lib/theme.tsx": {
    categoria: "INFRA",
    motivo: "a mesma chave de localStorage do script do layout; as duas são um par só",
    marcas: ["deskcomm-theme"],
  },
  "lib/supabase/browser.ts": {
    categoria: "INFRA",
    motivo:
      "nome do cookie de sessão. Renomear invalida a sessão de todo usuário logado no momento da atualização — o `update.sh` do clone viraria um logout em massa",
    marcas: ["sb-deskcomm-auth"],
  },
  "lib/supabase/server.ts": {
    categoria: "INFRA",
    motivo: "o mesmo cookie de sessão, lido no servidor; tem de casar com o do browser",
    marcas: ["sb-deskcomm-auth"],
  },
  "lib/impersonate/cookie.ts": {
    categoria: "INFRA",
    motivo:
      "nome do cookie de impersonação. Renomear deixa órfã a sessão de suporte já aberta, e o operador fica preso na conta do tenant sem o cookie que o traz de volta",
    marcas: ["deskcomm-impersonate"],
  },
  "lib/impersonate/cookie-edge.ts": {
    categoria: "INFRA",
    motivo: "o mesmo cookie de impersonação, na cópia que o middleware edge consegue importar",
    marcas: ["deskcomm-impersonate"],
  },

  // ─── DIVIDA — vazamento real. Cada linha declara a fase que a apaga. ───
  "app/account-suspended/page.tsx": {
    categoria: "DIVIDA",
    fase: 4,
    motivo:
      "endereço de suporte NOSSO na tela que o cliente do revendedor vê ao ser suspenso — e quem suspendeu foi o revendedor, não nós. `branding()` não resolve: endereço de e-mail não se deriva de um nome, e não existe SUPPORT_EMAIL em lib/env.ts (medido). Precisa da chave nova + coleta no install.sh, que é escopo da Fase 4",
    marcas: ["support@deskcomm.com.br", "support@deskcomm.com.br"],
  },
  "app/app/settings/billing/page.tsx": {
    categoria: "DIVIDA",
    fase: 4,
    motivo:
      "a tela de dinheiro entrega nosso contato ao cliente do revendedor, e ela tem porta de 1ª classe no menu. Mesmo bloqueio do endereço acima; a tela inteira vira 'Suporte' em fase posterior, então reescrever a cópia agora seria trabalho jogado fora",
    marcas: ["suporte@deskcomm.app", "suporte@deskcomm.app"],
  },
  "app/actions/auth/enrollMfa.ts": {
    categoria: "DIVIDA",
    fase: 4,
    motivo:
      "o `friendlyName` do TOTP vai para o app autenticador e fica no celular do usuário PARA SEMPRE — nenhuma atualização nossa reescreve o que já está lá. É o vazamento mais duradouro do produto, e depende da marca resolvida do banco, que só existe a partir da Fase 2",
    marcas: ["deskcommcrm"],
  },
  "lib/lgpd/pdf-renderer.tsx": {
    categoria: "DIVIDA",
    fase: 4,
    motivo:
      "rodapé do relatório entregue ao TITULAR DE DADOS, um documento com peso legal. Trocar pelo nome da marca sem decidir antes quem é o controlador escreveria a entidade errada num documento jurídico — por isso espera a Fase 4",
    marcas: ["deskcommcrm"],
  },
  "lib/lgpd/email-delivery.ts": {
    categoria: "DIVIDA",
    fase: 4,
    motivo:
      "fallback do nome da organização no e-mail de LGPD. Trocar pela constante não adiantaria: continua sendo o nome do produto; precisa da marca resolvida do banco",
    marcas: ["deskcommcrm"],
  },
  "lib/lgpd/sla-alarm.ts": {
    categoria: "DIVIDA",
    fase: 4,
    motivo: "mesmo fallback do e-mail de LGPD, no alarme de SLA; sai junto na Fase 4",
    marcas: ["deskcommcrm"],
  },
  "lib/email/templates/invite.ts": {
    categoria: "DIVIDA",
    fase: 4,
    motivo:
      "assunto e corpo do convite — o PRIMEIRO artefato que um usuário novo recebe do sistema, e ele chega com o nome do nosso produto em vez do da instalação que o convidou",
    marcas: ["deskcomm", "deskcommcrm"],
  },
  "lib/email/templates/ai-budget-alarm.tsx": {
    categoria: "DIVIDA",
    fase: 4,
    motivo: "assunto do alarme de orçamento de IA, enviado ao admin do tenant",
    marcas: ["deskcommcrm"],
  },
  "lib/email/resend.ts": {
    categoria: "DIVIDA",
    fase: 4,
    motivo:
      "remetente padrão. O domínio depende de verificação no Resend, então não é só texto: a Fase 4 tem de decidir o fallback de quem não verificou domínio próprio antes de mexer aqui",
    marcas: ["deskcomm", "noreply@deskcomm.app"],
  },

  // ─── DEV — fixture de teste; não embarca. ───
  "lib/agent-engine/agent/draft-reply.test.ts": {
    categoria: "DEV",
    motivo: "nome de agente numa fixture de teste ('Bot Deskcomm'); não sai da suíte",
    marcas: ["deskcomm"],
  },
  "lib/system/changelog.test.ts": {
    categoria: "DEV",
    motivo:
      "fixture que reproduz o CHANGELOG real, incluindo as URLs do repositório no GitHub. A marca aqui é o nome do repositório upstream, que o clone não renomeia",
    marcas: ["deskcommcrm", "deskcommcrm", "deskcommcrm"],
  },

  // ─── PADRAO — a marca padrão precisa existir em algum lugar. ───
  "lib/branding.ts": {
    categoria: "PADRAO",
    motivo:
      "é a DEFINIÇÃO de DEFAULT_APP_NAME — o valor que aparece quando o operador não configurou marca nenhuma. Se esta linha sumir, some o padrão",
    marcas: ["deskcommcrm"],
  },
};

/** Raízes varridas. `app/design/` fica de fora: é o showcase interno do design
 *  system, a única tela em que o nome do produto é o assunto da página. */
const RAIZES_VARRIDAS = ["app", "components", "lib", "workers"] as const;

/**
 * Extrai as marcas de um texto, uma por ocorrência.
 *
 * Casa `deskcomm` em qualquer caixa e leva junto o identificador inteiro em volta
 * (`x-deskcomm-signature`, `support@deskcomm.com.br`), porque é o identificador —
 * não a palavra solta — que distingue contrato de fio de vazamento de marca.
 *
 * Linha que ABRE com `//`, `*` ou `/*` é comentário e não conta: comentário não
 * chega ao usuário, e contá-lo encheria a lista de entradas inertes até ninguém
 * mais ler as que importam. O teste olha só o início da linha DE PROPÓSITO —
 * procurar `//` em qualquer posição descartaria `"https://deskcomm.app"`, que é
 * exatamente um vazamento de verdade.
 */
function marcasNoTexto(fonte: string): string[] {
  const achadas: string[] = [];
  for (const linha of fonte.split("\n")) {
    const inicio = linha.trimStart();
    if (inicio.startsWith("//") || inicio.startsWith("*") || inicio.startsWith("/*")) continue;
    for (const casada of linha.matchAll(/[\w@.-]*deskcomm[\w@.-]*/gi)) {
      // Pontuação encostada (o ponto final de "no DeskcommCRM.") não faz parte
      // do identificador e faria a lista mudar por causa de uma vírgula.
      achadas.push(casada[0].toLowerCase().replace(/^[.-]+/, "").replace(/[.-]+$/, ""));
    }
  }
  return achadas.sort();
}

function arquivosVarridos(dir: string): string[] {
  const alvos: string[] = [];
  for (const entrada of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, entrada.name);
    if (rel.startsWith("app/design")) continue;
    if (entrada.isDirectory()) alvos.push(...arquivosVarridos(rel));
    else if (rel.endsWith(".ts") || rel.endsWith(".tsx")) alvos.push(rel);
  }
  return alvos;
}

describe("catraca de marca hardcoded", () => {
  const porRaiz = new Map(RAIZES_VARRIDAS.map((r) => [r, arquivosVarridos(r)]));
  const alvos = [...porRaiz.values()].flat();
  const encontrado = new Map<string, string[]>();
  for (const arquivo of alvos) {
    const marcas = marcasNoTexto(fs.readFileSync(path.join(RAIZ, arquivo), "utf8"));
    if (marcas.length > 0) encontrado.set(arquivo, marcas);
  }

  it("a varredura alcança as quatro raízes — senão o resto não prova nada", () => {
    // Guarda de vacuidade com nome. `workers/` hoje não tem NENHUMA ocorrência
    // fora de comentário: sem esta asserção, uma varredura que nem descesse lá
    // devolveria a mesma lista vazia e passaria como se estivesse vigiando.
    for (const [raiz, arquivos] of porRaiz) {
      expect(arquivos.length, `${raiz}/ não devolveu arquivo nenhum`).toBeGreaterThan(0);
    }
    expect(alvos.length).toBeGreaterThan(500);
    expect(alvos.filter((f) => f.endsWith(".ts")).length).toBeGreaterThan(100);
    expect(alvos.filter((f) => f.endsWith(".tsx")).length).toBeGreaterThan(100);
  });

  it("pega a marca em qualquer caixa e dentro de identificador", () => {
    // O furo nº 1 do gate antigo, agora com asserção: `/Deskcomm/` deixava passar
    // as três formas de baixo, que são as formas em que a marca de fato aparece.
    expect(marcasNoTexto(`a.download = "deskcommcrm-recovery-codes.txt";`)).toEqual([
      "deskcommcrm-recovery-codes.txt",
    ]);
    expect(marcasNoTexto(`href="mailto:suporte@deskcomm.app"`)).toEqual(["suporte@deskcomm.app"]);
    expect(marcasNoTexto(`const k = "sb-DESKCOMM-auth";`)).toEqual(["sb-deskcomm-auth"]);
  });

  it("ignora comentário, mas não confunde `//` de URL com comentário", () => {
    // A regra de comentário é uma exceção, e exceção sem guarda vira buraco:
    // procurar `//` em qualquer posição da linha esconderia justamente a URL.
    expect(marcasNoTexto(`  // fala do DeskcommCRM`)).toEqual([]);
    expect(marcasNoTexto(` * fala do DeskcommCRM`)).toEqual([]);
    expect(marcasNoTexto(`const u = "https://deskcomm.app/x";`)).toEqual(["deskcomm.app"]);
    expect(marcasNoTexto(`fetch(url); // manda pro DeskcommCRM`)).toEqual(["deskcommcrm"]);
  });

  it("nenhum arquivo fora da lista fixa a marca", () => {
    const novos = [...encontrado.keys()].filter((f) => !(f in MARCA_CONGELADA));
    expect(
      novos,
      `Marca hardcoded em arquivo que não está congelado.\n` +
        `Use branding() de lib/branding.ts — ou, se for identificador técnico\n` +
        `(header, cookie, storage), declare em MARCA_CONGELADA com categoria e motivo:\n` +
        novos.map((f) => `  ${f}  ${JSON.stringify(encontrado.get(f))}`).join("\n"),
    ).toEqual([]);
  });

  it("arquivo congelado não ganhou nem perdeu marca sem a lista acompanhar", () => {
    const divergentes: string[] = [];
    for (const [arquivo, entrada] of Object.entries(MARCA_CONGELADA)) {
      const atual = encontrado.get(arquivo) ?? [];
      const congelado = [...entrada.marcas].sort();
      if (JSON.stringify(atual) !== JSON.stringify(congelado)) {
        divergentes.push(`  ${arquivo}\n    lista: ${JSON.stringify(congelado)}\n    disco: ${JSON.stringify(atual)}`);
      }
    }
    expect(
      divergentes,
      `O conjunto de marcas mudou num arquivo congelado.\n` +
        `Ganhou marca: é ocorrência NOVA — tire do código.\n` +
        `Perdeu marca: a dívida encolheu — atualize (ou apague) a linha da lista.\n` +
        divergentes.join("\n"),
    ).toEqual([]);
  });

  it("a lista não guarda arquivo que já não tem marca nenhuma", () => {
    // É o que força a lista a ENCOLHER: quem limpar um arquivo é obrigado a
    // apagar a linha, em vez de deixar a pendência morta ocupando espaço.
    const obsoletos = Object.keys(MARCA_CONGELADA).filter((f) => !encontrado.has(f));
    expect(
      obsoletos,
      `Estes arquivos não têm mais marca — apague a linha de MARCA_CONGELADA:\n` +
        obsoletos.map((f) => `  ${f}`).join("\n"),
    ).toEqual([]);
  });

  it("toda entrada declara categoria e explica o porquê", () => {
    const validas: CategoriaDeMarca[] = ["PROTOCOLO", "INFRA", "DIVIDA", "DEV", "PADRAO"];
    const ruins = Object.entries(MARCA_CONGELADA)
      .filter(([, e]) => !validas.includes(e.categoria) || e.motivo.trim().length < 40)
      .map(([f]) => f);
    expect(ruins, `entrada sem categoria válida ou sem justificativa escrita:\n  ${ruins.join("\n  ")}`).toEqual([]);
  });

  it("toda DIVIDA nomeia a fase que a resolve, e só DIVIDA tem fase", () => {
    // Pendência sem prazo é pendência esquecida — e categoria que não é dívida
    // com "fase" declarada seria alguém tratando contrato de fio como pendência.
    const semFase = Object.entries(MARCA_CONGELADA)
      .filter(([, e]) => (e.categoria === "DIVIDA") !== (typeof e.fase === "number"))
      .map(([f]) => f);
    expect(semFase, `DIVIDA sem fase, ou fase declarada onde não é dívida:\n  ${semFase.join("\n  ")}`).toEqual([]);
  });
});
