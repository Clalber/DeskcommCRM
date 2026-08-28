"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Conectar o Instagram Direct — a FORMA da tela, antes do transporte.
 *
 * Campos desabilitados de propósito: o transporte não existe (`getAdapter`
 * lança). As alternativas descartadas — não mostrar nada, ou aceitar a chave
 * secreta sem ter onde guardá-la — estão na mensagem do commit e no fragmento
 * em `.changes/`.
 */


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
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium">Instagram Direct</h2>
            <p className="text-muted-foreground text-sm">
              Atender as mensagens diretas do Instagram no mesmo Inbox do WhatsApp.
            </p>
          </div>
          {/* O estado real, dito sem rodeio. "Em construção" seria vago; o que o
              operador precisa saber é que NÃO dá para conectar ainda. */}
          <Badge variant="outline">Transporte pendente</Badge>
        </div>

        <div className="border-muted-foreground/30 bg-muted/40 rounded-md border border-dashed p-3">
          <p className="text-sm">
            O canal já existe no banco e no roteamento, mas ainda{" "}
            <strong>não é possível conectar uma conta</strong>: falta a
            autorização pela Meta e a entrega de mensagens. Esta tela mostra o
            que será pedido, para você preparar o lado da Meta enquanto isso.
          </p>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Credenciais da conta</h3>
          <p className="text-muted-foreground text-sm">
            Cada cliente cria o próprio aplicativo na Meta e cola as credenciais
            dele aqui — não existe um aplicativo único para todo mundo.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["ig-app-id", "ID do aplicativo", "O identificador do app que o dono da conta criou na Meta."],
            ["ig-app-secret", "Chave secreta do aplicativo", "Secreta. Fica cifrada no banco, nunca no arquivo de configuração."],
            ["ig-verify-token", "Token de verificação", "Inventado por você; é assim que confirmamos que quem chama é a Meta."],
          ].map(([id, rotulo, ajuda]) => (
            <div key={id} className="flex flex-col gap-1.5">
              <Label htmlFor={id}>{rotulo}</Label>
              <Input id={id} disabled placeholder="—" />
              <p className="text-muted-foreground text-xs">{ajuda}</p>
            </div>
          ))}
        </div>

        <div>
          {/* Desabilitado, e o `title` diz por quê — botão morto sem explicação
              faz o operador clicar três vezes e concluir que a tela quebrou. */}
          <Button disabled title="Disponível quando a conexão com a Meta estiver implementada">
            Conectar conta
          </Button>
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">O que preparar na Meta</h3>
          <p className="text-muted-foreground text-sm">
            A aprovação leva de semanas a meses, então vale começar antes. É
            preciso uma conta profissional do Instagram e um portfólio de
            negócios verificado.
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {PERMISSOES.map((p) => (
            <li key={p.nome} className="flex flex-col gap-0.5">
              <code className="text-xs">{p.nome}</code>
              <span className="text-muted-foreground text-xs">{p.para}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h3 className="text-sm font-medium">Como este canal se comporta</h3>
        {/* Não é enfeite: é a diferença de COMPORTAMENTO que quem opera precisa
            saber antes de vender atendimento por aqui. Fora da janela o agente
            de IA não tem jogada — e isso é o canal, não um defeito nosso. */}
        <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-4 text-sm">
          <li>
            A conversa fica aberta por <strong>24 horas</strong> a partir da
            última mensagem do cliente.
          </li>
          <li>
            Passadas as 24 horas <strong>não existe modelo aprovado</strong> para
            reabrir, como há no WhatsApp — quem responde tem que ser uma pessoa.
            O agente de IA encerra o turno e escala.
          </li>
          <li>Não há grupos, e a mensagem não é cobrada por unidade.</li>
          <li>
            A credencial <strong>vence</strong> e precisa ser renovada — algo que
            o WhatsApp por QR não exige.
          </li>
        </ul>
      </Card>
    </div>
  );
}
