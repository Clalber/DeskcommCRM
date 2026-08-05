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

### Wave 3 — passar para um humano (pacote `escalar`) · CÓDIGO E TESTES CONCLUÍDOS

**Entregue por:** terminal "Maestro" · worktree `/Users/rafaelmelgaco/DeskcommCRM-ia360-w3-escalar`
**Branch:** `feat/ia-360-w3-escalar` · **SHA do marco:** `c0db6aa` (árvore limpa) · base `99cd0fc`

O pacote tinha **1** capacidade (chamar um atendente) e agora tem **7**. Mais
importante que a contagem: a volta humano→IA passou a existir.

**Regra extraída para um lugar só** (Decisão 4 — a rota e a capacidade do agente
chamam a MESMA função; nenhum SQL duplicado):

| Arquivo novo | O que centraliza | Quem passou a chamar |
|---|---|---|
| `lib/escalacao/retomada.ts` | devolver o atendimento ao agente | rota `reactivate-bot` + `crm_resume_ai_attendance` |
| `lib/escalacao/continuidade.ts` | o que a pessoa fez, em texto que o modelo lê | retomada + `crm_get_human_case` |
| `lib/escalacao/chamados.ts` | listar/ler chamados | rotas `/ai/cases` e `/ai/cases/[id]` + 2 capacidades |
| `lib/escalacao/atendentes.ts` | roster + "pode assumir agora" | rota `/attendants/availability` + `crm_list_available_attendants` |

**As 6 capacidades novas** (`lib/mcp/tools/catalogo/escalacao.ts` + handlers em
`lib/mcp/tools/escalacao.ts`; 1 linha de import e 1 de spread no agregador):
`crm_list_available_attendants`, `crm_list_human_cases`, `crm_get_human_case`,
`crm_add_case_note`, `crm_close_human_case`, `crm_resume_ai_attendance`.

**Como a volta virou viva (invariante 2).** A devolução grava o que a pessoa
decidiu em `lead_checkpoints` — que é de onde `latestCheckpoint` → `ritualBlocks`
já lê na abertura de TODO turno. Nenhum leitor novo no motor: uma superfície
paralela que só o autor sabe consultar seria ilha.

**Evidência observada em `120b27f` (árvore limpa):**

```
pnpm typecheck  → limpo
pnpm lint       → 0 errors, 170 warnings (mesmo baseline da Wave 0)
pnpm test:unit  → Test Files 227 passed · Tests 2001 passed
pnpm test:db    → Test Files  63 passed · Tests 430 passed | 1 skipped
E2E             → 1 passed (tests/e2e/escalacao-ciclo.spec.ts)
```

Testes novos (110 asserções nos 4 arquivos da wave):
`tests/unit/escalacao-retomada.test.ts` (14),
`tests/unit/mcp-escalacao-tools.test.ts` (20),
`tests/unit/attendants-availability-route.test.ts` (4),
`tests/invariants/escalacao-ciclo-humano.test.ts` (16),
`tests/e2e/escalacao-ciclo.spec.ts` (1 jornada completa).
O gate do pilar 3 (`catalogo-tools-leigo-friendly`) foi de **53 para 73**.

**Sabotagem — 8 defeitos aplicados de propósito, cada um reprovou no teste certo:**

| Sabotagem | Teste que reprovou |
|---|---|
| não limpar `contacts.force_human` | `limpa force_human do contato — a trava que ninguém soltava` |
| sobrescrever o resumo acumulado em vez de acrescentar | `grava o que a pessoa decidiu no checkpoint` |
| `emit_event` virar fire-and-forget | `emite o sinal de retomada ... e falha alto se ele não sair` |
| escrever `assigned_to_user_id` na mão | `solta o dono humano pela regra que já existe` |
| tipo de atividade errado na volta | `a volta aparece na linha do tempo do negócio` |
| sumir com a guarda de estado do registro | `chamado FECHADO recusa o registro` (invariante) |
| o agente gravando `actor_kind='human'` | `encerrar como 'resolvido' ... deixa o desfecho escrito` (invariante) |
| a 0100 não chegar ao `baseline.sql` | 6 testes do invariante, incluindo o do CHECK |

**Schema:** migration `20260804200000_0100_agent_case_events_agent_noted.sql` +
apêndice idempotente no `baseline.sql` + linha no `MANIFEST.md` — os três juntos.
Mais o par `agent_case_events.kind` ↔ `CaseEventKind` no invariante de vocabulário.

**O critério que prova a wave — E2E em tela, verde.**
`tests/e2e/escalacao-ciclo.spec.ts`, uma corrida, o ciclo inteiro:
chamado na fila → a pessoa decide escrevendo o que combinou → a conversa mostra
"Automático pausado" e o botão de devolver → a devolução solta as **três** travas
→ a volta aparece na linha do tempo → **a abertura do próximo turno do agente cita
a decisão da pessoa**.

O último passo não prende a redação do modelo (isso reprovaria por motivo falso e
treinaria o time a ignorar vermelho). Ele lê o **bloco de abertura do turno pela
função REAL do motor** (`latestCheckpoint` → `ritualBlocks`, num processo `tsx` à
parte) e cobra que a decisão da pessoa esteja lá — é a diferença determinística
entre o agente voltar cego e voltar sabendo. Trecho medido, com o acumulado
anterior preservado:

```
## Resumo acumulado da conversa
Cliente quer 200 unidades e pediu desconto por volume.

Uma pessoa da equipe assumiu esta conversa e devolveu o atendimento para você.
O que ela fez, e que o cliente já considera combinado:
- No chamado "Desconto acima da alçada", resolveu: Aprovei 15% de desconto para
  as 200 unidades, com entrega em 5 dias uteis.
- E2E Agent anotou internamente: Cliente confirmou o CNPJ por telefone.
Retome daqui: não peça de novo o que já foi combinado nem contradiga a decisão
da pessoa.
```

Evidência visual em `.superpowers/evidence/ia-360-w3/` (5 arquivos; o diretório é
gitignored por convenção do repo).

**Sabotagem do E2E** — as duas que importam, cada uma com rebuild completo:

| Sabotagem | O que reprovou |
|---|---|
| devolver o CONTROLE sem gravar o CONTEXTO | `se a decisão da pessoa não está na abertura do turno, o agente volta cego` |
| voltar ao comportamento antigo da rota (só o silêncio) | `soltar só o silêncio deixa o agente morto` (`forcado: true` ≠ `false`) |

**Living System Checklist — o ciclo como peça:**

| Pergunta | Resposta |
|---|---|
| Quem me alimenta? | a decisão da pessoa (`agent_case_events`), a nota interna (`conversation_notes`) e o estado da conversa — nunca o input do modelo |
| Quem eu alimento? | `lead_checkpoints` (lido pelo ritual de abertura de TODO turno), `crm_lead_activities`, `event_log ai.handoff_resolved` |
| Que atividade/log eu emito? | `handoff_triggered` (ida) e `handoff_resolved` (volta) + `api_audit_log` (`ai.reactivated_by_agent`, `ai.case_noted_by_agent`, `ai.case_closed_by_agent`) |
| Onde apareço na tela? | aviso "Automático pausado" e botão no cabeçalho da conversa; a volta na linha do tempo do negócio; o registro do agente no chamado |
| Mecanismo anti-morte | `ai.handoff_resolved` é o único produtor do sinal que retoma acompanhamento pausado — por isso é AWAITED e a rota devolve 500 se falhar |
| Continuidade IA↔humano | as duas direções: `buildHandoffSummary` na ida (já existia) e o checkpoint de retomada na volta (esta wave) |
| Mapa vivo atualizado? | `docs/architecture/escalacao-ciclo-humano.architecture.json` — 30 peças, 38 arestas; as 7 peças novas entram com 3 a 8 arestas cada |

---

## Bugs encontrados

### BUG-01 — devolver o atendimento ao agente não devolvia nada

- **Achado em:** `99cd0fc`, pelo terminal "Maestro", ao extrair a regra da rota
  `POST /api/v1/conversations/[id]/reactivate-bot` para `lib/escalacao/retomada.ts`.
- **Sintoma observado:** a rota respondia `{ reactivated: true }` e o agente
  continuava mudo para sempre. Medido contra Postgres real em
  `tests/invariants/escalacao-ciclo-humano.test.ts`: depois de
  `performHumanHandoff`, limpar só `bot_silenced_until` (exatamente o que a rota
  fazia) deixa a função de guarda REAL `isLeadInHandoff` devolvendo `true`.
- **Causa raiz:** a passagem para humano liga **três** travas e a rota soltava
  uma. `contacts.force_human = true` não era escrito de volta para `false` em
  **lugar nenhum do repo** (`grep -rn force_human`) — e ele é lido por
  `workers/ai-response-worker.ts` (`skip("force_human")`), por `isLeadInHandoff`
  (NO-OP antes de qualquer chamada de modelo) e por
  `lib/agent-engine/guardrails/before-send.ts` (`(is_blocked or force_human) as
  stopped`, que veta TODO envio). A terceira trava é `assignee_kind='user'`
  (`skip("assigned_to_human")`).
- **Correção:** `lib/escalacao/retomada.ts` — solta o dono pela regra existente
  (`fn_conversation_assign` reason `release`), limpa as marcas de passagem na
  conversa e limpa `force_human` no contato. SHA do fix: `c0db6aa`.
- **Prova do fix:** o invariante roda a função de guarda REAL e mostra os dois
  estados (`true` com só o silêncio limpo, `false` com `force_human` junto); o
  unitário prende a escrita `{ force_human: false }` e reprova quando ela some.

### BUG-02 — a volta sumia da linha do tempo do negócio

- **Achado em:** `99cd0fc`, mesma extração.
- **Sintoma observado:** `crm_lead_activities` tinha `handoff_triggered`
  ("Passou para humano") e nenhum tipo para a volta. Na timeline o cliente saía
  para uma pessoa e nunca voltava — meia continuidade, que se lê como
  continuidade.
- **Causa raiz:** só a ida tinha emissor; o vocabulário fechado
  (`lib/leads/activity-vocabulary.ts`) não tinha o tipo da volta.
- **Correção:** tipo `handoff_resolved` ("Voltou para o atendimento automático")
  + emissão em `lib/escalacao/retomada.ts` via `emitLeadActivity` com a constante
  compartilhada (nunca string literal). SHA: `c0db6aa`.
- **Prova do fix:** `a volta aparece na linha do tempo do negócio`, que reprova
  quando o tipo é trocado.

### BUG-03 — o agente não tinha como registrar nada num chamado

- **Achado em:** `99cd0fc`, ao mapear `agent_case_events`.
- **Sintoma observado:** o CHECK de `kind` não tinha valor honesto para "o agente
  registrou o que aconteceu depois". Reusar `lead_provided` ou `human_replied`
  faria a linha do tempo do chamado mentir sobre quem agiu — e é desse registro
  que sai o resumo entregue ao próximo atendente.
- **Correção:** migration `0100` + apêndice no baseline + MANIFEST, e as
  transições `registrarNotaDoAgente` / `encerrarChamadoPeloAgente` em
  `lib/agent-engine/agent/human-cases.ts` (mesmo estilo atômico das irmãs).
  SHA: `c0db6aa`.
- **Prova do fix:** invariante contra Postgres real, incluindo a sabotagem "a
  0100 não chegou ao baseline" (o defeito que deixa o clone self-host sem a
  mudança) — 6 testes reprovam.

### BUG-04 — a rota de devolver o atendimento não tinha porta em tela nenhuma

- **Achado em:** `c0db6aa`, ao montar o E2E do ciclo: não havia o que clicar.
- **Sintoma observado:** `grep -rn "reactivate-bot"` em `app/` e `components/`
  devolve só o próprio `route.ts` e um comentário. A rota existe desde a IA-06 e
  nenhuma tela a chamava — e a conversa com o atendimento automático desligado
  tinha exatamente a mesma cara de uma conversa normal.
- **Causa raiz:** o estado nem chegava ao cliente: `SELECT_COLS` de
  `app/api/v1/conversations/_handler.ts` não trazia `bot_silenced_until` nem
  `contacts.force_human`, então a tela não tinha como saber que havia algo a
  devolver.
- **Correção:** as duas colunas no `SELECT_COLS` (+ tipos), o aviso "Automático
  pausado" e o botão "Devolver ao automático" em `ConversationHeader`, e o hook
  `useResumeAiAttendance`. Junto: `STATUS_LABEL` ganhou `pending` — é o estado em
  que a passagem deixa a conversa, e o rótulo faltava, então TODA conversa
  escalada mostrava `pending` cru no rosto do atendente.
- **Prova do fix:** `tests/e2e/escalacao-ciclo.spec.ts` passos (3) e (4), com
  captura de tela.

### BUG-05 — metade das passagens não aparecia na linha do tempo

- **Achado em:** `c0db6aa`, desenhando o mapa vivo (a aresta não existia).
- **Sintoma observado:** `crm_lead_activities` recebia `handoff_triggered` só
  pelo caminho do CRM (`lib/ai/handoff/orchestrator.ts`). `performHumanHandoff` —
  usada pelo harness (`inbound-turn`) **e** pelo "Assumir eu" dos casos
  (`POST /ai/cases/:id/reply`) — não gravava atividade nenhuma. No dossiê do
  cliente o atendimento saía para uma pessoa e sumia.
- **Causa raiz:** dois caminhos de passagem, um emissor só.
- **Correção:** `performHumanHandoff` emite via `emitAgentActivityForContact`
  (mesmo emissor pg do resto do motor), com `reason` **fixo** — `opts.reason`
  pode ser o texto livre que o atendente escreveu ao escalar, e essa linha
  aparece na tela e no export de LGPD.
- **Prova do fix:** `a IDA também aparece na linha do tempo — não só o caminho do
  CRM` (invariante), que reprova quando o tipo é trocado.

---

## Achados reportados, NÃO consertados (fora do escopo desta wave)

### ACH-01 — o mesmo caminho também não emite `ai.handoff_triggered` no `event_log`

`performHumanHandoff` cancela os crons do próprio motor
(`cancelPendingCronsForLead`), mas **não** emite `ai.handoff_triggered`. Quem
consome esse evento é `lib/followup/reactivity.ts` (reação 2), o mecanismo de
follow-up do lado do CRM: pelo caminho do harness e pelo "Assumir eu" dos casos,
um `followup_enrollment` ativo **não é pausado** enquanto uma pessoa atende.

Não consertei de propósito: mexer nisso muda o contrato de pausa/retomada do
follow-up, que é a superfície da **Wave 2 (`reter`)**, e um emissor a mais aqui
pode virar cancelamento em dobro com o cron do motor. Medido em `c0db6aa` por
leitura dos dois emissores (`orchestrator.ts` emite; `human-handoff.ts` não) e
pelos consumidores em `reactivity.handler.ts`.

### ACH-02 — `tests/invariants/followup-reactivity.test.ts` é intermitente na suíte completa

**O que se vê:** sempre o mesmo caso (`marca next_eval_at=now + wake marker`),
sempre `AssertionError: expected +0 to be 1` em `tick1.scheduled`.

**O mecanismo, lido no código (não inferido do sintoma):**
`fn_claim_due_followup_enrollments(p_limit, p_lease)` reclama enrollments
**globalmente** — sem filtro de organização —, `order by next_eval_at limit
p_limit`, e marca `claimed_until = now() + 120s`. O teste chama o tick com
`limit: 5` e cobra `scheduled === 1`. Num banco compartilhado, bastam **5**
enrollments vencidos e não-reclamados mais antigos, em qualquer organização,
para encher o lote e deixar o do teste de fora. E `runFollowupTick` engole
qualquer erro do claim (`catch { return summary }`), então o sintoma é sempre
`0`, nunca uma exceção.

**Medições (cada uma é uma corrida completa de `pnpm test:db`):**

| Configuração | Resultado |
|---|---|
| base `99cd0fc`, sem alteração | **3 de 3 verdes** |
| base + arquivo que só gasta 45s antes (nada no banco) | **2 de 2 verdes** |
| base + arquivo que só gasta 150s (acima do lease de 120s) | **2 de 2 verdes** |
| base, só `followup-engine` + `followup-reactivity` | **4 de 4 verdes** |
| branch da W3, suíte completa, SHAs intermediários | **3 verdes, 2 vermelhas** (8 corridas ao todo) |
| branch da W3, suíte completa, SHA final `120b27f` | **3 de 3 verdes** |
| `followup-reactivity` sozinho, na branch da W3 | **3 de 3 verdes** |

**O que isso permite e não permite afirmar.** A base ficou verde em 11 corridas e
a branch não: o gatilho está do meu lado, e eu **não consegui isolá-lo**. Descartei
tempo puro (45s e 150s), a família `followup-*` sozinha e exaustão de conexão
(zero ocorrência de `too many clients` no log da corrida vermelha). Nenhum arquivo
meu escreve em `followup_enrollments` — conferido por leitura.

**Três verdes no SHA final NÃO fecham o assunto**, e é importante que ninguém leia
assim: num intermitente de ~25%, três corridas limpas saem por acaso com quase 40%
de chance. Entre os vermelhos e agora eu isolei as fixtures do meu invariante (ele
usava as linhas compartilhadas do `seedGov`) — pode ter sido isso, e pode não ter
sido: **um dos dois vermelhos aconteceu DEPOIS da isolação**. Fica declarado como
aberto.

### ACH-02 (continuação) — experimento pareado, e o que ele fecha

A primeira comparação estava mal desenhada, e a crítica veio do `@MaestroConexoes`:
eu tratei "a branch" como variável única quando havia **quatro** estados de código
dentro dela (fixtures compartilhadas → isoladas → + fixture de negócio → + emissão
da ida). Um dos dois vermelhos aconteceu DEPOIS da isolação, então nem dentro da
minha própria série o rótulo era uma variável.

Refeito com **SHA fixo dos dois lados** e rodadas **alternadas** (a carga da
máquina varia ao longo de horas; rodar um lado inteiro antes do outro confundiria
efeito com horário):

| Lado | SHA | Corridas | Vermelhos |
|---|---|---|---|
| controle | `99cd0fc` | 6 | **0** |
| tratamento | `6a49417` | 6 | **0** |

Somando as anteriores no MESMO estado de código: base `99cd0fc` **9 de 9 verdes**;
branch no SHA final **9 de 9 verdes**. Os 2 vermelhos ficam todos em SHAs
intermediários (5 corridas).

**Poder do experimento, para ninguém ler zero-vermelhos como "resolvido":**
se a taxa real fosse 25%, 0 em 6 sai por acaso em 17,8% das vezes (0 em 9, em
7,5%); com 40%, em 4,7%. Ou seja: **taxa alta ficou improvável, taxa moderada
continua compatível.** Não está fechado — está rebaixado.

### Os dois mecanismos candidatos, e o único conserto que mata os dois

Ambos lidos no código, não inferidos do sintoma — e ambos produzem
`expected +0 to be 1`, que é por que a atribuição é difícil:

1. **Dois relógios.** `seedEnrollment` grava `next_eval_at` com
   `new Date(Date.now() - 1_000)` (relógio do HOST) e
   `fn_claim_due_followup_enrollments` compara com `now()` (relógio do CONTAINER).
   Margem: 1 segundo.
2. **Claim global.** A função reclama sem filtro de organização,
   `order by next_eval_at limit p_limit`, e o teste cobra `scheduled === 1` com
   `limit: 5`. Cinco enrollments vencidos mais antigos, em qualquer organização
   do banco compartilhado, enchem o lote.

**Medição que desfavorece o mecanismo 1:** amostrei a defasagem host↔container
num `pgvector/pgvector:pg17` recém-subido, 5 amostras: o container está **+38 a
+53 ms à FRENTE** do host. O mecanismo 1 exigiria o container mais de **1000 ms
ATRASADO** — sinal contrário e duas ordens de grandeza de folga. Limite da
medição: container ocioso, janela de amostragem de ~130 ms, não durante os 8
minutos de suíte carregada.

**O conserto que imuniza contra os dois** (para quem tem a caneta no follow-up —
não editei arquivo de outra wave):

- gravar `next_eval_at` pelo relógio do **banco** (`now() - interval '1 second'`
  no próprio INSERT) em vez do relógio do host — mata o mecanismo 1 na raiz,
  porque deixa de existir comparação entre relógios;
- antes de cada `runFollowupTick`, estacionar os enrollments de OUTRAS
  organizações (`update followup_enrollments set claimed_until = now() +
  interval '1 hour' where organization_id <> <org do teste>`) — mata o mecanismo 2.

Os dois valem para **todos** os ticks do arquivo, não só para o caso que já foi
visto falhar: consertar só a instância observada dá álibi às irmãs.

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
