import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible, IBM_Plex_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { branding } from "@/lib/branding";
import { cssDaMarca } from "@/lib/branding/css";
import { REGUA_DO_PRODUTO } from "@/lib/branding/regua-do-produto";
import { camadaDoAmbiente, resolverMarca } from "@/lib/branding/resolve";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ThemeProvider } from "@/lib/theme";
import { Providers } from "./providers";
import { PublicEnvScript } from "./public-env-script";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "700"],
  display: "swap",
  variable: "--font-atkinson",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

/**
 * Metadata dinâmica (não `export const metadata`) para a marca ser lida em RUNTIME.
 * Constante seria resolvida durante o `next build`, e a imagem self-host — que é
 * pré-buildada — carregaria a nossa marca para sempre. Ver `lib/branding.ts`.
 *
 * O `template` é o que faz a marca existir em UM lugar só: as páginas filhas
 * declaram apenas o próprio nome ("Entrar") e herdam o sufixo daqui.
 */
export function generateMetadata(): Metadata {
  const { name } = branding();
  return {
    title: {
      default: `${name} — atendimento e vendas por WhatsApp com agentes de IA`,
      template: `%s · ${name}`,
    },
    description:
      "Centralize o atendimento por WhatsApp num funil só. Agentes de IA resolvem o que dá pra resolver e passam para o time humano o que importa — com tudo registrado. Multi-tenant, LGPD-nativo, feito para operações brasileiras.",
    applicationName: name,
    authors: [{ name }],
    keywords: [
      "CRM",
      "atendimento",
      "WhatsApp",
      "IA conversacional",
      "LGPD",
      "multi-tenant",
    ],
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#161510" },
  ],
};

// Inline FOUC-prevention. Conteúdo é string literal estática (zero input do usuário),
// portanto seguro. Lê localStorage + prefers-color-scheme antes do primeiro paint.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('deskcomm-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var r=(s==='dark'||s==='light')?s:((s==='system'||!s)&&d?'dark':'light');document.documentElement.setAttribute('data-theme',r);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

/**
 * Motivos já registrados neste processo. `EstiloDaMarca` roda em TODA
 * requisição e os motivos são os mesmos até alguém mudar o `.env` — repetir o
 * aviso a cada render seria ruído, e ruído é como um log deixa de ser lido.
 */
const motivosRegistrados = new Set<string>();

/**
 * A cor da instalação, injetada como CSS no `<head>`.
 *
 * É HTML no primeiro byte — antes do CSS e antes do `THEME_INIT_SCRIPT` — então
 * não há flash: o navegador nunca chega a pintar a cor do produto para depois
 * trocar. Server Component de propósito: a leitura é de `process.env` em runtime
 * (a imagem self-host é pré-buildada; ver `lib/branding.ts`), e enviar isso pelo
 * cliente reintroduziria justamente o flash.
 *
 * Os motivos NÃO morrem aqui: enquanto a tela de marca não existe (fase
 * seguinte, `/app/settings/tenant/branding`), o log estruturado é por onde o
 * operador descobre que a cor dele foi deslocada ou recusada — e `resolverMarca`
 * devolve a lista inteira para quem a quiser mostrar.
 */
async function EstiloDaMarca() {
  // `await headers()` força render dinâmico, pelo mesmo motivo do
  // `<PublicEnvScript/>`: numa imagem pré-buildada, um render ESTÁTICO
  // congelaria o valor lido durante o `next build` — que é vazio — e a cor do
  // revendedor nunca apareceria. Hoje o layout já é dinâmico por causa do
  // vizinho; declarar aqui torna a garantia local, em vez de depender de um
  // componente que alguém pode mover.
  await headers();
  const marca = resolverMarca([camadaDoAmbiente(env)], REGUA_DO_PRODUTO);
  const { css, motivos } = cssDaMarca(marca.cor);

  const avisos = [
    ...marca.motivos.map((m) => ({
      codigo: m.codigo,
      origem: m.origem,
      tema: m.tema,
      alvo: m.alvo,
      detalhe: m.detalhe,
    })),
    ...motivos.map((m) => ({
      codigo: m.codigo,
      origem: "css",
      tema: null,
      alvo: m.alvo,
      detalhe: m.detalhe,
    })),
  ];
  for (const aviso of avisos) {
    const chave = `${aviso.codigo}|${aviso.tema ?? ""}|${aviso.alvo ?? ""}`;
    if (motivosRegistrados.has(chave)) continue;
    motivosRegistrados.add(chave);
    logger.warn("marca da instalação: a cor configurada não foi aplicada como está", aviso);
  }

  // `null` sem motivo é o caso de fábrica (nenhuma cor configurada): não há o
  // que injetar, e o produto fica com a cor dele.
  if (!css) return null;
  // Conteúdo derivado do `.env` do servidor e já passado pela allowlist de forma
  // de `lib/branding/css.ts`, que recusa `<` e devolve `null` em vez de string
  // parcial. Mesmo contrato do `THEME_INIT_SCRIPT` acima.
  //
  // O `id` é o que torna este bloco IDENTIFICÁVEL na tela: sem ele, achá-lo no
  // `<head>` só dá por varredura de todos os `<style>` procurando um `--color-`
  // no texto (foi como a prova em tela deste marco teve de fazer), e distinguir
  // o bloco da INSTALAÇÃO do bloco da ORGANIZAÇÃO — que a fase seguinte injeta —
  // seria impossível. Vale para diagnóstico, para spec de e2e e para o suporte.
  return <style id="marca-instalacao" dangerouslySetInnerHTML={{ __html: css }} />;
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      data-theme="light"
      suppressHydrationWarning
      className={`${atkinson.variable} ${plexMono.variable}`}
    >
      <head>
        {/* Primeiro de tudo: a cor da instalação, antes do CSS e do script de tema. */}
        <EstiloDaMarca />
        {/* Config pública do Supabase em runtime (imagem genérica self-host). */}
        <PublicEnvScript />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-bg font-sans text-text antialiased">
        <Providers>
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </Providers>
      </body>
    </html>
  );
}
