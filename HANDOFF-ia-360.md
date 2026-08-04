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

### Wave 4 — Organizar a operação · EM ANDAMENTO

**Terminal:** MaestroConexoes · worktree `/Users/rafaelmelgaco/DeskcommCRM-ia360-w4-organizar`
· branch `feat/ia-360-w4-organizar` · base `99cd0fc` (contém `origin/main` = `687716a`;
`git log HEAD..origin/main` vazio, medido antes de começar).

#### Marco 1 — a operação de etapa saiu da rota, e a configuração ganhou autoria (`6d6ea0e`, árvore limpa)

- `lib/leads/stage-operations.ts` (novo) — `lerFunil`, `criarEtapa`, `atualizarEtapa`,
  `arquivarEtapa`. A regra e, principalmente, **a ordem das escritas** (desmarcar a etapa de
  ganho antiga antes de marcar a nova; mover os negócios antes de arquivar) estavam dentro do
  `route.ts`. Com o agente também organizando o funil, duas superfícies escreveriam na mesma
  tabela por caminhos diferentes — Decisão 4 do briefing. As duas rotas de etapa ficaram só
  com transporte; `app/api/v1/pipelines/[id]/stages/_funil.ts` foi absorvido e removido.
- `lib/api/recusa.ts` (novo) — `respostaDeRecusa()`: `ApiError` do domínio → `Response`. Erro
  que não é `ApiError` **sobe**: traduzi-lo para um 500 educado apagaria o stack trace.
- `lib/operacao/autoria.ts` + **migration 0101** — `last_change_actor_kind` (`user|ai|system`,
  com CHECK) e `last_change_at` em `crm_stages`, `webhook_sources`, `automation_rules`.
  Migration + apêndice idempotente no `baseline.sql` + linha no MANIFEST, os três juntos.

**Evidência observada:**

```
npx vitest run app/api/v1/pipelines
 Test Files  5 passed (5)
      Tests  95 passed (95)     ← 8 delas reprovaram primeiro, pela autoria a mais no patch

npx tsc --noEmit → exit 0
```

**Por que a autoria virou coluna e não um feed de audit log.** O `api_audit_log` já registra
tudo — e **nenhuma tela de configuração o lê**. Log que não aparece é log morto (doutrina §3).
Com a coluna, o estado e a autoria do estado saem na mesma consulta que a tela já faz.

**Por que NÃO há coluna de "qual agente".** Ver BUG-01: `Actor.id` para `ai_agent` significa
coisas diferentes em cada caminho de execução. Uma FK para `ai_agents(id)` alimentada dali
seria verdadeira num caminho e recusaria a escrita no outro.

**Sabotagem do gate novo** (`tests/unit/capacidade-alcancavel-pelo-agente.test.ts`):

| Sabotagem | Resultado |
|---|---|
| tirar `crm_move_lead_stage` da lista de dívida | `1 failed \| 2 passed` — acusou a que faltava |
| fingir `PAPEL_DO_AGENTE_PUBLICADO = "admin"` | `2 failed \| 1 passed` — as duas guardas acusaram |

Restaurado: `3 passed`.

---

## Bugs encontrados

### BUG-01 — `Actor.id` de `ai_agent` é o run num caminho e o agente no outro
- **Achado em:** `99cd0fc`, por MaestroConexoes (W4), lendo os três montadores de `McpContext`
  antes de desenhar a coluna de autoria.
- **Sintoma observado:** `crm_lead_activities.actor_agent_id` **tem FK** para `ai_agents(id)`
  (`supabase/baseline.sql`, bloco da 0071). `lib/leads/activity-emitter.ts:131` grava
  `agentId: actor.id`. Mas `lib/ai/runtime/agent.ts:346` monta `actor.id = run.id` — id de
  `ai_agent_runs` (a linha vem de `.from("ai_agent_runs")`, e o próprio arquivo usa
  `run.agent_id` em outro ponto). Já `lib/agent-engine/edge/crm/mcp-tools.ts:67` monta
  `actor.id = agentConfig.agentId`, que é o certo. `lib/mcp/auth.ts:63` usa o run do scope, ou
  o id do token como fallback.
- **Consequência:** toda atividade de lead emitida por tool chamada pelo **runtime nativo**
  tenta gravar um `actor_agent_id` que não existe em `ai_agents` → `23503`. A emissão de
  atividade falha BAIXO por doutrina, então isso some sem alarme de usuário.
- **Estado:** **não corrigido nesta wave** — o conserto é em `lib/ai/runtime/agent.ts`, tocado
  por outras waves; corrigir aqui geraria conflito e o efeito atravessa o épico inteiro.
  Contornado: a autoria da configuração (0101) grava a **espécie** do ator, nunca um id de
  agente. Registrado para o Maestro decidir onde entra.

### BUG-02 — capacidade de escrita que o humano liga e o agente não alcança
- **Achado em:** `99cd0fc`, por MaestroConexoes (W4), medindo com
  `tests/unit/capacidade-alcancavel-pelo-agente.test.ts` (`3 passed`, lista exata bate).
- **Sintoma observado:** `crm_create_lead`, `crm_update_lead`, `crm_move_lead_stage` e
  `crm_send_whatsapp_message` declaram `requiresRole: "manager"`. O papel de um agente
  publicado é `"agent"` **literal e fixo** nos dois caminhos que montam o contexto
  (`lib/ai/runtime/agent.ts:342` e `lib/agent-engine/edge/crm/mcp-tools.ts:66`), e
  `lib/ai/runtime/mcp_token.ts:85` grava `"role:agent"` sem parâmetro para variar.
  `ensureRole` compara por `ROLE_RANK` → 403.
- **Por que passa despercebido:** `lib/ai/runtime/tools.ts:92` devolve o erro **ao modelo**
  em vez de estourar ("keeps the loop alive"). O agente recebe
  `{ error: "Role 'agent' insufficient (required: 'manager')" }`, segue conversando, e nada
  aparece na tela do humano dizendo que a ferramenta que ele ligou não existe na prática.
- **Estado:** **não corrigido nesta wave, por decisão consciente.** Subir o papel do token
  efêmero é mexer no modelo de permissão, que o despacho da W4 põe explicitamente fora de
  escopo — e errar para cima aqui daria ao agente poder que o humano não sabe que concedeu.
  A dívida está declarada no teste com guarda de envelhecimento: quando for consertada, a
  segunda asserção reprova até a lista ser limpa.
- **Impacto no épico:** é o pilar 1 pela metade em outro eixo. Nenhuma tool de escrita nova
  desta wave é usável por um agente publicado enquanto isto não for decidido. **Precisa do
  Maestro.**

Formato de cada entrada:

```
### BUG-NN — <título curto>
- **Achado em:** SHA, por quem, executando o quê
- **Sintoma observado:** o que se vê na tela / no output (não a hipótese)
- **Causa raiz:** o porquê, provado
- **Correção:** arquivo:linha + SHA do fix
- **Prova do fix:** teste que reprova antes e passa depois
```

---

## Bugs corrigidos

*(nenhum ainda)*

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
