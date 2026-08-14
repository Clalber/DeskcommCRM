"use client";

/**
 * O campo do logo — subir, ver nas DUAS superfícies, e remover.
 *
 * ── Por que a prévia mostra o logo sobre CLARO e ESCURO ──────────────────────
 *
 * O modo de falha campeão de logo em produto com dois temas é o arquivo escuro
 * com fundo transparente: fica perfeito na tela onde a pessoa subiu e some no
 * outro tema, que ela nunca abre. Descobrir isso pelo relato de um cliente é
 * caro; descobrir na hora do upload é grátis.
 *
 * E a prévia é a imagem REAL, renderizada pelo navegador sobre as duas
 * superfícies do produto. Foi a alternativa escolhida contra um analisador de
 * luminância no servidor: aquele exigiria decodificar PNG (bytes controlados por
 * quem sobe, mais guarda de bomba de descompressão), seria cego para PNG
 * entrelaçado e para JPEG, e terminaria escrevendo em português o que estas duas
 * caixas mostram com precisão total e zero linha de parser.
 *
 * As duas cores vêm da RÉGUA DO PRODUTO (`--color-surface` de cada tema), nunca
 * digitadas: são as mesmas superfícies onde o logo de fato aparece — a barra
 * lateral e o cartão do login. Um par de hexes escritos aqui viraria a quinta
 * cópia de uma cor que o produto já declara em um lugar só.
 *
 * ── Por que o upload é IMEDIATO, e não parte do "Salvar" do formulário ───────
 *
 * O arquivo tem rota própria (`/api/v1/marca/logo`) porque o que atravessa é
 * multipart, não JSON, e porque o ponteiro é gravado por um escritor próprio no
 * banco — a função da marca substitui o objeto inteiro e apagaria o logo. Juntar
 * os dois no mesmo botão significaria segurar bytes em memória do navegador até
 * alguém clicar em Salvar, e perder o arquivo em toda navegação acidental.
 */

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { melhorFrenteSobre } from "@/lib/branding/contraste";
import { TAMANHO_MAXIMO_DO_LOGO } from "@/lib/branding/logo";
import { REGUA_DO_PRODUTO } from "@/lib/branding/regua-do-produto";

/** A superfície onde o logo de fato aparece, em cada tema. Lida, nunca digitada. */
function superficie(tema: "claro" | "escuro"): string {
  const encontrada = REGUA_DO_PRODUTO[tema].base.find((b) => b.chave === "--color-surface");
  // O `??` não é zelo abstrato: `base` é `readonly {...}[]`, então o compilador
  // não garante que a chave exista. Cair no fundo do tema é o degrade certo —
  // a prévia continua contrastando, só não é exatamente a superfície do produto.
  return encontrada?.hex ?? REGUA_DO_PRODUTO[tema].base[0]?.hex ?? "#ffffff";
}

const SUPERFICIE_CLARA = superficie("claro");
const SUPERFICIE_ESCURA = superficie("escuro");

export type EscopoDoLogo = "instalacao" | "organizacao";

interface Props {
  readonly escopo: EscopoDoLogo;
  /**
   * O logo que ESTA camada gravou, já como URL pública. `null` = esta camada não
   * tem logo próprio — e aí quem aparece é `logoHerdado`.
   */
  readonly logoDaCamada: string | null;
  /**
   * O que o produto mostra quando esta camada não tem nada. `null` = ninguém tem
   * logo, e a interface aparece com o NOME em texto.
   */
  readonly logoHerdado: string | null;
  /** Uma frase dizendo de quem é o logo herdado ("do sistema", "da instalação"). */
  readonly origemDoHerdado: string;
  /** O nome em vigor — vira o `alt` da prévia e o texto do caso sem logo. */
  readonly nomeEmVigor: string;
}

/** Mensagem por código de recusa da rota. */
const ERRO_EM_PORTUGUES: Record<string, string> = {
  unauthenticated: "Sua sessão expirou. Entre de novo para trocar o logo.",
  forbidden_role: "Você não tem permissão para trocar este logo.",
  forbidden_tenant: "Nenhuma empresa ativa nesta sessão.",
  mfa_required: "Confirme o segundo fator nesta sessão e tente de novo.",
  rate_limited: "Muitas trocas seguidas. Tente de novo em alguns minutos.",
};

export function CampoDeLogo({
  escopo,
  logoDaCamada,
  logoHerdado,
  origemDoHerdado,
  nomeEmVigor,
}: Props) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [, startTransition] = useTransition();

  const emVigor = logoDaCamada ?? logoHerdado;

  /**
   * A mensagem da rota, quando ela souber nomear a recusa.
   *
   * A rota devolve `{ error: { code, message } }` e a `message` dela já é escrita
   * para o operador — usá-la em vez de um dicionário local é o que faz a razão
   * exata ("SVG não é aceito porque…", "o logo precisa ter até 512 KB") chegar à
   * tela. O dicionário acima só cobre o que a rota responde em código de auth,
   * onde a mensagem certa depende de onde a pessoa está.
   */
  async function razaoDaFalha(resposta: Response): Promise<string> {
    const corpo = (await resposta.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;
    const codigo = corpo?.error?.code ?? "";
    return ERRO_EM_PORTUGUES[codigo] ?? corpo?.error?.message ?? "Não consegui trocar o logo agora.";
  }

  async function enviar(arquivo: File) {
    setEnviando(true);
    try {
      const corpo = new FormData();
      corpo.set("escopo", escopo);
      corpo.set("file", arquivo);
      const resposta = await fetch("/api/v1/marca/logo", { method: "POST", body: corpo });
      if (!resposta.ok) {
        toast.error(await razaoDaFalha(resposta));
        return;
      }
      toast.success("Logo atualizado.");
      // `router.refresh()` e não estado local: a prévia mostra a URL RESOLVIDA
      // pelo servidor, com a precedência entre camadas aplicada. Pintar a tela
      // com o que acabamos de mandar faria a prévia divergir do que o produto
      // mostra no render seguinte.
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
      // Sem isto, escolher o MESMO arquivo de novo (depois de uma falha) não
      // dispara `change` e a tela parece travada.
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function remover() {
    setEnviando(true);
    try {
      const resposta = await fetch(`/api/v1/marca/logo?escopo=${escopo}`, { method: "DELETE" });
      if (!resposta.ok) {
        toast.error(await razaoDaFalha(resposta));
        return;
      }
      toast.success("Logo removido.");
      startTransition(() => router.refresh());
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-4" data-campo-de-logo={escopo}>
      <div className="space-y-2">
        <Label htmlFor={`logo-${escopo}`}>Logo</Label>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={entrada}
            id={`logo-${escopo}`}
            type="file"
            // `image/png,image/jpeg` FILTRA o seletor de arquivos, não decide
            // nada: quem decide é o farejador de bytes do servidor. O atributo
            // existe para a pessoa não navegar até um arquivo que será recusado.
            accept="image/png,image/jpeg"
            disabled={enviando}
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void enviar(arquivo);
            }}
            className="max-w-xs text-sm file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-border file:bg-surface-elevated file:px-3 file:py-1.5 file:text-sm"
          />
          {logoDaCamada ? (
            <Button type="button" variant="outline" onClick={() => void remover()} disabled={enviando}>
              Remover
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-text-muted">
          PNG ou JPG, até {Math.round(TAMANHO_MAXIMO_DO_LOGO / 1024)} KB. Prefira fundo
          transparente. SVG não é aceito: ele pode executar código quando aberto direto pelo
          endereço da imagem.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-text-muted">
          {logoDaCamada
            ? "Como o logo aparece nas duas aparências do sistema:"
            : `Sem logo próprio, o sistema usa o logo ${origemDoHerdado}. Assim ele aparece:`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              { rotulo: "Aparência clara", fundo: SUPERFICIE_CLARA },
              { rotulo: "Aparência escura", fundo: SUPERFICIE_ESCURA },
            ] as const
          ).map(({ rotulo, fundo }) => (
            <div key={rotulo} className="space-y-1">
              <div
                data-previa-do-logo={rotulo === "Aparência clara" ? "claro" : "escuro"}
                className="flex h-24 items-center justify-center rounded-sm border border-border px-4"
                style={{ backgroundColor: fundo }}
              >
                {emVigor ? (
                  // <img> e não next/image pelo mesmo motivo da barra lateral e da
                  // tela de acesso: a URL é do projeto de quem hospeda, e
                  // `next/image` exige allowlist de domínios fechada em BUILD — a
                  // imagem pré-buildada do self-host recusaria o domínio do
                  // operador. Altura fixa e largura livre para não distorcer arte
                  // de proporção desconhecida.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={emVigor}
                    alt={nomeEmVigor}
                    className="max-h-12 w-auto max-w-full object-contain"
                  />
                ) : (
                  <span
                    className="text-sm font-semibold tracking-tight"
                    // O texto acompanha a SUPERFÍCIE, não o tema em que a pessoa
                    // está: um `text-*` do Tailwind sumiria no quadro oposto. E a
                    // cor sai de `melhorFrenteSobre` — a mesma função que decide
                    // a cor do texto sobre os botões da marca —, nunca de um hex
                    // digitado aqui.
                    style={{ color: melhorFrenteSobre(fundo) }}
                  >
                    {nomeEmVigor}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted">{rotulo}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
