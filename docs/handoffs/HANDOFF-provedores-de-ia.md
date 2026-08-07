# HANDOFF — Provedores de IA: painel, logs e OpenRouter

> Documento **vivo**. Atualizado a cada avanço, cada bug encontrado e cada
> atividade deixada para trás. Quem assumir esta frente lê daqui.

- **Branch:** `feat/provedores-de-ia` · **Worktree:** `~/DeskcommCRM-provedores`
- **Base:** `9249e6f2` (`origin/main` em 2026-08-07)
- **Última atualização:** 2026-08-07 — quatro frentes entregues; gates verdes; prova na tela PARCIAL (ver B3)

---

## O pedido, em uma frase

Três coisas em paralelo: (1) painel para configurar o provedor de IA de cada
ponto do sistema, (2) log completo das execuções de IA, (3) OpenRouter com
catálogo que se atualiza sozinho. As três são o mesmo problema visto de ângulos
diferentes — a camada de decisão de modelo não tem dono, nem superfície, nem
rastro.

### Decisões do Rafael (2026-08-07)

1. **Painel agrupado por papel**, com "configuração avançada" que permite
   escolher ponto a ponto. Razão declarada por ele: vem aí **portabilidade com
   IA local**, e modelo local pequeno só é confiável como especialista de uma
   tarefa só — se for genérico, alucina. Isso torna a granularidade fina um
   requisito de arquitetura, não um capricho: o agrupamento é só de exibição, o
   armazenamento é por ponto.
2. **Unificar `ai_invocations` em `llm_calls`** com backfill.
3. **OpenRouter convive com BYOK.** O instalador passa a perguntar qual provedor
   o usuário quer (estilo OpenClaw/Hermes) e então coleta a chave daquele
   provedor.

---

## Diagnóstico medido (SHA `c56416aa`, antes de qualquer mudança)

**Três pilhas paralelas resolvem modelo e não se falam:**

| Pilha | Onde | Como escolhe | Onde grava |
|---|---|---|---|
| Seam do engine | `lib/agent-engine/edge/llm/run-model-call.ts` | BYOK por org + registry | `llm_calls` |
| Gateway | `lib/ai/gateway.ts` | variável de ambiente | `ai_invocations` |
| Runtime antigo | `lib/ai/runtime/agent.ts:134` (`buildModel`) | terceiro `switch` | `ai_agent_runs` |

A duplicidade já dói e está admitida no código: `app/api/v1/ai/usage/route.ts:146`
soma **duas** tabelas de telemetria para dar um número só.

**Achados que explicam o sintoma "falha e não dá para entender por quê":**

1. **`llm_calls` só grava sucesso.** Em `run-model-call.ts` o `generateText` não
   tem `try/catch` e o `INSERT` vem depois dele. Provider recusou? Nada é
   gravado. O log de IA tem um buraco exatamente na forma do problema.
2. **`purpose` existe e não decide nada.** O seam recebe `purpose:
   'stage_classifier'` e o usa só para rotular custo. O gancho do painel já
   estava lá, desconectado.
3. **Modelo e credencial vinham de lugares diferentes** — corrigido no PR #151,
   com a cicatriz documentada em `lib/agent-engine/agent/aux-model-args.ts`: um
   tenant com Anthropic padrão e agente publicado em OpenAI mandava `gpt-5-mini`
   para o endpoint da Anthropic e **o turno inteiro morria**, sem erro na tela.
4. **Transcrição recebia a chave errada.** `workers/media-derive-worker.ts`
   documenta o caso visto em VPS: chave da Anthropic enviada ao Whisper da
   OpenAI, recusa em toda tentativa, com a chave certa no `.env`.
5. **Visão de imagem falha em silêncio.** `media-derive-worker.ts:142` usa o
   modelo de *chat* da org; se ele não enxerga imagem, `describeImage` devolve
   `""` e ninguém é avisado. **Ainda aberto** — ver Pendências.

**Barreira dura para OpenRouter:** três CHECKs travam `provider` em
`anthropic|openai|google` — `ai_agent_versions_provider_check`,
`ai_models_provider_check`, `ai_provider_credentials_provider_check`.

**OpenRouter, medido em 2026-08-07** via `GET https://openrouter.ai/api/v1/models`:
**400 modelos**, **333 com `tools`** em `supported_parameters`, **58 famílias**.
O payload traz `pricing`, `context_length` e `architecture.input_modalities` —
tudo que o catálogo e a validação de capacidade precisam vem na mesma resposta.

---

## Estado por frente

| Frente | Estado | Commit |
|---|---|---|
| **0 — Registro de pontos** | ✅ concluída | `cb06cae6` |
| **1a — Schema + resolvedor** | ✅ concluída | `ab37426c`, `52a7440e` |
| **1b — Seam obedece ao painel** | ✅ concluída | `c2a78b31` |
| **1c — Tela `/app/ai/providers`** | ✅ entregue | `3d012c9c` |
| **2b — Tela `/app/ai/runs`** | ✅ entregue | `85f4532e` |
| **2 — Log registra falha** | ✅ concluída | `231c0cf1` |
| **3 — OpenRouter + catálogo** | ✅ concluída | `2910c19f` |

---

## Frente 0 — Registro de Pontos de IA ✅

**Entregue:** `lib/ai/pontos/registro.ts` — os **23 pontos** que chamam modelo,
cada um com rótulo de leigo, o que faz, papel (para o agrupamento da tela),
capacidade exigida (`tools`/`imagem`/`audio`/`embeddingDims`), arquivo emissor,
o **sintoma que o usuário vê** quando falha, e se é fixo-por-arquitetura com a
razão escrita.

Distribuição: 15 pontos passam pelo seam (`purpose`), 8 estão fora dele.

**Correção de rota durante a medição:** `send_message` aparecia no `grep` de
`purpose:` mas **não é ponto de IA** — `followup-turn.ts:348` delega para
`runAgentTurn`, que emite `agent_turn`. Teria virado um ponto fantasma no
painel. Por isso o teste varre o código nos dois sentidos.

**Prova (`tests/unit/pontos-de-ia-completude.test.ts`, 13 testes):**

| Sabotagem | Reprovações previstas | Medidas |
|---|---|---|
| A — remover `agent_turn` do registro | 2 | 2 ✅ |
| B — adicionar ponto fantasma | 1 | 1 ✅ |
| C — sintoma escrito em jargão | 1 | 1 ✅ |
| D — `agent_turn` sem exigir `tools` | 1 | 1 ✅ |
| E — varredura morta (raiz inexistente) | 2 | 2 ✅ |

Árvore limpa de volta: **13/13 passando**. `tsc --noEmit` exit 0, `eslint` exit 0
(medidos sem pipe — `cmd | tail` mascara o código de saída).

A sabotagem **E** é a que justifica o controle positivo: com a varredura morta,
o teste de pontos órfãos **passaria** (lista vazia = nenhum órfão encontrado).
Zero é indistinguível de "está tudo em ordem".

---

---

## Frente 1a — Schema e resolvedor de precedência ✅

**Entregue:**

- `supabase/migrations/20260807120000_0126_ai_purpose_bindings.sql` + apêndice
  idempotente no `baseline.sql` + linha no `MANIFEST.md` (a tripla).
- `lib/ai/pontos/resolver.ts` — a ordem entre as quatro origens que podem
  decidir o modelo de um ponto, com a **origem devolvida junto do valor**.
- `tests/unit/pontos-de-ia-resolver.test.ts` (21 testes) e
  `tests/invariants/ai-purpose-bindings.test.ts` (8 testes).

**A precedência decidida** (do mais forte ao mais fraco):

1. **Versão publicada do agente** — só para `agent_turn` e `operator_turn`. A
   escolha ali já tem tela própria; duas telas mandando na mesma coisa é como
   se cria a configuração que mente. O painel mostra os dois como leitura.
2. **Binding do painel** — os outros 21 pontos.
3. **Variável de ambiente** — os sete knobs herdados. Continuam valendo para
   quem já os usa, mas perdem para quem clicou depois.
4. **Padrão da organização** (`organizations.settings.llm`).

**Prova do baseline** (Postgres 17 local, não Docker — ver bloqueio B1):

| Etapa | Resultado |
|---|---|
| `install` fresh, `ON_ERROR_STOP=1` | exit **0** |
| `update` (re-aplicar em banco populado) | exit **0** |
| Tabela, RLS, policy, constraint única, 5 índices | presentes |

**Prova de comportamento** (não só de existência), com controle positivo antes
de cada medição:

| O quê | Medido |
|---|---|
| Constraint única recusa 2º binding do mesmo ponto | ✅ pelo nome da constraint |
| Mesmo ponto em organizações diferentes | ✅ aceito |
| Cascade da credencial | 1 → 0 |
| Cascade da organização | 1 → 0 |
| Dedup auto-curativo do apêndice | 2 → 1, sobreviveu o mais recente, constraint recriada |
| RLS: A vê só A, B vê só B | ✅ |
| RLS: escrita cruzada | barrada **pela RLS** (mensagem casada), invasor não gravado |

**Sabotagens do invariante** (previsão antes de rodar):

| Sabotagem | Previsto | Medido |
|---|---|---|
| RLS desligada | 2 | 2 ✅ |
| Constraint única removida | 1 | 1 ✅ |
| `CASCADE` → `SET NULL` | 1 | **0 → corrigido → 1** |
| Auto-cura apagada do baseline | 1 | 1 ✅ |

### Três erros meus que viraram guarda no teste

1. **`CASCADE`→`SET NULL` reprovava zero.** O teste contava
   `where credential_id = CRED_A`; sob `SET NULL` a coluna vira nula e a
   contagem também cai a zero — passava exatamente no cenário que existe para
   proibir (binding órfão). Só apareceu porque a contagem foi **prevista** antes
   de rodar. Agora conta a linha por organização.
2. **Asserção contando o banco inteiro.** "Mesmo ponto em orgs diferentes"
   falhou com 4 onde esperava 2 — resíduo de outra suíte. Banco de invariantes
   nunca está limpo; a contagem agora é escopada ao cenário.
3. **Fixture falha em silêncio.** Duas vezes a fixture quebrou (coluna `name`
   inexistente; e-mail duplicado) e a medição seguiu contra tabela vazia,
   devolvendo "não vazou" quando não havia nada para vazar. Por isso todo bloco
   agora abre com controle positivo que aborta.

---

---

## Frentes 1b/1c, 2 e 3 — o que foi entregue

### Frente 1b — o `purpose` passa a DECIDIR (`c2a78b31`)

Toda chamada de modelo já viajava com um `purpose`, usado só para rotular custo.
Agora o seam lê o binding do ponto e o aplica, com a credencial do provedor
ESCOLHIDO viajando junto.

**O alarme que quase passou batido:** os 2984 testes existentes passaram verde
depois da mudança. Isso não era alívio — os testes usam um `pg.Pool` fingido que
não responde à consulta de binding, então a leitura falha, o seam cai no padrão,
e o comportamento observado é o de antes. Verde por ausência de cobertura.
`tests/unit/seam-respeita-o-binding.test.ts` fecha o buraco medindo no argumento
que chega à **fábrica de modelo** — o único lugar que não mente.

### Frente 3 — OpenRouter (`2910c19f`)

- Migration 0127 remove os três CHECKs de provider. **Provado no banco:**
  `openrouter / meta-llama/llama-3.3-70b-instruct` entra; provider vazio é recusado.
- Tradução exercitada contra a **origem real**: 400 modelos, 0 descartados, 0
  duplicados, sanidades limpas. Conversão de preço confere com valores conhecidos
  (`openai/o1-pro` → US$ 150/M; `llama-3.3-70b` → US$ 0,10/M).
- Cron diário (04:15) no `scheduler` do compose.
- Catraca nova: o painel **recusa** modelo sem ferramentas em "Responder o
  cliente" e "Trabalhar o funil".

**Três invariantes reprovaram, todos com razão, nenhum apagado:**
`openrouter-alcance` dizia "o agente continua fora do alcance" e o próprio
cabeçalho avisava que, no dia em que alcançasse, o aviso teria de mudar. A guarda
**mudou de alvo**: antes protegia uma ausência, agora protege a proteção (recusa
+ recíproca + o `.env.example` acompanhando).

### Frente 2 — a falha deixa rastro (`231c0cf1`)

`llm_calls` só gravava sucesso: o INSERT vivia depois do `generateText`, sem
`try`. Agora grava **e relança**. Códigos normalizados pela AÇÃO que exigem de
quem instalou. Tokens em zero e custo em NULL na linha de erro.

| Sabotagem | Previsto | Medido |
|---|---|---|
| não gravar a falha | 6 | **11** (subestimei: a classificação também depende da gravação) |
| não truncar a mensagem | 1 | 1 ✅ |
| colapsar a classificação | 5 | **3** (sabotei só os ramos de `status`; os de regex seguiram classificando) |

---

## Bloqueios

| # | O quê | Estado |
|---|---|---|
| B1 | Docker voltou (28.3.2) e o Supabase local subiu. `pnpm test:db` completo (364 invariantes) **ainda não rodou** nesta frente | parcial |
| B3 | **Prova na tela PARCIAL.** Provado dirigindo o browser: login funciona, o app abre, a porta "Provedores" aparece na sidebar, e a tela responde. NÃO provado ainda: o fluxo completo de trocar o modelo de um ponto e ver a troca valer. O `supabase start` passou a falhar aplicando as migrations (cadeia fresh não sobe — conhecido) e a máquina está disputada com outras duas sessões (`t188-recon`, `t188-medidor`). O e2e está escrito em `tests/e2e/prova-painel-provedores.spec.ts` | aberto |
| B2 | **Bug meu, achado pelo e2e e já corrigido:** `carregar()` do painel não tratava exceção e a tela ficava presa em "Carregando…" para sempre — a mesma falha muda que o painel veio acabar, recriada dentro dele | corrigido |

---

## Pendências e dívidas conhecidas

| # | O quê | Onde | Estado |
|---|---|---|---|
| P1 | Visão de imagem devolve `""` em silêncio quando o modelo de chat da org não enxerga imagem | `workers/media-derive-worker.ts:142` | aberto — F1 dá a superfície, F2 dá o rastro |
| P2 | `embedding_consultar`, `transcricao_de_audio`, `visao_de_imagem` e `contagem_de_tokens` não gravam telemetria nenhuma (`registraEm: "nenhum"`) | registro | endereçado na F2 |
| P3 | `install.sh` monta o `.env` com lista fechada e trunca — env acrescentada à mão se perde ao re-rodar | `hostgator-setup-kit/install.sh` | precisa resolver ANTES da F3 mexer no instalador |
| P4 | Sete variáveis de ambiente de modelo continuam válidas e competem com o binding | `lib/agent-engine/env.ts` | ✅ resolvido em `ab37426c` — precedência declarada e testada |
| P5 | `psql-transporte.ts` duplica ~10 linhas do `gov-helpers.ts`. Não estendi o original porque `tests/invariants/**` é congelado por hook, e usar a variável de escape seria decidir sozinho uma questão do dono do repo | `tests/invariants/` | aguarda decisão do Rafael |
| P6 | Resolvedor plugado no seam (`c2a78b31`) | `lib/agent-engine/edge/llm/` | ✅ resolvido |
| P7 | `lib/ai/gateway.ts` e `lib/ai/runtime/agent.ts::buildModel` **ainda não delegam** ao resolvedor — as duas pilhas antigas seguem resolvendo por env. Afeta `sentiment_classify`, `bot_respond` e `teste_de_agente` | `lib/ai/` | aberto |
| P8 | A tela de execuções (`/app/ai/runs`) tem API pronta, **falta o componente** | `app/app/ai/` | aberto |
| P9 | `ai_invocations` ainda não foi unificada em `llm_calls` (decisão 2 do Rafael) — a API de uso segue somando as duas | `app/api/v1/ai/usage` | aberto |

---

## Como retomar

```bash
cd ~/DeskcommCRM-provedores
git fetch origin && git merge origin/main     # doutrina de higiene de branches
npx vitest run tests/unit/pontos-de-ia-completude.test.ts
```

Próximo passo: **Frente 1**, começando pela migration de `ai_purpose_bindings` e
pelo resolvedor no seam — a tela vem depois, sobre um resolvedor já provado.


---

## Gates, no fim desta sessão

| Gate | Resultado |
|---|---|
| `tsc --noEmit` | **exit 0** (medido sem pipe) |
| `vitest run` (suíte inteira) | **3046 testes, 294 arquivos, exit 0** |
| `next build` | **exit 0** |
| `eslint` (arquivos da frente) | exit 0 |
| baseline `install` fresh (`ON_ERROR_STOP=1`) | **exit 0** |
| baseline `update` (re-aplicar) | **exit 0** |
| invariante `ai_purpose_bindings` | 8/8 |

**Não rodado:** `pnpm test:db` completo (364 invariantes) e a suíte e2e inteira.

## Duas falhas que a suíte pegou no fim, e que valem registro

1. **`llm_calls_status_check` duplicado no baseline.** Um comando que rodou em
   background completou depois que eu já havia refeito a edição à mão, e o
   apêndice entrou duas vezes. Quem pegou foi `baseline-constraint-reconstruida`
   — um invariante que já existia no repo exatamente para isso.
2. **`navegacao-registry` reprovou a ordem do grupo de IA.** Duas telas novas
   entraram e o teste travava a ordem em três. Atualizado com a razão escrita:
   "Provedores" fecha a etapa de MONTAR, "Execuções" pertence a ACOMPANHAR.
