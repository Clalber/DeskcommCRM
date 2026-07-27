# HANDOFF — WhatsApp API Oficial (seam de canais)

> Registro contínuo. **Cada passo, cada evolução, cada pulo, cada acréscimo entra aqui** —
> nada avança sem anotação. Quem retomar esta branch lê só este arquivo e sabe onde está.

**Branch:** `feat/canais-oficial` · **Worktree:** `~/DeskcommCRM-canais`
**Base:** `origin/main` @ `0ea9f4b` (árvore limpa, `0 0` contra a main na criação)
**Plano:** `docs/superpowers/plans/2026-07-27-canais-seam-fases-0-2.md`
**Doutrina:** `docs/doctrine/restricao-de-canal.md` + invariante 6 de `sistema-vivo.md`

---

## Regra de ritmo (não negociável)

Nenhuma task começa com a anterior não provada. Cada task fecha com **5 atos**:

1. Teste vivido no navegador (Playwright, conta real, pela tela — `curl` não conta)
2. Evidência gravada em `evidence/canais/<task>/`
3. Linha neste HANDOFF (o que mudou · o que provei · o que quebrou · o que aprendi)
4. `npm run typecheck && npm run lint && npm run test:unit` zerados
5. Commit atômico

O motivo é o acúmulo: quanto mais tarde o teste, mais causas possíveis para um mesmo sintoma.

---

## Estado atual

| Item | Estado |
|---|---|
| Doutrina de restrição de canal escrita | ✅ |
| Invariante 6 (superfície de config) no sistema vivo | ✅ |
| Plano das Fases 0–2 escrito e auto-revisado | ✅ |
| Worktree limpo a partir da `main` | ✅ |
| Task 0 (baseline de regressão) | ✅ gravada em `evidence/canais/baseline/` |
| Task 0.1 (consertar os defeitos do baseline) | ✅ evidência versionada · guarda verde · e2e re-rodada em série e classificada |
| Task 1 (cortesia ≠ anti-ban) | ⬜ não iniciada |

**Nenhuma linha de código de produção foi escrita.** A Task 0 gravou a foto do "antes"
e produziu 2 instrumentos reutilizáveis (`tests/journeys/`, `scripts/provoke-agent-turn.ts`).

### O que a baseline cobre (medido, não afirmado)

| Artefato | Medição | Onde |
|---|---|---|
| unit.txt | **1038 passaram / 0 falharam** (136 arquivos) · **exit 0** — regravado na Task 0.1; a Task 0 media 1035✓/1✗, e o 1 vermelho era a Ressalva 1 | `evidence/canais/baseline/unit.txt` |
| e2e.txt | **em série:** 41 passaram / 4 falharam / 13 não rodaram (58) · **exit 1** | `.../baseline/e2e.txt` |
| e2e-paralelo.txt | **5 workers:** 29 passaram / 15 falharam / 14 não rodaram (58) · **exit 1** — guardado só para a comparação | `.../baseline/e2e-paralelo.txt` |
| gates.csv | **9 linhas** (header + 8 gates), de 1 turno REAL de IA | `.../baseline/gates.csv` |
| Screenshots | 7 paradas da jornada, vividas pela tela | `evidence/canais/baseline/` |
| typecheck / lint | **exit 0 / exit 0** (156 warnings pré-existentes, 0 erros) | — |

Cadeia `before_send` observada (a prova mais dura do plano, **esta sequência não pode mudar**):
`stop → lgpd → pacing → spinning → promise → semantic_promise → case_promise → disclosure`,
todos `pass`. Turno real: `claude-sonnet-4-5`, 1 mensagem enviada, `messages_sent:1`.

### Ressalva 1 — RESOLVIDA na Task 0.1: o plano citava prova por nome puro

`tests/unit/evidencia-citada.test.ts` reprovava **o próprio plano de canais**: ele citava
os sete screenshots por **nome puro** — "01-login.png" e irmãos, sem pasta —, e o guarda
resolve nome puro contra a pasta do documento → procurava
`docs/superpowers/plans/01-login.png`, que nunca existiria.

> E aconteceu **de novo** ao escrever esta correção: pus o nome puro em crase para
> *descrever* o defeito e criei um terceiro vermelho. O guarda não distingue descrever de
> citar — em crase, nome puro é sempre citação. Escrever entre aspas resolve.

> Escrever este handoff me fez cair na MESMA armadilha: citei dois desses nomes puros e
> criei um segundo vermelho. Citar por caminho conserta. A lição é do guarda, não minha:
> nome puro em crase é indistinguível de citação de prova.

- **Não era dívida da `main`:** `git ls-tree origin/main` não tem o plano nem este
  handoff. Nasceu nos commits `63660c0`/`c81f61d`, desta branch.
- **Conserto (Task 0.1):** toda citação passou a ser CAMINHO
  (`evidence/canais/baseline/01-login.png`). Medido: `npx vitest run
  tests/unit/evidencia-citada.test.ts` → **28 passed / 0 failed**, exit 0. Eram 26 casos
  (1 vermelho); viraram 28 porque dois documentos novos entraram na cobertura do guarda —
  `evidence/canais/README.md` e este handoff, que antes citava por caminho `.superpowers/`
  e o guarda ignorava como menção. **A suíte unitária inteira ficou verde**: `pnpm run
  test:unit` → **1038 passaram / 0 falharam · exit 0**. O `unit.txt` da baseline foi
  regravado — régua que embute defeito já corrigido mede errado.

### Ressalva 2 — RESOLVIDA na Task 0.1: a evidência passou a viver versionada

`.gitignore` linhas 84 e 92 ignoram `.superpowers/` e `.superpowers/evidence/`. O
`git add .superpowers/evidence/canais/baseline/` do Step 7 do plano adicionava **zero**
arquivos — a prova vivia só numa máquina, e nenhum clone a recebia.

- **Medido antes:** `git check-ignore -v .superpowers/evidence/canais/baseline/01-login.png`
  → `.gitignore:84:.superpowers/`. E `git ls-files evidence/ | wc -l` → **96** arquivos
  já rastreados, PNGs inclusos: `evidence/` na raiz é a convenção versionada deste repo.
- **Conserto (Task 0.1):** `.superpowers/evidence/canais/` → `evidence/canais/` (cópia +
  remoção; `git mv` não serve porque a origem nunca esteve rastreada). Os 7 PNGs,
  `gates.csv`, `unit.txt`, `e2e.txt` e `e2e-paralelo.txt` entraram no git, com
  `evidence/canais/README.md` dizendo o que cada um prova e como re-gerar. O plano, este
  handoff e o default de `CANAIS_EVIDENCE_DIR` em `tests/journeys/` apontam para o novo
  caminho.
- **O que continua fora:** `.superpowers/evidence/vps-qa/`, de outra épica. Não é meu.

### Ressalva 3 — PARCIALMENTE RESOLVIDA: agora existe régua em série

A Task 0 rodou com **5 workers** e não separou flake de defeito. A Task 0.1 re-rodou em
série (`--workers=1`) — a classificação está na seção **"Série × paralelo"** abaixo. A
suíte continua **não sendo um verde de referência**: as falhas que sobrevivem à série são
dívida pré-existente, não regressão desta branch, e nenhuma foi consertada aqui (fora do
escopo da Task 0.1, que só classifica).

**Armadilha do ambiente descoberta na re-execução:** a 3001 (default do
`playwright.config.ts`) estava ocupada por um `next-server` de **outra sessão**, com 6d23h
de uptime. Como o config usa `reuseExistingServer: false` de propósito, a suíte **aborta
inteira** em vez de rodar contra o build errado. Rodar com `E2E_PORT=3007` (ou outra porta
livre) resolve; matar o processo alheio, não — não é nosso.

### Série × paralelo — o que é flake e o que é defeito (Task 0.1, medido)

Mesmo commit (`4536ab1` + só docs/evidência mexidos), mesmo banco, mesmo build. Única
variável: `--workers=1`.

| Execução | Passaram | Falharam | Não rodaram | Total | exit | Duração |
|---|---|---|---|---|---|---|
| 5 workers (`e2e-paralelo.txt`) | **29** | **15** | 14 | 58 | 1 | 5.2 min |
| **série** (`e2e.txt`) | **41** | **4** | 13 | 58 | 1 | 3.6 min |

A série é mais rápida **e** mais verde — sinal de que a concorrência sobre fixtures
compartilhadas custava mais do que rendia.

**Falharam nas DUAS execuções → defeito provável (3):**

| Teste | Sintoma na série |
|---|---|
| `tests/e2e/error-pages.spec.ts:16` — `/500 renders erro interno` | — |
| `tests/e2e/vps-fresh-onboarding.spec.ts:111` — `J1.1 login do bootstrap cai no wizard` | `waitForURL(/\/onboarding/)` estoura 20s; `before.onboarded_at` era null |
| `tests/e2e/webhooks.spec.ts:102` — fluxo completo de webhooks/automações | a tag `e2e-tag` não aparece no card do lead no kanban |

**Só falharam em paralelo, passaram em série → flake de concorrência (12):**
`followup-builder.spec.ts:239,283,455,603,707` · `followup-journey.spec.ts:193` ·
`followup-queue.spec.ts:251` · `invite-lifecycle.spec.ts:241` ·
`kanban-owner-filter.spec.ts:51` · `password-recovery.spec.ts:65` ·
`risk-radar.spec.ts:70` · `vps-webhook-outbound-ssrf.spec.ts:95`.

`followup-journey.spec.ts:193` é o caso mais claro: 5.0 min e vermelho em paralelo,
**33.2 s e verde** em série.

**Não classificável (1):** `invite-lifecycle.spec.ts:268` — `5. already_member:
reconvidar quem já é membro → failed already_member`. Ele **não rodou** na execução em
paralelo (o `describe.serial` abortou no `:241`, que era flake), e falhou na única vez que
rodou. Uma execução não separa flake de defeito — precisa de uma segunda para ter
veredito.

**Os 13 "não rodaram" da série** são todos posteriores a uma falha dentro do mesmo
`describe.serial`: `invite-lifecycle.spec.ts:277,289,303,317` (bloqueados pelo `:268`) e
`vps-fresh-onboarding.spec.ts:120,127,149,167,180,194,221,233,296` (bloqueados pelo
`:111`). **Não há medição sobre eles** — consertar os dois bloqueadores é o que revela
essa faixa.

**Nada disso foi consertado aqui**, e nada é regressão desta branch: nenhuma linha de
produção foi tocada. A Task 0.1 classifica; o conserto é decisão de outro.

### Instrumentos criados (reutilizáveis pelas Tasks 1, 4, 5 e 7)

- `tests/journeys/canais-baseline.spec.ts` + `tests/journeys/playwright.config.ts` —
  a jornada de 7 paradas. Fica **fora** de `tests/e2e/` de propósito: dentro, ela mudaria
  a composição do `npm run test:e2e` e o artefato de comparação viraria a variável.
  Re-rodar: `CANAIS_EVIDENCE_DIR=evidence/canais/task4 pnpm exec playwright
  test --config tests/journeys/playwright.config.ts`.
- `scripts/provoke-agent-turn.ts` — provoca UM turno real de IA pelo webhook WAHA
  (o único caminho que escreve `before_send_traces`, que exige `job_id` de `job_queue`).

### Receita do ambiente (o que o plano não dizia e custou caro)

1. **`pnpm`, não `npm`** — `packageManager: pnpm@9.15.9`; `npm install` quebra em ERESOLVE
   (`@emoji-mart/react` pede react ≤18).
2. **`supabase start` NÃO sobe:** a cadeia fresca de migrations morre na 0010
   (`relation "public.contacts" does not exist`) — exatamente o que a doutrina diz. Receita
   que funcionou: mover `supabase/migrations/` para fora, `supabase start`, `drop schema
   public cascade` + `create extension vector/citext/pg_trgm`, `psql -f supabase/baseline.sql`
   (exit 0), devolver `migrations/` ao lugar.
3. **Chaves do Supabase local são as NOVAS** (`sb_publishable_…` / `sb_secret_…`); o CLI
   2.95 não imprime mais os JWT legados. Ambas funcionam em REST e no Auth admin.
4. **`npm run test:e2e` exige o env EXPORTADO no shell** — 2 specs leem `process.env`
   direto e derrubam a coleta inteira (0 testes rodam) se ele não estiver lá.
5. **A jornada precisa da org com `onboarded_at`** — nulo, todo `/app/*` volta ao wizard,
   e os specs do repo zeram esse campo entre execuções. O spec faz isso no `beforeAll`.
6. **O turno de IA exige 3 coisas** que um banco fresco não tem: credencial BYOK
   decifrável (os seeds gravam `\x00` e um spec marca `validated_at` → o turno morre com
   `Invalid authentication tag length: 1`), `organizations.settings.llm.default_model`, e
   `ANTHROPIC_API_KEY` real. O `provoke-agent-turn.ts` cuida das três.

### Ambiente — o disco estava cheio (relato honesto de intervenção na máquina)

O disco do Mac estava com **117 MB livres** (100%): o `next build` morreu, o daemon do
Docker travou (comandos pendurando indefinidamente) e o Postgres local ficou inacessível.
Para destravar eu **apaguei caches regeneráveis** (`~/.npm/_cacache` 2,2 G,
`~/Library/Caches/{ms-playwright-mcp,Homebrew,node-gyp,CocoaPods}`) e **reiniciei o Docker
Desktop** (os processos antigos ficaram zumbis: `quit` não bastou, precisou `kill -9`).
Nenhum dado de usuário foi tocado.

**Correção da Task 0.1 — "o disco continua em 99%" não batia com a medição.** `df -h /` no
início da Task 0.1: **4,3 GiB livres, 79% de uso** (e 4,6 GiB / 78% depois de rodar). O
"99%" era leitura de um momento anterior repetida como estado corrente. Continua apertado
para um Mac — a suíte e2e sozinha grava trace e `test-results/` — mas 79% não é 99%, e a
diferença muda a decisão de quem retoma. Nenhum cache foi apagado na Task 0.1.

---

## Decisões tomadas (e por quê)

| # | Decisão | Razão |
|---|---|---|
| D1 | Adapter Meta nativo — nem Evolution API, nem porte do TomikCRM | Evolution é serviço (mais um container na VPS do self-hoster) com Apache-2.0 + condições de marca; o Tomik são ~8.600 linhas de Deno com `@ts-nocheck` e fallback que aceita token em texto claro. Do Tomik vem a **doutrina**, não o código. |
| D2 | Seam de **capacidade**, não de provider | `if (provider === 'meta')` espalhado é como a implementação nova regride a antiga. |
| D3 | `banRisk` como flag em `decidePacing`, sem partir `PacingKnobs` em dois tipos | Mesmo invariante com 1/5 do diff — e diff menor = menos conflito com as outras sessões ativas no repo. O invariante é o teste, não a forma. |
| D4 | Colunas `meta_*` aditivas com CHECK de tagged union, sem renomear `waha_session_name` | 1 migration aditiva, zero rename, `default 'waha'` faz todo clone já instalado subir correto sem ação. |
| D5 | Tela de templates subiu para **pré-requisito da Fase 3b** | Invariante 6: não se entrega disparo de template sem superfície para ver/configurar. |
| D6 | Provider é propriedade da **conversa** (via sessão), nunca escolhido no envio | Elimina por construção a classe "mandou pelo canal errado". |
| D7 | `messages.provider` gravado por mensagem | Conversa cujo número migrou tem histórico dos dois lados; derivar da sessão atual mentiria sobre o passado. |

---

## Correções em mim mesmo (auto-revisão do plano, 2026-07-27)

Registradas porque a lição vale mais que o conserto:

1. **Citei `scripts/lint-pacing.ts` como existente no repo. Não existe.** Um comentário em
   `lib/agent-engine/pacing/defaults.ts` o menciona e eu tratei a citação como o fato; ele
   ficou no repo do harness. Chegou a entrar na doutrina antes de eu conferir. *Lição:
   comentário de código é afirmação de terceiro, não evidência.*
2. **Referenciei uma fixture `tests/unit/helpers/before-send-ctx` que não existe** — cada
   teste de gate monta seu próprio `baseCtx` local (`case-guardrail.test.ts:32`).
3. **Usei `fs.globSync` no lint**, que só existe em node 22+; `.nvmrc` fixa node 20. Trocado
   por walk recursivo sem dependência.
4. **Escrevi a doutrina dentro do worktree principal, que estava sujo com trabalho de outra
   sessão** (`feat/operacao-visivel`, 10 commits atrás da main). Revertido e movido para
   worktree limpo. *Lição: conferir `git status` do destino ANTES de escrever, não depois.*

---

## Bloqueio conhecido — recurso externo para as Fases 3b+

A Fase 3b não pode ser "vivida como usuário real" sem:

- **App Meta + WABA.** A Meta dá um **número de teste grátis** por app (envia para até 5
  destinatários verificados) — é API real e webhook real, serve para E2E honesto.
- **URL pública para o webhook.** Túnel em dev, ou a VPS que já existe.
- **Templates submetidos cedo.** Aprovação leva de minutos a ~24h; submeter na Fase 3a para
  estarem prontos quando a Fase 4 chegar.

Sem isso as Fases 0–3a rodam inteiras; a 3b para na fronteira. **Mock não substitui** —
a doutrina de QA Visual do repo já diz que mock não estressa o egress real.

---

## Diário de execução

| Data | Task | O que mudou | O que provei | O que quebrou |
|---|---|---|---|---|
| 2026-07-27 | — | doutrina + plano + worktree | plano auto-revisado; 3 erros meus corrigidos antes de virar código | — |
| 2026-07-27 | **Task 0** | baseline gravada (`evidence/canais/baseline/`); 2 instrumentos novos (`tests/journeys/`, `scripts/provoke-agent-turn.ts`) | unit **1035✓/1✗ exit 1**; e2e **29✓/15✗/14 não rodaram exit 1**; `gates.csv` **9 linhas** de 1 turno REAL (`claude-sonnet-4-5`, `messages_sent:1`); 7 screenshots pela tela; typecheck/lint **exit 0** | (a) o plano derruba `evidencia-citada.test.ts` citando os 7 PNGs por nome puro — vermelho da BRANCH, não da `main`; (b) `.superpowers/evidence/` é gitignorado → o `git add` do Step 7 do plano não versiona nada; (c) e2e não é verde de referência: timeouts sob 5 workers + `schema cache` do PostgREST, **não re-rodei em série** |
| 2026-07-27 | **Task 0.1** | evidência movida de `.superpowers/evidence/canais/` (gitignorada) para `evidence/canais/`, versionada, com `README.md` do que cada artefato prova; plano/HANDOFF/`CANAIS_EVIDENCE_DIR` citam CAMINHO, não nome puro; Step 3 do plano ganhou `set -o pipefail` e passou a mandar a e2e em série | `npx vitest run tests/unit/evidencia-citada.test.ts` → **28✓/0✗ exit 0** (eram 26 com 1✗; +2 documentos entraram na cobertura); suíte unitária inteira **1038✓/0✗ exit 0** (era 1035✓/1✗); typecheck **exit 0**, lint **exit 0**; e2e em série **41✓/4✗/13 não rodaram exit 1** em 3.6min vs **29✓/15✗/14 exit 1** em 5.2min com 5 workers → **3 defeitos prováveis, 12 flakes de concorrência, 1 sem veredito** (ver "Série × paralelo") | (a) a 3001 estava tomada por um `next-server` de OUTRA sessão (6d23h) e a suíte inteira abortou — `reuseExistingServer:false` é proposital, resolvi com `E2E_PORT=3007` sem matar processo alheio; (b) `invite-lifecycle.spec.ts:268` (`already_member`) rodou pela 1ª vez e falhou — 1 execução não classifica; (c) `${PIPESTATUS[0]}` — a receita que eu mesmo escrevi no plano — grava `exit=` VAZIO no zsh (é variável do bash); trocado por `set -o pipefail` + `$?`, que vale nos dois shells; (d) NÃO consertei nenhum e2e vermelho (fora do escopo) nem provei nada pela tela: a Task 0.1 não toca UI |
