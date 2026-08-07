# HANDOFF — Provedores de IA: painel, logs e OpenRouter

> Documento **vivo**. Atualizado a cada avanço, cada bug encontrado e cada
> atividade deixada para trás. Quem assumir esta frente lê daqui.

- **Branch:** `feat/provedores-de-ia` · **Worktree:** `~/DeskcommCRM-provedores`
- **Base:** `9249e6f2` (`origin/main` em 2026-08-07)
- **Última atualização:** 2026-08-07 — Frente 1, parte 1 (schema + resolvedor) provada

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
| **1b — Tela `/app/ai/providers`** | ⏳ próxima | — |
| **2 — Log de runs** | ⬜ não iniciada | — |
| **3 — OpenRouter + catálogo** | ⬜ não iniciada | — |

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

## Bloqueios

| # | O quê | Estado |
|---|---|---|
| B1 | **Docker desta máquina não responde** (`docker info` pendura indefinidamente). Contornado com Postgres 17 via Homebrew + `TEST_DB_PSQL`; o CI segue usando o container. `pnpm test:db` completo (364 invariantes) **ainda não rodou** nesta frente | aberto |

---

## Pendências e dívidas conhecidas

| # | O quê | Onde | Estado |
|---|---|---|---|
| P1 | Visão de imagem devolve `""` em silêncio quando o modelo de chat da org não enxerga imagem | `workers/media-derive-worker.ts:142` | aberto — F1 dá a superfície, F2 dá o rastro |
| P2 | `embedding_consultar`, `transcricao_de_audio`, `visao_de_imagem` e `contagem_de_tokens` não gravam telemetria nenhuma (`registraEm: "nenhum"`) | registro | endereçado na F2 |
| P3 | `install.sh` monta o `.env` com lista fechada e trunca — env acrescentada à mão se perde ao re-rodar | `hostgator-setup-kit/install.sh` | precisa resolver ANTES da F3 mexer no instalador |
| P4 | Sete variáveis de ambiente de modelo continuam válidas e competem com o binding | `lib/agent-engine/env.ts` | ✅ resolvido em `ab37426c` — precedência declarada e testada |
| P5 | `psql-transporte.ts` duplica ~10 linhas do `gov-helpers.ts`. Não estendi o original porque `tests/invariants/**` é congelado por hook, e usar a variável de escape seria decidir sozinho uma questão do dono do repo | `tests/invariants/` | aguarda decisão do Rafael |
| P6 | O resolvedor existe e é testado, mas **ainda não está plugado** no seam (`run-model-call.ts`) nem em `lib/ai/gateway.ts` — nenhum comportamento de produção mudou até aqui | `lib/agent-engine/edge/llm/` | próxima etapa da F1 |

---

## Como retomar

```bash
cd ~/DeskcommCRM-provedores
git fetch origin && git merge origin/main     # doutrina de higiene de branches
npx vitest run tests/unit/pontos-de-ia-completude.test.ts
```

Próximo passo: **Frente 1**, começando pela migration de `ai_purpose_bindings` e
pelo resolvedor no seam — a tela vem depois, sobre um resolvedor já provado.
