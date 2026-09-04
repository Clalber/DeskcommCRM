import { resolveField } from "@/lib/automation/conditions";

const ALIASES: Record<string, string> = {
  nome: "contact.name",
  telefone: "contact.phone_number",
  email: "contact.email",
  etapa: "stage.name",
  funil: "pipeline.name",
  responsavel: "owner.name",
  atendente: "owner.name",
  "agendamento.profissional": "agendamento.profissional",
  "agendamento.atendente": "agendamento.profissional",
};

/** Variaveis restritas ao uso interno que nunca devem vazar para mensagens ao cliente */
const INTERNAL_PREFIXES = [
  "qualificacao.",
  "owner.",
  "responsavel",
  "atendente",
  "agendamento.profissional",
  "agendamento.atendente",
  "agendamento.notas",
];

export interface RenderTemplateOptions {
  audience?: "customer" | "internal";
}

export function renderTemplate(
  template: string,
  context: Record<string, unknown>,
  options?: RenderTemplateOptions,
): string {
  const isCustomer = options?.audience === "customer";

  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    const targetPath = ALIASES[path] ?? path;

    // Guarda de vazamento: bloqueia dados internos para cliente
    if (isCustomer) {
      if (
        INTERNAL_PREFIXES.some(
          (prefix) =>
            path === prefix ||
            path.startsWith(prefix) ||
            targetPath === prefix ||
            targetPath.startsWith(prefix),
        )
      ) {
        return "";
      }
    }
    let resolved = resolveField(context, targetPath);

    // Fallback inteligente para campos personalizados:
    // Permite {{campo.segmento}} ou {{custom_fields.segmento}}
    if ((resolved === undefined || resolved === null) && path.startsWith("campo.")) {
      const fieldKey = path.slice("campo.".length);
      resolved = resolveField(context, `lead.custom_fields.${fieldKey}`);
    } else if ((resolved === undefined || resolved === null) && path.startsWith("custom_fields.")) {
      const fieldKey = path.slice("custom_fields.".length);
      resolved = resolveField(context, `lead.custom_fields.${fieldKey}`);
    }

    return resolved === undefined || resolved === null ? "" : String(resolved);
  });
}
