---
type: index
project: DeskcommCRM
status: draft
last_updated: 2026-07-29
generated_by: auditoria documental (Claude Code)
confidence: alta (inventário de arquivos é CONFIRMADO; agrupamento temático é INFERIDO)
---

# Índice da documentação — DeskcommCRM

Mapa dos ~102 documentos do repositório. Existe porque a documentação cresceu em
20 pastas sem ponto de entrada: sem este índice, humano e agente não acham o que
já foi decidido e reescrevem por cima.

**Regra de precedência quando dois docs discordam:**
`CLAUDE.md` (doutrina) > `docs/specs/` (contrato técnico) > `docs/prd/` (intenção) >
`HANDOFF-*.md` (estado de sessão) > README. Se achou divergência, corrija a fonte
de menor precedência e registre.

---

## 1. Comece por aqui

| Doc | Para quê |
|---|---|
| [`README.md`](../README.md) | O que é, quickstart de 5 min, stack, roadmap. Também em [EN](../README.en.md) / [ES](../README.es.md) |
| [`VISION.md`](../VISION.md) | Posicionamento, por que self-host, para quem |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Arquitetura em 1 página |
| [`AGENTS.md`](../AGENTS.md) | Contrato para agentes de código (qualquer ferramenta) |
| [`CLAUDE.md`](../CLAUDE.md) | **Doutrina não-negociável.** Convenções, anti-patterns, Definition of Done |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Como contribuir |
| [`docs/current-state.md`](current-state.md) | **O que está pronto, incompleto e quebrado hoje** |

## 2. Produto e intenção

| Doc | Conteúdo |
|---|---|
| [`prd/00-prd-master.md`](prd/00-prd-master.md) | PRD mestre — visão, escopo MVP, KPIs, restrições |
| [`prd/01-prd-platform-base.md`](prd/01-prd-platform-base.md) | Auth, tenancy, RBAC, framework LGPD |
| [`prd/02-prd-customer-360.md`](prd/02-prd-customer-360.md) | Customer 360 + identity resolution determinística |
| [`prd/03-prd-whatsapp-waha.md`](prd/03-prd-whatsapp-waha.md) | Canal WhatsApp, anti-banimento, janela 24h |
| [`prd/04-prd-pipeline-attendance.md`](prd/04-prd-pipeline-attendance.md) | Kanban, atendimento, tickets, handoff |
| [`prd/05-prd-ai-rag-handoff.md`](prd/05-prd-ai-rag-handoff.md) | IA conversacional, RAG por tenant, sentiment |
| [`prd/06-prd-nuvemshop-lgpd.md`](prd/06-prd-nuvemshop-lgpd.md) | Integração Nuvemshop + webhooks LGPD |
| [`business-rules/00-business-rules-catalog.md`](business-rules/00-business-rules-catalog.md) | **Catálogo de regras de negócio** — fonte da verdade fora do código |
| [`presentation/pitch-deck.md`](presentation/pitch-deck.md) | Pitch |

## 3. Contrato técnico (specs)

Detalham schema SQL e payloads exatos. **Consulte antes de modelar qualquer coisa.**

| Spec | Domínio |
|---|---|
| [`specs/01`](specs/01-spec-platform-base.md) | Plataforma base — tenancy, RLS, RBAC, API, audit |
| [`specs/02`](specs/02-spec-customer-360.md) | Customer 360 |
| [`specs/03`](specs/03-spec-whatsapp-waha.md) | WAHA — fila outbound, warm-up, spinning, crons |
| [`specs/04`](specs/04-spec-pipeline-attendance.md) | Pipeline e atendimento |
| [`specs/05`](specs/05-spec-ai-rag-handoff.md) | IA, RAG, gatilhos de handoff |
| [`specs/06`](specs/06-spec-nuvemshop-lgpd.md) | Nuvemshop + LGPD |
| [`specs/07`](specs/07-spec-events-workers.md) | **`event_log`, workers, claim atômico, backoff/DLQ** |
| [`specs/08`](specs/08-spec-deploy-observability.md) | Deploy e observabilidade |
| [`specs/09`](specs/09-spec-frontend-backend-integration.md) | Integração front/back |
| [`specs/10`](specs/10-spec-ai-agents-runtime.md) | Runtime dos AI Agents |
| [`specs/11`](specs/11-spec-mcp-server-internal.md) | MCP server interno + catálogo de tools |
| [`specs/12`](specs/12-spec-ai-agents-ui.md) | UI dos AI Agents |
| [`specs/13`](specs/13-spec-governanca-atendimento.md) | Governança de atendimento (épico G1–G6) |
| [`specs/14`](specs/14-contrato-governanca-agentes-externos.md) | Contrato para agentes de IA externos |
| [`specs/15`](specs/15-spec-casos-humanos.md) | Casos humanos (IA delega a humano) |
| [`specs/RECONCILIATION-LOG.md`](specs/RECONCILIATION-LOG.md) | Log de reconciliação entre specs |

## 4. Doutrina e arquitetura

| Doc | Conteúdo |
|---|---|
| [`doctrine/sistema-vivo.md`](doctrine/sistema-vivo.md) | **Doutrina do Sistema Vivo** — 5 invariantes + Living System Checklist (item 13 do DoD) |
| [`architecture/agent-turn.html`](architecture/agent-turn.html) | Diagrama do turno do agente (inbound → guardrails → outbound) |
| [`research/architecture-diagrams.md`](research/architecture-diagrams.md) | Diagramas de arquitetura |
| [`research/reference-synthesis.md`](research/reference-synthesis.md) | Arquitetura herdada da referência WAHA |
| [`research/followup-reference-mining.md`](research/followup-reference-mining.md) | Pesquisa do motor de follow-up |
| [`threat-model.md`](threat-model.md) | **Superfície de ataque real do self-host** |

## 5. Design system

[`design-system/README.md`](design-system/README.md) é o ponto de entrada (v1.0, 5 escolhas
visuais lockadas: paleta Sage, Atkinson Hyperlegible, densidade aerada, Phosphor duotone,
IBM Plex Mono). Numerados `00`–`09`: overview, tokens, paleta, tipografia, densidade,
iconografia, componentes, motion, voice & tone, **anti-patterns**.
Fluxo de tela em `design-system/screen-flow/` (jornadas, clickflows, máquinas de estado,
acessibilidade).

## 6. Operar e instalar

| Doc | Conteúdo |
|---|---|
| [`SETUP.md`](SETUP.md) | Guia completo de env vars e setup local |
| [`deploy-selfhost/README.md`](deploy-selfhost/README.md) | Self-host genérico |
| [`deploy-hostgator/README.md`](deploy-hostgator/README.md) | VPS HostGator (`install.sh`, `backup.sh`, `reset-mfa.sh`) |
| [`DEPLOY-CHECKLIST.md`](DEPLOY-CHECKLIST.md) | Checklist de deploy |
| [`ATUALIZANDO.md`](ATUALIZANDO.md) | `update.sh`, `restore.sh`, `healthcheck.sh` |
| [`runbooks/waha-hostgator.md`](runbooks/waha-hostgator.md) | Runbook do WAHA em produção |
| [`runbooks/ai-credentials-rotation.md`](runbooks/ai-credentials-rotation.md) | Rotação de credenciais de IA |
| [`../SECURITY.md`](../SECURITY.md) | Política de reporte de vulnerabilidade |

## 7. Testes e QA

| Doc | Conteúdo |
|---|---|
| [`testing/user-journey-map.md`](testing/user-journey-map.md) | **Mapa de jornadas vivo** — casos, prioridade `[P0]`, achados. Atualizar sempre |
| [`testing/HANDOFF-vps-qa.md`](testing/HANDOFF-vps-qa.md) | Receita do ambiente fresco estilo VPS |
| [`harness-audit.md`](harness-audit.md) | **Auditoria do harness** — 20 itens + nível de maturidade |
| [`../tests/e2e/README.md`](../tests/e2e/README.md) | Como rodar os E2E |

## 8. Execução — planos, épicos, handoffs

Documentação de *processo*. Alta rotatividade; trate como estado, não como contrato.

- [`stories/epics/`](stories/) — épicos e stories (`MASTER.md` = plano por epic/wave)
- [`superpowers/plans/`](superpowers/) e `superpowers/specs/` — planos e designs datados por onda
- [`superpowers/handoffs/`](superpowers/) — handoffs de sessão
- Raiz do repo: `HANDOFF.md` (follow-up), `HANDOFF-casos-humanos.md`,
  `HANDOFF-harness-evolution.md`, `HANDOFF-inbox-multimodal.md`, `HANDOFF-operacao-visivel.md`
- [`../plan/`](../plan/) — backlog do gov-loop (`features.json`, `phases.md`, `progress.md`)
- [`../loop/`](../loop/) — máquina do gov-loop (`LOOP.md`, `CHECKPOINT.md`, `checkpoints/G1..G6-report.md`)
- [`../tasks/todo.md`](../tasks/todo.md) — workflow de construção original (Fase 0 → PRD → specs)

## 9. Grafo de conhecimento

`graphify-out/` — grafo do repositório (7310 nós, 17705 arestas, 538 comunidades).
Consulte via skill `graphify` antes de varrer código bruto. `GRAPH_REPORT.md` traz
god nodes, hyperedges e comunidades. **Gerado — não editar.**

---

## Lacunas conhecidas deste índice

- `docs/vendaval-fusion-plan.md` e `docs/vendaval-vps-deploy-comandos.md` referem-se a uma
  integração ("Vendaval") cujo status é **A CONFIRMAR** — README a lista como *Fase FG,
  aguardando priorização do dono*.
- `docs/evidence/` e `docs/diagrams/` existem mas não foram inventariados neste passe.
- `docs/architecture/` contém só o diagrama do agent-turn; a doutrina (`CLAUDE.md`, DoD item 13)
  pede que o "mapa vivo" da arquitetura reflita toda peça nova com ≥2 arestas — **NÃO IDENTIFICADO**
  se isso está sendo cumprido.
