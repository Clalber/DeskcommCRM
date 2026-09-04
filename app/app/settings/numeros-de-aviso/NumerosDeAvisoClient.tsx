"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/hooks/i18n/useT";
import {
  useCriarNotifyNumber,
  useNotifyNumbers,
  useRemoverNotifyNumber,
} from "@/hooks/automacoes/useNotifyNumbers";

export function NumerosDeAvisoClient() {
  const t = useT();
  const { data: numeros, isLoading, isError } = useNotifyNumbers();
  const criar = useCriarNotifyNumber();
  const remover = useRemoverNotifyNumber();

  const [phone, setPhone] = React.useState("");
  const [label, setLabel] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [aviso, setAviso] = React.useState<string | null>(null);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    try {
      const r = await criar.mutateAsync({ phone, label });
      setPhone("");
      setLabel("");
      // ⚠️ Aviso, não erro: o número PODE ser também um cliente, e quem decide é
      // quem cadastrou. Mas ele precisa saber — a partir daqui os avisos NÃO
      // aparecem na conversa daquele contato.
      if (r.data.tambem_e_contato) {
        setAviso(
          `Atenção: ${r.data.tambem_e_contato.nome} também é um contato seu. Os avisos enviados para este número não vão aparecer na conversa dele.`,
        );
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui cadastrar o número.");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t("Números de aviso")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("Números de WhatsApp que as automações podem avisar. Só quem está nesta lista pode ser avisado — é o que impede um erro numa regra de virar mensagem para o número errado.")}
        </p>
      </div>

      <form onSubmit={salvar} className="space-y-3 rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="label">{t("Quem é")}</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Thiago (dono)"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">{t("Número")}</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(19) 99740-3473"
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={criar.isPending}>
          {criar.isPending ? t("Cadastrando…") : t("Cadastrar número")}
        </Button>
        {erro ? <p className="text-sm text-destructive">{erro}</p> : null}
        {aviso ? <p className="text-sm text-amber-600">{aviso}</p> : null}
      </form>

      <div className="space-y-2">
        {isLoading ? <p className="text-sm text-muted-foreground">{t("Carregando…")}</p> : null}
        {/* Lista vazia por FALHA é indistinguível de "nenhum cadastrado" — e a
            segunda leitura convida a cadastrar de novo o que já existe. */}
        {isError ? (
          <p className="text-sm text-destructive">
            {t("Não consegui carregar a lista. Recarregue a página antes de cadastrar — o número pode já estar aqui.")}
          </p>
        ) : null}
        {!isLoading && !isError && (numeros ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("Nenhum número cadastrado. Cadastre um acima para poder usá-lo em Automações.")}
          </p>
        ) : null}
        {(numeros ?? []).map((n) => (
          <div
            key={n.id}
            className="flex items-center justify-between rounded-lg border border-border p-3"
          >
            <div>
              <p className="font-medium text-text">{n.label}</p>
              <p className="text-sm text-muted-foreground">{n.phone_e164}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={remover.isPending}
              onClick={() => void remover.mutateAsync(n.id)}
            >
              {t("Remover")}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
