import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { buildContext, enrichLeadContext, runAutomationForEvent } from "@/lib/automation/engine";
import { renderTemplate } from "@/lib/automation/template";
import { getAction } from "@/lib/automation/actions";
import "@/lib/automation/actions/register-all";
import type { EventRow } from "@/lib/event-log/dispatcher";
import type { ActionCtx, ActionExecutor } from "@/lib/automation/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fusoValido } from "@/lib/tempo/fusos";

describe("buildContext, enrichLeadContext e protecoes de auditoria", () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-04T10:00:00Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  const orgId = "org-1111-2222";
  const leadId = "lead-3333-4444";
  const contactId = "contact-5555-6666";

  interface FakeAppt {
    [key: string]: unknown;
    id: string;
    organization_id: string;
    contact_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    time_zone: string;
    status: string;
    notes?: string;
    event_type_id?: string;
    owner_user_id?: string;
  }

  interface FakeLink {
    [key: string]: unknown;
    organization_id: string;
    lead_id: string;
    target_kind: string;
    target_id: string;
  }

  function criarMockAdmin(opts?: {
    appointments?: FakeAppt[];
    links?: FakeLink[];
    leadContactId?: string | null;
  }) {
    const appointmentsTable: FakeAppt[] = opts?.appointments ?? [
      // 0. Agendamento do contato (mas de OUTRO lead do mesmo contato):
      // Acontece antes de appt-link-next. Se os vinculos do lead forem ignorados,
      // a busca cairia erroneamente aqui.
      {
        id: "appt-outro-lead-do-contato",
        organization_id: orgId,
        contact_id: contactId,
        title: "Consulta de Outro Negocio",
        starts_at: "2026-09-09T14:00:00.000Z",
        ends_at: "2026-09-09T14:30:00.000Z",
        time_zone: "America/Sao_Paulo",
        status: "confirmed",
      },
      // 1. Vinculado, mas cancelado: DEVE ser ignorado
      {
        id: "appt-link-cancelled",
        organization_id: orgId,
        contact_id: contactId,
        title: "Consulta Cancelada",
        starts_at: "2026-09-08T10:00:00.000Z",
        ends_at: "2026-09-08T11:00:00.000Z",
        time_zone: "America/Sao_Paulo",
        status: "cancelled",
      },
      // 2. Vinculado e confirmado, mas do PASSADO: DEVE ser ignorado
      {
        id: "appt-link-past",
        organization_id: orgId,
        contact_id: contactId,
        title: "Consulta Passada",
        starts_at: "2026-08-01T10:00:00.000Z",
        ends_at: "2026-08-01T11:00:00.000Z",
        time_zone: "America/Sao_Paulo",
        status: "confirmed",
      },
      // 3. Vinculado, confirmado e futuro proximo: O UNICO ESPERADO
      {
        id: "appt-link-next",
        organization_id: orgId,
        contact_id: contactId,
        title: "Consulta Odontologica Proxima",
        starts_at: "2026-09-10T17:30:00.000Z",
        ends_at: "2026-09-10T18:00:00.000Z",
        time_zone: "America/Sao_Paulo",
        status: "confirmed",
        event_type_id: "type-1",
        owner_user_id: "user-1",
        notes: "Prefere cadeira 3 - nota interna",
      },
      // 4. Vinculado, confirmado, mas distante: NAO PODE vencer a proxima
      {
        id: "appt-link-distant",
        organization_id: orgId,
        contact_id: contactId,
        title: "Consulta Distante",
        starts_at: "2026-10-25T17:30:00.000Z",
        ends_at: "2026-10-25T18:00:00.000Z",
        time_zone: "America/Sao_Paulo",
        status: "confirmed",
      },
      // 5. Outro tenant: NUNCA pode ser retornado
      {
        id: "appt-other-org",
        organization_id: "tenant-alheio-9999",
        contact_id: contactId,
        title: "Consulta Outro Tenant",
        starts_at: "2026-09-09T17:30:00.000Z",
        ends_at: "2026-09-09T18:00:00.000Z",
        time_zone: "America/Sao_Paulo",
        status: "confirmed",
      },
    ];

    const linksTable: FakeLink[] = opts?.links ?? [
      { organization_id: orgId, lead_id: leadId, target_kind: "appointment", target_id: "appt-link-cancelled" },
      { organization_id: orgId, lead_id: leadId, target_kind: "appointment", target_id: "appt-link-past" },
      { organization_id: orgId, lead_id: leadId, target_kind: "appointment", target_id: "appt-link-next" },
      { organization_id: orgId, lead_id: leadId, target_kind: "appointment", target_id: "appt-link-distant" },
    ];

    return {
      auth: {
        admin: {
          getUserById: vi.fn().mockImplementation(async (id: string) => {
            if (id === "user-1") {
              return { data: { user: { user_metadata: { full_name: "Dr. Roberto" } } } };
            }
            return { data: null };
          }),
        },
      },
      from: vi.fn().mockImplementation((table: string) => {
        const filters: {
          eq: Array<[string, unknown]>;
          in: Array<[string, unknown[]]>;
          gte: Array<[string, unknown]>;
          order?: { col: string; ascending: boolean };
          limit?: number;
        } = {
          eq: [],
          in: [],
          gte: [],
        };

        const queryBuilder: Record<string, unknown> = {};

        queryBuilder.select = vi.fn().mockReturnValue(queryBuilder);
        queryBuilder.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
          filters.eq.push([col, val]);
          return queryBuilder;
        });
        queryBuilder.in = vi.fn().mockImplementation((col: string, list: unknown[]) => {
          filters.in.push([col, list]);
          return queryBuilder;
        });
        queryBuilder.gte = vi.fn().mockImplementation((col: string, val: unknown) => {
          filters.gte.push([col, val]);
          return queryBuilder;
        });
        queryBuilder.order = vi.fn().mockImplementation((col: string, cfg?: { ascending?: boolean }) => {
          filters.order = { col, ascending: cfg?.ascending ?? true };
          return queryBuilder;
        });
        queryBuilder.limit = vi.fn().mockImplementation((n: number) => {
          filters.limit = n;
          return queryBuilder;
        });

        function filtrarRows<T extends Record<string, unknown>>(rows: T[]): T[] {
          // Guarda multi-tenant: Toda consulta a tabelas tenantizadas DEVE incluir .eq("organization_id", orgId)
          const orgFilter = filters.eq.find(([c]) => c === "organization_id");
          if (!orgFilter || orgFilter[1] !== orgId) {
            throw new Error(`tenant_violation: consulta a tabela ${table} sem organization_id valido`);
          }

          let result = rows.slice();
          for (const [col, val] of filters.eq) {
            result = result.filter((r) => r[col] === val);
          }
          for (const [col, list] of filters.in) {
            result = result.filter((r) => list.includes(r[col]));
          }
          for (const [col, val] of filters.gte) {
            result = result.filter((r) => String(r[col]) >= String(val));
          }

          if (filters.order) {
            const { col, ascending } = filters.order;
            result.sort((a, b) => {
              const valA = String(a[col] ?? "");
              const valB = String(b[col] ?? "");
              return ascending ? valA.localeCompare(valB) : valB.localeCompare(valA);
            });
          }

          if (filters.limit !== undefined) {
            result = result.slice(0, filters.limit);
          }
          return result;
        }

        queryBuilder.maybeSingle = vi.fn().mockImplementation(async () => {
          if (table === "calendar_appointments") {
            const matching = filtrarRows(appointmentsTable);
            return { data: matching[0] ?? null, error: null };
          }
          if (table === "crm_lead_links") {
            const matching = filtrarRows(linksTable);
            return { data: matching[0] ?? null, error: null };
          }
          if (table === "crm_leads") {
            const matching = filtrarRows([
              {
                id: leadId,
                organization_id: orgId,
                title: "Consulta Implante",
                stage_id: "stage-1",
                pipeline_id: "pipe-1",
                owner_user_id: "user-1",
                contact_id: opts?.leadContactId !== undefined ? opts.leadContactId : contactId,
                status: "open",
                custom_fields: { segmento: "clinica", cidade: "Campinas" },
                created_at: "2026-09-01T10:00:00.000Z",
              },
              {
                id: "lead-lost-novo",
                organization_id: orgId,
                title: "Consulta Perdida Recente",
                stage_id: "stage-99",
                pipeline_id: "pipe-1",
                contact_id: contactId,
                status: "lost",
                created_at: "2026-09-02T10:00:00.000Z",
              },
              {
                id: "lead-open-antigo",
                organization_id: orgId,
                title: "Consulta Aberta Antiga",
                stage_id: "stage-1",
                pipeline_id: "pipe-1",
                contact_id: contactId,
                status: "open",
                created_at: "2026-08-01T10:00:00.000Z",
              }
            ]);
            return { data: matching[0] ?? null, error: null };
          }
          if (table === "contacts") {
            const matching = filtrarRows([
              {
                id: contactId,
                organization_id: orgId,
                name: "Clalber",
                phone_number: "+5511999999999",
              },
            ]);
            return { data: matching[0] ?? null, error: null };
          }
          if (table === "crm_stages") {
            const matching = filtrarRows([
              { id: "stage-1", organization_id: orgId, name: "Agendado", slug: "agendado" },
            ]);
            return { data: matching[0] ?? null, error: null };
          }
          if (table === "crm_pipelines") {
            const matching = filtrarRows([
              { id: "pipe-1", organization_id: orgId, name: "Funil Comercial" },
            ]);
            return { data: matching[0] ?? null, error: null };
          }
          if (table === "calendar_event_types") {
            const matching = filtrarRows([
              { id: "type-1", organization_id: orgId, name: "Consulta Odontologica" },
            ]);
            return { data: matching[0] ?? null, error: null };
          }
          if (table === "lead_state") {
            const matching = filtrarRows([
              {
                contact_id: contactId,
                organization_id: orgId,
                stage: "qualified",
                qualification: { budget: "5000", need: "Implante", timeline: "Urgente" },
                next_action: "Ligar para confirmar",
              },
            ]);
            return { data: matching[0] ?? null, error: null };
          }
          return { data: null, error: null };
        });

        // Suporte a await select() sem maybeSingle
        queryBuilder.then = vi.fn().mockImplementation((resolve) => {
          if (table === "crm_lead_links") {
            const matching = filtrarRows(linksTable);
            resolve({ data: matching, error: null });
            return;
          }
          if (table === "calendar_appointments") {
            const matching = filtrarRows(appointmentsTable);
            resolve({ data: matching, error: null });
            return;
          }
          if (table === "automation_rules") {
            const matching = filtrarRows([
              {
                id: "rule-e2e",
                organization_id: orgId,
                trigger_event: "lead.stage_changed",
                is_active: true,
                conditions: [],
                actions: [{ type: "send_whatsapp_message", config: { channel_session_id: "sess-1", template: "Sua consulta eh {{agendamento.data}}" } }],
                created_at: "2026-09-01T10:00:00.000Z",
              }
            ]);
            resolve({ data: matching, error: null });
            return;
          }
          resolve({ data: [], error: null });
        });

        return queryBuilder;
      }),
    } as unknown as SupabaseClient;
  }

  it("morde de verdade: seleciona estritamente o agendamento futuro mais proximo vinculado ao lead", async () => {
    const admin = criarMockAdmin();
    const eventRow: EventRow = {
      id: "event-1",
      organization_id: orgId,
      event_type: "lead.stage_changed",
      entity_kind: "crm_lead",
      entity_id: leadId,
      payload: { to_stage_id: "stage-1", from_stage_id: "stage-0" },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const ctx = await buildContext(admin, eventRow);
    await enrichLeadContext(admin, orgId, ctx.lead as Record<string, unknown>, ctx);

    // PROVA 1: Rejeitou cancelled, rejeitou past, rejeitou distant, pegou appt-link-next
    const appt = ctx.agendamento as Record<string, string>;
    expect(appt).toBeDefined();
    expect(appt.id).toBe("appt-link-next");
    expect(appt.titulo).toBe("Consulta Odontologica Proxima");
    expect(appt.data).toBe("10/09/2026");
    expect(appt.hora).toBe("14:30");
    expect(appt.profissional).toBe("Dr. Roberto");
    expect(appt.tipo).toBe("Consulta Odontologica");
  });

  it("fallback para o contato quando o lead nao tem agendamento futuro valido vinculado", async () => {
    // Lead com vinculo apenas para reuniao cancelada
    const admin = criarMockAdmin({
      links: [
        { organization_id: orgId, lead_id: leadId, target_kind: "appointment", target_id: "appt-cancelada" },
      ],
      appointments: [
        {
          id: "appt-cancelada",
          organization_id: orgId,
          contact_id: contactId,
          title: "Cancelada no Lead",
          starts_at: "2026-09-08T10:00:00.000Z",
          ends_at: "2026-09-08T11:00:00.000Z",
          time_zone: "America/Sao_Paulo",
          status: "cancelled",
        },
        // Reunião valida do contato (sem vinculo explicito com o lead)
        {
          id: "appt-contato-valida",
          organization_id: orgId,
          contact_id: contactId,
          title: "Reuniao Valida por Contato",
          starts_at: "2026-09-15T15:00:00.000Z",
          ends_at: "2026-09-15T15:30:00.000Z",
          time_zone: "America/Sao_Paulo",
          status: "confirmed",
        },
      ],
    });

    const eventRow: EventRow = {
      id: "event-2",
      organization_id: orgId,
      event_type: "lead.stage_changed",
      entity_kind: "crm_lead",
      entity_id: leadId,
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const ctx = await buildContext(admin, eventRow);
    await enrichLeadContext(admin, orgId, ctx.lead as Record<string, unknown>, ctx);

    // Deve ter feito fallback com sucesso para appt-contato-valida
    const appt = ctx.agendamento as Record<string, string>;
    expect(appt).toBeDefined();
    expect(appt.id).toBe("appt-contato-valida");
    expect(appt.titulo).toBe("Reuniao Valida por Contato");
  });

  it("protege contra vazamento de agendamento.profissional, notas, owner e qualificacao para cliente", async () => {
    const admin = criarMockAdmin();
    const eventRow: EventRow = {
      id: "event-3",
      organization_id: orgId,
      event_type: "lead.stage_changed",
      entity_kind: "crm_lead",
      entity_id: leadId,
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const ctx = await buildContext(admin, eventRow);
    await enrichLeadContext(admin, orgId, ctx.lead as Record<string, unknown>, ctx);

    // Mensagem interna: tudo acessivel
    const templateInterno =
      "Interno: {{nome}} com {{agendamento.profissional}} notas: {{agendamento.notas}} resp: {{responsavel}} orc: {{qualificacao.orcamento}}";
    const msgInterna = renderTemplate(templateInterno, ctx, { audience: "internal" });
    expect(msgInterna).toContain("Dr. Roberto");
    expect(msgInterna).toContain("Prefere cadeira 3 - nota interna");
    expect(msgInterna).toContain("5000");

    // Mensagem ao CLIENTE: profissional, atendente, notas, responsavel e qualificacao sao BLOQUEADOS
    const templateCliente =
      "Ola {{nome}}, sua consulta e {{agendamento.data}} as {{agendamento.hora}} com {{agendamento.profissional}} ({{agendamento.notas}}). Resp: {{responsavel}}. Orc: {{qualificacao.orcamento}}";
    const msgCliente = renderTemplate(templateCliente, ctx, { audience: "customer" });
    expect(msgCliente).toBe("Ola Clalber, sua consulta e 10/09/2026 as 14:30 com  (). Resp: . Orc: ");
  });

  it("gatilhos contact.tag_added e message.received associam o lead mais recente e enriquecem", async () => {
    const admin = criarMockAdmin();
    const eventRowContact: EventRow = {
      id: "event-4",
      organization_id: orgId,
      event_type: "contact.tag_added",
      entity_kind: "contact",
      entity_id: contactId,
      payload: { tag: "cliente-vip" },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const ctx = await buildContext(admin, eventRowContact);
    expect(ctx.contact).toBeDefined();
    // buildContext deve ter achado o lead mais recente do contato
    expect(ctx.lead).toBeDefined();
    expect((ctx.lead as { id: string }).id).toBe(leadId);

    await enrichLeadContext(admin, orgId, ctx.lead as Record<string, unknown>, ctx);
    expect(ctx.agendamento).toBeDefined();
    expect((ctx.agendamento as { id: string }).id).toBe("appt-link-next");
  });

  it("send_whatsapp_message aborta com skipped se o template exige agendamento mas o contexto nao possui", async () => {
    const action = getAction("send_whatsapp_message");
    expect(action).toBeDefined();

    const admin = criarMockAdmin();
    const actionCtx = {
      admin,
      organizationId: orgId,
      ruleId: "rule-1",
      ruleName: "Aviso agendamento",
      event: {
        id: "ev-1",
        organization_id: orgId,
        event_type: "lead.stage_changed",
        entity_kind: "crm_lead",
        entity_id: leadId,
        payload: {},
        metadata: {},
        consumed_by: [],
        attempts: 0,
        created_at: new Date().toISOString(),
      },
      context: {
        contact: {
          id: contactId,
          name: "Maria",
          phone_number: "+5511999999999",
          consent: {
            marketing: {
              granted: true,
              granted_at: new Date().toISOString(),
            },
          },
        },
        // agendamento propositalmente ausente
      },
      requestId: "req-1",
    };

    const config = {
      channel_session_id: "sess-1",
      template: "Ola {{nome}}, sua consulta e {{agendamento.data}} as {{agendamento.hora}}",
    };

    const res = await action!.execute(actionCtx as unknown as import("@/lib/automation/types").ActionCtx, config);
    expect(res.status).toBe("skipped");
    expect(res.detail).toEqual({ reason: "agendamento_ausente_no_contexto" });
  });

  it("garante que o fallback do contato filtra estritamente pelo contact_id correto (previne vazamento P1)", async () => {
    const admin = criarMockAdmin({
      links: [], // sem link
      appointments: [
        {
          id: "appt-outro-contato-mesma-org",
          organization_id: orgId,
          contact_id: "contact-OUTRO-9999", // OUTRO CONTATO
          title: "Consulta de Terceiro",
          starts_at: "2026-09-15T15:00:00.000Z",
          ends_at: "2026-09-15T15:30:00.000Z",
          time_zone: "America/Sao_Paulo",
          status: "confirmed",
        },
      ],
    });

    const eventRow: EventRow = {
      id: "ev-vazamento", organization_id: orgId, event_type: "lead.stage_changed", entity_kind: "crm_lead",
      entity_id: leadId, payload: {}, metadata: {}, consumed_by: [], attempts: 0, created_at: new Date().toISOString()
    };
    const ctx = await buildContext(admin, eventRow);
    await enrichLeadContext(admin, orgId, ctx.lead as Record<string, unknown>, ctx);
    
    // Nao pode pegar a consulta do terceiro!
    expect(ctx.agendamento).toBeUndefined();
  });

  // ─── O FUSO PODRE PRECISA PASSAR PELO MOTOR, NÃO PELA BIBLIOTECA ──────────
  //
  // A versão anterior deste teste afirmava `fusoValido("Fuso/Inexistente") ===
  // false` — isso mede a biblioteca, que já tem os testes dela, e não encosta
  // no `engine.ts`. Medido: com aquele teste no lugar, trocar a guarda por
  // `rawTz || FUSO_PADRAO` deixava os nove testes verdes.
  //
  // `calendar_appointments.time_zone` é `text` sem CHECK no banco, então um
  // valor podre é alcançável; `partesNoFuso` lança `RangeError` de propósito
  // (lib/agenda/fuso.ts) porque espera que quem chama já tenha validado. Sem a
  // guarda, esse throw sobe pelo `enrichLeadContext` e o evento inteiro morre.
  it("fuso invalido no banco nao derruba o enriquecimento: cai no padrao (P2)", async () => {
    const admin = criarMockAdmin({
      links: [
        { organization_id: orgId, lead_id: leadId, target_kind: "appointment", target_id: "appt-fuso-podre" },
      ],
      appointments: [
        {
          id: "appt-fuso-podre",
          organization_id: orgId,
          contact_id: contactId,
          title: "Consulta com fuso podre",
          starts_at: "2026-09-10T17:30:00.000Z",
          ends_at: "2026-09-10T18:00:00.000Z",
          time_zone: "Fuso/Inexistente",
          status: "confirmed",
        },
      ],
    });

    const eventRow: EventRow = {
      id: "event-fuso",
      organization_id: orgId,
      event_type: "lead.stage_changed",
      entity_kind: "crm_lead",
      entity_id: leadId,
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const ctx = await buildContext(admin, eventRow);
    // Se a guarda sair, esta linha lança RangeError e o teste reprova aqui.
    await enrichLeadContext(admin, orgId, ctx.lead as Record<string, unknown>, ctx);

    const ag = ctx.agendamento as Record<string, string>;
    // FUSO_PADRAO é America/Sao_Paulo (UTC-3, sem horário de verão desde 2019):
    // 17:30Z vira 14:30 local. Se o fuso podre fosse usado, não haveria número.
    expect(ag.hora).toBe("14:30");
    expect(ag.data).toBe("10/09/2026");
    // E a biblioteca continua sendo a fonte da decisão.
    expect(fusoValido("Fuso/Inexistente")).toBe(false);
  });

  it("teste e2e de runAutomationForEvent verifica que o enriquecimento roda antes das acoes (P0)", async () => {
    const admin = criarMockAdmin();
    // Injetamos um erro manual no insert do automation_rule_runs so para espiar os results
    let gravouStatus = "";
    admin.from = vi.fn().mockImplementation((table: string) => {
      const q = criarMockAdmin().from(table); // pega o mock base
      if (table === "automation_rule_runs") {
        q.insert = vi.fn().mockImplementation((row) => {
           // capturamos o status que o run_aggregator gravou
           gravouStatus = row.status;
           return { select: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: {id: "run-1"}, error: null})}) };
        });
      }
      if (table === "automation_rules") {
        q.update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) }); // mock update run_count
      }
      return q;
    });

    const eventRow: EventRow = {
      id: "ev-e2e", organization_id: orgId, event_type: "lead.stage_changed", entity_kind: "crm_lead",
      entity_id: leadId, payload: {}, metadata: {}, consumed_by: [], attempts: 0, created_at: new Date().toISOString()
    };

    // send_whatsapp_message vai tentar mandar usando {{agendamento.data}}.
    // Como enrichLeadContext VAI rodar, ele vai preencher e o status final sera partial ou failed dependendo de outras condicoes, 
    // mas se enrichLeadContext fosse codigo morto, agendamento seria vazio e o envio faria skip.
    // Pra garantir q nao pula, o status da acao q tenta enviar com template q tem agendamento vai dar failed (pq o mock da api recusa sem mock), ou success, 
    // MAS IMPORTANTE eh q nao de "skipped" por motivo "agendamento_ausente_no_contexto".
    
    // Pra ter certeza, vamos mockar getAction
    let acaoRecebeuAgendamento = false;
    
    // interceptamos na mao o executor
    // `ActionExecutor` exige `type` além de `execute` (lib/automation/types.ts:22).
    // Sem ele o dublê compila no vitest e reprova no `pnpm typecheck`, que é
    // check obrigatório do CI e NÃO é exercitado pela suíte.
    const mockExecutor: ActionExecutor = {
      type: "send_whatsapp_message",
      execute: vi.fn().mockImplementation(async (ctx: ActionCtx) => {
        if (ctx.context.agendamento) acaoRecebeuAgendamento = true;
        return { type: "send_whatsapp_message", status: "success" as const };
      }),
    };
    // gambiarra pra pegar na importacao local
    vi.spyOn(await import("@/lib/automation/actions"), "getAction").mockReturnValue(mockExecutor);

    await runAutomationForEvent(admin, eventRow);

    expect(acaoRecebeuAgendamento).toBe(true);
    expect(gravouStatus).toBe("success");
    vi.restoreAllMocks();
  });

  // ─── A ORDEM É UMA DECISÃO, E DECISÃO SEM TESTE VOLTA ─────────────────────
  //
  // `enrichLeadContext` roda ANTES de `evaluateConditions` de propósito: só
  // assim uma condição pode falar de etapa, funil, responsável, agendamento ou
  // qualificação — nenhuma dessas chaves existe no contexto que `buildContext`
  // devolve. Mover o enriquecimento para depois das condições é uma linha, não
  // quebra tipo nenhum, e faz TODA regra condicionada a esses campos parar de
  // casar em silêncio: o evento vira `no_match` e o operador vê a automação
  // simplesmente não acontecer.
  //
  // Medido: com o enriquecimento depois das condições, os outros nove testes
  // deste arquivo seguem verdes. Este é o único que reprova.
  it("a ORDEM importa: condicao sobre campo enriquecido so casa se o enriquecimento vier antes (P0)", async () => {
    const admin = criarMockAdmin();
    admin.from = vi.fn().mockImplementation((table: string) => {
      // O dublê expõe `then` (o await do PostgREST sem `.maybeSingle()`), que
      // não existe no tipo do builder real — daí o cast.
      const q = criarMockAdmin().from(table) as unknown as Record<string, unknown>;
      if (table === "automation_rules") {
        // A condição lê `stage.name`, que NÃO vem de `buildContext`.
        q.then = vi.fn().mockImplementation((resolve: (r: unknown) => void) => {
          resolve({
            data: [
              {
                id: "rule-ordem",
                organization_id: orgId,
                trigger_event: "lead.stage_changed",
                is_active: true,
                conditions: [{ field: "stage.name", op: "eq", value: "Agendado" }],
                actions: [
                  {
                    type: "send_whatsapp_message",
                    config: { channel_session_id: "sess-1", template: "Etapa {{etapa}}" },
                  },
                ],
                created_at: "2026-09-01T10:00:00.000Z",
              },
            ],
            error: null,
          });
        });
        q.update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });
      }
      if (table === "automation_rule_runs") {
        q.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "run-ordem" }, error: null }),
          }),
        });
      }
      return q;
    });

    let regraCasouEExecutou = false;
    const executor: ActionExecutor = {
      type: "send_whatsapp_message",
      execute: vi.fn().mockImplementation(async () => {
        regraCasouEExecutou = true;
        return { type: "send_whatsapp_message", status: "success" as const };
      }),
    };
    vi.spyOn(await import("@/lib/automation/actions"), "getAction").mockReturnValue(executor);

    const eventRow: EventRow = {
      id: "ev-ordem",
      organization_id: orgId,
      event_type: "lead.stage_changed",
      entity_kind: "crm_lead",
      entity_id: leadId,
      payload: {},
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const resultado = await runAutomationForEvent(admin, eventRow);

    expect(regraCasouEExecutou).toBe(true);
    expect(resultado.detail).not.toBe("no_match");
    vi.restoreAllMocks();
  });

  it("buildContext pega o lead open correto e com conversation link para message.received (P1 e P12)", async () => {
    const admin = criarMockAdmin({
      links: [
        { organization_id: orgId, lead_id: leadId, target_kind: "conversation", target_id: "conv-123" }
      ]
    });
    const eventRowMsg: EventRow = {
      id: "event-msg",
      organization_id: orgId,
      event_type: "message.received",
      entity_kind: "message",
      entity_id: "msg-999",
      payload: { contact_id: contactId, conversation_id: "conv-123" },
      metadata: {},
      consumed_by: [],
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const ctx = await buildContext(admin, eventRowMsg);
    expect(ctx.contact).toBeDefined();
    // A query acha o link conv-123 e associa o leadId!
    expect((ctx.lead as { id: string }).id).toBe(leadId);
  });

});
