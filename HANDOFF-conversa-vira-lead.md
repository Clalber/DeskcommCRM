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
| 1 | **conversa vira lead** | ✅ **completo** — código, invariantes, prova de tela e 5 sabotagens |
| 2 | contato deixa de ser anônimo | 🔄 **em curso** — 3 bugs vivos consertados, telefone do @lid ligado; falta o rótulo único e a mão do Operador |
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
| S5 | `funilDeEntrada` nunca acha o funil (**e2e**) | 3 | **3** | os três casos da prova de tela |

S4 é o que responde "e se o adaptador mentir?": um filtro ignorado derruba 12 dos 18 casos, e 3
deles são do teste do próprio adaptador.

S5 é o controle da prova de tela: os 3 casos passam em ~2s cada, e verde rápido demais merece
desconfiança. Com o nascimento desligado eles levam 22s, 30s e 22s — o tempo do timeout — e
reprovam. O spec mede o card nascendo, não outra coisa que já estivesse na tela.

### Um instrumento morto no caminho, registrado

A primeira rodada de S1 chamou `bash scripts/test-db.sh` direto — `vitest` não estava no PATH, o
script morreu com 127, e o `grep` sobre a saída devolveu **vazio**. Vazio e "nenhum teste reprovou"
têm a mesma cara. Só apareceu porque o exit code foi conferido separado da contagem.

---

## A prova de tela

`tests/e2e/conversa-vira-lead.spec.ts` — **3/3 verdes**. A mensagem entra por
`POST /api/v1/webhooks/waha/[token]`, a mesma rota que o WAHA chama, **sem header de assinatura**
(que é como o WAHA Core real chega). Nenhum `insert` direto em `crm_leads`: insert à mão mente
sobre a origem e provaria só que a tela desenha uma linha que alguém pôs no banco.

| # | o que prova |
|---|---|
| 1 | card no quadro do funil de entrada, com o NOME de quem escreveu — e zero `@c.us`/`@lid` na tela |
| 2 | a timeline diz **"Entrou pelo WhatsApp"** |
| 3 | a segunda mensagem do mesmo contato **não** abre um segundo card |

Evidência: [`evidence/spec-17/card-nascido-da-conversa.png`](evidence/spec-17/card-nascido-da-conversa.png).
Registrada no CI (`e2e.yml`, parte 1) e no mapa de jornadas (J4.22–J4.25).

Ambiente: Supabase local (`.env.e2e`, 127.0.0.1:54321) + `next build` + `next start`. **Sem
`.env.local` nesta worktree** — nenhum risco de escrever na produção.

---

## Passo 2 — o contato deixa de ser anônimo

O passo 2 **não era o que a spec dizia**, e as medições mudaram o trabalho três vezes.

### O que a produção respondeu (31 contatos ativos, leitura em 2026-08-06)

| medida | valor | o que isso derruba |
|---|---:|---|
| sem telefone | 22/31 · **71%** | todos com identidade `lid:` |
| sem e-mail | 25/31 · 81% | |
| `display_name` técnico | **3**/31 | e os três com `notify_name` VAZIO — **não há nome a recuperar** |
| mensagens de cliente COM nome no payload | **269 de 271 · 99,3%** | o nome **não** é o problema |
| payloads `@lid` que trazem o TELEFONE | **76 de 76 · 100%** | o telefone sempre chegou |

### Fatia A — três bugs vivos, uma classe (`10a3560f`, `39a7f8f2`)

O Postgres recusa atribuição a coluna `GENERATED ALWAYS … STORED` (428C9) e **aborta a instrução
inteira**. Três instâncias, cada uma provada contra Postgres real com controle positivo:

| onde | o que quebrava |
|---|---|
| `contacts/_handler.ts` | **salvar o e-mail de um contato pela tela → 500.** É o "não registra o número e email dele" do relato |
| `lgpd/anonymize/route.ts` | **a anonimização LGPD não acontecia** — direito do titular, com prazo legal |
| `waha/ingest.ts` | fim do warm-up abortava o UPDATE e levava junto o `status` do canal |

O que entra de verdade é o **gate**: `colunas-geradas-nao-sao-escritas.test.ts` PERGUNTA ao Postgres
quais colunas são geradas e varre `app/`, `lib/`, `scripts/`. O detector custou duas versões — a
primeira acusou 11 falsos positivos (declaração de tipo, montagem de resposta HTTP), e gate que
grita onde não há defeito é gate que alguém desliga.

Prova de tela: [`evidence/spec-17/contato-com-email-salvo.png`](evidence/spec-17/contato-com-email-salvo.png)
(`contato-salva-email.spec.ts`, J4.26–J4.27).

### Fatia B — o telefone que sempre chegou (migration 0122)

```
"_data": { "key": {
    "remoteJid":    "70192801575156@lid",
    "remoteJidAlt": "558183647258@s.whatsapp.net",
    "addressingMode": "lid" } }
```

A resposta estava em `webhook_events_log`, não na documentação. **Inbound 56/56 e outbound 20/20**
trazem o número — e no outbound o `remoteJid` é o chat do destinatário, então o telefone é do
cliente, não da loja (só o **nome** continua bloqueado ali, porque o `pushName` de `fromMe` é do
operador).

**Gravar o telefone, porém, quebrava o CRM.** `wa_identity` é gerada com o telefone na frente do
lid: preencher `phone_number` num contato nascido `lid` muda a identidade de `lid:X` para `phone:+Y`,
o `on conflict` deixa de casar e **nasce um contato duplicado** — o defeito que a 0027 matou. Daí
`contacts.wa_lid`: correlação do WhatsApp que não depende do telefone, com índice único e dedup
auto-curativa ANTES da constraint.

**E o canal de envio não muda.** `resolveWahaChatId` preferia telefone; com o número gravado, toda
conversa `@lid` viva passaria a sair por `@c.us` — que para contato em modo privacidade
frequentemente não é endereçável. O sintoma seria pior que um erro: mensagem marcada como enviada e
cliente sem resposta. O `lid` passou para a frente, e o **mesmo raciocínio estava numa quarta
instância** (`session-reconciler.ts`), que reenvia o que ficou preso — divergir ali faria o redrive
mandar para um endereço diferente do envio original.

`fn_upsert_wa_contact` ganhou o 7º parâmetro e mudou de regra: antes só mexia em `display_name` no
conflito, com `coalesce` — nome ruim congelava para sempre e nada descoberto depois entrava. Agora
**completa o que falta e nunca sobrescreve**, e reencontra por lid *ou* por telefone (é isso que
impede o cliente já importado de virar um segundo contato ao escrever no WhatsApp).

### O que o mapeamento derrubou

- **`Contato 543134@lid` é legado, não bug vivo.** Nenhum código no HEAD produz a string; o produtor
  morreu no commit `c890b403`. São 3 linhas de resíduo — backfill, não conserto de emissor.
- **O `pushName` não está na raiz do payload.** A hipótese de que o WAHA mandava o nome num campo que
  o código ignorava era a "causa candidata nº 1" — e é falsa: o nome vem em `_data.pushName`, onde o
  código já olha, em 341 de 343 payloads.
- **O regex `^Contato ` colide com `Contato Anonimizado #…`**, que a rota LGPD grava de propósito. O
  backfill leva `and is_anonymized = false` — sem isso, ele reverteria anonimizações (regra L-04,
  exceção "Nenhuma"). Tem caso de teste próprio.

### Medições

`pnpm test:db` **75 arquivos / 508 testes** · `pnpm test:unit` 284 arquivos · typecheck e lint zerados.
19 casos novos entre `telefone-do-lid.test.ts` (banco) e `telefone-alternativo-do-payload.test.ts`
(unit, com payloads TRANSCRITOS da produção — ninguém teria inventado o nome `remoteJidAlt`).

### Ainda em aberto no passo 2

| # | o quê | por quê |
|---|---|---|
| 1 | **O rótulo do contato em 5 lugares**, com 4 finais diferentes (`—`, `Sem nome`, …) | centralizar é o que impede a 6ª política nascer; o nome entra até no system prompt do modelo |
| 2 | **A mão do Operador** (salvar e-mail/nome dito na conversa) | depende da Fatia A, que acabou de sair; falta decidir a política de sobrescrita e a base legal (`consent` nunca é escrito hoje) |
| 3 | O título do lead é **cópia congelada** | `nascimento-do-lead` lê o nome do PAYLOAD, não do cadastro; consertar exige o item 1 antes, senão o rótulo técnico vaza para o kanban |
| 4 | Nenhum turno com WAHA real desde a 0122 | o telefone foi provado por payload gravado e por banco, não por mensagem nova ponta a ponta |

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
| 1 | O adaptador não reproduz **RLS** | conecta como `postgres`; isolamento é medido pelos invariantes de papel restrito | declarado no cabeçalho do arquivo |
| 2 | Nenhum **turno do agente** observado com o lead já nascido | exige WAHA + worker vivos; a prova de tela cobre a ingestão, não o turno | passo 3 |
| 3 | Funil semeado é de e-commerce (acima) | decisão de produto | passo 4 |
| 4 | `sem_funil_de_entrada` e `sem_etapa` só viram **log** | não há aviso na Central para quem configura | passo 4 (superfície) |
| 5 | Lead nasce **sem dono** (`owner_kind` nulo) | atribuição tem regra própria (gov-loop) e misturar as duas aqui seria decidir por cima dela | a decidir no passo 3 |
