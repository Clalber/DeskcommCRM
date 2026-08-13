"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDefaultAgent, skipAi } from "@/app/actions/onboarding/createDefaultAgent";
import type { PromptTemplate } from "@/lib/schemas/onboarding";
import { cn } from "@/lib/utils";

/**
 * O jeito de falar, não o "estilo de prompt".
 *
 * Os rótulos anteriores eram "Amigável (e-commerce)", "Profissional" e "Suporte
 * minimalista" — dois deles amarrados a loja virtual, num produto cuja maioria
 * de adopters roda em clínica, imobiliária e infoproduto. Os identificadores
 * continuam os mesmos porque já existem gravados; só a fala mudou.
 */
const JEITOS: { id: PromptTemplate; titulo: string; desc: string }[] = [
  {
    id: "ecommerce_friendly",
    titulo: "Próximo e caloroso",
    desc: "Conversa como gente, puxa assunto, tranquiliza. Bom para quem vende no dia a dia.",
  },
  {
    id: "ecommerce_professional",
    titulo: "Objetivo e cordial",
    desc: "Vai direto ao ponto sem ser seco, e sempre indica o próximo passo.",
  },
  {
    id: "support_minimal",
    titulo: "Curto e prático",
    desc: "Frases curtas, pergunta só o essencial e chama uma pessoa cedo.",
  },
];

interface Props {
  /** O que ele já sabe fazer, em linguagem de dono de negócio. */
  capacidades: string[];
  /** O que ele nunca faz — as conferências antes de cada mensagem sair. */
  conferencias: string[];
}

export function SetupAiForm({ capacidades, conferencias }: Props) {
  const [name, setName] = useState("Atendente IA");
  const [jeito, setJeito] = useState<PromptTemplate>("ecommerce_friendly");
  const [regras, setRegras] = useState("");
  const [naoPublicado, setNaoPublicado] = useState<string | null>(null);
  const [causa, setCausa] = useState<"canal" | "modelo" | null>(null);
  const [provedor, setProvedor] = useState<string | null>(null);
  const [regrasNaoSalvas, setRegrasNaoSalvas] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-6"
      action={(formData) => {
        startTransition(async () => {
          setNaoPublicado(null);
          setCausa(null);
          setProvedor(null);
          setRegrasNaoSalvas(null);
          const res = await createDefaultAgent(formData);
          if (res && !res.ok) {
            toast.error(`Falha ao criar agente: ${res.error}`);
            return;
          }
          if (res?.regras_nao_salvas) setRegrasNaoSalvas(res.regras_nao_salvas);
          if (res?.publish_blocked_by === "modelo") {
            setCausa("modelo");
            setProvedor(res.provider ?? null);
            toast.warning("Atendente criado, mas ainda não está no ar.");
            return;
          }
          if (res?.publish_error) {
            setNaoPublicado(res.publish_error);
            setCausa("canal");
            toast.warning("Agente criado, mas ainda não publicado.");
          }
        });
      }}
    >
      <div className="space-y-5 rounded-lg border bg-background p-6">
        <div className="space-y-2">
          <Label htmlFor="name">Como ele vai se chamar</Label>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
          <p className="text-xs text-muted-foreground">
            É o nome que aparece para o seu time. O cliente vê só a conversa.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">O jeito dele falar</legend>
          <div className="grid gap-2">
            {JEITOS.map((j) => (
              <label
                key={j.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                  jeito === j.id ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  name="prompt_template"
                  value={j.id}
                  checked={jeito === j.id}
                  onChange={() => setJeito(j.id)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{j.titulo}</span>
                  <span className="block text-xs text-muted-foreground">{j.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          <Label htmlFor="regras_da_casa">As regras da casa (opcional)</Label>
          <Textarea
            id="regras_da_casa"
            name="regras_da_casa"
            value={regras}
            onChange={(e) => setRegras(e.target.value)}
            rows={5}
            maxLength={20000}
            placeholder={
              "Nunca prometa desconto sem confirmar com uma pessoa.\n" +
              "Horário de atendimento: 9h às 18h, de segunda a sexta.\n" +
              "Sempre chame o cliente pelo primeiro nome."
            }
          />
          <p className="text-xs text-muted-foreground">
            O que vale para qualquer atendimento aqui. Pode deixar em branco agora e
            escrever depois — ele aprende com você ao longo do tempo.
          </p>
        </div>
      </div>

      {/*
        Nada aqui pede configuração: é o que ele JÁ vem sabendo. O passo
        anterior entregava um funcionário sem dizer uma linha sobre o que ele
        é capaz de fazer — e a primeira pergunta de quem contrata alguém é
        exatamente essa.
      */}
      <div className="grid gap-3 sm:grid-cols-2">
        <section className="rounded-lg border bg-background p-4">
          <h3 className="text-sm font-medium">Ele já vem sabendo</h3>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {capacidades.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border bg-background p-4">
          <h3 className="text-sm font-medium">E nunca vai fazer</h3>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {conferencias.map((c) => (
              <li key={c}>· {c}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Essas conferências acontecem antes de cada mensagem sair, e não têm
            interruptor.
          </p>
        </section>
      </div>

      {regrasNaoSalvas && (
        <div
          role="alert"
          className="space-y-2 rounded-md border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20"
        >
          <p className="text-sm font-medium">
            O atendente foi criado, mas as <strong>regras da casa</strong> não foram
            gravadas. Copie o que você escreveu antes de sair — e salve de novo em{" "}
            <strong>IA › Memória</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Erro do banco de dados: <code className="break-all">{regrasNaoSalvas}</code>
          </p>
        </div>
      )}

      {causa === "modelo" && (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20"
        >
          <p className="text-sm font-medium">
            Seu atendente foi criado, mas ficou como <strong>rascunho</strong>: esta
            instalação ainda não baixou a lista de modelos
            {provedor ? ` da ${provedor}` : " da inteligência que você escolheu na instalação"}, e
            sem saber qual modelo usar ele não entra no ar — rascunho não responde mensagem.
          </p>
          <p className="text-sm">
            A lista é atualizada automaticamente uma vez por dia. Para colocá-lo no ar antes
            disso, vá em <strong>IA › Credenciais</strong> e cadastre a chave dessa empresa;
            depois publique em <strong>IA › Agentes</strong>.
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = "/onboarding/invite-team";
              }}
            >
              Continuar sem publicar
            </Button>
          </div>
        </div>
      )}

      {naoPublicado && (
        <div
          role="alert"
          className="space-y-3 rounded-md border border-amber-300/60 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-950/20"
        >
          <p className="text-sm font-medium">
            Seu agente foi criado, mas ficou como <strong>rascunho</strong>: não consegui ler os
            números de WhatsApp desta instalação, então não dá pra dizer em qual número ele
            atenderia — e rascunho não responde mensagem.
          </p>
          <p className="text-xs text-muted-foreground">
            Erro do banco de dados: <code className="break-all">{naoPublicado}</code>
          </p>
          <p className="text-sm">
            Tente de novo no botão abaixo (clicar de novo não cria um segundo agente) ou siga
            agora e publique depois em <strong>IA › Agentes</strong>.
          </p>
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                window.location.href = "/onboarding/invite-team";
              }}
            >
              Continuar sem publicar
            </Button>
          </div>
        </div>
      )}

      <div className="flex justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => startTransition(() => void skipAi())}
        >
          Pular
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Criando..." : "Criar e continuar"}
        </Button>
      </div>
    </form>
  );
}
