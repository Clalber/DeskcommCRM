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

## Atritos de coordenação (e como foram resolvidos)

Três colisões que só existem porque cinco frentes trabalham ao mesmo tempo. Ficam registradas
porque a próxima pessoa que orquestrar isto vai encontrá-las de novo.

| # | Colisão | Resolução |
|---|---|---|
| C1 | As quatro waves escreveriam no mesmo `HANDOFF-ia-360.md` | Cada uma escreve `HANDOFF-ia-360-W<N>.md`; o Maestro consolida. **Avisado tarde demais para a W3**, que já havia escrito no arquivo comum — merge dela precisa de resolução manual |
| C2 | **Números de migration colidindo.** Último na `main` é `0099`; W1 e W3 escolheram `0100` **as duas**, W4 pegou `0101`, e W2 pegou `0102` com timestamp mais antigo que todas — o número ficava fora da ordem em que o `psql` aplica | Maestro realocou por ordem de timestamp: **W2→0100, W1→0101, W3→0102, W4→0103** |
| C3 | Quatro waves acrescentando bloco no fim do mesmo `supabase/baseline.sql` | Conflito garantido no merge. Regra dada a todas: **manter os dois blocos**, nunca escolher um lado — escolher apaga a mudança de schema da outra wave e o clone self-host nunca a recebe |
| C4 | **Cinco waves rodando E2E ao mesmo tempo.** Porta se resolve com `E2E_PORT`, mas o **banco é compartilhado**: o próprio `playwright.config.ts` registra que os specs usam a mesma organização, os mesmos usuários e o mesmo banco, e que rodar em paralelo produziu 10 a 15 falhas de interferência que sumiam quando o spec rodava isolado | **Fase de E2E serializada pelo Maestro.** Cada wave pede a vez e espera liberação; portas alocadas (W1 3011, W2 3012, W3 3013, W4 3014). O estrago de ignorar isto não seria perder tempo, seria **vermelho falso** — que ninguém interpreta e que na prática desliga o gate |

| C5 | **Conflito que pede combinação, não escolha.** W2 tirou `reter` da lista `PACOTES_VAZIOS_CONHECIDOS`; a W5 tirou `evoluir`. O git vai conflitar naquela linha e **os dois lados estão errados** | Resolução correta é a lista **vazia** — ambos os pacotes foram preenchidos. É o conflito mais perigoso que existe: o git mostra dois lados plausíveis, escolher um compila, os testes do lado escolhido passam, e o trabalho do outro **some sem erro nenhum**. A segunda guarda do mesmo arquivo (`dívida declarada não esconde pacote já preenchido`) acusa se a escolha for errada |

### Regra da prova em tela (vale para todas)

**Escrever o spec não é prova.** Só conta E2E **executado**, com a saída real do Playwright e
evidência visual salva. Item do plano não fecha sem isso — é o DoD 12 do `CLAUDE.md` e o critério
de aceite declarado em cada item `IA360-W*`.

Estado em `57384a0`: **nenhuma wave executou E2E ainda.** W3 e W4 têm spec escrito e não
commitado; W1, W2 e W5 não têm spec.

**Numeração de bugs:** cada wave numerou a partir de `BUG-01` no próprio arquivo, então há colisão
entre elas. A numeração canônica é a desta seção; a origem de cada um está declarada.

---

## Medições em aberto

### O invariante vermelho da W4 — controle rodado, caso NÃO fechado

A W4 reportou `tests/invariants/followup-turn-bridge.test.ts` falhando na suíte completa
(`expected 2 to be 1` em `tick2.advanced`) e passando isolado no mesmo SHA, atribuindo a
interferência de estado entre invariantes — declarando explicitamente que era hipótese.

**Controle rodado pelo Maestro** em `5e8a547`, base, árvore limpa, `TEST_DB_PORT=54391`:
`62 arquivos, 413 passed | 1 skipped, exit 0`. O invariante **não falhou**.

**O que o controle decide:** derruba a hipótese de defeito determinístico pré-existente na base.

**FECHADO — o flaky é pré-existente na base.** Caracterização por repetição, mesma base
`5e8a547`, árvore limpa, portas `54401/54402/54403`:

| Rodada | Resultado |
|---|---|
| controle inicial | `413 passed \| 1 skipped` |
| 1 | `413 passed \| 1 skipped` |
| 2 | **`1 failed \| 412 passed \| 1 skipped`** |
| 3 | `413 passed \| 1 skipped` |

**1 vermelho em 4 rodadas da base, sem nenhuma mudança de wave.** O fenômeno existe no tronco —
a W4 não o introduziu, e a W2 (dona do domínio de follow-up) também não, já que a base não tem
mudança de nenhuma das duas.

**Limitação da minha medição, declarada:** filtrei o output pela linha de sumário e **perdi o nome
do teste** que falhou na rodada 2. Sei que 1 falhou; **não** sei se foi um dos dois de follow-up que
a W4 viu. Para saber, é preciso repetir capturando a saída inteira — e com taxa observada de ~25%,
são várias rodadas.

**Comparação que NÃO dá para fazer:** base 1/4 contra W4 2/2 parece diferença, mas com esse número
de amostras não distingue nada. O que está estabelecido é a existência na base, não a taxa.

**O que o controle inicial NÃO decidia:** um run verde não refuta flaky. Se o fenômeno é interferência de
estado, ele é não-determinístico por definição — uma foto verde na base contra uma foto vermelha na
W4 não distingue *causado pela W4* de *flaky que calhou de cair naquela rodada*. Fica em aberto
até a segunda rodada da W4; se repetir no mesmo ponto, o próximo passo é rodar o invariante isolado
~5× em cada branch.

**Ruído descartado:** o `ERROR: duplicate key ... uniq_system_update_runs_dispatched` que aparecia
no log da W4 também aparece **na base com a suíte verde** — é algum teste exercitando conflito, não
sintoma.

**Correção de método (minha).** Levantei como alternativa que duas waves rodando `test:db`
concorrentes estivessem no mesmo banco, porque `followup-turn-bridge` é o domínio da W2. A hipótese
tinha **dois** defeitos, não um:

1. `scripts/test-db.sh` tem `set -euo pipefail` e container com nome único por PID — se a porta
   estiver ocupada o `docker run` falha e o script morre; a segunda wave não lê o banco da primeira.
2. Pior: o worktree da W4 está em **outra branch** e não contém nenhuma mudança de follow-up da W2.
   Ela nunca poderia afetá-lo.

Registrado porque era a explicação **mais interessante** das duas, e a interessante é justamente a
que passa sem ser medida — teria desviado o trabalho da W4 para caçar um fantasma, vestida de
achado de maestro.

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

**Correção** (`bddeeb6`): `lib/ai/runtime/agent.ts` passa `run.agent_id`.

> ⚠️ **ESTA CORREÇÃO FOI SUPERADA — não a use como referência.** A W2 achou o mesmo defeito de
> forma independente e resolveu melhor: em vez de trocar o campo, **separou** `id` (correlação de
> audit, varia por runtime) de `agent_id` (a linha em `ai_agents`, a única que pode ir para uma
> coluna com FK), tocando também `lib/api/handlers/types.ts`, `lib/leads/activity-emitter.ts` e o
> harness.
>
> A minha perde por três razões, medidas no diff dela:
> 1. quebra a correlação do run no audit — `metadata.actor_id` passaria a ser o agente;
> 2. **conserta 1 dos 3 produtores de `actor.id`.** Existem três, e eu só tinha visto dois: o
>    runtime nativo põe o id do run, o token MCP externo põe o run do escopo `agent_run:` ou o id
>    do próprio token, e o envio do motor chega a pôr a string literal `'agent-engine'`. Meu
>    conserto deixava os dois últimos quebrados — e eu teria declarado o bug resolvido;
> 3. a dela degrada com segurança: sem `agent_id` a linha entra como sistema e perde a **autoria**;
>    a minha, ao errar, perdia a **linha inteira** na FK.
>
> **Resolução do conflito em `lib/ai/runtime/agent.ts`: ficar com o lado da W2, inteiro.**

**Medição da base após as duas correções**, em `9fc1cc3` com árvore estável durante toda a
execução: `pnpm test:unit` → 225 arquivos, 1948 testes, exit 0. `pnpm typecheck` limpo.

> Nota de método: a primeira medição desta suíte foi **descartada** — eu havia sabotado
> `lib/mcp/tools/leads.ts` enquanto ela rodava. Número medido contra disco em movimento não vale,
> mesmo quando o resultado é o mesmo.

### BUG-03 — "devolver ao atendimento automático" não devolvia nada · CORRIGIDO

- **Achado em** `99cd0fc` pelo terminal **Maestro** (W3), ao extrair a regra de
  `POST /api/v1/conversations/[id]/reactivate-bot` para `lib/escalacao/retomada.ts`.
- **Confirmado** por medição independente do Maestro do épico: `grep` por `force_human` em
  `lib/`, `app/` e `workers/` devolve **zero** escritas de `false` em toda a base.
- **Pré-existente na `main`.**

**Sintoma observado.** A rota respondia `{ reactivated: true }` e o agente continuava mudo para
sempre.

**Causa raiz.** A passagem para humano liga **três** travas e a rota soltava uma.
`contacts.force_human = true` não era escrito de volta para `false` em lugar nenhum do repo — e é
lido pelo worker (`skip("force_human")`), pela guarda `isLeadInHandoff` (NO-OP antes de qualquer
chamada de modelo) e por `before-send.ts` (`(is_blocked or force_human) as stopped`, que veta todo
envio).

**Correção** (`c0db6aa`): solta o dono pela regra existente, limpa as marcas de passagem e limpa
`force_human`. **Prova:** invariante contra Postgres real rodando a função de guarda **real**,
mostrando os dois estados (`true` com só o silêncio limpo, `false` com `force_human` junto).

### BUG-04 — a volta sumia da linha do tempo do negócio · CORRIGIDO

Achado pela W3. `crm_lead_activities` tinha `handoff_triggered` e **nenhum** tipo para a volta: na
timeline o cliente saía para uma pessoa e nunca voltava — meia continuidade, que se lê como
continuidade. Corrigido com o tipo `handoff_resolved` emitido via constante compartilhada
(`c0db6aa`).

### BUG-05 — o agente não tinha como registrar nada num chamado · CORRIGIDO

Achado pela W3. O CHECK de `agent_case_events.kind` não tinha valor honesto para "o agente
registrou o que aconteceu depois"; reusar `lead_provided` ou `human_replied` faria a linha do tempo
do chamado mentir sobre quem agiu — e é desse registro que sai o resumo entregue ao próximo
atendente. Corrigido com migration + apêndice no baseline + MANIFEST, incluindo sabotagem do tipo
"a migration não chegou ao baseline" (`c0db6aa`).

### BUG-06 — o gate confundia restrição deliberada com acidente · CORRIGIDO

- **Defeito meu (Maestro), introduzido em `bddeeb6`** ao consertar o BUG-02.
- **Revelado** pela W3, que marcou `crm_resume_ai_attendance` como `manager` de propósito.

**Sintoma observado.** Rodei o gate de alcançabilidade contra o catálogo da W3 e ele acusou
`crm_resume_ai_attendance` junto com as dívidas reais — reprovando uma escolha **correta**.

**Causa raiz.** A regra que escrevi ("toda capacidade é alcançável pelo agente") é falsa. Algumas
**não devem** estar ao alcance dele: `inbound-turn.ts:607` registra a regra dura de que só o
humano/CRM libera um handoff, e um agente capaz de chamar aquela tool se auto-liberaria do próprio
handoff.

**Correção** (`5f9dd97`): o catálogo ganhou `apenasHumano`, e o gate passou a caçar só a restrição
**não declarada** — a que ficou fora do alcance por descuido e falha em silêncio. Entrou junto uma
segunda asserção contra a combinação pior: tool marcada como operada por pessoa **mas alcançável
pelo agente**, que diz uma coisa na tela e faz outra.

**Prova:** sabotado nas duas direções — inalcançável sem a marca reprova a primeira asserção; marca
mentirosa em tool alcançável reprova a segunda. Revertido, 4 verdes.

**Consequência de produto** (repassada à W1): capacidade `apenasHumano` precisa aparecer diferente
na tela, e uso zero dela **não** é sinal de capacidade ociosa — é o esperado.

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
