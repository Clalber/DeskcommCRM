/**
 * Os DOIS endereços do Supabase, e por que eles não são o mesmo.
 *
 * ─── O PROBLEMA ────────────────────────────────────────────────────────────
 *
 * Numa instalação que publica o Supabase num domínio próprio, o servidor usa a
 * MESMA URL do navegador para falar com o banco. Isso faz cada consulta sair do
 * contêiner, atravessar a internet e voltar para a mesma máquina.
 *
 * Medido nesta VPS em 2026-09-04: **3,9 ms por dentro contra 67,6 ms pela
 * volta**. O custo não é só latência — quando o proxy da frente engasga, a
 * resposta que chega no lugar do JSON é uma **página HTML de erro** (`502: Bad
 * gateway`), e o cliente do Supabase não sabe ler HTML. Foram 10 ocorrências em
 * 24 h, e elas derrubaram o `followup`, o `recover-stuck-messages` e fizeram uma
 * regra de automação nascer duplicada (o 502 no meio da escrita, o cliente
 * repetindo o POST).
 *
 * ─── A ARMADILHA, E É ELA QUE JUSTIFICA ESTE ARQUIVO ───────────────────────
 *
 * Trocar a URL do cliente do servidor por uma interna quebraria a mídia. As URLs
 * assinadas do Storage nascem do endereço do cliente que as gerou: com o
 * endereço interno, `createSignedUrl` devolve algo como
 * `http://supabase-envoy:8000/storage/v1/object/sign/...` — e esse host **não
 * existe para o navegador**. A foto do WhatsApp vira link quebrado, e o teste
 * unitário não percebe, porque o link é gerado certo; ele só não é alcançável.
 *
 * A saída é trocar a ORIGEM de volta para a pública antes de entregar o link.
 * Isso é seguro porque **a assinatura cobre o caminho, não o host** — provado
 * contra a instalação real: uma URL assinada pelo endereço interno respondeu
 * HTTP 200 quando buscada pelo domínio público.
 *
 * ⚠️ Todo `createSignedUrl` do repositório passa por `urlPublicaDaAssinatura`.
 * Quem esquecer é reprovado por `tests/unit/url-assinada-sai-publica.test.ts` —
 * o teste existe porque este é exatamente o tipo de defeito que nasce mudo:
 * some só na tela do cliente, e nunca no CI.
 */

import { env } from "@/lib/env";

/**
 * O endereço que o SERVIDOR usa para falar com o Supabase.
 *
 * Cai na URL pública quando não há interna configurada — que é o estado de toda
 * instalação existente, e de todo `pnpm dev` local.
 */
export function urlDoSupabaseNoServidor(): string {
  return env.SUPABASE_INTERNAL_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
}

/**
 * Troca a origem interna pela pública num link que vai SAIR daqui — para o
 * navegador, para o WhatsApp, para um e-mail.
 *
 * Sem endereço interno configurado, devolve a entrada intacta: a URL já nasceu
 * pública e não há nada a trocar.
 *
 * Não lança. Uma URL malformada (ou um caminho relativo) volta como veio: falhar
 * aqui derrubaria o envio de uma mídia que, na pior hipótese, iria funcionar.
 */
export function urlPublicaDaAssinatura(url: string): string {
  const interna = env.SUPABASE_INTERNAL_URL;
  if (!interna) return url;

  try {
    const alvo = new URL(url);
    const base = new URL(interna);
    if (alvo.origin !== base.origin) return url;

    // ⚠️ Reconstruir a partir da ORIGEM, e não atribuir `protocol`/`host` na URL
    // existente: atribuir `host` sem porta NÃO limpa a porta anterior, e o
    // interno tem uma (`:8000`). O primeiro rascunho disto devolvia
    // `https://dominio-publico:8000/...` — link quebrado com cara de certo.
    const publica = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    return new URL(alvo.pathname + alvo.search + alvo.hash, publica.origin).toString();
  } catch {
    return url;
  }
}
