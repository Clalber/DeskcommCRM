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
| **Fase** | 1 de 4 (componentes deriváveis, sem mudança de schema no caminho quente) |
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

## Sabotagens — o que foi provado que os testes pegam

Verde não prova nada; o que prova é o teste reprovar quando deveria. Cada
sabotagem teve **previsão de contagem antes de rodar**.

| Sabotagem | Previsão | Resultado | O que isso prova |
|---|---|---|---|
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
