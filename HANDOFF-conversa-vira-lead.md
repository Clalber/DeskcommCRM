# HANDOFF — A conversa vira lead (spec 17)

> Branch `feat/conversa-vira-lead`, empilhada sobre `feat/tres-papeis-do-agente` (spec 16, PR #181).
> Worktree `/Users/rafaelmelgaco/DeskcommCRM-tres-papeis`. Spec:
> [`docs/specs/17-spec-conversa-vira-lead.md`](docs/specs/17-spec-conversa-vira-lead.md).
> Antecessor: [`HANDOFF-tres-papeis.md`](HANDOFF-tres-papeis.md) — as regras de trabalho ao final
> daquele arquivo continuam valendo aqui.

---

## Estado por passo

| # | passo | estado |
|---|---|---|
| 1 | **conversa vira lead** | ✅ código + invariantes + sabotagem · ⏳ **falta prova de tela** (DoD 12) |
| 2 | contato deixa de ser anônimo | ⏳ não começado |
| 3 | escopo por pipeline | ⏳ não começado |
| 4 | tradução de etapas com superfície | ⏳ não começado |
| 5 | o laço (desfazer vira sinal) | ⏳ não começado |

---

## Passo 1 — o que entrou (`ab36fe88`)

| arquivo | papel |
|---|---|
| `lib/leads/nascimento-do-lead.ts` | a regra: onde o lead nasce e quando **não** nasce |
| `lib/waha/ingest.ts` | a ligação, entre o STOP e o dispatch |
| `lib/leads/activity-vocabulary.ts` | `lead_created` → "Entrou pelo WhatsApp" |
| `tests/pg-como-supabase.ts` | adaptador que permite rodar código-Supabase contra o Postgres do `test:db` |
| `tests/invariants/nascimento-do-lead.test.ts` | 12 casos |
| `tests/invariants/pg-como-supabase.test.ts` | 6 casos — **o instrumento medido antes de medir** |

### A posição no ingest é a regra, não detalhe

`ingest.ts` → `markConversation` → **STOP** (grava `is_blocked`) → audit → **nascimento** → dispatch.

- **Depois do STOP:** quem acabou de pedir para sair não vira oportunidade. A função relê o contato,
  então a ordem é o que garante isso.
- **Antes do dispatch:** o turno do agente resolve o lead ativo do contato. Criar depois faria o
  primeiro turno rodar sem lead — o buraco que esta peça existe para fechar.
- **Grupo (`@g.us`)** nem chega aqui: `ingest.ts:374` já retorna antes.

---

## O que foi medido

### O defeito, na produção (2026-08-06)

| medida | valor |
|---|---:|
| conversas × leads | 32 × 15 |
| leads **sem contato vinculado** | 13 / 15 · 87% |
| código que insere em `crm_leads` a partir de conversa | **nenhum** |

### A suíte

`pnpm test:db` — **73 arquivos / 495 testes verdes** (os 2 arquivos novos são +18 casos).
`pnpm typecheck` e `pnpm lint` zerados (185 warnings pré-existentes, 0 erros).

### As sabotagens — predição declarada ANTES de rodar

| # | o que foi quebrado | previsto | medido | quais |
|---|---|---:|---:|---|
| S1 | filtro `status='open'` do lead existente | 1 | **1** | "depois de FECHADO … abre demanda nova" |
| S2 | filtros `is_won`/`is_lost` da escolha de etapa | 2 | **2** | "sem_etapa" e "'Ganho' na posição 0" |
| S3 | recusa por contato bloqueado | 1 | **1** | "quem pediu para sair não vira oportunidade" |
| S4 | `.eq()` do **adaptador** virou no-op | ≥10 (≥2 no instrumento) | **12** (3 no instrumento) | — |

S4 é o que responde "e se o adaptador mentir?": um filtro ignorado derruba 12 dos 18 casos, e 3
deles são do teste do próprio adaptador.

### Um instrumento morto no caminho, registrado

A primeira rodada de S1 chamou `bash scripts/test-db.sh` direto — `vitest` não estava no PATH, o
script morreu com 127, e o `grep` sobre a saída devolveu **vazio**. Vazio e "nenhum teste reprovou"
têm a mesma cara. Só apareceu porque o exit code foi conferido separado da contagem.

---

## 🔎 Achado que muda produto (fora do escopo do passo 1)

**Toda organização nasce com o funil "Pedidos", de e-commerce, com 8 etapas hardcoded** —
`fn_seed_default_pipeline_for_org` no baseline: *Carrinho abandonado · Aguardando pagamento · Pago ·
Em separação · Enviado · Entregue · Pós-venda · Cancelado*.

Como o funil de entrada é `is_default`, **numa clínica ou imobiliária recém-instalada o lead nasce
em "Carrinho abandonado"**. Antes do passo 1 isso era invisível (nenhum lead nascia sozinho); agora
é a primeira coisa que o dono vê no kanban.

Não foi mexido aqui: mudar o seed altera o comportamento de todo clone e é decisão de produto, não
consequência deste passo. É insumo direto do **passo 4** (a superfície precisa mostrar onde os
contatos entram e permitir trocar) e candidato a item próprio: um funil neutro de entrada, ou o
onboarding perguntando o nicho.

---

## Deixado para trás (declarado, não escondido)

| # | o quê | por quê | onde fecha |
|---|---|---|---|
| 1 | **Prova de tela do passo 1** — DoD 12 | o invariante prova a REGRA; falta ver o card aparecer no kanban vindo de mensagem real | antes de fechar o passo 1 |
| 2 | O adaptador não reproduz **RLS** | conecta como `postgres`; isolamento é medido pelos invariantes de papel restrito | declarado no cabeçalho do arquivo |
| 3 | Nenhum turno de produção observado ponta a ponta com o lead nascendo | exige WAHA + worker vivos | junto com a prova de tela |
| 4 | Funil semeado é de e-commerce (acima) | decisão de produto | passo 4 |
| 5 | `sem_funil_de_entrada` e `sem_etapa` só viram **log** | não há aviso na Central para quem configura | passo 4 (superfície) |
| 6 | Lead nasce **sem dono** (`owner_kind` nulo) | atribuição tem regra própria (gov-loop) e misturar as duas aqui seria decidir por cima dela | a decidir no passo 3 |
