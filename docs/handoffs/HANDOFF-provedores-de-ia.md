# HANDOFF — Provedores de IA: painel, logs e OpenRouter

> Documento **vivo**. Atualizado a cada avanço, cada bug encontrado e cada
> atividade deixada para trás. Quem assumir esta frente lê daqui.

- **Branch:** `feat/provedores-de-ia` · **Worktree:** `~/DeskcommCRM-provedores`
- **Base:** `9249e6f2` (`origin/main` em 2026-08-07)
- **Última atualização:** 2026-08-07 — fim da Frente 0

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
| **1 — Painel de provedores** | ⏳ próxima | — |
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

## Pendências e dívidas conhecidas

| # | O quê | Onde | Estado |
|---|---|---|---|
| P1 | Visão de imagem devolve `""` em silêncio quando o modelo de chat da org não enxerga imagem | `workers/media-derive-worker.ts:142` | aberto — F1 dá a superfície, F2 dá o rastro |
| P2 | `embedding_consultar`, `transcricao_de_audio`, `visao_de_imagem` e `contagem_de_tokens` não gravam telemetria nenhuma (`registraEm: "nenhum"`) | registro | endereçado na F2 |
| P3 | `install.sh` monta o `.env` com lista fechada e trunca — env acrescentada à mão se perde ao re-rodar | `hostgator-setup-kit/install.sh` | precisa resolver ANTES da F3 mexer no instalador |
| P4 | Sete variáveis de ambiente de modelo continuam válidas e competem com o binding | `lib/agent-engine/env.ts` | F1 precisa definir a precedência e documentá-la |

---

## Como retomar

```bash
cd ~/DeskcommCRM-provedores
git fetch origin && git merge origin/main     # doutrina de higiene de branches
npx vitest run tests/unit/pontos-de-ia-completude.test.ts
```

Próximo passo: **Frente 1**, começando pela migration de `ai_purpose_bindings` e
pelo resolvedor no seam — a tela vem depois, sobre um resolvedor já provado.
