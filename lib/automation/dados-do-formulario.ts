/**
 * OS DADOS QUE A IA RECEBE COMO ENTRADA — e de onde eles vêm.
 *
 * A fonte PREFERIDA é `webhook_lead_captures` (migration 0169): ela guarda o
 * formulário como a pessoa preencheu, com os rótulos originais dos campos. É a
 * diferença entre a IA ler `quantos_funcionarios: 3` e ler um `custom_fields`
 * já mastigado pelo mapeamento.
 *
 * O plano B é o contexto que o motor já hidratou (`lead.custom_fields` +
 * `source_metadata` + o contato). Ele existe porque a ação vale para os CINCO
 * gatilhos, não só para o de webhook: uma regra disparada por "ganhou a tag
 * cliente-vip" não tem formulário nenhum, e ainda assim a IA deve escrever com
 * o que se sabe da pessoa.
 *
 * `veioDeFormulario` não é detalhe: é o que decide qual situação o prompt
 * declara ao agente ("acabou de preencher um formulário" vs. "entrou no funil
 * por uma automação"). Dizer a errada faz o modelo escrever sobre um formulário
 * que não existiu.
 */
import type { ActionCtx } from "@/lib/automation/types";

export interface DadosParaAbordagem {
  dados: Record<string, string>;
  origem: string | null;
  veioDeFormulario: boolean;
}

/** Rótulos que a pessoa reconhece, para os três campos canônicos. */
const ROTULO_CANONICO: Record<string, string> = {
  name: "Nome",
  display_name: "Nome",
  phone_number: "Telefone",
  email: "E-mail",
};

function texto(valor: unknown): string | null {
  if (typeof valor === "string" && valor.trim()) return valor.trim();
  if (typeof valor === "number" || typeof valor === "boolean") return String(valor);
  return null;
}

function acrescentar(
  destino: Record<string, string>,
  origem: Record<string, unknown> | null | undefined,
  rotular = false,
): void {
  if (!origem) return;
  for (const [chave, valor] of Object.entries(origem)) {
    const v = texto(valor);
    if (v === null) continue;
    const rotulo = rotular ? (ROTULO_CANONICO[chave] ?? chave) : chave;
    if (!(rotulo in destino)) destino[rotulo] = v;
  }
}

export async function dadosDoFormularioDoContexto(ctx: ActionCtx): Promise<DadosParaAbordagem> {
  const lead = ctx.context.lead as
    | { id?: string; custom_fields?: Record<string, unknown>; source_metadata?: Record<string, unknown> }
    | undefined;
  const contact = ctx.context.contact as
    | { name?: string | null; phone_number?: string | null; email?: string | null }
    | undefined;

  const dados: Record<string, string> = {};
  acrescentar(dados, contact as Record<string, unknown> | undefined, true);

  if (lead?.id) {
    // A captação mais recente deste lead. `maybeSingle` com limit 1: um lead
    // pode ter mais de uma linha (reenvio da ferramenta), e a que vale é a que
    // criou o lead — a primeira. Ordena ascendente por isso.
    const { data } = await ctx.admin
      .from("webhook_lead_captures")
      .select("fields, utm, source_name")
      .eq("organization_id", ctx.organizationId)
      .eq("lead_id", lead.id)
      .order("received_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const captura = data as
      | { fields: Record<string, unknown>; utm: Record<string, string>; source_name: string }
      | null;
    if (captura) {
      acrescentar(dados, captura.fields);
      acrescentar(dados, captura.utm);
      return { dados, origem: captura.source_name, veioDeFormulario: true };
    }
  }

  acrescentar(dados, lead?.custom_fields);
  acrescentar(dados, lead?.source_metadata);
  return { dados, origem: null, veioDeFormulario: false };
}
