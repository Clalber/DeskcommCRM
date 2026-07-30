---
type: current-state
project: DeskcommCRM
status: draft
last_updated: 2026-07-29
generated_by: auditoria documental (Claude Code) — leitura de código, HANDOFFs, plan/, loop/, CI
confidence: média-alta (métricas de código são CONFIRMADO; estado de épico vem dos HANDOFFs, que são auto-relatados)
---

# Estado atual — DeskcommCRM

Este documento existe porque "o que está pronto" estava espalhado em 5 `HANDOFF-*.md`
na raiz, `plan/progress.md`, `loop/checkpoints/`, `tasks/todo.md` e o roadmap do README —
sem lugar único. Um agente novo (ou o dono, depois de uma semana) não conseguia responder
"posso subir isso?" sem ler ~1500 linhas.

**Aviso de método:** o estado de épico abaixo vem dos HANDOFFs, que são *auto-relatados
pelas sessões que fizeram o trabalho*. Estão densos em evidência (outputs de teste,
screenshots), o que é bom sinal, mas nada aqui foi re-verificado por execução nesta
auditoria — a auditoria é read-only por instrução. Métricas de código, contagem de
arquivos, conteúdo de CI e cobertura de padrão **foram** verificados diretamente.

---

## 1. Números do repositório — CONFIRMADO

| Métrica | Valor |
|---|---|
| Arquivos TS/TSX em `app`+`lib`+`components`+`workers` | 879 |
| Route handlers (`app/api/**/route.ts`) | 149 |
| Migrations em `supabase/migrations/` | 60 arquivos, até `0067_org_memory` |
| Testes unitários (`*.test.ts(x)`) | 155 arquivos |
| Invariantes de banco (`tests/invariants/`) | ~31 arquivos |
| Specs E2E (`tests/e2e/`) | 17 |
| Documentos `.md` em `docs/` | 102 |
| Import cycles | **0** (graphify) |
| `console.log` fora de `lib/logger.ts` | **0** |
| `: any` / `as any` | 6 |

**Higiene de código é boa.** Zero ciclos de import, logger centralizado respeitado,
quase nenhum `any`. Os god nodes do grafo (`fail` 325 arestas, `createAdminClient` 323,
`ok` 305, `audit` 290, `requireRole` 230) são *helpers canônicos* — indicam convenção
sendo aplicada, não acoplamento acidental.

**Doutrina de migrations está sendo cumprida** — CONFIRMADO: `MANIFEST.md` cita as 60
migrations e `baseline.sql` tem 35 blocos de apêndice rotulados, cobrindo até `migration 0067`.
Os três artefatos (migration + baseline + manifest) andam juntos como a doutrina exige.

---

## 2. O que está entregue

Conforme o roadmap do README (INFERIDO como fiel — cada item tem código e testes
correspondentes localizados no repo):

- **Fundação & plataforma** — auth com MFA para admin, multi-tenancy com RLS + teste de
  isolamento, RBAC de 4 papéis, audit log append-only, onboarding de tenant.
- **Atendimento WhatsApp** — inbox de 3 painéis em tempo real, conexões WAHA multi-número,
  mídia via Storage, anti-banimento (throttle + jitter + janela de horário), STOP detection.
- **CRM & pedidos** — kanban com vocabulário configurável por nicho (fractional indexing),
  customer 360, contatos, tags, Nuvemshop.
- **IA nativa** — agentes com RAG por tenant (pgvector), sentiment, handoff IA→humano,
  budget por org, MCP server interno.
- **LGPD** — export e redact via workers, anonimização em cascata, consentimento auditado.
- **Self-host** — `hostgator-setup-kit`, `baseline.sql` auto-curativo, runbook de produção.
- **Webhooks & automação** — captação + regras QUANDO/SE/ENTÃO + gatilhos externos.
- **Operação visível** — transparência do motivo de retenção anti-ban, central de avisos,
  knobs de proteção de envio, propostas do flywheel com gate humano.

### Épico de Governança de Atendimento (G1–G6) — COMPLETO

CONFIRMADO em `plan/features.json` (31/31 features com `passes: true`) e
`loop/checkpoints/` (relatórios G1–G6 + os 6 arquivos `.approved`).
Guiado por 100+ invariantes de banco. Fechou em 2026-07-18.

Entregou: RBAC server-side em toda a API, atribuição e transferência auditadas
(IA como assignee de primeira classe), visibilidade por papel via RLS, métricas por
atendente, roteamento automático com fila e painel de gestão, e `docs/specs/14` —
o contrato de governança para agentes de IA externos.

---

## 3. O que está incompleto — por épico

| Épico | Estado relatado | O que falta |
|---|---|---|
| **Follow-up inteligente** (`HANDOFF.md`) | Ondas 1–7 ✅; Onda 8 **em andamento** (8.1 gatilho de silêncio ✅, 8.3 jornada E2E ✅) | gatilho `stage_change`, flywheel, e o fechamento do checklist DoD/PRD da 8.3 |
| **Casos humanos** (`HANDOFF-casos-humanos.md`) | Waves 1–6 ✅ e revisadas; **Wave 7 (prova E2E) PARCIAL** | conclusão da prova E2E — foi interrompida por limite semanal de API, não por bug. Código relatado verde |
| **Inbox multimodal** (`HANDOFF-inbox-multimodal.md`) | Ondas 0, 1, 2, 3, 3.1 ✅ com prova real (WhatsApp real, mídia real) | ondas 4–6 do épico de 6 ondas. **Bloqueios externos:** chave Google é de gateway (modelos fictícios, gemini real inacessível); credencial Anthropic ainda placeholder (`last4 1234`) — o agente multimodal foi provado **só em OpenAI/gpt-4o** |
| **Evolução do harness** (`HANDOFF-harness-evolution.md`) | **Fase 0, Task 1** concluída (2026-07-23) — o mais atrasado | praticamente todo o épico |
| **Fase FG / Vendaval** | Não iniciada | README: *"aguardando priorização do dono"*. Gatilho era a aprovação de G6, que já existe (`G6.approved`) — **A CONFIRMAR** se está liberada ou deliberadamente parada |

### Próximo no roadmap (não iniciado — CONFIRMADO no README)

MCP público · flywheel de auto-aprimoramento · templates por nicho (clínica,
imobiliária, infoproduto, serviços) · VTEX e Shopify via adapter · identity probabilística.

---

## 4. O que está quebrado ou frágil — CONFIRMADO

Estes são achados de código/config verificados nesta auditoria, não relatos.

### 4.1 O gate obrigatório de RLS não roda no CI 🔴

`.github/workflows/ci.yml` roda **só** `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`.
E `vitest.config.ts:12` **exclui explicitamente** `tests/invariants/**` e `tests/e2e/**`.

Consequência: os ~31 invariantes de banco — incluindo isolamento cross-tenant, os 100+
invariantes que guiaram o épico de governança, e o gate de `baseline.sql` install+update
do `scripts/test-db.sh` — **nunca rodam automaticamente**. `CLAUDE.md` chama isso de
"gate obrigatório no CI antes de merge". Hoje o gate depende de alguém lembrar de rodar
`pnpm test:db` na máquina.

Mesmo problema para os 17 E2E, entre eles `vps-fresh-onboarding.spec.ts` e
`vps-webhook-outbound-ssrf.spec.ts` — exatamente os P0 de primeira impressão que a
doutrina de QA Visual manda proteger.

### 4.2 `pnpm gov:verify` não é o comando único que aparenta ser 🟠

`gov:verify` = `typecheck && lint && test:unit`. Omite `test:db` e `test:e2e`. Um agente
que trate `gov:verify` verde como "pronto" vai declarar concluída uma mudança de schema
sem nunca ter testado RLS. O nome sugere cobertura total; o conteúdo não entrega.

### 4.3 Rate limit HTTP praticamente inexistente 🔴

`checkRateLimit` (`lib/ai/dispatcher/rate-limit.ts`) é chamado em **2** lugares:
o webhook público de captação e o dispatcher de IA. Sem proteção: `/login`, `/signup`,
`/team/accept-invite/:token`, os 9 crons, `/api/internal/*`, `/api/mcp`, webhooks WAHA
e Nuvemshop. Detalhe e impacto em [`threat-model.md`](threat-model.md).

### 4.4 Ambiente local de dev quebrado 🟠

`node_modules` tem 70 pacotes e **não tem `typescript` nem `eslint`** — `pnpm typecheck` e
`pnpm lint` falham com `MODULE_NOT_FOUND`. Resolve-se com `pnpm install` (não executado:
a auditoria é read-only). Vale como sinal: o estado verificável do repo hoje é
**não verificado localmente**.

### 4.5 `.env.example` incompleto 🟠

6 variáveis declaradas em `lib/env.ts` e ausentes do template — incluindo **três secrets**:
`IMPERSONATE_COOKIE_SECRET`, `INTERNAL_CRON_SECRET`, `LGPD_SIGNING_KEY`
(mais `LGPD_DPO_EMAIL`, `LGPD_EXPORT_EXPIRES_HOURS`, `NUVEMSHOP_ENABLED`).
Inverso: `SUPABASE_DB_URL` está no template e não em `lib/env.ts`.
Quem instala numa VPS não descobre que precisa delas até algo falhar. Viola o item 9 do DoD.

### 4.6 `ARCHITECTURE.md` tinha três afirmações falsas 🟡

Corrigidas nesta auditoria: dizia Next.js 15 (é 16.2), "rate limit sliding window"
(é fixed-window, e só em 2 pontos), e "`Idempotency-Key` para POSTs de criação" (existe
em **1** rota). Documentação que promete garantia inexistente é pior que documentação
ausente — um agente confia e não implementa.

### 4.7 Sem proteção automática contra vazamento de secret 🟡

Não há gitleaks/trufflehog no CI, nem pre-commit hook (`.husky`/`.pre-commit-config.yaml`
ausentes). `.gitignore` cobre `.env*` corretamente — a proteção é só essa camada.

### 4.8 Raiz do repositório poluída 🟡

11 PNGs de evidência de teste commitados na raiz + 5 `HANDOFF-*.md`. A própria doutrina
manda evidência visual em `.superpowers/evidence/` (onde, de fato, a maior parte já está).

### 4.9 Divergências de estado nos HANDOFFs 🟡

`HANDOFF.md` afirma "Migration seguinte livre: **0058**" e lista pendência de aplicar
`0057` no dev DB — mas o repo já tem migrations até **0067**. É deriva natural de trabalho
em branches paralelas, e mostra o risco de tratar HANDOFF como fonte da verdade de schema.
**A CONFIRMAR:** se a pendência de dev DB de `0057` ainda existe.

---

## 5. Riscos técnicos abertos

1. **80 dos 149 handlers usam `createAdminClient`** (service role, bypassa RLS). A regra
   "filtre `organization_id` manualmente, nunca do body" não tem *enforcement automático* —
   é revisão humana. Um erro aqui é vazamento cross-tenant, o pior modo de falha do produto.
2. **Fallback in-memory do rate limit** (`rate-limit.ts:23`): sem Upstash configurado — o
   estado normal de um primeiro deploy — o limite passa a ser por processo. Silencioso além
   de um `logger.warn`.
3. **`ffmpeg` precisa existir na imagem do worker** para a derivação de vídeo (Onda 3.1).
   Relatado como contingência em aberto no HANDOFF — **A CONFIRMAR** se `Dockerfile.worker`
   já inclui.
4. **Dependência de credencial de terceiro para provar IA**: Anthropic com credencial
   placeholder e Google com chave de gateway inválida significam que o caminho multimodal
   está provado em um único provider (OpenAI), apesar de o design ser model-agnostic.
5. **`lib/agent-engine/agent/inbound-turn.ts` com 1595 linhas** — quase 3× o segundo maior
   arquivo de lógica, e é o hot path do produto.

---

## 6. Perguntas para o responsável

1. A Fase FG (Vendaval) está liberada? `G6.approved` existe, mas o README diz "aguardando priorização".
2. Qual épico é prioridade para "iniciar minimamente o sistema": fechar Wave 7 de Casos
   Humanos, Onda 8 de Follow-up, ou estabilizar o harness (CI + rate limit) antes de tudo?
3. A credencial Anthropic e a chave direta do Google AI Studio serão providenciadas? Isso
   bloqueia provar o runtime multi-provider.
4. `docs/vendaval-fusion-plan.md` e `docs/vendaval-vps-deploy-comandos.md` ainda são
   válidos ou são resíduo?
5. Os 5 `HANDOFF-*.md` da raiz devem migrar para `docs/superpowers/handoffs/`, ou a
   posição na raiz é intencional (visibilidade para a sessão que abre)?
6. `pnpm gov:verify` deve passar a incluir `test:db` (exige Docker em toda máquina de dev)
   ou fica um `verify:full` separado?

---

## 7. Não pôde ser confirmado

- Se `pnpm typecheck` / `lint` / `test:unit` passam **hoje** — `node_modules` incompleto e
  a auditoria não instala dependências.
- Se os invariantes e E2E passam hoje — exigiriam Docker, banco e app rodando.
- Estado real do banco de dev/produção — nenhuma conexão foi aberta.
- Números de teste citados nos HANDOFFs (533 unit, 236 db, 547 unit em outra data) — são
  auto-relatados em datas diferentes e não reconciliam entre si. Contei **155 arquivos**
  de teste, o que é compatível com centenas de casos, mas não valida nenhum número específico.
- Cobertura de teste (%) — `coverage` está configurado no Vitest, mas nenhum relatório foi gerado.
- Se `docs/architecture/` cumpre o "mapa vivo" exigido pelo item 13 do DoD (só contém o
  diagrama do agent-turn).
