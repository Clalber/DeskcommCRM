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

### Wave 1 — o painel do humano · CONCLUÍDA

**Entregue por:** Arquiteto (worktree `DeskcommCRM-ia360-w1-painel`, branch `feat/ia-360-w1-painel`)
**Commits:** `ddb53bd` (rota) · `259567e` (tela) · `032f038` (observabilidade) · `41e61b2` (prova em tela + mapa vivo)

#### O que mudou

**1. A rota serve a camada do humano** (`ddb53bd`)
`app/api/v1/mcp/tools/route.ts` montava a resposta só a partir dos handlers, que carregam a metade
do MODELO. Agora `lib/mcp/tools/catalogo-servido.ts` junta as duas metades por `name` e **recusa
servir handler sem entrada no catálogo** — servir com rótulo vazio empurra o defeito para a tela do
dono da clínica, onde ele aparece como um id monoespaçado dentro de um card. Campos novos no wire:
`rotulo`, `explicacao`, `o_que_toca`, `risco`, `pacotes`.

**Para as outras waves:** o teste `tests/unit/catalogo-servido.test.ts` prende a bijeção nos DOIS
sentidos. Entrada no catálogo sem handler faz o `tool_ids` aceitar o id, o agente ser publicado e o
runtime descartar a capacidade em silêncio (`pickToolsFromMcp` faz `if (!def) continue`) — o humano
vê ligado na tela algo que nunca chega ao modelo. Se você adicionar entrada, adicione o handler.

**2. A tela por jornada** (`259567e`)
`ToolPicker.tsx` reconstruído. Caminho padrão = os 6 pacotes; modo avançado = checkbox por
capacidade com a ficha (rótulo, explicação, o que toca, risco) e o `name` técnico só ali.

A regra **não** mora no componente: `lib/mcp/tools/selecao-por-pacote.ts` é função pura sobre listas
de nome. O que ela prende, além de `entraPorPacote`:
- desligar um pacote leva junto a capacidade `critico` **dele** — declarar que a jornada acabou e
  ficar com o direito de enviar WhatsApp é a pior surpresa possível (falha fechado);
- o que pertence a outro pacote ainda ligado sobrevive, senão desligar um esvaziaria o vizinho;
- pacote só com capacidade crítica nunca aparece "ligado".

O teto de 20 saiu de número mágico em três lugares para `TETO_TOOLS_POR_AGENTE`, que
`lib/ai/agents/validation.ts` importa: o teto que a tela mostra é o que o servidor recusa.

**3. O uso das capacidades, que era log morto** (`032f038`)
`api_audit_log` registrava `mcp.tool_called` desde a Spec 11 e **nenhuma tela lia**. Nova aba
**Capacidades** na página do agente: por capacidade, usos, falhas, quantos vieram de teste, última
vez — e a recomendação do que fazer (invariante 5). `fn_agent_tool_usage` (migration **0103** +
apêndice no baseline + MANIFEST) faz a agregação no banco; o elo é
`api_audit_log.request_id = ai_agent_runs.id`.

Medido em pg17 com 708.020 linhas de audit (10,2% tool calls) e 36.000 runs, melhor de 3:
**345,7 ms** sem janela no lado do audit · **224,0 ms** com a janela nos dois lados · **165,0 ms**
com um índice parcial dedicado — o índice **não** foi adotado (audit é append-only de escrita
altíssima; 60 ms numa aba não pagam manutenção em todo INSERT). A medição está na migration como
linha de base.

#### Evidência observada (SHA `032f038` + prova em tela no working tree)

```
pnpm typecheck                     → limpo
pnpm lint                          → 0 erros, 170 avisos (a MESMA linha de base da Wave 0;
                                     nenhum aviso em arquivo desta wave)
pnpm vitest (4 arquivos da wave)   → 44 passed
pnpm test:unit (suíte inteira)     → 1986 passed | 1 failed (1987) — ver nota abaixo
pnpm test:db                       → 419 passed | 1 skipped (63 arquivos)
                                     install (ON_ERROR_STOP=1) + update do baseline verdes
E2E em tela (Playwright, chromium) → 5 passed (45,2s)
```

**Sobre o 1 vermelho do `test:unit`, sem arredondar para verde.** Em três rodadas
da suíte inteira nesta máquina, falharam **arquivos diferentes a cada vez**
(`lib/ui/icons`, `TeamMembersClient`, `_mapping`, `composer-emoji`) — todos testes
de componente estourando tempo (43s, 17s, 15s, 4,5s) enquanto build, docker e E2E
disputavam a máquina. Cada um **passa isolado** (medido: os três primeiros juntos,
23 passed em 15,7s; `composer-emoji`, 1 passed em 5,9s). E nenhum deles referencia
qualquer arquivo desta wave — `grep` por `selecao-por-pacote|catalogo-servido|
uso-de-capacidades|UsoDasCapacidades|ToolPicker|AgentTabs|AgentForm|mcp/tools`
nos quatro: nenhuma ocorrência. Os 4 arquivos de teste da wave passaram em todas
as rodadas. **Não afirmo suíte 100% verde nesta máquina**; afirmo que o vermelho
é de carga e não desta wave, e que o CI (máquina dedicada) é quem dá a palavra.

Evidência visual versionada em `evidence/ia-360-w1/`:
![capacidades por jornada](evidence/ia-360-w1/w1-capacidades-por-jornada.png)
![pacote ligado sem o envio](evidence/ia-360-w1/w1-pacote-ligado-sem-envio.png)
![modo avançado](evidence/ia-360-w1/w1-modo-avancado.png)
![uso das capacidades](evidence/ia-360-w1/w1-uso-das-capacidades.png)

#### Sabotagem (verde de primeira não prova nada)

| Sabotagem | O que reprovou |
|---|---|
| `entraPorPacote` → sempre `true` (unit) | 6 de 19, incl. "ligar Atender não dá direito de enviar WhatsApp" |
| `desligarPacote` não leva a crítica | 1 de 19 |
| `estadoDoPacote` contando a crítica | 2 de 19 |
| junção servindo ficha vazia em vez de lançar | 1 de 7 |
| entrada removida do catálogo | arquivo inteiro reprova no import |
| precedência dos sinais invertida | os 2 casos de precedência |
| `fn_agent_tool_usage` sem filtro de agente (Postgres real) | 6 de 6 |
| idem, sem filtro de `action` | 4 de 6 |
| idem, `em_teste` fixo em 0 | 1 de 6 |
| **`entraPorPacote` → `true` + rebuild + E2E NA TELA** | **o caso do WhatsApp reprovou na tela** |

A última é a que importa: unitário prova a função, só a tela prova que a função é a que o clique
chama.

#### Achados (dois defeitos meus, pegos pela prova em tela)

1. **A recomendação afirmava uma causa que nem sempre é a certa.** "Usada sem estar ligada" dizia
   "é o caso do pedido de ajuda humana" — verdade para o handoff auto-injetado, mentira para uma
   capacidade que foi **desligada depois** de já ter sido usada. Corrigido para nomear as duas
   hipóteses. Só apareceu porque o E2E rodou contra um cenário onde a segunda hipótese existia.
2. **Um teste meu passou por sorte.** O caso de persistência lia o estado inicial do DOM antes de a
   configuração carregar, comparava `[]` com `[]` e passava — e ainda deixava o cenário do próximo
   caso diferente. Agora espera o consumo do teto estabilizar e devolve o cenário pelo seed.

#### Coisas que a W1 NÃO conseguiu provar (declarado de propósito)

- **A recusa do teto de 20 não é alcançável pela tela hoje.** O catálogo tem 16 capacidades e
  ligar tudo dá menos que 20 — o caminho de recusa existe, tem teste unitário, e só vira alcançável
  quando W2/W3/W4 entregarem. O que a tela prova hoje é o **consumo** ("11 de 20").
- **`lib/database.types.ts` não foi regenerado** para incluir `fn_agent_tool_usage` (exigiria
  conexão ao projeto Supabase remoto). A rota usa o admin client, que não é tipado — não há erro de
  tipo hoje, mas quem regenerar os types deve incluí-la.

#### Duas coisas que atrapalham quem for rodar E2E depois

- **Configurar exige `admin`, não `manager`.** `page.tsx` passa `readOnly` quando `role < admin`, e
  o formulário inteiro nasce desabilitado (o switch resolve para `<button disabled>`). É RBAC
  pré-existente; o spec loga como admin com TOTP. A aba **Capacidades** (observabilidade) é de
  `manager`, e a rota foi escrita com essa régua de propósito.
- **As quatro waves compartilham o mesmo Supabase local.** `seed-e2e-credentials.ts` **rotaciona o
  factor TOTP do admin** e reescreve `.e2e-creds.json`. Quando outra wave roda esse seed, o segredo
  da sua sessão fica inválido e o login de admin falha com "MFA falhou em 2 tentativas" — sintoma
  que não parece o que é. Rode o seed imediatamente antes do E2E.
- **`update` do baseline emite `ERROR: relation "idx_crm_leads_org_expected_close_overdue" already
  exists`** (pré-existente, não desta wave: é um `create index` sem `if not exists` no apêndice). Não
  derruba o `update.sh` porque ele roda sem `ON_ERROR_STOP`, mas aparece como erro vermelho no
  terminal de quem atualiza um clone. Vale um forward-fix de uma linha para quem estiver mexendo
  nessa área.

---

## Bugs encontrados

*(nenhum ainda — esta seção é alimentada por todos os terminais)*

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
