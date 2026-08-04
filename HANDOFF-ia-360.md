# HANDOFF — IA 360

> Documento **vivo**. Alimentado a cada progresso, cada bug encontrado e cada bug corrigido.
> Toda afirmação declara o **SHA curto** de onde foi medida. Número sem SHA não compara.
>
> Contrato e motivos: `docs/handoffs/BRIEFING-ia-360.md` — leia antes de tocar em código.
> Branch: `feat/ia-360-mcp` · Base: `origin/main` = `687716a`
> Worktree do Maestro: `/Users/rafaelmelgaco/DeskcommCRM-ia360`

---

## Linha de base medida (SHA `687716a`, árvore limpa)

| Medida | Valor |
|---|---|
| Tools no catálogo MCP | 16 (9 leitura, 6 escrita, 1 handoff) |
| Tabelas no `baseline.sql` (dump + apêndice) | ~100 |
| Tabelas alcançáveis pelas 16 tools | ~8 |
| Tools de follow-up (anti-morte, invariante 4) | **0** |
| Operações de arquivamento/encerramento expostas à IA | **0** |
| Tools nativas do engine fora do catálogo e invisíveis na tela | 7 |
| Teto de tools por agente | 20 (`lib/ai/agents/validation.ts`) |
| `pnpm typecheck` | limpo |
| `pnpm lint` | 0 erros / 170 avisos (pré-existentes) |

**As 7 tools sombra** (existem em `lib/agent-engine/agent/inbound-turn.ts`, o humano não vê nem
configura): `get_lead_context`, `search_knowledge`, `send_message`, `update_lead_state`,
`save_lead_note`, `get_lead_note`, `request_human_handoff`.

**Achado arquitetural que barateia tudo:** `lib/mcp/tools/catalog.ts` é **fonte única** para três
consumidores — o MCP externo (`/api/mcp`), o runtime nativo da tela (`lib/ai/runtime/tools.ts`) e o
harness de vendas (`lib/agent-engine/edge/crm/mcp-tools.ts`). Uma capacidade nova entra em **um**
lugar e serve os três.

**Achado que muda a estratégia:** existem ~140 rotas em `app/api/v1/` que já contêm a regra de
negócio. A tool é fachada fina sobre elas (Decisão 4 do briefing), nunca reimplementação.

---

## Progresso

### Wave 0 — contrato do catálogo · CONCLUÍDA

**Entregue por:** Maestro (terminal "Assistente e Testes")

O que mudou:

- `lib/mcp/tools/pacotes.ts` (novo) — camada de apresentação client-safe: os 6 pacotes por
  jornada (`atender`, `vender`, `reter`, `escalar`, `organizar`, `evoluir`), os 3 níveis de risco
  (`seguro`, `atencao`, `critico`) e a regra `entraPorPacote()` — capacidade `critico` nunca é
  ligada por pacote, exige marcação explícita do humano.
- `lib/mcp/tools/catalog.ts` — `McpToolCatalogEntry` ganhou `rotulo`, `explicacao`, `oQueToca`,
  `risco`, `pacotes`. As 16 tools existentes preenchidas em pt-BR. Nenhum `name` renomeado
  (Decisão 3 — contrato de wire preservado).
- `tests/unit/catalogo-tools-leigo-friendly.test.ts` (novo) — o gate mecânico do pilar 3.

**Evidência observada:**

```
pnpm vitest run tests/unit/catalogo-tools-leigo-friendly.test.ts
 Test Files  1 passed (1)
      Tests  53 passed (53)

pnpm typecheck  → limpo
pnpm lint       → 0 errors, 170 warnings (todos pré-existentes na main)
```

**Sabotagem (verde de primeira não prova nada).** Apliquei três defeitos de propósito e confirmei
que cada um reprova no teste certo:

| Sabotagem | Teste que reprovou |
|---|---|
| `rotulo: "crm_search_contacts"` (identificador técnico vazado) | `crm_search_contacts tem rotulo em portugues de gente` |
| `explicacao: "Abre o lead."` (curta + jargão) | `crm_get_lead explica o efeito, nao o codigo` |
| tool de leitura anunciada como `risco: "critico"` | `o risco anunciado ao humano bate com a categoria tecnica` |

Resultado: `Tests 3 failed | 50 passed (53)`. Revertido em seguida; verde restaurado.

**Dívida declarada no próprio teste:** os pacotes `reter` (Não perder o cliente) e `evoluir`
(Aprender e evoluir) nascem **vazios** — não existe nenhuma capacidade de follow-up nem de
conhecimento no catálogo. É exatamente o buraco que este épico existe para fechar, e é a violação
mais grave da linha de base: o invariante 4 da doutrina ("nada morre sem próximo passo") não tem
como ser cumprido por um agente que não consegue agendar um retorno.

O teste lista essa dívida explicitamente e tem uma **segunda guarda** que reprova se a lista
envelhecer — se a wave entregar as tools e ninguém tirar o pacote da dívida, o teste acusa.

---

### Orquestração — quatro waves em paralelo (a partir de `99cd0fc`)

Cada wave tem worktree próprio (dois implementadores no mesmo worktree é a regra que mais quebra
trabalho em paralelo) e escreve num arquivo de catálogo exclusivo — o agregador
`lib/mcp/tools/catalogo/index.ts` custa **uma linha de import e uma de spread** por domínio.

| Wave | Pacote | Dono | Worktree / branch | Despacho |
|---|---|---|---|---|
| W1 | painel do humano | Arquiteto | `-ia360-w1-painel` / `feat/ia-360-w1-painel` | `docs/handoffs/waves/W1-painel-do-humano.md` |
| W2 | `reter` | DevVivo | `-ia360-w2-reter` / `feat/ia-360-w2-reter` | `docs/handoffs/waves/W2-nao-perder-o-cliente.md` |
| W3 | `escalar` | Maestro | `-ia360-w3-escalar` / `feat/ia-360-w3-escalar` | `docs/handoffs/waves/W3-passar-para-humano.md` |
| W4 | `organizar` | MaestroConexoes | `-ia360-w4-organizar` / `feat/ia-360-w4-organizar` | `docs/handoffs/waves/W4-organizar-a-operacao.md` |

Itens no plano compartilhado: `IA360-W1` … `IA360-W4`, com critério de aceite provado em tela.

**Registro de progresso:** cada wave escreve em `HANDOFF-ia-360-W<N>.md` no próprio worktree; o
Maestro consolida aqui. Correção aplicada logo após o despacho — o pedido original mandava os
quatro escreverem neste arquivo, o que garantiria conflito de merge em todo hunk, e conflito
resolvido no automático é onde um achado some em silêncio.

**Vigia armado:** monitor persistente lendo **artefato** (SHA de cada branch, árvore suja) além do
estado dos terminais — terminal `Idle` não prova que nada foi feito, e `Busy` não prova que algo
saiu. Cobre também a parada: 30 minutos sem commit novo em nenhuma wave emitem alerta, porque
silêncio de monitor é indistinguível de "está rodando".

### Waves ainda não despachadas

| Wave | Pacote / escopo | Estado |
|---|---|---|
| W5 | `evoluir` — conhecimento, skills, propostas do flywheel, memória da org | pacote **vazio**; assumida pelo Maestro |
| W6 | leads completos (notas, timeline, score, checkpoints), contatos, conversas, pedidos e produtos | aguarda terminal livre |

---

## Bugs encontrados e corrigidos

Formato de cada entrada: onde foi achado (SHA + por quem + executando o quê), o **sintoma
observado** (não a hipótese), a causa raiz provada, a correção com SHA, e a prova de que o teste
reprova antes e passa depois.

### BUG-02 — capacidade de escrita inalcançável pelo agente, falhando calado · CORRIGIDO

- **Achado em** `99cd0fc` por **MaestroConexoes** (W4), montando o catálogo de operação.
- **Confirmado** por remedição independente do Maestro antes de aceitar.
- **Pré-existente na `main`** — não veio deste épico.

**Sintoma observado.** `crm_create_lead`, `crm_update_lead`, `crm_move_lead_stage` e
`crm_send_whatsapp_message` declaram `requiresRole: "manager"`. O agente publicado recebe papel
`agent`, literal e fixo, nos dois caminhos que montam o contexto MCP
(`lib/ai/runtime/agent.ts:341-366` e `lib/agent-engine/edge/crm/mcp-tools.ts:68`).
`ROLE_RANK.agent` (2) `< ROLE_RANK.manager` (3), então `ensureRole` lança 403 — e
`wrapMcpTool` devolve `{ error }` **ao modelo** em vez de estourar. O modelo lê o erro, segue
conversando, e **nada aparece na tela do humano** dizendo que a capacidade que ele ligou não
existe na prática.

**Causa raiz — divergência, não política de segurança.** As quatro rotas HTTP equivalentes exigem
`agent`, todas:

| Rota | Papel exigido |
|---|---|
| `app/api/v1/leads/route.ts` | `agent` |
| `app/api/v1/leads/[id]/route.ts` | `agent` |
| `app/api/v1/leads/[id]/move/route.ts` | `agent` |
| `app/api/v1/messages/route.ts` | `agent` |

Um atendente humano com papel `agent` cria lead, move etapa e manda mensagem pela tela. A IA, com
o **mesmo papel**, não podia nenhuma delas. É a Decisão 4 do briefing violada em produção: a IA e
o humano operando por regras diferentes, e o sistema mentindo para um dos dois.

**Correção** (`bddeeb6`): `requiresRole` alinhado para `agent` nas quatro
(`lib/mcp/tools/leads.ts`, `lib/mcp/tools/messages.ts`) — restaura a paridade que o produto já
pratica, não afrouxa nada. E o silêncio, que era a parte pior: recusa por papel **não é erro de
execução, é defeito de configuração**; `lib/ai/runtime/tools.ts` passa a emitir `logger.error`
próprio para `McpAuthError` antes de devolver ao modelo.

**Prova.** `tests/unit/capacidade-alcancavel-pelo-agente.test.ts` (escrito na W4, trazido para a
base, lista de dívidas esvaziada). Sabotado com `crm_create_lead` de volta em `manager`:
`1 failed | 2 passed`. Revertido: `3 passed`.

### BUG-01 — a IA agia e a timeline não registrava · CORRIGIDO

- **Achado em** `99cd0fc` por **MaestroConexoes** (W4). Confirmado por remedição independente.
- **Pré-existente na `main`.**

**Sintoma observado.** `crm_lead_activities.actor_agent_id` tem FK para `ai_agents(id)`
(`supabase/baseline.sql:7293`) e `lib/leads/activity-emitter.ts:131` deriva a autoria de
`actor.id`. O runtime nativo passava `run.id` — que não existe em `ai_agents`. Toda atividade
emitida por ele quebrava com `23503` e **falhava baixo, em silêncio**.

**Causa raiz.** Dois caminhos discordando sobre o que `actor.id` significa: o harness sempre usou
o id do **agente** (`mcp-tools.ts:68`), o runtime nativo usava o id do **run**.

**Correção** (`bddeeb6`): `lib/ai/runtime/agent.ts` passa `run.agent_id`. O run continua
rastreável por `ctx.requestId` e pelo scope `agent_run:<id>`, e o audit não é afetado —
`lib/mcp/audit.ts` grava `actor_id` em metadata livre, não em coluna com FK.

**Medição da base após as duas correções**, em `9fc1cc3` com árvore estável durante toda a
execução: `pnpm test:unit` → 225 arquivos, 1948 testes, exit 0. `pnpm typecheck` limpo.

> Nota de método: a primeira medição desta suíte foi **descartada** — eu havia sabotado
> `lib/mcp/tools/leads.ts` enquanto ela rodava. Número medido contra disco em movimento não vale,
> mesmo quando o resultado é o mesmo.

---

## Decisões tomadas no caminho

| # | Decisão | Motivo |
|---|---|---|
| D1 | Pacotes de capacidade em vez de 60 checkboxes | 60 tools degradam a escolha do modelo e destroem a tela do leigo |
| D2 | Arquivar/anonimizar, nunca `DELETE` físico | apagar lead cascateia mensagens e destrói histórico (anti-pattern 7) |
| D3 | Rótulo é camada, `name` é contrato de wire | renomear quebra agentes publicados em VPS de clientes |
| D4 | Tool é fachada fina sobre a regra já existente | IA e humano têm que operar pela **mesma** regra, senão o sistema mente para um dos dois |
| D5 | Gate do pilar 3 é teste mecânico, não comentário | `typecheck` e `lint` passam com comentário falso dentro |
| D6 | Teste do catálogo em `tests/unit/` e não `tests/invariants/` | é puro, não precisa de Postgres — feedback rápido no job `verify` do CI |
