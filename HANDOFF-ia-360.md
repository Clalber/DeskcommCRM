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

### Wave 2 — Não perder o cliente (pacote `reter`) · CONCLUÍDA

**Entregue por:** DevVivo · branch `feat/ia-360-w2-reter` · worktree
`/Users/rafaelmelgaco/DeskcommCRM-ia360-w2-reter` · base `99cd0fc`

| Medida | Antes (`99cd0fc`) | Depois (`896f6098`) |
|---|---|---|
| Capacidades de retorno no catálogo | **0** | **6** |
| Pacote `reter` | vazio (dívida declarada) | preenchido, fora da dívida |
| Porta do humano para desmarcar um retorno avulso | **não existia** | fila → `POST /ai/followups/promises/:id/cancel` |
| Situações distinguíveis de um retorno | 2 (`agendado`, `enabled=false` ambíguo) | 3 (`agendado`, `disparado`, `cancelado`) |
| Encerrar negócio emitia atividade na timeline | **não** | sim (`demand_closed`) |

**As seis capacidades** (`lib/mcp/tools/catalogo/retencao.ts` + `lib/mcp/tools/retencao.ts`):
`crm_schedule_followup`, `crm_cancel_followup`, `crm_list_followups`,
`crm_list_at_risk_leads`, `crm_close_demand` (**crítica** — nunca entra por pacote) e
`crm_propose_reactivation`. Todas com `requiresRole: "agent"`, porque é com `role:agent` que o
runtime do agente configurado na tela emite o token efêmero — exigir `manager` entregaria uma
capacidade que aparece na tela, o humano liga, e o servidor recusa em silêncio.

**A regra virou uma só (Decisão 4 levada a sério).** Janela, guard anti-empilhamento e formato do
agendamento viviam dentro do motor (`schedule-followup.ts`, sobre `pg.Pool`). Agora vivem em
`lib/followup/retorno.ts`, sem I/O, atrás da porta `RetornoDb`; cada runtime traz seu adaptador
(`retorno-pg.ts`, `retorno-crm.ts`). O motor passou a entrar pela mesma porta e o arquivo dele
ficou só com o que é dele: a whitelist do payload e o ENSINO em português ao modelo. Mesmo
tratamento para o radar (`lib/leads/radar-de-risco.ts`, extraído da rota) e para o encerramento
(`lib/leads/encerramento.ts`, extraído das rotas de ganho/perda).

**Schema:** migration `0102_cron_jobs_retorno_cancelado` + apêndice idempotente no
`baseline.sql` + linha no `MANIFEST.md` — os três juntos.

**Mapa vivo:** `docs/architecture/ia-360-retencao.architecture.json` (26 peças, 36 arestas) +
linha no `README.md` do diretório.

**Evidência observada — em `896f6098`, árvore limpa** (o SHA da passada de UX; os números de
`9e2d3fb`, antes dela, eram 1994 unitários e 2 casos de E2E):

- `pnpm typecheck` limpo · `pnpm lint` 0 erros (170 avisos pré-existentes)
- `pnpm test:unit` — **226 arquivos, 1997 testes verdes** (eram 224/1963 na base)
- `pnpm test:db` — **62 de 63 arquivos verdes; 420 passados, 1 pulado, 1 falha**, e a falha é o
  BUG-03 (flake pré-existente de dois relógios em `followup-engine`). A MESMA suíte fechou
  **63/63, 421 verdes** em `9e2d3fb`. `tests/invariants/retorno-anti-morte.test.ts` passou nas
  duas — 8/8.
- E2E em tela (`tests/e2e/retorno-anti-morte.spec.ts`) — **3 passed**, evidência visual em
  `.superpowers/evidence/w2-retorno-*.png`. O Radar mostra "Em voo · Assistente retorna em 2d"
  para o negócio parado há 5 dias; a fila mostra "Cancelada" (não "Concluída") depois do clique;
  o dossiê mostra "Retorno agendado" com o motivo, sem repetir a frase.

> **Uma execução de `test:unit` em `9e2d3fb` fechou `2 failed | 1992 passed` e as duas seguintes,
> no MESMO SHA e com a árvore limpa, fecharam verdes (226/1994).** A execução vermelha rodou
> concorrente com o `test:db` de outra sessão na mesma máquina, e eu **não capturei os nomes dos
> dois casos** — a informação se perdeu, e por isso está declarada em vez de arredondada. O que
> está medido é: 2 verdes em 3 execuções no mesmo SHA, com uma vermelha não identificada sob
> carga. Quem reproduzir isso deve salvar a saída completa antes de re-executar.

**Sabotagem antes de confiar** (toda propriedade nova foi quebrada de propósito e reprovou):
guard anti-empilhamento removido, limite inferior da janela virando `<=`, corrida perdida virando
sucesso, as três emissões de atividade desligadas, e a porta de cancelamento devolvida ao estado
anterior à wave. Cada uma produziu exatamente uma reprovação; o controle restaurado voltou verde.

---

## Bugs encontrados

### BUG-01 — o retorno cancelado era indistinguível do retorno disparado
- **Achado em:** `99cd0fc`, por DevVivo, ao desenhar `crm_cancel_followup`.
- **Sintoma observado:** `cron_jobs.enabled = false` é escrito tanto por `fireOneDue` (o one-shot
  disparou) quanto por um cancelamento. A fila (`/app/ai/followups`) rotulava os dois como
  "Concluída" — dizendo ao operador que a mensagem saiu para o cliente quando ninguém a enviou.
- **Causa raiz:** falta de estado no banco, não de código: não existia campo para "quem passou a
  distinguir um estado novo". Ver a memória `wire_sem_campo_para_nao_sei`.
- **Correção:** migration `0102` (`cancelled_at` + `cancel_reason`, sem backfill — não se sabe
  quais linhas antigas foram canceladas, e chutar seria gravar ficção) + `situacaoDoRetorno()`
  como derivação única + a fila passa a mostrar "Cancelada".
- **Prova do fix:** `tests/invariants/retorno-anti-morte.test.ts` cancela pelo código de produção
  contra Postgres real e afirma que a situação lida do banco é `cancelado`, não `disparado`.

### BUG-02 — a atividade da IA morria na FK quando o agente da tela escrevia
- **Achado em:** `99cd0fc`, por DevVivo, ao ligar a emissão de atividade nas capacidades novas.
- **Sintoma observado:** `crm_lead_activities.actor_agent_id` tem FK para `ai_agents`, e o
  runtime nativo (`lib/ai/runtime/agent.ts`) põe em `actor.id` o id do **RUN**
  (`ai_agent_runs`). O emissor lia `actor.id`. Toda tool de escrita chamada pelo agente
  configurado na tela — inclusive `crm_move_lead_stage`, que já existia — perdia a atividade no
  INSERT: a mutação acontecia, a timeline não registrava, e a perda só aparecia em `event_log`.
  O `send-message` do motor chega a passar a string literal `agent-engine`, que nem uuid é.
- **Causa raiz:** `id` significava coisas diferentes em cada runtime (run, token, rótulo), e um
  único campo servia a dois consumidores com exigências incompatíveis (correlação de audit ×
  coluna com FK).
- **Correção:** `Actor` do tipo `ai_agent` ganhou `agent_id` explícito
  (`lib/api/handlers/types.ts`); `actorParaAtividade` passou a ler **só** ele, e os três pontos
  que conhecem o agente de verdade passaram a preenchê-lo. A polaridade da falha inverteu: sem
  `agent_id` perde-se a AUTORIA (linha entra como sistema), não a LINHA.
- **Prova do fix:** `lib/leads/activity-emitter.test.ts` — caso novo "id de RUN em `id` NÃO vira
  actor_agent_id"; e o invariante contra Postgres real afirma
  `actor_agent_id = <id do ai_agents>` numa linha escrita pelo caminho de produção.

### BUG-03 — `followup-engine` tem um flake de dois relógios (PRÉ-EXISTENTE, não corrigido)
- **Achado em:** `607888d`, por DevVivo, rodando `pnpm test:db`.
- **Sintoma observado:** `tests/invariants/followup-engine.test.ts > trigger → end leva 2 ticks`
  falha intermitentemente com `summary2.claimed === 0`.
- **Medição (não suposição):** base `99cd0fc` — **0 falhas em 4 execuções**; branch — **3 falhas
  em 8 execuções** (até `896f6098`). Confesso o confundidor: as execuções da base rodaram com a
  máquina mais quieta que as da branch (que dividiram CPU com builds, servidor e navegador). A
  contagem sozinha, portanto, não decide.
- **O que decide, e é estrutural:** `git diff 99cd0fc..HEAD` sobre `lib/followup/engine.ts`,
  `node-handlers.ts`, `turn-bridge.ts`, `graph-schema.ts` e o próprio arquivo de teste devolve
  **vazio**. A asserção que falha lê uma coluna escrita por uma função que esta wave não tocou,
  reivindicada por uma SQL que esta wave não tocou.
- **Causa raiz provável, pelo mecanismo:** `node-handlers.ts` escreve
  `next_eval_at = clock()` (relógio do **processo**) e `fn_claim_due_followup_enrollments`
  reivindica com `next_eval_at <= now()` (relógio do **banco**). É o mesmo defeito de dois
  relógios já documentado no cabeçalho de `lib/leads/risk-seed.ts`, noutro lugar. Nada no diff
  desta wave toca esse caminho.
- **Por que NÃO corrigi aqui:** o conserto mexe no núcleo de agendamento do motor de fluxos, que
  é escopo de outra wave. Fica mastigado para quem o assumir; a correção honesta é ancorar os
  dois lados no relógio do banco, não afrouxar a asserção.

## Bugs corrigidos

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

### BUG-04 — a linha do tempo repetia a mesma frase duas vezes (achado OLHANDO, não testando)
- **Achado em:** `31332c0`, por DevVivo, abrindo o dossiê no navegador — **depois** de a wave
  estar declarada pronta, com typecheck, 1994 unitários, 421 invariantes e E2E verdes.
- **Sintoma observado:** o dossiê renderiza o rótulo do tipo e, embaixo, o `reason`. Com o reason
  começando pela mesma frase, a tela dizia:
  `Retorno agendado` / `Retorno agendado — reconfirmar a proposta que o cliente pediu para pensar`.
  Idem para cancelar e encerrar.
- **Por que nenhum teste pegou:** as asserções eram sobre o que PRECISA estar no texto
  (`toContain(motivo)`). Nada dizia o que NÃO pode estar — um `reason` redundante satisfaz
  `toContain` perfeitamente. O gate media presença, não legibilidade.
- **Correção:** `motivoLegivel()` em `retorno-crm.ts` (o reason passa a ser só o PORQUÊ, com
  inicial maiúscula) e `encerramento.ts` passa a dizer `Ganho` / `Perdido — <motivo>`. É o padrão
  que `stageChangeReason` já seguia: o rótulo nomeia o quê, o reason conta o porquê.
- **Prova do fix:** bloco novo em `tests/unit/mcp-retencao-tools.test.ts` ("o texto que aparece na
  linha do tempo") comparando o reason contra `ACTIVITY_LABELS`, e um caso E2E novo que lê o
  dossiê RENDERIZADO. Sabotado (reason voltando a repetir o rótulo): 2 unitários reprovam.

---

## Achados de EXPERIÊNCIA ainda abertos (olhados na tela, não corrigidos)

Levantados na passada de UX em `31332c0`, dirigindo o navegador com intenção de julgar a
experiência — não de confirmar asserção. Nenhum é regressão desta wave; os quatro ficaram
visíveis por causa dela, e nenhum é meu para resolver sozinho.

| # | O que se vê | Por que não corrigi aqui |
|---|---|---|
| UX-1 | A tela de configuração do agente lista as capacidades como `crm_schedule_followup` em fonte monoespaçada, com a `description` TÉCNICA embaixo (a que fala com o modelo: `lead_id`, `contact_id`, `ISO 8601`). O `rotulo`/`explicacao` da wave 0 **não são consumidos por essa tela**. Medido no navegador: as 6 capacidades aparecem, `mostraRotuloAmigavel: false`. | É exatamente o `ToolPicker` por pacote que a **wave 1** entrega. Editar aqui colide de frente com o Arquiteto. |
| UX-2 | A linha do tempo diz **"Sistema"** agendou o retorno, enquanto o cabeçalho do mesmo card diz "Agente Retorno E2E". A constraint 0071 recusa autoria de IA sem lastro e o emissor degrada para `system` — correto —, mas `actorName()` descarta o `actor_agent_id` que o próprio emissor faz questão de preservar. | Decidir se "sistema com agente conhecido" pode exibir o nome do agente é tensão doutrinária real (afirmar autoria sem prova). Não é decisão de uma wave sozinha. |
| UX-3 | A linha do tempo não diz **quando** é o retorno — só o Radar e a fila dizem. O instante está no `payload` e o componente não o lê. | Renderizar data no servidor esbarra no fuso da organização; o lugar certo é o componente. Fica proposto, não meio-feito. |
| UX-4 | Na fila, a coluna "Nó atual / Motivo" mostra `trigger-1` / `end-1` ao usuário, e o título da tela é "Follow-ups" — a palavra que o próprio gate do catálogo proíbe no texto do humano. | Pré-existente e fora do pacote `reter`; entra como dívida declarada, não como conserto silencioso no meio de outra entrega. |

---

## Bugs corrigidos

BUG-01, BUG-02 e BUG-04 acima já saem corrigidos com prova nesta wave. BUG-03 é pré-existente,
está medido dos dois lados e **não** foi corrigido — o motivo está escrito nele.

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
| D7 | Agendar retorno é `atencao`, encerrar demanda é `critico` | agendar não fala com ninguém agora, é visível na fila e no Radar e tem botão de desfazer; encerrar tira o negócio do quadro e voltar é trabalho manual |
| D8 | Recusa de negócio volta como RESPOSTA, nunca exceção | "já existe retorno vivo" não é falha: exceção faz o modelo repetir a mesma chamada e queimar passos até o teto do turno |
| D9 | O invariante do retorno roda o CÓDIGO DE PRODUÇÃO contra Postgres real (`pg.Pool`), não SQL à mão | INSERT manual prova que o banco aceita a linha que EU montei; o que precisa ser provado é que o caminho que roda em produção monta a linha certa |
| D10 | `agent_id` separado de `id` no `Actor` de agente | um campo servia a dois consumidores incompatíveis (correlação de audit × coluna com FK), e o resultado era atividade perdida em silêncio (BUG-02) |
