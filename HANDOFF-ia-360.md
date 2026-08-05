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

#### Marco 2 — as 15 capacidades de `organizar` (`9ccec11`, árvore limpa)

`lib/mcp/tools/catalogo/operacao.ts` (novo, meu) + duas linhas no agregador, handlers em
`lib/mcp/tools/operacao.ts`, regra em `lib/operacao/*`.

| # | capacidade | categoria · risco |
|---|---|---|
| 1 | `crm_list_stages` — ver as etapas de um funil | read · seguro |
| 2 | `crm_create_stage` — criar etapa no funil | write · atencao |
| 3 | `crm_update_stage` — renomear ou reordenar uma etapa | write · atencao |
| 4 | `crm_archive_stage` — arquivar uma etapa do funil | write · **critico** |
| 5 | `crm_list_tags` — ver os marcadores em uso | read · seguro |
| 6 | `crm_list_message_templates` — ver as respostas prontas | read · seguro |
| 7 | `crm_render_message_template` — preencher uma resposta pronta | read · seguro |
| 8 | `crm_list_webhook_sources` — ver as entradas automáticas de contatos | read · seguro |
| 9 | `crm_list_webhook_source_events` — ver o que chegou por uma entrada | read · seguro |
| 10 | `crm_create_webhook_source` — criar uma entrada automática | write · **critico** |
| 11 | `crm_set_webhook_source_active` — ligar/desligar uma entrada | write · **critico** |
| 12 | `crm_list_automation_rules` — ver as regras automáticas | read · seguro |
| 13 | `crm_list_automation_runs` — ver o que as regras dispararam | read · seguro |
| 14 | `crm_set_automation_rule_active` — ligar/desligar uma regra | write · **critico** |
| 15 | `crm_list_team_members` — ver quem trabalha na empresa | read · seguro |

Catálogo: **16 → 31 tools**. O pacote `organizar` saiu de 2 para 16 capacidades.

**A régua de `critico` que usei** (o gate mecânico não distingue `atencao` de `critico`): *o efeito
acontece quando ninguém está olhando?* Renomear etapa muda o que o usuário vê na hora e ele desfaz
na tela → `atencao`. Ligar regra/entrada muda o comportamento do sistema para todos os eventos
futuros e o efeito sai da empresa → `critico`. Arquivar etapa mexe em onde os negócios estão
parados → `critico`.

**O que o agente deliberadamente NÃO pode**, e por quê:

| não pode | por quê |
|---|---|
| criar/editar/apagar regra automática | ligar o que um humano escreveu é reversível e ele sabe o que a regra faz; deixá-lo ESCREVER a ação é deixá-lo escolher para qual endereço externo a empresa manda dados |
| criar resposta pronta | o texto sai em nome da marca, e nenhuma tela distingue o modelo revisado do inventado |
| escrever no vocabulário canônico de marcadores | `organizations.settings.canonical_conversation_tags` tem rota de leitura e **nenhuma tela** para ver/mudar — um escritor ali violaria o invariante 6 ("toda configuração tem superfície"). O defeito real (o agente inventar `cliente-vip` quando já existe `vip`) é curado por `crm_list_tags` |
| mudar papel de alguém | RBAC, fora de escopo por decisão do despacho |
| apagar entrada automática | Decisão 2 do briefing — desligar resolve, apagar leva a configuração do cliente junto |

**Decisão de vocabulário:** o despacho sugeria "aviso automático" para `webhook_source`. Usei
**"entrada automática de contatos"** — a peça não avisa ninguém, ela RECEBE gente de fora, e um
rótulo que descreve errado confunde mais que o termo técnico. Sem jargão da lista proibida.

**Evidência observada:**

```
npx vitest run tests/unit/catalogo-tools-leigo-friendly.test.ts   → 101 passed
npx vitest run tests/unit/operacao-do-agente.test.ts              →  19 passed
npx vitest run tests/unit/capacidade-alcancavel-pelo-agente.test.ts →  5 passed
npx tsc --noEmit → exit 0 · npx eslint lib/operacao → 0 problemas
pnpm test:db → install ok · update ok · 412 passed | 1 failed (ver "Medições" abaixo)
```

**Sabotagem** (`tests/unit/operacao-do-agente.test.ts`, cinco defeitos aplicados um a um):

| Sabotagem | Teste que reprovou |
|---|---|
| tirar `eq("organization_id")` da validação do funil | `funil de OUTRA organização → recusa e NENHUMA escrita` |
| deixar `actions` cru vazar na leitura da regra | `regra automática sai sem a config das ações` |
| devolver `payload_parsed` no recebimento | `recebimento devolve os NOMES dos campos` |
| chumbar a autoria como `"user"` | `regra ligada pelo AGENTE grava autoria 'ai'` |
| esconder as lacunas do modelo preenchido | `sem o dado, denuncia a lacuna` |

Cada uma: `1 failed | 18 passed`. Restaurado: `19 passed`.

Sabotagem do gate de papel (`capacidade-alcancavel-pelo-agente`): baixar o papel de
`crm_set_automation_rule_active` para `agent` → reprova; mint gravando `role:manager` → reprova o
controle positivo; nome órfão na lista de exceções → reprova. Restaurado: `5 passed`.

#### Marco 3 — provado pela tela, com receiver HTTP real (`277f676` + ajustes do spec)

`tests/e2e/agente-organiza-operacao.spec.ts` dirige o **frontend**, logado como manager real, e
chama as capacidades pelo **HTTP do MCP** (`POST /api/mcp` com Bearer carregando
`actor:ai_agent`) — não pelo handler em processo, porque é o transporte que carrega o ator que
decide a autoria que a tela vai mostrar.

```
E2E_PORT=3031 npx playwright test tests/e2e/agente-organiza-operacao.spec.ts
  1 passed (18.0s)   ·   exit 0
```

O que ficou provado, em ordem:

1. **O agente cria uma etapa** → ela aparece em `/app/settings/tenant/pipelines` na posição 9 do
   funil, e o campo `data-autoria="ai"` mostra **"alterado pelo assistente há 2 segundos"**. As
   oito etapas de fábrica aparecem **sem selo** — silêncio honesto para o que ninguém mediu.
   Evidência: `evidence/ia-360-w4/w4-etapa-criada-pelo-agente.png`.
2. **O agente liga uma regra escrita por um humano** → `/app/webhooks` mostra o cartão com o
   badge **"Ativa"** e, abaixo, **"alterado pelo assistente há 3 segundos"**. Evidência:
   `evidence/ia-360-w4/w4-regra-ligada-pelo-agente.png`.
3. **A regra ligada pelo agente dispara e o egress continua barrado.** Um receiver HTTP de
   verdade sobe em `127.0.0.1:<porta efêmera>`; a regra aponta para ele; um lead entra pela URL
   de captação; o `event_log` é drenado. O receiver registrou **zero** requisições
   (`assertSafeOutboundUrl` recusa host privado antes do `fetch`) **e** a aba Atividade mostra a
   execução com falha — barrar em silêncio faria o dono achar que o outro sistema recebeu.
   Evidência: `evidence/ia-360-w4/w4-egress-barrado-com-registro.png`.

**Sabotagem do E2E** (a única propriedade que o despacho cobra nominalmente):

| Sabotagem | Resultado |
|---|---|
| `autoriaDaMudanca` gravando `"user"` fixo (rebuild + rerun) | reprova em `expect(seloDaEtapa).toBeVisible()` — `element(s) not found` para `[data-autoria="ai"]` |
| restaurado (rebuild + rerun) | `1 passed (18.0s)` |

O caminho até o verde também teve valor: **quatro vermelhos diferentes**, todos defeitos reais do
teste — parser de SSE ancorado em `data:` quando o servidor abre com `event: message`;
`toContainText` num nome que mora em `<input>`; `filter().last()` devolvendo o título em vez do
cartão; e o timeout de 30s medindo o relógio em vez do comportamento. Estão comentados no spec
para a próxima pessoa não repetir.

---

## Estado final da wave (SHA `277f676` + os ajustes do spec; árvore limpa no commit final)

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | **0 errors, 170 warnings** — exatamente a linha de base do épico (`687716a`), zero avisos novos |
| `npx vitest run` (unit) | 226 arquivos, 2014 testes — ⚠️ **medido ANTES da última edição deste commit**, ver "O quarto gate" abaixo; o número válido para o estado final é o da tabela pós-merge |
| `pnpm test:db` — baseline | `install ok` (`ON_ERROR_STOP=1`) e `update ok` (re-aplicação), nas duas rodadas |
| `pnpm test:db` — invariantes | 412 passam; **1 vermelho por rodada**, em teste que muda de lugar — causa em apuração pela W3, ver abaixo |
| E2E em tela | `1 passed`, com evidência visual e sabotagem confirmada |

### A medição que não fecha limpa — e a conclusão que eu RETIREI

**O que medi, e continua valendo:** duas rodadas completas de `pnpm test:db` no meu SHA, dois
vermelhos, em testes **diferentes** da família follow-up.

| rodada | porta | teste que falhou |
|---|---|---|
| 1ª | `TEST_DB_PORT=54371` | `tests/invariants/followup-turn-bridge.test.ts` (`expected 2 to be 1`) |
| 2ª | `TEST_DB_PORT=54373` | `tests/invariants/followup-reactivity.test.ts` (`expected +0 to be 1`) |

`followup-turn-bridge` passa isolado no mesmo SHA (`5 passed`, exit 0). Nenhum arquivo de
follow-up foi tocado nesta branch (`git diff --name-only 99cd0fc..HEAD | grep -i followup` →
vazio).

**O que eu CONCLUÍ daí, e estava além do dado: "não é desta wave".** Retirado.

O que sustentava a conclusão era a ausência de regressão determinística mais o fato de eu não ter
tocado follow-up. Nenhum dos dois exclui esta branch: o mecanismo que a W2 encontrou — dois
relógios diferentes, `node-handlers` em 201 contra o baseline em 6497 — explica **sensibilidade a
tempo de execução**, e qualquer mudança que altere o tempo da suíte pode disparar isso sem tocar
uma linha de follow-up.

E o número decisivo é o que eu **não** tinha: **zero corridas de controle na base**. A W3 mediu
com régua melhor — base **verde em 11 corridas**, branch dela **6 falhas em 8**, com o teste
identificado. Contra 11 corridas limpas, meu "2 de 2" deixa de ser evidência de tronco doente e
vira evidência de que **branches disparam**, inclusive a minha.

**A lição, que é a mesma que o Maestro registrou sobre si:** usei uma amostra pequena para dizer
"não dá para concluir" quando a conclusão me era desfavorável, e usei a MESMA amostra para
concluir quando ela me era favorável. O erro não é a amostra — é ela mudar de força conforme o
lado que sustenta.

**Item com dono:** a W3 assumiu. Minha contribuição são as medições abaixo — **declaradas por
SHA, nunca agregadas**, porque somar corridas de estados de código diferentes sob o rótulo "a
branch" é o erro que a própria W3 retratou na série dela:

| SHA | o que é | corridas | resultado |
|---|---|---|---|
| `4202acf` | pré-merge | 2 | 2 vermelhos, em testes **diferentes** (`followup-turn-bridge`, `followup-reactivity`) |
| `dc20317` | pós-merge, estado final | 3 | **3 verdes** (`413 passed \| 1 skipped`, exit 0 nas três) |

**O que isso NÃO prova:** que sumiu. Três corridas verdes não refutam um fenômeno intermitente —
a W3 já declarou isso sobre as três dela, e vale igual para as minhas.

### O segundo mecanismo, confirmado por leitura independente

A W3 encontrou um mecanismo que **não depende de relógio**, e eu o confirmei no código sem partir
do achado dela — `supabase/baseline.sql:6485`:

```sql
create or replace function fn_claim_due_followup_enrollments(p_limit int, p_lease_seconds int)
...
    select id from followup_enrollments
    where status in ('active','waiting_reply') and next_eval_at <= now() ...
    order by next_eval_at limit p_limit for update skip locked
```

**Não há `organization_id` na assinatura nem no corpo.** O claim varre `followup_enrollments`
inteiro. Medidas que acrescento ao achado dela:

- `DEFAULT_CLAIM_LIMIT = 20` e `CLAIM_LEASE_SECONDS = 120` (`lib/followup/engine.ts:29-30`);
- `runFollowupTick` **engole** a falha do claim (`catch { return summary }`, linha 409): devolve
  `claimed: 0`, que é indistinguível de "nada vencido" — os dois mecanismos produzem o MESMO
  sintoma, como a W3 disse;
- **não é vazamento entre tenants.** O lote é global, mas cada enrollment é processado com o
  `orgId` dele (`loadFlowGraph`/`loadLeadFacts` filtram por organização). O defeito é outro:
  **starvation**. Numa instalação com mais de uma organização, quem tiver mais de 20 follow-ups
  vencidos monopoliza cada tick — e, como a ordem é por `next_eval_at` crescente, quem está
  atrasado continua tendo os mais antigos. É starvation **persistente**, não transitória, e atinge
  em silêncio o invariante 4 da doutrina ("nenhuma demanda sem próximo passo") nas organizações
  menores.

Hoje o impacto real é baixo porque o uso corrente é de um operador só; num SaaS multi-tenant, não
seria. **Não é item desta wave** — é registro para quem for fechar o do follow-up.

---

## Depois do merge da base (`feat/ia-360-mcp` = `210669c`)

O Maestro corrigiu na base os **dois** defeitos que reportei daqui, e mergeei. Três coisas
mudaram no que eu tinha escrito, e todas exigiram acerto — não só de código:

### 1. As seis escritas viraram `apenasHumano`, por PARIDADE

A base introduziu `apenasHumano` no catálogo e reescreveu o gate de alcançabilidade: ele deixou
de exigir "toda capacidade é alcançável" e passou a caçar **restrição não declarada**. A régua
que decide o papel de uma tool é **o que a rota HTTP equivalente exige**.

Medi as minhas: `pipelines/[id]/stages`, `webhook-sources` e `automation-rules` exigem `manager`,
todas as três. **Não há divergência aqui** — ao contrário das quatro tools de lead, cujas rotas
pedem `agent`. Nem um atendente humano configura a operação pela tela, então baixar para `agent`
daria à IA um poder que o produto não dá a uma pessoa com o mesmo papel.

**A consequência, dita sem maquiagem:** no pacote "Organizar a operação", um agente publicado
**lê tudo e muda nada**. As dez leituras são o ganho real — explicar a operação, diagnosticar a
entrada que parou, mostrar a automação que falhou, parar de inventar marcador. As seis escritas
existem, são alcançáveis por cliente MCP com papel de gestor (é o que o E2E exercita), e a tela
agora **diz** que são operadas por gente, em vez de deixar o dono ligar achando que o agente vai
usar.

### 2. O gate foi COMBINADO, não escolhido

Meu arquivo e o da base tinham o mesmo nome e conteúdo divergente — convergência independente
depois do meu reporte. Resolver escolhendo um lado perderia metade em silêncio. O resultado tem
as duas metades:

| origem | o que aporta |
|---|---|
| base | `apenasHumano`, dívida zerada, "inalcançável POR ACIDENTE", "marca não pode mentir" |
| minha | "escrita que muda a casa não entra por atalho" (a falha SIMÉTRICA), guarda de exceção órfã, e o **controle positivo** que lê o fonte do mint |

O controle positivo é o que impede o arquivo inteiro de passar sozinho no dia em que alguém mudar
o papel do token efêmero — as duas listas seguiriam classificando por uma régua morta.

**Sabotagem do gate combinado:**

| Sabotagem | Resultado |
|---|---|
| tirar `apenasHumano` de `crm_archive_stage` (restrição vira acidente) | `1 failed \| 6 passed` |
| baixar `crm_archive_stage` para `agent` (atalho + marca mentirosa) | `2 failed \| 5 passed` — as duas guardas acusaram |

Restaurado: `7 passed`.

### 3. BUG-01 tem uma IRMÃ que não foi consertada — e eu tinha texto errado no repo

O conserto do BUG-01 (`bddeeb6`) alinhou o runtime nativo: `lib/ai/runtime/agent.ts` passa
`run.agent_id`. Fui conferir os três caminhos antes de reescrever meus comentários, e **o
terceiro não foi**: `lib/mcp/auth.ts` `deriveActor()` continua devolvendo o id do RUN (do scope
`agent_run:<uuid>`) ou, sem ele, o id do TOKEN — o caminho de um cliente MCP externo.

**Consequência medida por leitura:** uma tool que emita `crm_lead_activities` chamada por MCP
externo com `actor:ai_agent` tenta gravar em `actor_agent_id` (FK para `ai_agents(id)`) um id que
não é de agente → `23503`, e a emissão falha baixo, em silêncio. É o mesmo defeito do BUG-01, na
instância que sobrou. **Não consertei:** o scope `agent_run:<uuid>` não carrega o id do agente, e
tirá-lo de lá exigiria mudar o que `mintEphemeralToken` grava — transversal, e o arquivo acabou
de ser tocado pela base. **Para o Maestro.**

Isso também me obrigou a **corrigir cinco textos meus que envelheceram mentindo** (o comentário
de `lib/operacao/autoria.ts`, a migration 0101, o apêndice do `baseline.sql`, a linha do MANIFEST
e o card do mapa vivo). Todos afirmavam "os três caminhos discordam", que deixou de ser verdade
30 minutos depois de eu escrever. A decisão de não criar a FK continua certa; o **motivo** mudou,
e motivo errado no repo é pior que motivo ausente — o próximo a ler decide com ele.

---

## Estado final pós-merge

| Gate | Resultado |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx eslint .` | 0 errors, 170 warnings — a linha de base do épico |
| `npx vitest run` (unit) | **226 arquivos, 2017 testes passando**, exit 0 — rodado DEPOIS da última edição do commit |
| E2E em tela | `1 passed (1.9m)`, exit 0, rodado contra o SHA pós-merge com `next build` novo; capturas regeneradas em `evidence/ia-360-w4/` |

### O quarto gate, e o que ele revelou sobre a minha própria medição

`tests/unit/evidencia-citada.test.ts` recusou o HANDOFF por citar capturas em
`.superpowers/evidence/`, que é pasta de trabalho e não entra no `git ls-files`. Num projeto
aberto, prova citada e não entregue é afirmação sem lastro para quem clona. As três capturas
foram para `evidence/ia-360-w4/` (versionado) e **o spec passou a escrever direto lá** — apagar
o sintoma deixaria a próxima rodada recriando o problema.

**Atribuição corrigida.** Escrevi antes que esse gate "veio na base". Errado nos dois sentidos, e
o Maestro cobrou a correção — crédito errado manda o próximo procurar o dono errado quando o gate
incomodar. Medido: `git log --diff-filter=A` → nasceu em `49a3cb0` (2026-07-24, épico **crm-vivo**),
evoluiu em seis commits, e `ce93ab0` (2026-07-27, growth) foi o **último retoque** (+8/−2). Ambos
já estavam em `origin/main` = `687716a`, logo **o gate já estava na minha branch desde o primeiro
commit** — não veio no merge.

**E é aí que está o achado que interessa, porque é sobre mim.** Se o gate já estava lá, por que a
suíte que reportei como `2014 testes passando` não o pegou? Fui medir em vez de supor: restaurei
o `HANDOFF-ia-360.md` de `4202acf` no disco e rodei o gate isolado — **reprova**
(`HANDOFF-ia-360.md não cita imagem fora do versionamento`).

A causa não é o gate: é a **ordem em que eu medi**. Rodei a suíte completa e, só depois, escrevi a
seção do Marco 3 com as citações — e commitei as duas coisas juntas em `4202acf`. O número não era
falso; ele simplesmente **não descrevia o commit ao qual eu o atribuí**. Medi contra um disco que
mudou antes do commit fechar.

A regra que eu já devia estar aplicando, escrita aqui para a próxima pessoa (e para mim): **o
`vitest run` que sustenta uma afirmação sobre um SHA roda DEPOIS da última edição que entra nele**,
nunca antes. Foi o que fiz na rodada final — `2017 testes`, com a árvore já no estado do commit.

> **Nota sobre o número, para ele não pegar carona.** Uma rodada intermediária deu `2019`. Não
> rastreei a origem da diferença de dois; o que verifiquei é que **nenhum arquivo de teste sumiu**
> (226 nas duas) e que os dois geradores dinâmicos que este trabalho toca continuam cobrindo o que
> devem — o gate do catálogo roda sobre as 31 tools (`99 passed`) e o de evidência sobre todos os
> documentos que citam prova (`32 passed`). A diferença está em `it` gerados por dado, não em
> cobertura perdida. Registro assim porque "provavelmente é X" num rodapé de estado é exatamente o
> tipo de frase que ninguém audita depois.

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

**O que o controle NÃO decide:** um run verde não refuta flaky. Se o fenômeno é interferência de
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

**Correção** (`bddeeb6`): `lib/ai/runtime/agent.ts` passa `run.agent_id`. O run continua
rastreável por `ctx.requestId` e pelo scope `agent_run:<id>`, e o audit não é afetado —
`lib/mcp/audit.ts` grava `actor_id` em metadata livre, não em coluna com FK.

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

---

## QA de uso — o que só apareceu USANDO o produto

A wave foi entregue com E2E de tela verde. Isso responde "funciona?", não "ficou bom?". A pergunta
foi feita depois, usando o produto como usuário, e produziu **quatro achados** — três deles
invisíveis para qualquer teste que eu já tinha.

### A1 · A tela de configuração não recebe NADA da camada de apresentação · CONFIRMADO

Medido em `/api/v1/mcp/tools`, que é a fonte do `ToolPicker`:

```
capacidades da W4 servidas à tela: 15/15
campos servidos: ["id","description","input_schema","category","requires_role","requires_scope"]
campo "rotulo": 0/15 · "explicacao": 0/15 · "risco": 0/15 · "pacotes": 0/15 · "apenasHumano": 0/15
```

O dono lê `crm_list_stages` e a descrição escrita **para o modelo**. Pior: as seis capacidades
`apenasHumano` aparecem marcáveis, sem aviso — o dono liga achando que o agente vai usar, e **ela
nunca dispara**, que é literalmente o defeito que o campo foi criado para impedir. O campo existe
no dado e não chega à tela. **É a W1, mas o buraco é de agora** — enquanto ela não sai, ligar uma
capacidade de configuração é uma promessa que o produto não cumpre e não avisa. A tela como o dono
a vê está em `evidence/ia-360-w4/qa-tela-de-escolha-de-capacidades.png`.

### A2 · Dois pacotes ocupam o teto inteiro do agente · CONFIRMADO

| pacote | capacidades | entram por pacote (as `critico` ficam de fora) |
|---|---|---|
| atender | 12 | 11 |
| vender | 9 | 9 |
| escalar | 6 | 6 |
| **organizar** | **17** | **13** |

Teto por agente: **20** (`lib/ai/agents/validation.ts`). Medido: `organizar + atender` = **20,
exatamente no limite**; `organizar + atender + vender` = **25, estoura**. A combinação mais natural
de uma clínica não cabe. A Decisão 1 do épico foi "pacotes em vez de 60 checkboxes" — e o pacote
que esta wave entregou sozinho come 65% do orçamento. **Eu adicionei 15 capacidades sem nunca
perguntar quantas cabem.**

### A3 · O selo de autoria virava ruído com o funil usado · CORRIGIDO

Eu aprovei o selo num funil recém-instalado: uma etapa do agente, oito de fábrica sem autoria.
Simulei um mês de uso normal e abri a tela:

```
antes  → assistente: 1 · você/time: 7   (13% do sinal era o que importa)
         altura de selo: 128px de 1091px da lista (12%)
depois → assistente: 1 · você/time: 0   (100%)
         altura de selo: 16px de 895px (2%) — a lista encolheu 196px
```

Sete linhas dizendo ao dono que foi ele quem mexeu, afogando a única que ele precisa ver.
**Correção:** mudança feita por pessoa não gera selo (`lib/operacao/autoria.ts`). A ambiguidade
resultante é inócua — sem selo passa a significar "foi uma pessoa" **ou** "é anterior à 0101", e
nos dois casos a resposta à pergunta que importa é a mesma. Guardado em
`tests/e2e/qa-selo-no-funil-usado.spec.ts`, que reprova se o ruído voltar. O estado final está em
`evidence/ia-360-w4/qa-selo-no-funil-usado.png` — sete etapas mexidas por pessoa, silenciosas, e só
a do assistente falando.

### A4 · O selo era um susto sem saída · CORRIGIDO

A doutrina (invariante 5) exige que todo dado responda "por que vejo isto **e o que faço a
seguir**". O selo respondia só a primeira metade: dizia que o assistente mexeu e deixava o dono
sem caminho. Agora é link para o histórico (`/app/audit`), com o texto "— ver o que mudou".

### O que ficou BLOQUEADO, e não vou fingir que testei

**Nunca vi um modelo de verdade escolhendo estas capacidades.** Montei o teste completo
(`tests/e2e/qa-agente-usa-as-maos.spec.ts`, quatro cenários, pelo mesmo endpoint do botão
"Executar teste"), e os quatro turnos falharam em ~400ms com:

```
error_code: runtime_error
Your credit balance is too low to access the Anthropic API.
```

A credencial do banco **e** a chave do ambiente estão sem saldo (confirmei com chamada direta à
API: HTTP 400, mesma mensagem). O spec fica pronto para rodar quando houver crédito. Até lá,
seguem **sem resposta**: o modelo escolhe a tool certa? as 15 novas degradam a escolha? o retorno
serve para ele? `crm_list_tags` de fato o impede de inventar marcador?

### Um defeito do meu próprio instrumento, achado no caminho

`seed-e2e-agente-mcp.ts` revogava **todo** token vivo do mesmo nome antes de emitir. Duas
execuções próximas faziam a segunda matar o token da primeira no meio da corrida — e o sintoma
chegava como `Token revoked` numa chamada MCP, **parecendo defeito do produto**. Medido: quatro
tokens em 35s, três revogados em cascata. Agora só revoga o que tem mais de 10 minutos.

---

## QA das telas descobertas — `/app/templates`, `/app/settings/templates`, `/app/audit`

O Maestro apontou que 24 das 47 telas não aparecem em spec nenhum, e que os E2E do repo provam
**encanamento**: login real, mas estado vindo de seed. Isso demonstra que a tela funciona quando
alguém já pôs os dados lá — não que uma pessoa chega lá sozinha. Estas três são da W4. Abri as
três criando o estado **pela interface**.

Spec: `tests/e2e/qa-telas-descobertas-w4.spec.ts`.

### T1 · `/app/templates` — SADIA, e provada criando pela tela

O caminho do leigo funciona inteiro: a tela tem "Novo template", os campos são achados pelo
rótulo que o usuário lê (não por `data-testid`), e depois de salvar **a resposta aparece na
lista** — a prova é a lista, não o toast sumir. Evidência: a tela vazia
(`evidence/ia-360-w4/qa-tela-templates.png`), o formulário preenchido
(`evidence/ia-360-w4/qa-tela-templates-criando.png`) e a resposta já na lista
(`evidence/ia-360-w4/qa-tela-templates-criada.png`).

Tela sadia provada também é resultado.

### T2 · `/app/settings/templates` — não é defeito, é redirect legítimo

Redireciona para `/app/connections?aba=oficial&sub=templates`, e o destino exige `admin` — um
manager cai num **403 honesto**. O arquivo existe de propósito, para link salvo não virar 404.

**Reparo possível, registrado sem inflar:** o 403 diz "Você não tem acesso a essa área" sem dizer
QUAL área nem por quê. Quem clicou num favorito de "templates" fica sem entender por que a tela de
respostas prontas (que ele acessa) virou proibida. É UX, não bug.
Evidência: `evidence/ia-360-w4/qa-tela-settings-templates.png`.

### T3 · A rota de funis misturava organizações · CORRIGIDO

**Não veio de ler código: veio de montar o cenário.** Para testar `/app/audit` eu precisava do id
de um funil e pedi a `GET /api/v1/pipelines` com a sessão do manager da `e2e-test-org`. Ela
devolveu como **primeiro item um funil da `e2e-segunda-org`**.

Causa raiz: `listPipelinesHandler` **recebe** `ctx.organization_id` e **nunca o usa** no filtro.

- Quem tem uma organização só não vê o defeito — a RLS já limita.
- Quem é membro de **duas** recebe as duas misturadas, sem indicação de origem. É o modelo
  multi-tenant do produto, não um canto.
- A tool MCP já se defendia filtrando o **resultado** em JS (`lib/mcp/tools/pipelines.ts`, com o
  comentário "defesa em profundidade — service-role bypassa RLS"). O remendo estava no **chamador**,
  e o outro chamador não o tinha.
- E essa lista alimenta a tela de **entradas automáticas de contatos**, onde o usuário escolhe para
  qual funil os contatos vão.

Correção na origem (`.eq("organization_id", ctx.organization_id)`), com teste em
`app/api/v1/pipelines/route.test.ts`. **Sabotagem:** removi o filtro → `expected [ 'p-minha',
'p-alheia' ] to deeply equal [ 'p-minha' ]`. Restaurado: `13 passed`.

> Nota de mérito honesto: **eu li esse handler no início da wave** — está citado no marco 1 — e não
> vi. Ler não é usar. O defeito apareceu na primeira vez que precisei do dado para outra coisa.

### Um segundo defeito do meu instrumento, no mesmo cenário

A sonda do `/app/audit` reportou "assistente criou etapa → HTTP 200" sobre uma chamada que
**falhou**: o MCP devolve `200` com `isError` no corpo, e eu olhava só o status. O erro real era
`"Funil não encontrado."` — consequência do T3. Corrigido no spec, com o porquê comentado: no MCP,
HTTP 200 não é sucesso.

### T4 · `/app/audit` — a promessa do meu selo, em apuração

O `SeloDeAutoria` passou a dizer "ver o que mudou" apontando para esta tela, e eu nunca a tinha
aberto. A tela **existe e carrega** (`h1 = "Audit Log"`, botão "Exportar CSV" —
`evidence/ia-360-w4/qa-tela-audit.png`).

**Medição limpa, depois do T3 corrigido:** a etapa FOI criada (`last_change_actor_kind = ai`) e o
registro FOI gravado (`pipeline.stage_created`, ator `ai_agent`, nome correto, 16:17:56). E a tela
continua **não mostrando**.

**Causa raiz — a borda e o banco discordam sobre quem pode ler:**

| camada | exige |
|---|---|
| `app/app/audit/page.tsx` | `manager` |
| `app/api/v1/audit/route.ts` | `requireRole("manager")` |
| policy `audit_log_select` (RLS) | **`fn_role_at_least(organization_id, 'admin')`** |

O manager passa pelas duas portas da aplicação, a query roda com o client dele, e a **RLS devolve
zero linhas**. A tela mostra vazio — **sem erro, sem explicação**. Ele conclui que não há registro.

**E é o destino do meu selo.** O `SeloDeAutoria` diz "ver o que mudou" e aponta para cá: um dono
com papel `manager` clica, chega numa tela vazia e fica pior do que estava — antes não sabia,
agora "sabe" que não há nada. Beco que mente é pior que beco.

**Não corrigi, e a razão é a mesma de sempre nesta wave:** as duas saídas mexem em permissão.
Alinhar a rota para `admin` restringe (falha fechada, honesta); alinhar a RLS para `manager`
**concede acesso ao log de auditoria**. Isso é decisão de produto, não minha — e o despacho me põe
RBAC fora de escopo. **Para o Maestro.** Enquanto não for decidido, o link do selo leva um manager
a uma tela vazia.

---

## O agente usando as mãos — com IA REAL

O bloqueio de crédito foi resolvido: o Rafael forneceu chave OpenAI e o teste rodou com
**`gpt-5.6-terra`**, pelo mesmo endpoint do botão "Executar teste" da tela. A chave entra por
`QA_LLM_API_KEY` (ambiente) e é cadastrada **pela rota de credenciais**, que a cifra — nunca no
arquivo, porque spec versionado é vazamento permanente.

### O modelo escolheu certo nos quatro cenários

| cenário | esperado | o modelo chamou | veredito |
|---|---|---|---|
| ler o funil | `list_pipelines` e/ou `list_stages` | `crm_list_pipelines → crm_list_stages` | certo |
| não duplicar marcador | `list_tags` antes de aplicar | `crm_list_tags` | certo — **não** aplicou marcador sem consultar |
| diagnosticar entrada parada | `list_webhook_sources` + eventos | `crm_list_webhook_sources` | certo — parou porque não havia fonte alguma, em vez de buscar eventos de nada |
| criar etapa | tentar `create_stage` | `crm_list_pipelines → crm_list_stages` | **melhor que o esperado** |

Todos `completed`, 4–8s cada. Relatório com as chamadas cruas e as respostas:
`evidence/ia-360-w4/qa-turnos-do-agente.md`.

### O quarto cenário respondeu uma pergunta que eu não tinha feito

Pedi "cria uma etapa chamada Pós-venda". O modelo **consultou antes de escrever**, viu que
«Pos-venda» já existia e respondeu:

> "A etapa **"Pos-venda"** já existe no funil **Pedidos**. Não criei uma duplicata."

Isso valida a aposta desta wave — dar LEITURA rica ao agente — de um jeito que eu não tinha
previsto: a leitura o impediu de fazer besteira **antes** de qualquer barreira de permissão entrar
em ação. É o mesmo mecanismo do `crm_list_tags` (não inventar marcador), aparecendo sozinho.

### O que NÃO ficou provado

**A barreira `apenasHumano` não foi exercitada.** Justamente porque o modelo se recusou a
duplicar, ele nunca tentou escrever. Acrescentei um quinto cenário pedindo uma etapa que não
existe — e os cenários 2 a 5 dessa rodada caíram com `401 unauthenticated`: a sessão do navegador
expirou no meio da corrida (o spec loga como `admin` com MFA e a rodada é longa). O cenário 1
passou, os demais não chegaram ao modelo.

### A barreira, provada — rodando o cenário sozinho

A corrida longa expirava a sessão; rodar **um cenário por vez** (`QA_CENARIO=5`) manteve a medição
válida. Pedi uma etapa que não existia, para ele de fato tentar escrever:

> **Perguntaram:** "Preciso de uma etapa nova chamada Retorno pos-cirurgico no fim do funil. Ela
> não existe ainda, cria pra mim."
>
> **O agente respondeu:** "Não consegui criar a etapa: seu perfil atual é **agent**, e essa
> alteração exige permissão de **manager**. Confirmei que **"Retorno pos-cirurgico"** ainda não
> existe no funil **Pedidos**. Um gestor pode criá-la no fim do funil."

**A barreira segurou, e o veredito é o do banco, não o da prosa:** `select count(*) from
crm_stages where name ilike '%pos-cirurgico%'` → **0**. Ele tentou, foi recusado por papel, e nada
foi escrito.

Três coisas boas, medidas e não supostas: ele **tentou** (não desistiu por conta própria), a
recusa **virou português** em vez de vazar `Role 'agent' insufficient (required: 'manager')` cru, e
ele ainda **ofereceu o próximo passo** ("um gestor pode criá-la") — que é o que o invariante 5 pede.

### E o defeito de qualidade que só aparece lendo a frase

> "**seu** perfil atual é **agent**"

**Isso é falso para quem lê.** O papel `agent` é do ASSISTENTE, não de quem está conversando. Um
dono com papel `admin` lê isso e pensa "meu perfil é admin, do que ele está falando?". E num
atendimento de verdade quem lê é **o cliente da clínica**, que não tem perfil nenhum no CRM — a
frase vaza vocabulário interno (`agent`, `manager`) para fora da empresa.

A recusa técnica atravessou até o texto final porque **nada a traduz no caminho**: `ensureRole`
lança `Role 'agent' insufficient (required: 'manager')`, a ponte devolve isso ao modelo, e o modelo
faz o melhor que pode com o que recebeu — reescreve em português e erra o sujeito, porque a
mensagem que ele recebeu fala de "role" sem dizer de quem.

### Corrigido, e provado com o mesmo modelo

`lib/mcp/recusa-para-o-modelo.ts` (novo): a recusa por papel deixa de chegar ao modelo como
mensagem técnica e passa a chegar como **instrução de produto**, na mesma família do veto
instrutivo que o engine já usa nos gates de envio. `lib/ai/runtime/tools.ts` a usa no `catch` de
`McpAuthError` — a mensagem original continua no log e na observabilidade, onde serve.

**Dois textos, não um**, e a distinção importa para quem lê a resposta:

| situação | o que o modelo recebe |
|---|---|
| `apenasHumano` (restrição deliberada) | "é operada por uma PESSOA do time com acesso de gestor… ofereça que alguém do time faça" |
| sem a marca (o acidente do BUG-02) | "limitação da configuração… oriente a pessoa a falar com quem cuida do sistema" |

Prometer "peça a um gestor" numa capacidade que ninguém deveria ter restringido mandaria a pessoa
bater numa porta que não abre — seria o BUG-02 virando promessa falsa ao cliente.

**A frase, medida com `gpt-5.6-terra`, mesmo cenário:**

| | o que o usuário lê |
|---|---|
| antes | "Não consegui criar a etapa: **seu perfil atual é agent**, e essa alteração exige permissão de **manager**." |
| depois | "A etapa **"Retorno pos-cirurgico"** ainda não existe no funil, mas não consigo criá-la por aqui. **Peça para alguém do time** adicioná-la no fim do funil." |

Zero vocabulário interno, nenhuma afirmação falsa sobre o perfil de quem lê, e o próximo passo
oferecido. A barreira continua segurando: `crm_stages` com o nome alvo → **0**.

Guarda em `tests/unit/recusa-para-o-modelo.test.ts` (5 testes). **Sabotagem:** devolvi o jargão ao
texto → `expected [ 'crm_create_stage: "agent"', …(23) ] to deeply equal []`, acusando cada termo
em cada capacidade. Restaurado: `5 passed`.

---

## Os quatro cenários com a frase nova, e um vazamento que o contrato impede consertar

Rodados **um por vez** (a corrida com os cinco juntos expira a sessão do admin com MFA), mesmo
modelo `gpt-5.6-terra`:

| cenário | ferramentas escolhidas | igual à rodada anterior? |
|---|---|---|
| ler o funil | `crm_list_pipelines → crm_list_stages` | sim |
| não duplicar marcador | `crm_list_tags` | sim |
| diagnosticar entrada parada | `crm_list_webhook_sources` | sim |
| criar etapa que já existe | `crm_list_pipelines → crm_list_stages` | sim |

Comportamento **estável**: a tradução da recusa mexe só no `catch` de `McpAuthError`, e os caminhos
felizes não mudaram — que era o esperado, e agora está medido em vez de suposto.

### O jargão vaza para o cliente por DUAS portas, e só uma era minha

**Porta 1 — a `description`, e essa eu fechei.** O contrato do épico separa `description` (para o
modelo) de `rotulo`/`explicacao` (para o humano), assumindo que o modelo não repassa a primeira.
**Ele repassa:** `"entradas automáticas de contatos (webhook_sources)"` virou, na resposta ao
usuário, *"nenhuma entrada automática de contatos **(webhook)** configurada"*. Tirei os nomes de
tabela de todas as minhas `description`.

**Porta 2 — o `name` da capacidade, e essa NÃO tem conserto por aqui.** Refiz o cenário depois da
limpeza e o termo voltou:

> *"Não há nenhuma entrada automática/**webhook** cadastrada na clínica — ativa ou desativada."*

A fonte agora é o próprio identificador da ferramenta que ele chamou: `crm_list_webhook_sources`.
O modelo lê o nome do que executou e o repete. E `name` é **contrato de wire** — a Decisão 3 do
briefing proíbe renomear tool publicada, porque agentes em VPS de clientes e clientes MCP externos
quebram.

**O que sobra**, e é decisão de quem define o prompt de sistema, não minha: instruir o agente a
nunca citar o nome interno de uma ferramenta ao usuário. É a mesma família da correção da recusa —
o modelo repete o que lê, então o que ele lê tem que ser escrito pensando em quem vai ouvir.
**Registrado para o Maestro.**

> O gate `catalogo-tools-leigo-friendly` não pega nenhuma das duas: ele vigia `rotulo`,
> `explicacao` e `oQueToca` — os textos que vão à TELA. O caminho que vai à CONVERSA
> (`description` + `name`) nunca teve guarda.
