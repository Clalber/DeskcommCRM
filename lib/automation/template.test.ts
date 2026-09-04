import { describe, it, expect } from "vitest";
import { renderTemplate } from "@/lib/automation/template";

const ctx = { contact: { name: "Ana" }, lead: { title: "Pedido X", custom_fields: { cupom: "BF10" } } };

describe("renderTemplate", () => {
  it("variável simples", () =>
    expect(renderTemplate("Oi {{contact.name}}!", ctx)).toBe("Oi Ana!"));
  it("path aninhado", () =>
    expect(renderTemplate("Use {{lead.custom_fields.cupom}}", ctx)).toBe("Use BF10"));
  it("alias {{nome}} resolve contact.name", () =>
    expect(renderTemplate("Oi {{nome}}", ctx)).toBe("Oi Ana"));
  it("variável ausente vira vazio, não '{{...}}' cru", () =>
    expect(renderTemplate("X{{lead.ghost}}Y", ctx)).toBe("XY"));
  it("espaços dentro das chaves tolerados", () =>
    expect(renderTemplate("Oi {{ contact.name }}", ctx)).toBe("Oi Ana"));
  it("alias {{etapa}} e {{funil}}", () => {
    const context = {
      stage: { name: "Qualificado" },
      pipeline: { name: "Vendas Gerais" },
    };
    expect(renderTemplate("Etapa: {{etapa}} no funil {{funil}}", context)).toBe(
      "Etapa: Qualificado no funil Vendas Gerais",
    );
  });
  it("alias {{agendamento.data}}, {{agendamento.hora}} e {{agendamento.profissional}}", () => {
    const context = {
      agendamento: {
        data: "05/09/2026",
        hora: "14:30",
        profissional: "Dr. Marcos",
        tipo: "Avaliação Inicial",
      },
    };
    expect(
      renderTemplate(
        "Agendado para {{agendamento.data}} às {{agendamento.hora}} com {{agendamento.profissional}} ({{agendamento.tipo}})",
        context,
      ),
    ).toBe("Agendado para 05/09/2026 às 14:30 com Dr. Marcos (Avaliação Inicial)");
  });
  it("fallback para {{campo.nome_do_campo}} acessando lead.custom_fields", () => {
    expect(renderTemplate("Cupom: {{campo.cupom}}", ctx)).toBe("Cupom: BF10");
    expect(renderTemplate("Cupom: {{custom_fields.cupom}}", ctx)).toBe("Cupom: BF10");
  });
  it("alias {{responsavel}} e {{atendente}}", () => {
    const context = { owner: { name: "Carla Consultora" } };
    expect(renderTemplate("Responsável: {{responsavel}} / {{atendente}}", context)).toBe(
      "Responsável: Carla Consultora / Carla Consultora",
    );
  });
  it("bloqueia variaveis internas quando audience e customer", () => {
    const context = {
      contact: { name: "Ana" },
      owner: { name: "Carla" },
      qualificacao: { orcamento: "5000", necessidade: "Implante" },
      agendamento: {
        data: "10/09/2026",
        hora: "14:30",
        profissional: "Dr. Roberto",
        notas: "Nota interna sigilosa",
      },
    };
    const template =
      "Ola {{nome}}, horario {{agendamento.data}} as {{agendamento.hora}} com {{agendamento.profissional}} notas: {{agendamento.notas}}. Consultor: {{responsavel}}. Orc: {{qualificacao.orcamento}}";
    expect(renderTemplate(template, context, { audience: "customer" })).toBe(
      "Ola Ana, horario 10/09/2026 as 14:30 com  notas: . Consultor: . Orc: ",
    );
  });
});
