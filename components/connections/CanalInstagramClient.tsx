"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";

/**
 * Conectar o Instagram Direct — a FORMA da tela, antes do transporte.
 *
 * ─── Por que os campos estão desabilitados, e não funcionando ───────────────
 *
 * O schema e o vocabulário deste canal já existem (migration 0203), mas o
 * TRANSPORTE não: não há adapter, não há OAuth, não há webhook. `getAdapter`
 * lança de propósito para quem tentar enviar.
 *
 * A escolha aqui foi entre três telas, e duas são piores:
 *
 *   1. Não mostrar nada — some a informação de que o canal está a caminho, e
 *      quem opera não tem como saber o que falta.
 *   2. Formulário que ACEITA credencial e não a guarda — pior que não existir.
 *      App Secret e token são segredo de verdade: um campo que os recebe e os
 *      joga fora convida alguém a colar o segredo do cliente num lugar que não
 *      existe, e ninguém descobre até vazar.
 *   3. Formulário DESABILITADO, com o estado dito em voz alta — é esta. Mostra
 *      exatamente o que vai ser pedido, sem convidar ninguém a preencher.
 *
 * Isto é aplicação direta da doutrina "toda configuração tem superfície"
 * (`docs/doctrine/restricao-de-canal.md`): o que acontece quando falta
 * configuração precisa ser VISÍVEL, nunca um silêncio.
 *
 * ─── Por que a tela pode escrever "Instagram" ───────────────────────────────
 *
 * O `lint:channels` proíbe nomear PROVIDER fora de `lib/channels/`, e o regex
 * dele não distingue prosa de código — então o nome do transporte não cabe
 * nem neste comentário. "Instagram" passa porque é o nome do CANAL, que é
 * outra coisa: é o que o usuário reconhece, e o mesmo motivo pelo qual
 * `conversations.channel` grava `whatsapp` em vez do transporte por trás.
 */

/**
 * O que a conexão vai pedir. Sai daqui, e não de JSX solto, porque a mesma
 * lista precisa aparecer no passo a passo entregue ao cliente que vai criar o
 * app na Meta — duas listas divergem na primeira que alguém editar.
 */
const CAMPOS_DA_CREDENCIAL = [
  {
    id: "ig-app-id",
    rotulo: "ID do aplicativo",
    ajuda: "O identificador do app que o dono da conta criou na Meta.",
  },
  {
    id: "ig-app-secret",
    rotulo: "Chave secreta do aplicativo",
    ajuda: "Secreta. Fica cifrada no banco, nunca no arquivo de configuração.",
  },
  {
    id: "ig-verify-token",
    rotulo: "Token de verificação",
    ajuda: "Inventado por você; a Meta o devolve ao registrar o webhook, e é assim que confirmamos que é ela.",
  },
] as const;

/**
 * As três permissões pedidas na MESMA submissão à Meta. A de mensagens não
 * aprova sozinha, e a terceira é a que decide o que acontece depois da janela
 * de 24 horas.
 */
const PERMISSOES = [
  { nome: "instagram_business_basic", para: "ler a conta" },
  { nome: "instagram_business_manage_messages", para: "receber e responder mensagens" },
  { nome: "human_agent", para: "uma PESSOA responder até 7 dias depois — a IA não usa" },
] as const;

export function CanalInstagramClient() {
  const t = useT();

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">{t("Instagram Direct")}</h2>
            <p className="text-muted-foreground text-sm">
              {t("Atender as mensagens diretas do Instagram no mesmo Inbox do WhatsApp.")}
            </p>
          </div>
          {/* O estado real, dito sem rodeio. "Em construção" seria vago; o que o
              operador precisa saber é que NÃO dá para conectar ainda. */}
          <Badge variant="outline">{t("Transporte pendente")}</Badge>
        </div>

        <div className="border-muted-foreground/30 bg-muted/40 rounded-md border border-dashed p-3">
          <p className="text-sm">
            {t(
              "O canal já existe no banco e no roteamento, mas ainda não é possível conectar uma conta: falta a autorização pela Meta e a entrega de mensagens. Esta tela mostra o que será pedido, para você preparar o lado da Meta enquanto isso.",
            )}
          </p>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{t("Credenciais da conta")}</h3>
          <p className="text-muted-foreground text-sm">
            {t(
              "Cada cliente cria o próprio aplicativo na Meta e cola as credenciais dele aqui — não existe um aplicativo único para todo mundo.",
            )}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {CAMPOS_DA_CREDENCIAL.map((campo) => (
            <div key={campo.id} className="flex flex-col gap-1.5">
              <Label htmlFor={campo.id}>{t(campo.rotulo)}</Label>
              <Input id={campo.id} disabled placeholder="—" />
              <p className="text-muted-foreground text-xs">{t(campo.ajuda)}</p>
            </div>
          ))}
        </div>

        <div>
          {/* Desabilitado, e o `title` diz por quê — botão morto sem explicação
              faz o operador clicar três vezes e concluir que a tela quebrou. */}
          <Button disabled title={t("Disponível quando a conexão com a Meta estiver implementada")}>
            {t("Conectar conta")}
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">{t("O que preparar na Meta")}</h3>
          <p className="text-muted-foreground text-sm">
            {t(
              "A aprovação leva de semanas a meses, então vale começar antes. É preciso uma conta profissional do Instagram e um portfólio de negócios verificado.",
            )}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {PERMISSOES.map((p) => (
            <li key={p.nome} className="flex flex-col gap-0.5">
              <code className="text-xs">{p.nome}</code>
              <span className="text-muted-foreground text-xs">{t(p.para)}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h3 className="text-sm font-medium">{t("Como este canal se comporta")}</h3>
        {/* Não é enfeite: é a diferença de COMPORTAMENTO que quem opera precisa
            saber antes de vender atendimento por aqui. Fora da janela o agente
            de IA não tem jogada — e isso é o canal, não um defeito nosso. */}
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-sm">
          <li>
            {t("A conversa fica aberta por 24 horas a partir da última mensagem do cliente.")}
          </li>
          <li>
            {t(
              "Passadas as 24 horas não existe modelo aprovado para reabrir, como há no WhatsApp — quem responde tem que ser uma pessoa. O agente de IA encerra o turno e escala.",
            )}
          </li>
          <li>{t("Não há grupos, e a mensagem não é cobrada por unidade.")}</li>
          <li>
            {t("A credencial vence e precisa ser renovada — algo que o WhatsApp por QR não exige.")}
          </li>
        </ul>
      </Card>
    </div>
  );
}
