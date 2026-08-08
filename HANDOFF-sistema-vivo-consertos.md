# HANDOFF — Consertos sob a doutrina do Sistema Vivo

> Documento **vivo**. Toda afirmação declara o SHA de onde foi medida. Número sem SHA não compara.
>
> Base: `origin/main` = **`b9f2ca51`** · branch `fix/sistema-vivo-operador` · worktree `DeskcommCRM-sv`
> Origem: auditoria do PR #181 ("os três papéis do agente", squash `9249e6f2`) contra
> [`docs/doctrine/sistema-vivo.md`](docs/doctrine/sistema-vivo.md) — 13 agentes, 86 achados,
> **79 sobreviveram** ao cético, mais 8 do crítico de completude.

---

## Por que a base é a main e não a branch da sessão

A sessão começou em `feat/indice-de-atrito`, **111 commits atrás** da main. Consertar ali seria
consertar contra alvo em movimento — e a main já continha o PR #181. Worktree dedicado, criado da
main, com `node_modules` real.

**Havia outra sessão viva na máquina** (`397eb824`, rodando vitest e `test:db`). Nenhum processo dela
foi tocado, e as suítes daqui foram sequenciadas: máquina saturada forja falha, e falha forjada custa
mais caro que a que ela esconde.

---

## Linha de base, medida antes de tocar em nada (`b9f2ca51`)

| medida | valor |
|---|---|
| `pnpm test:unit` | **310 arquivos / 3209 testes** verdes |
| `pnpm lint` | 0 erros, 188 warnings |
| `pnpm typecheck` | limpo |
| `pnpm test:e2e` (39 specs) | **111 passed / 4 failed**, 14m1s |
| specs em `tests/e2e/` × listadas no CI | **39 × 36** |

---

## Estado final, medido (`3ebb6ba5`)

| medida | valor | contra o baseline |
|---|---|---|
| `pnpm test:unit` | **313 arquivos / 3225 testes** verdes | +3 arquivos, +16 casos — a aritmética fecha |
| `pnpm lint` | 0 erros, **188** warnings | o MESMO número; nenhum warning novo |
| `pnpm typecheck` | **exit 0** (medido sem pipe) | igual |
| specs × listadas | 39 × **37 rodam + 2 declaradas fora** | soma conferida por gate |

> **Sobre "typecheck limpo" no meio da sessão:** eu afirmei isso medindo com `| tail`, que mascara o
> exit code. Medido sem pipe, estava **quebrado** — num arquivo meu, já commitado. Consertado em
> `639f0894`. A lição não é nova neste repo e eu a repeti.

---

## O que foi consertado

### 1 · A migration 0129 derrubou três avisos da Central · `2b75d51e`

`agent_inbox_items_kind_check` é derrubada e reconstruída a cada kind novo — sete vezes até aqui — e o
contrato implícito é que cada reconstrução repita a lista inteira. A 0129 reconstruiu a partir de uma
lista anterior à 0111 e perdeu **`promise_unfulfilled`** (o aviso do papel Operador),
`contact_proposal_expired` e `other`.

- **Medido:** a cadeia termina em **15** valores; o `baseline.sql` tem **18**. O kit self-host nunca
  foi atingido — quem quebra é o clone que aplica migrations pelo Supabase CLI, o caminho versionado.
- **Modo de falha:** `insertInboxItem` bate 23514, quem chama captura e emite `log.warn` de propósito,
  e a Central **para de receber** o sinal. Ninguém vê erro; alguém deixa de ver aviso.
- **Prova de comportamento** (Postgres real, não leitura de arquivo):

  | estado | valores | aceita `promise_unfulfilled`? |
  |---|---|---|
  | após 0124 | 17 | sim |
  | após 0129 | 15 | **não** — `violates check constraint` |
  | após 0131 | 18 | sim — `INSERT 0 1` |

- **Gate da classe:** `tests/unit/migrations-nao-encolhem-vocabulario.test.ts`, duas asserções que
  medem coisas diferentes — monotonicidade (o evento, com allowlist justificada) e
  cadeia-igual-ao-baseline (a consequência, sem allowlist). Sabotagem: tirar a 0131 → **1**; migration
  nova que encolhe → **2**. Previsões 1 e 2.
- **De brinde:** o gate achou a **primeira** instância da classe, que eu não procurava — a 0062, de
  22/07, perdeu `followup_dead` e foi reparada um dia depois pela 0065 (`reconcile_inbox_kind_check`).
  A 0129 reincidiu *citando no próprio comentário* a lição que violava: aquela era sobre **blocos**, o
  mecanismo é sobre **listas**.

### 2 · A suíte e2e não rodava num worktree limpo · `fdcf7e80`

`pnpm e2e:build && pnpm test:e2e` — o caminho documentado — morria antes do primeiro teste. As duas
proteções se anulavam: `envDoE2E()` injetava o ambiente só no `webServer`, e `env-de-teste.ts` caía no
`.env.local`, que **não existe de propósito** no worktree isolado. O CI não notava porque contorna por
dois caminhos, um deles `cp .env.e2e .env.local` — recriando o arquivo cuja ausência é a proteção.

Prova com uma variável mudada, shell sem credenciais (impresso antes de rodar): antes
`Sem credenciais do Supabase`; depois **7 passed (24,1s)**.

### 3 · O alarme de destino mentia no estado misto · `4c8cd222`

`anunciarDestino` decidia o rótulo só por `c.url`. Mas `dbUrl` cai no `.env.local` sozinha, então com
`.env.e2e` exportado e um `.env.local` de trabalho no disco a API vai para o local e o **Postgres para
a produção** — e são 15 arquivos que abrem `pg.Pool` com esse valor. A função criada para tornar
visível a escrita acidental não cobria o canal que o fallback põe em risco. 10 testes; sabotagens 2 e
1, previstas 2 e 1; a senha do Postgres nunca vai ao log, com teste próprio.

### 4 · O Operador escrevia no CRM depois de o humano assumir · `ec9a6faa`

**O pior achado da auditoria.** `isLeadInHandoff` guardava três dos quatro handlers de turno e **zero**
vezes o `operator-turn`. Não foi linha esquecida: a guarda foi posta na *função* de turno, e o Operador
é um job separado que ela enfileira. E o instante importa — o handoff nasce durante o turno (tool
`request_human_handoff`) ou depois (o "assumir eu" da tela), então só o início da **execução** lê o
estado que vale.

- Formato igual ao dos irmãos (registrar o motivo e sair) de propósito: `followup-turn.ts:432` faz
  exatamente isso. Persistir o desfecho é trabalho separado e vale para os quatro do mesmo jeito.
- **Prova:** `tests/invariants/operador-nao-pisa-no-humano.test.ts`, 4 casos contra Postgres real
  (baseline install + update), rodando o **handler**, não afirmando que a linha existe. Os dois braços
  do `or` têm caso próprio, mais o caso do silêncio **vencido** (na direção oposta: uma guarda que
  lesse `is not null` silenciaria o papel para sempre). O primeiro caso é a **guarda de vacuidade**.
- Sabotagem: apagar a guarda → **2 failed | 2 passed**, previsão 2. Os dois casos de handoff caem, o
  controle e o do silêncio vencido seguem verdes.

### 5 · A cobertura do e2e deixa de ser prosa digitada · `ac026651` + `c42b6553`

39 arquivos no disco, 36 nas listas, e o passo que existia para declarar a lacuna afirmava "32 de 33".
As ausentes eram as novas — entre elas `agente-papeis-operador.spec.ts`, a prova de tela do épico dos
três papéis, apresentada como 7/7 e que **nunca rodou em job nenhum**.

Agora há uma fonte por lista, o summary **conta**, e `tests/unit/e2e-cobertura-completa.test.ts` guarda
três propriedades com três modos de falha: completude, vigência (filtro que não casa nada deixa o job
verde) e **consumo** (declarar não é executar). Sabotagens: 1 + 1 + 1, cada uma num teste diferente.

> **Correção da minha própria decisão** (`c42b6553`): eu vi um caso da `prova-painel-provedores` passar
> e concluí que o arquivo estava verde. Errado — 2 de 6 falham, e o caso F3 **não pode** passar no CI:
> exige >50 modelos da OpenRouter e o catálogo chega lá com 2 linhas (o baseline não semeia catálogo e
> não existe seed que o popule). A spec passa onde o dado por acaso existe. Foi para `FORA_DO_CI` com o
> motivo medido.

### 6 · Duas mutações perdiam a auditoria em silêncio · `639f0894`

Achado nos **logs** da corrida, não em leitura de código: `invalid input syntax for type uuid:
"stage_classifier"` em `ai.purpose_binding_updated`. `resource_id` é uuid, `purpose` é chave natural em
text; audit é fire-and-forget por doutrina, então a gravação seguia, a tela dizia "salvo" e a trilha
não tinha a linha.

Procurando a **classe**, a varredura achou uma segunda ocorrência que ninguém tinha visto:
`ai.skill_uninstalled` mandava o NOME da skill (`skill_pointers` é chaveada por `(organization_id,
name)`). Um DELETE perdendo a própria auditoria.

Gate: `tests/unit/audit-resource-id-e-uuid.test.ts` varre as 149 chamadas e exige que todo `resourceId`
termine em id/Id/_id ou seja `null` — **allowlist, não denylist**, com as 7 exceções legítimas
declaradas e um teste cobrando que exceção órfã seja removida.

### 7 · Três defeitos que só apareceram ao RODAR a suíte · `3ebb6ba5`

- **`escalacao-ciclo` morria em 0ms** porque o re-seed de credenciais (disparado por rotação de TOTP de
  outra sessão) apaga o bloco `escalacao` do `.e2e-creds.json`. A spec passa a semear a própria
  precondição. Prova: apaguei o bloco e o teste avançou da linha 124 para a 152.
- **A mesma spec disparava `tsx --env-file=.env.local`** — o arquivo cuja ausência é a proteção. Única
  ocorrência **executável** no repo; o gate não a pegava porque sua regex procura `readFileSync`.
- **A suíte destruía a evidência versionada.** `qa-agente-usa-as-maos.spec.ts` grava em
  `evidence/ia-360-w4/medicao-vazamento/turnos/`, que é fixture de `projecao-conversador.test.ts`. Sem
  chave de IA, os 10 cenários voltaram HTTP 400 e o carimbo `rodou: false` cobriu os turnos reais — a
  medição histórica do vazamento de 30%. Três testes de unidade ficaram vermelhos e o **controle
  positivo deles** disse por quê. A falha agora vai para `__falhou.json`, ao lado.
- **O gate passa a medir código, não prosa:** documentar o item acima *dentro* da spec reprovou o gate,
  porque o comentário citava os dois literais que a regex procura. Comentário não executa. Controle
  positivo depois de afrouxar: violação real injetada → **2** reprovações (previ 1; são 2 porque o
  arquivo está nas duas baterias).

---

## Triagem completa das 4 falhas do e2e

| spec | causa | ação |
|---|---|---|
| `degradacao-silenciosa:84` | **falha esperada** — `test.fail()`, a catraca da lacuna declarada. Aparece com ✘ e não conta como falha | nenhuma; a catraca está funcionando |
| `escalacao-ciclo:128` | fixture apagada pelo re-seed + `--env-file=.env.local` | consertado (`3ebb6ba5`) |
| `prova-painel-provedores:77,139` | F3 exige catálogo de modelos que o CI não semeia | declarada em `FORA_DO_CI` com motivo (`c42b6553`) |
| `vps-fresh-onboarding:111` | WAHA + Redis + Resend + Nuvemshop | segue fora, declarada — é a P0 da doutrina de QA Visual |

---

## Medido e NÃO consertado (declarado, não escondido)

| # | o quê | por que ficou |
|---|---|---|
| 1 | **`followup.scheduled` perde auditoria** — `api_audit_log_actor_api_token_id_fkey`, 2× na corrida | Investiguei e a hipótese óbvia está **errada**: `revokeEphemeralToken` faz `update revoked_at`, não delete, e o FK é `ON DELETE SET NULL`; nenhum código do repo apaga de `api_tokens` (sonda com controle positivo: 11 arquivos usam a tabela). É um token id que nunca existiu, e não consegui estabelecer a causa. Fica com a evidência, sem história por cima |
| 2 | **O desfecho do Operador não é persistido** (P1-C3) — `{tipo:'agiu'}` é tipo morto, o retorno de `runModelCall` é descartado | é a maior peça restante; plano completo abaixo |
| 3 | **O aviso de promessa afirma sem apurar**, e sem dedup | depende do item 2 (é o mesmo dado) |
| 4 | **O terceiro papel (Segurança) não existe como papel** — os 10 gates são lista informativa no TestPanel; os knobs semânticos seguem no `.env` | P5-C6, a maior peça de UI |
| 5 | **O mapa vivo não recebeu o Operador**, e `agent-turn.workflow.json` descreve uma chamada de modelo por mensagem quando há duas | P4 inteira |
| 6 | **A projeção nunca arma num agente real** — `turnoProjeta` exige zero ferramenta de catálogo; o pacote "atender" tem 18 | P2-C5 |
| 7 | **As três métricas que a spec 16 §7 diz que "passam a existir"** não existem | dependem do item 2 |
| 8 | Nenhum turno de produção observado com worker real | não houve chave de IA nesta máquina |

---

## O que executar em seguida, na ordem

Cinco planos completos, cada um já passado por um cético (causa raiz, edição, teste, sabotagem com
contagem prevista e copy em pt-BR). **Ordem entre partições importa** porque P5 e P3 consomem dados que
P1 e P2 criam.

**P1 — o handler do Operador** (`operator-turn.ts`, `repository.ts`, `agent-inbox-copy.ts` + tripla)
1. `insertInboxItem` ganha chave de dedup opcional — chave certa é `kind + ref_id + status='open'`, não `kind` org-wide (essa engoliria a promessa de outra conversa)
2. ~~guarda de handoff~~ ✅ `ec9a6faa`
3. o desfecho passa a existir e o aviso passa a **apurar** antes de afirmar — capturar o retorno de `runModelCall`, ler as tool calls por `steps` (nunca `result.toolCalls`, que é só o último step)
4. `sem_agente` deixa de pular antes de apurar (é o caminho da instalação fresca)
5. a falha de capacidade do Operador ganha kind e voz próprios — **atômico**: migration (agora **0132**, a 0131 é minha) + apêndice no bloco único do baseline + MANIFEST + union TS

**P2 — o disparo, a chave e o identificador no prompt**
1. o Operador lê o checkpoint **do seu turno**, pela chave que já viaja (`origin_job_id`, hoje usada só em log)
2. com o papel desligado, o turno não enfileira nada (hoje toda instalação paga +1 job por turno, ocupando a *lane* do lead)
3. falha ao enfileirar vira aviso na Central
4. as duas afirmações falsas saem do repo
5. a projeção deixa de ser interruptor de turno e passa a ser allowlist de identificador
6. o índice de notas cita a nota por apelido, não por uuid
7. o teste passa a medir o **prompt montado**, não a função pura

**P3 — enforcement** (1 e 2 ✅ feitos; restam 3 a 6: amplitude do gate de mapas, gate de guarda de
handoff em todo handler, gate de membro morto, gate de dedup na Central)

**P4 — o mapa vivo** (4 itens) · **P5 — o papel aparece na tela** (8 itens, sendo C6 o painel de Segurança)

---

## Regras desta frente

1. **Commitar antes de sabotar.** Eu perdi dois consertos para um `git checkout` de sabotagem nesta
   sessão — a lição já estava escrita e eu a repeti.
2. **Prever a contagem de reprovações antes de rodar.** Reprovar menos que o previsto denuncia
   mecanismo redundante; reprovar mais denuncia que você não entendeu o que ligou.
3. **Exit code sem pipe.** `cmd | tail` devolve o exit do `tail`.
4. **Afrouxar gate exige controle positivo** provando que ele ainda morde.
5. **Sonda de ausência precisa de controle positivo.** `grep` por um nome chutado devolve 0 e é
   indistinguível de "não existe" — aconteceu duas vezes aqui (o glob que o zsh comeu, o regex
   `\bid\b` que não casa `leadId`).
