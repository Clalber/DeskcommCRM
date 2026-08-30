"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useGuardarAplicativoInstagram,
  useInstagramChannel,
  type ContaDeInstagram,
} from "@/hooks/channels/useInstagramChannel";
import { copyToClipboard } from "@/lib/clipboard";
import { useT } from "@/hooks/i18n/useT";

/**
 * Conectar o Instagram Direct.
 *
 * ─── Por que a tela tem DOIS passos, e não um botão ─────────────────────────
 *
 * A versão anterior deste arquivo era um formulário desabilitado, porque o
 * transporte não existia. Agora existe — e o fluxo real da Meta tem uma ida ao
 * navegador da pessoa no meio dele, que nenhuma tela consegue encurtar:
 *
 *   1. guardar o aplicativo  →  2. cadastrar o webhook na Meta  →  3. autorizar
 *
 * O passo 2 é do operador, num site que não é o nosso, e é o que mais falha:
 * a Meta chama a URL, confere o token de verificação e recusa em silêncio se
 * algo diverge por um caractere. Por isso os dois endereços que ele precisa
 * colar lá aparecem juntos, prontos para copiar, assim que ele salva — e não
 * numa tela de ajuda separada, onde metade das instalações pararia.
 *
 * ─── Por que a tela pode escrever "Instagram" ───────────────────────────────
 *
 * O `lint:channels` proíbe nomear PROVIDER fora de `lib/channels/`, e o regex
 * dele não distingue prosa de código. "Instagram" passa porque é o nome do
 * CANAL, que é outra coisa: é o que o usuário reconhece, e o mesmo motivo pelo
 * qual `conversations.channel` grava `whatsapp` em vez do transporte por trás.
 */

/**
 * O que a volta da autorização quer dizer, em português.
 *
 * Sai daqui e não de um `if` no meio do JSX porque a rota de callback só sabe
 * devolver um código curto na URL — ela redireciona um navegador, não responde
 * um JSON. Sem esta tradução, quem voltasse veria `?autorizacao=troca_falhou` na
 * barra de endereço e mais nada na tela.
 */
const DESFECHOS: Record<string, { tom: "ok" | "erro"; texto: string }> = {
  conectada: { tom: "ok", texto: "Conta conectada. As mensagens do Direct já chegam no Inbox." },
  recusada: {
    tom: "erro",
    texto: "A autorização foi cancelada na Meta. Nada mudou; você pode tentar de novo.",
  },
  estado_invalido: {
    tom: "erro",
    texto: "O pedido de autorização venceu ou não confere. Comece de novo pelo botão Autorizar.",
  },
  sem_codigo: { tom: "erro", texto: "A Meta voltou sem o código de autorização. Tente de novo." },
  conexao_sumiu: {
    tom: "erro",
    texto: "A conexão não existe mais — ela pode ter sido excluída enquanto você autorizava.",
  },
  cifra_indisponivel: {
    tom: "erro",
    texto:
      "Esta instalação está sem a chave de cifra do servidor, e nada foi gravado. Fale com quem administra o servidor.",
  },
  troca_falhou: {
    tom: "erro",
    texto:
      "A Meta recusou a troca do código. Confira se o ID e a chave secreta do aplicativo estão certos e se a URL de retorno está cadastrada lá.",
  },
  conta_ilegivel: {
    tom: "erro",
    texto: "Autorizamos, mas a Meta não disse qual conta é. Tente de novo em alguns minutos.",
  },
  conta_ja_conectada: {
    tom: "erro",
    texto: "Esta conta do Instagram já está conectada em outro lugar. Desconecte-a de lá primeiro.",
  },
  gravacao_falhou: { tom: "erro", texto: "Não conseguimos gravar a conexão. Tente de novo." },
};

/** Um endereço para copiar. Aparece SEMPRE que existe conexão. */
function ParaColar({ rotulo, valor, ajuda }: { rotulo: string; valor: string; ajuda: string }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {rotulo}
      </span>
      <div className="flex items-center gap-2">
        <code className="bg-muted flex-1 overflow-x-auto rounded px-2 py-1.5 text-xs">{valor}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await copyToClipboard(valor);
            toast.success(t("Copiado."));
          }}
        >
          {t("Copiar")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t(ajuda)}</p>
    </div>
  );
}

/** Quanto falta para a credencial vencer, em dias. `null` = não sabemos. */
function diasAteVencer(quando: string | null): number | null {
  if (!quando) return null;
  const ms = new Date(quando).getTime() - Date.now();
  return Number.isFinite(ms) ? Math.floor(ms / 86_400_000) : null;
}

function Conta({ conta }: { conta: ContaDeInstagram }) {
  const t = useT();
  const dias = diasAteVencer(conta.tokenExpiraEm);

  return (
    <Card className="flex flex-col gap-3 p-4" data-testid="instagram-conta">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{conta.displayName ?? t("Instagram")}</span>
          {conta.conectada ? (
            <Badge variant="outline">{t("Conectada")}</Badge>
          ) : (
            <Badge variant="secondary">{t("Falta autorizar")}</Badge>
          )}
        </div>

        {conta.conectada ? null : (
          // Um link, e não um `fetch`: a rota responde 302 para o site da Meta, e
          // um redirecionamento entre sites precisa ser navegação de verdade —
          // buscá-lo por XHR o navegador bloqueia, e a pessoa clicaria num botão
          // que não faz nada.
          <Button asChild size="sm">
            <a href={`/api/v1/channels/instagram/authorize?session=${conta.id}`}>
              {t("Autorizar na Meta")}
            </a>
          </Button>
        )}
      </div>

      {/* A credencial deste canal VENCE, e é a única do produto que vence. Dizer
          quando é o que evita a descoberta pelo cliente que não foi respondido. */}
      {conta.conectada && dias !== null ? (
        <p className={dias <= 10 ? "text-destructive text-sm" : "text-muted-foreground text-sm"}>
          {dias <= 0
            ? t("O acesso expirou. Autorize de novo para voltar a receber mensagens.")
            : `${t("O acesso vence em")} ${dias} ${dias === 1 ? t("dia") : t("dias")}. ${t("A renovação é automática.")}`}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t pt-3">
        <ParaColar
          rotulo={t("URL de retorno de chamada")}
          valor={conta.webhook.callbackUrl}
          ajuda="Cole em Webhooks, no painel do seu aplicativo na Meta."
        />
        <p className="text-muted-foreground text-xs">
          {t("Campos a assinar:")} <code className="text-xs">{conta.webhook.campos.join(", ")}</code>
        </p>
      </div>
    </Card>
  );
}

export function CanalInstagramClient() {
  const t = useT();
  const { data, isPending } = useInstagramChannel();
  const guardar = useGuardarAplicativoInstagram();
  const params = useSearchParams();
  const [form, setForm] = useState({ app_id: "", app_secret: "", verify_token: "" });

  // A volta do callback chega pela URL. Sem isto a pessoa voltaria para uma tela
  // idêntica à que deixou, sem saber se conectou.
  const desfecho = params.get("autorizacao");
  useEffect(() => {
    if (!desfecho) return;
    const d = DESFECHOS[desfecho];
    if (!d) return;
    if (d.tom === "ok") toast.success(t(d.texto));
    else toast.error(t(d.texto));
  }, [desfecho, t]);

  const estado = data?.data;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    await guardar.mutateAsync(form);
    toast.success(t("Aplicativo guardado. Agora cadastre o webhook na Meta e autorize."));
    // Os dois segredos somem do formulário assim que gravam. Deixá-los na tela
    // seria mantê-los em memória do navegador sem motivo — e eles não voltam em
    // nenhum GET.
    setForm({ app_id: "", app_secret: "", verify_token: "" });
  }

  if (isPending) return <p className="text-muted-foreground text-sm">{t("Carregando…")}</p>;

  return (
    <div className="flex flex-col gap-4" data-testid="canal-instagram-root">
      <Card className="flex flex-col gap-2 p-4">
        <h2 className="text-sm font-medium">{t("Instagram Direct")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("Atender as mensagens diretas do Instagram no mesmo Inbox do WhatsApp.")}
        </p>
      </Card>

      {estado?.contas.map((c) => <Conta key={c.id} conta={c} />)}

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">
            {estado?.contas.length ? t("Conectar outra conta") : t("Conectar uma conta")}
          </h3>
          <p className="text-muted-foreground text-sm">
            {t(
              "Cada cliente cria o próprio aplicativo na Meta e cola as credenciais dele aqui — não existe um aplicativo único para todo mundo.",
            )}
          </p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={enviar}>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-app-id">{t("ID do aplicativo")}</Label>
              <Input
                id="ig-app-id"
                value={form.app_id}
                onChange={(e) => setForm((f) => ({ ...f, app_id: e.target.value }))}
                required
              />
              <p className="text-muted-foreground text-xs">
                {t("O identificador do app que o dono da conta criou na Meta.")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-app-secret">{t("Chave secreta do aplicativo")}</Label>
              <Input
                id="ig-app-secret"
                type="password"
                value={form.app_secret}
                onChange={(e) => setForm((f) => ({ ...f, app_secret: e.target.value }))}
                required
              />
              <p className="text-muted-foreground text-xs">
                {t("Fica cifrada no banco, nunca no arquivo de configuração, e não volta nesta tela.")}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ig-verify-token">{t("Token de verificação")}</Label>
              <Input
                id="ig-verify-token"
                value={form.verify_token}
                onChange={(e) => setForm((f) => ({ ...f, verify_token: e.target.value }))}
                required
                minLength={8}
              />
              <p className="text-muted-foreground text-xs">
                {t(
                  "Invente um e guarde: a Meta o devolve ao cadastrar o webhook, e é assim que confirmamos que é ela.",
                )}
              </p>
            </div>
          </div>

          <div>
            <Button type="submit" disabled={guardar.isPending}>
              {guardar.isPending ? t("Guardando…") : t("Guardar aplicativo")}
            </Button>
          </div>
        </form>

        {estado?.redirectUri ? (
          <div className="border-t pt-4">
            <ParaColar
              rotulo={t("URL de retorno da autorização")}
              valor={estado.redirectUri}
              ajuda="Cadastre em Redirect URIs, no painel do aplicativo. A Meta compara caractere por caractere e recusa a autorização se divergir."
            />
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h3 className="text-sm font-medium">{t("Como este canal se comporta")}</h3>
        {/* Não é enfeite: é a diferença de COMPORTAMENTO que quem opera precisa
            saber antes de vender atendimento por aqui. */}
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-sm">
          <li>{t("A conversa fica aberta por 24 horas a partir da última mensagem do cliente.")}</li>
          <li>
            {t(
              "Passadas as 24 horas não existe modelo aprovado para reabrir, como há no WhatsApp — quem responde tem que ser uma pessoa. O agente de IA encerra o turno e escala.",
            )}
          </li>
          <li>{t("Não há grupos, e a mensagem não é cobrada por unidade.")}</li>
          <li>
            {t(
              "A credencial vence a cada 60 dias. A renovação é automática, e avisamos na Central se ela falhar.",
            )}
          </li>
          <li>
            {t(
              "Conectar exige aprovação do aplicativo pela Meta, que leva de semanas a meses. Vale começar antes.",
            )}
          </li>
        </ul>
      </Card>
    </div>
  );
}
