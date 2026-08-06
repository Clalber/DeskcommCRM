# HANDOFF — Índice de Atrito (spec 16)

> **Leia este arquivo no início de qualquer sessão que continue este trabalho.**
> Alimente-o a cada avanço: o que foi feito, o que foi **provado** (com evidência
> observada), bug encontrado, e o que ficou pendente. Progresso sem prova não
> entra aqui.

| | |
|---|---|
| **Branch** | `feat/indice-de-atrito` (empilhada sobre `docs/doutrina-sistema-vivo-manual`) |
| **Spec** | [`docs/specs/16-spec-indice-de-atrito.md`](../specs/16-spec-indice-de-atrito.md) |
| **Doutrina** | [`docs/doctrine/sistema-vivo/03-medida-do-proposito.md`](../doctrine/sistema-vivo/03-medida-do-proposito.md) |
| **Fase** | 4 de 4 — TODAS provadas, inclusive na tela |
| **Atualizado** | 2026-08-06 |

---

## Por que este trabalho existe

O sistema media `won`, `lost`, `conversations_handled`, `avg_first_response_seconds`
— atividade e conversão. O propósito declarado é **"menor atrito possível para os
dois lados"** e não tinha número nenhum.

Consequência concreta, não hipotética: **um agente que insiste seis vezes converte
mais e queima relacionamento — e nos painéis atuais aparece como o melhor da
organização.** `agent_cases.followup_attempts` já contava a insistência e nenhuma
tela lia a coluna.

---

## Estado atual

### ✅ Feito e PROVADO

| Peça | Arquivo | Prova observada |
|---|---|---|
| Migration 0116 | `supabase/migrations/20260806190000_0116_fn_atrito_metrics.sql` | `pnpm test:db` verde — baseline aplicado em **install** e **update** |
| Apêndice do baseline | `supabase/baseline.sql` (fim do arquivo) | idem — é o que o self-hoster aplica |
| Linha no MANIFEST | `supabase/migrations/MANIFEST.md` | — |
| Módulo de pares | `lib/metrics/atrito.ts` | 26 testes unitários verdes |
| Teste unitário (gate da regra 3.3) | `tests/unit/atrito-par-eficiencia-dano.test.ts` | 26/26 · **2 sabotagens confirmadas** |
| Invariante de banco | `tests/invariants/atrito-metrics.test.ts` | 11/11 contra Postgres real · **1 sabotagem confirmada** |
| Rota | `app/api/v1/metrics/atrito/route.ts` | **`REDE 200`** no Playwright, com sessão real |
| Hook | `hooks/metrics/useAtritoMetrics.ts` | idem — o painel consome dele |
| Painel | `app/app/metrics/_components/AtritoPanel.tsx` | **✅ PROVADO NA TELA** — login real, 4 pares medidos por `getBoundingClientRect`, zero erros de console |

### Prova de tela — como foi feita (2026-08-06)

Ambiente: **Supabase local** (`127.0.0.1:54321`), `next build` + `next start` na
porta 3100, login real com `e2e-manager@deskcomm.test` via Playwright.

> ⚠️ **`.env.local` do repo aponta para a NUVEM DE PRODUÇÃO**
> (`rrydmwnporysaiysiztn.supabase.co`). O app foi subido com as vars do Supabase
> sobrescritas no `process.env` (o Next dá precedência a elas), e isso foi
> **medido, não presumido**: o HTML de `/login` referencia só `127.0.0.1:54321`,
> nenhuma ocorrência de `*.supabase.co`.

Cenário seedado na org de teste (5 demandas encerradas, uma com 6 retornos, 12
envios da IA / 8 humanos pelo sistema / 3 pelo celular, 2 vetos, 1 descadastro).

Medido na tela: 4 pares · `custoNoMesmoCard: true` em todos · `antesDoFunil: true`
· zero erros de console · sem scroll horizontal em 1280px.

### Defeitos MEUS achados na prova de tela — e corrigidos

A tela funcionava. A pergunta "está verdadeiramente bom?" achou quatro coisas:

| # | Defeito | Por que importava | Correção |
|---|---|---|---|
| 1 | **O sinal que motivou a spec não aparecia.** A função calculava `insistencia_max` (=6) e o painel publicava só a média (2.0) | Numa base de 40 demandas, seis retornos num único cliente somem na média — é exatamente o caso que a spec existe para denunciar. Medir o dano e escondê-lo na exibição é o mesmo defeito, um andar acima | Dano "Insistência no pior caso" ao lado da média + teste que exige os dois juntos e nessa ordem |
| 2 | Subtítulo da página mentia: "Funil e performance por atendente" | A página mudou de conteúdo e o texto não (invariante 5) | "Atrito, funil e performance…" — `grep` em `tests/` antes de mexer, nenhum teste dependia |
| 3 | Legenda do `—` aparecia mesmo sem nenhum `—` na tela | Ruído compete com o que importava (invariante 5) | Legenda condicional |
| 4 | Mediana e p90 idênticos (35min/35min) sem explicação | Dois números iguais lado a lado leem-se como bug | Nota condicional: "Igual à mediana: há poucas esperas medidas…" |

Reprovado na tela após a correção: `valorPiorCaso: "6"` visível ·
`legendaTravessaoPresente: false` · `notaBasePequena: true` · subtítulo corrigido.

### ⚠️ Pendente

1. **`lib/database.types.ts` não regenerado.** A RPC nova não está tipada. Medido
   nesta sessão: **o typecheck NÃO vigia nome de RPC** (`s.rpc("fn_que_nao_existe")`
   passa no `tsc --noEmit` sem erro), então isso não quebra o build — mas deixa o
   contrato desatualizado.
2. **Decisões de régua da Fase 2** (spec §5): definição de "primeira resposta
   útil", janela de abandono por canal, e o denominador definitivo.
3. **Spec 16 §7 (Living System Checklist): "atualizei o mapa?" segue pendente** —
   `docs/architecture/*.json` não reflete a peça nova.

---

## Fase 2 — abandono e a régua (2026-08-06)

### O que entrou

| Peça | Prova observada |
|---|---|
| Migration **0117** — `fn_atrito_metrics` ganha `p_abandono_horas` (default 72) + `abandonos` + `conversas_com_fala_nossa` | `test:db` verde; controle confirma **uma só função** de 4 args (o `drop` da de 3 funcionou) |
| Dano "Conversas que morreram no silêncio (após Nh)" no par Conversão | 35 unitários · 15 invariantes |
| `lerAbandonoHoras` — leitura defensiva de jsonb livre | 4 testes; **sabotagem 1/1** |
| `PATCH /api/v1/metrics/atrito` — muda a régua (manager+) | **PATCH 200 na tela**, com efeito no número |
| Controle da régua no cabeçalho do painel | **clicado de verdade** no Playwright |
| Audit `metrics.atrito_regua_changed` | linha confirmada em `api_audit_log` |

### A prova que vale — o ciclo completo, clicando

```
ANTES:  régua 72h  → abandono 50.0%
        [digitou 120 no campo, clicou em Salvar]
        REDE PATCH 200 → REDE GET 200
DEPOIS: régua 120h → abandono 40.0%   (rótulo do dano acompanhou: "após 120h")
```

A escrita foi provada **pelo efeito no número**, não por uma mensagem "salvo" —
que é exatamente o modo como o bug conhecido de `organizations` engana
(client de sessão casa 0 linhas e o PostgREST devolve sucesso).

Confirmado no banco, de forma independente: `settings->'atrito'` =
`{"abandono_horas": 120}`; audit gravado; e o merge preservou `llm`, `routing`,
`visibility_mode` e `canonical_conversation_tags` — nada foi sobrescrito.

### Defeitos achados e corrigidos nesta fase

| # | Defeito | Como apareceu | Correção |
|---|---|---|---|
| 1 | `Number(true) === 1` — um `true` no jsonb viraria "abandono após 1h" e o painel acusaria abandono em massa, com cara de dado | **Teste que eu mesmo escrevi reprovou** antes de qualquer prova de tela | `typeof` antes do `Number()`; sabotagem confirma 1/1 |
| 2 | O `as unknown as AtritoRaw` da rota escondia um `escopo` sem `abandono_horas` — a tela diria "após undefined h" | Revisão do próprio cast | Campo explícito no fallback |
| 3 | Controle da régua ficou no RODAPÉ, a três cards do número que governa | Prova de tela | Movido para o cabeçalho da seção |
| 4 | 0117 sem linha no MANIFEST | **Gate `manifest-x-migrations` reprovou** | Linha adicionada |

### Decisão de desenho — por que a régua NÃO foi para `channel_knobs`

A spec §5.2 propunha `channel_knobs`. Ao abrir a superfície existente
(`AntiBanSheet`), ela se chama **"Proteção de envio"** e trata de anti-ban:
throttle, janela horária, warm-up. A janela de abandono não é proteção de
envio — é **régua de medição**. Colocá-la lá seria a peça certa no lugar errado,
e o operador procuraria por ela onde ela não está.

Foi para `organizations.settings->'atrito'`, exibida e editável **junto do
número que ela governa** — o que satisfaz o invariante 6 (ver + mudar + falha
visível) e a regra 4 do cap. 3.4 ao mesmo tempo.

### 🐛 Segundo achado PRÉ-EXISTENTE

`tests/unit/ai-response-worker-model-routing.test.ts > "o defeito, explicitado:
model como STRING nem emite requisição"` **falha na `main`**, medido com
controle: `git checkout main` + rodar o teste sem nenhum código desta branch →
`1 failed | 2 passed`. Meu diff não toca `workers/ai-response-worker.ts`.
Merece issue própria.


---

## Fase 3 — repetição e espera calada (2026-08-06)

| Peça | Prova |
|---|---|
| Migration **0118** — `fn_atrito_jaccard` + `p_repeticao_min` + `p_espera_horas` | `test:db` install+update; **uma só função**, 6 args |
| "Perguntas que a pessoa teve de repetir" | tela: **27,3%**, rotulada como PISO |
| "Esperas sem nenhuma resposta por mais de 4h" | tela: **6,5%** |
| Cobertura do detector | 5 invariantes novos (20 no total) · 40 unitários |

### A decisão técnica, e a medição que a produziu

A spec §5.1 propunha embedding. **Duas medições mataram essa ideia:**

1. `lib/ai/embed.ts` depende de `AI_GATEWAY_API_KEY`/OpenAI — env **opcional**.
   Num self-host sem chave a métrica ficaria em ZERO **em silêncio**, e zero ali
   lê como "o cliente nunca precisou repetir". Zero lisonjeiro na pior forma.
2. `baseline.sql` cria **apenas `pgcrypto`** — `pg_trgm` não é garantida em quem
   aplica só o baseline, que é o que o kit self-host faz.

Solução: **Jaccard de tokens em SQL nativo**. Sem extensão, sem chave, sem custo
por mensagem — a mesma técnica que o gate de spinning já usa neste repo.

### O limiar foi CALIBRADO, não chutado

Bateria de 15 pares pt-br em três classes:

| limiar | reperguntas pegas | falsos positivos |
|---|---|---|
| 0.5 | 6/7 | **3** |
| 0.6 *(meu palpite inicial)* | 5/7 | **2** |
| **0.7** | **3/7** | **0** ← escolhido |
| 0.8 | 2/7 | 0 |

**As faixas se sobrepõem:** repergunta 0.33–0.80, pergunta-diferente-sobre-o-
mesmo-tema 0.17–0.67 ("horário aos sábados" × "aos domingos" = 0.67). **Não
existe limiar que separe as duas classes com Jaccard puro.**

0.7 é onde o falso positivo zera. A assimetria de custo justifica: falso
positivo levaria alguém a "consertar" um agente que está certo; falso negativo
só subconta. Por isso o número é publicado como **PISO** e a tela o rotula
assim, com a limitação visível ("escapa desta medida").

Validado com dados reais: 3 reperguntas detectadas, **zero falsos positivos** —
a plantada (0.83) e duas mensagens literalmente idênticas (1.00).

### Dívida declarada da Fase 4

Reformulação com outro vocabulário ("qual o prazo" → "quanto tempo demora") mede
**0.00** e escapa. Quando houver embedding sem env opcional, esta camada vira o
filtro barato da frente e o vetor decide o resto. Um invariante guarda esse
limite para que ninguém "conserte" o número baixando o limiar sem recalibrar.

---

## Fase 4 — a demanda como entidade, e o denominador definitivo (2026-08-06)

Esta fase não é "mais uma métrica": ela arrasta o **capítulo 5 da doutrina**.

### 0119 — a entidade

O propósito é resolver demandas, e a unidade do propósito não existia. Medido:
`agent_cases` tinha 7 linhas e **zero com `lead_id`** — é caso de ESCALADA
(nasce só de handoff, 1:1 com conversa, não conhece o negócio).

`demandas` + `demanda_conversas` (N:N). Dono nunca vazio; próximo passo é
**campo**, não derivação; desfecho enumerado incluindo `encerrada_pelo_cliente`
e `expirada_sem_resposta`. Passo 1 do cap. 5 §5.6: **cria ao lado, nada é
removido**. Passo 2: deriva o passado por **regra escrita** (R1 casos, R2
conversas sem caso), nunca por heurística.

Provado: 12 demandas derivadas (7 de caso, 5 de conversa), 12 vínculos N:N.
Idempotente — testado com `drop`+re-apply E com re-apply sobre banco populado.

### 0120 — o denominador

O índice deixa de contar sobre casos (6) e passa a contar sobre demandas (5).
Os números mudam e **não é regressão**: antes media-se a fatia difícil, agora o
todo. Índice que só olha casos escalados superestima o atrito médio.

Insistência, toque humano e retrabalho continuam vindo de `agent_cases` pelo
ponteiro `demandas.agent_case_id`, e o payload declara `demandas_com_caso` como
denominador PRÓPRIO deles — medir insistência sobre o total diluiria o sinal no
lugar exato onde a spec 16 nasceu.

### O ganho maior não era o denominador

**O invariante 4 da doutrina virou NÚMERO.** "Nenhuma demanda sem próximo
passo" era verificável em teoria desde que foi escrito; agora é medida na tela:
`demandas_sem_proximo_passo` = **7 de 7 abertas** no banco de referência. Antes
da 0119 isso não era sequer enumerável.

### Gate que funcionou

Ao trocar o denominador, **4 invariantes quebraram na hora** — a fixture criava
casos e a função passou a contar demandas. Não foi acidente: foi o gate
detectando a troca. Fixture atualizada, 20/20.

### Provado na tela

Texto medido no painel, com login real:

```
Base: 5 demandas encerradas nos últimos 30 dias, e 7 ainda abertas.
   → a ressalva "entre as que passaram por atendimento humano" SAIU

Demandas abertas sem próximo passo
De 7 abertas agora. Cada uma é alguém esperando sem que nada
esteja marcado para acontecer.
   → o invariante 4 da doutrina, na tela, como número
```

Zero erros de console. As métricas das Fases 1–3 seguem intactas
(repergunta 27,3% como piso, espera calada 6,5%, abandono, pior caso).

### ⚠️ PENDENTE nesta fase

- **Passo 3 do cap. 5**: criar demanda no ponto de entrada real. Hoje só existe
  a derivação do passado — conversa nova ainda não abre demanda sozinha.
- **Passo 4 do cap. 5**: migrar os demais consumidores (Radar de Risco, inbox).
- Sem isso, `demandas` é uma entidade correta que **para de crescer** — e uma
  peça que só recebe é ilha pelo invariante 1.

---

## Sabotagens — o que foi provado que os testes pegam

Verde não prova nada; o que prova é o teste reprovar quando deveria. Cada
sabotagem teve **previsão de contagem antes de rodar**.

| Sabotagem | Previsão | Resultado | O que isso prova |
|---|---|---|---|
| Predicado do abandono perde "falamos por último" | 2 reprovações | **2** ✅ (`expected 2 to be 1`) | O controle negativo distingue "abandono" de "toda conversa em que falamos" |
| `lerAbandonoHoras` sem o guard de `typeof` | 1 reprovação | **1** ✅ | `true` no jsonb não vira régua de 1 hora |
| Esvaziar `danos` de todos os pares | 6 reprovações | **6** ✅ | A regra 3.3 (eficiência nunca publicada sozinha) é gate real, não comentário |
| `razao()` devolver `0` em vez de `null` | 3 reprovações | **3** ✅ | O zero-lisonjeiro é vigiado: org sem envio não reporta "0% de contorno" |
| `fn_atrito_metrics` → `SECURITY DEFINER` | 1 reprovação | **1** ✅ (`expected 1 to be +0`) | **Vazamento entre inquilinos reproduzido**: a função entregou a demanda da org vizinha a um usuário da org A. O invariante o pega |

A terceira é a mais importante: ela demonstra que promover a função a definer
"para simplificar" vira vazamento — e que o CI reprova antes disso chegar na main.

---

## Bugs e armadilhas encontrados no caminho

| # | O quê | Causa | Estado |
|---|---|---|---|
| 1 | Fixture do invariante estourava FK em `agent_cases` | `seedGov` já gasta o par (`GOV_CONTACT_1`, `GOV_SESSION`) e `conversations` tem unique nele → meu insert caiu no `on conflict do nothing` **em silêncio**, e a FK só estourou depois, longe da causa | ✅ corrigido — contato próprio, que também isola as contagens de outras suítes |
| 2 | `ON CONFLICT` recusado em `agent_cases` | A tabela tem unique **deferrable**, e o Postgres não a aceita como árbitro | ✅ corrigido — idempotência por limpeza explícita |
| 3 | Porta 54329 ocupada por container de **outra sessão** | Ambiente compartilhado | ✅ contornado com `TEST_DB_PORT=54341` — o container alheio **não** foi tocado |
| 4 | `page.fill()` no login não logava ("Email inválido") | O form usa react-hook-form, que escuta eventos de teclado; `fill` seta o valor sem disparar o que ele espera | ✅ `pressSequentially` — **bug da sonda, não do app** |
| 5 | `page.evaluate(() => …)` quebrava com `__name is not defined` | O esbuild do `tsx` injeta helpers que não existem no contexto da página | ✅ medição passada como **string** |
| 6 | Migration nasceu como `0115`, número já tomado | A `0115` existe na branch `feat/tres-papeis-do-agente` | ✅ renumerada para `0116` — **pego pelo hook de pre-commit**, não por mim |

### 🐛 Achado PRÉ-EXISTENTE (fora do escopo, não é regressão desta branch)

**A aplicação tem overflow horizontal em telas de 390px.** Medido:
`scrollWidth=602` contra `clientWidth=390` — **idêntico em `/app/inbox`,
`/app/kanban` e `/app/metrics`**, e todos os elementos culpados têm
`dentroDoAtrito: false`. É do layout/header global, não do painel novo.

Controle em `tests/sonda-overflow-controle.ts`. **Vale abrir issue própria** —
num produto self-host, uma tela que não cabe no celular é primeira impressão ruim.

### Instrumentos quebrados que quase viraram medição (3 vezes nesta sessão)

Registrado porque é padrão, não acidente:

- `perl -0pi -e` falhou com erro de sintaxe → arquivo **não** foi sabotado → teste
  passou verde e pareceu que o gate não pegava.
- `grep ... | head` mascarou o exit code → o `||` de fallback nunca disparou → o
  controle não reportou nada e o silêncio pareceu resultado.
- `grep "create policy"` **case-sensitive** contra um dump que usa `CREATE POLICY`
  → concluí que `contacts` não tinha policy. Tinha.

**Lição operacional:** toda sonda leva controle positivo junto. Silêncio de
ferramenta é indistinguível de achado.

---

## Decisões tomadas (e por quê)

- **Denominador = `agent_cases` fechados**, com escopo **rotulado na tela**
  ("entre as que passaram por atendimento humano"). A unidade de demanda de
  verdade é o cap. 5 da doutrina e ainda não existe. Índice com escopo declarado
  é honesto; índice que finge cobrir tudo destrói a comparação quando o escopo mudar.
- **`SECURITY INVOKER`**, igual à `fn_attendant_metrics`. Definer daria org-wide a
  quem a RLS restringe — e a sabotagem acima mostra exatamente isso acontecendo.
- **Sem filtro por atendente.** Atrito é propriedade do sistema; quebrá-lo por
  pessoa convida a otimização local que degrada o todo (doutrina §3.6).
- **Painel ACIMA do funil e da performance.** É o número do sistema inteiro, ao
  qual as métricas de área se subordinam. Embaixo, viraria rodapé.
- **`external_device` entra no denominador da automação.** Excluí-lo inflaria a
  taxa numa org onde o time responde pelo celular: ali a IA não absorveu, ela só
  não foi usada.

---

## Achado que mudou o desenho

`messages.sent_via` tem três valores, e o terceiro não estava previsto na spec:

| Valor | Significa |
|---|---|
| `ai` | O agente respondeu |
| `user` | Humano respondeu **pelo sistema** |
| `external_device` | Humano respondeu **pelo celular, fora do sistema** |

O terceiro virou a **taxa de contorno** — quantas vezes o operador contornou a
própria ferramenta. Provavelmente a métrica de atrito da empresa mais honesta que
existe, porque ninguém a reporta espontaneamente.

---

## Como reproduzir a prova

```bash
# 1. Supabase local de pé + migration aplicada
npx supabase status
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -f supabase/migrations/20260806190000_0116_fn_atrito_metrics.sql

# 2. App apontando para o LOCAL (nunca para a nuvem do .env.local)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon local> \
SUPABASE_SERVICE_ROLE_KEY=<service local> \
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
PORT=3100 pnpm build && ... pnpm start

# 3. Provar
npx tsx tests/sonda-atrito-tela.ts       # 4 pares medidos, screenshots
npx tsx tests/sonda-atrito-detalhe.ts    # as 4 correções de UI
npx tsx tests/sonda-overflow-controle.ts # controle do overflow pré-existente
```

Sempre confirme, antes de qualquer coisa, que o HTML servido referencia
`127.0.0.1:54321` e **nenhum** `*.supabase.co`.

---

## Próximo passo

Fase 1 está **fechada e provada**. As opções, em ordem de valor:

1. **Fase 2 — as réguas** (spec §5): "primeira resposta útil", janela de abandono
   em `channel_knobs` com tela (invariante 6), denominador definitivo.
2. **Regenerar `lib/database.types.ts`** — barato, tira a pendência de contrato.
3. **Issue do overflow mobile** — pré-existente, mas é primeira impressão num
   produto que se instala.
