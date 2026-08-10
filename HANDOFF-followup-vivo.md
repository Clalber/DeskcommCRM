# HANDOFF — Follow-up Vivo

> Documento vivo da missão "otimizar o sistema de follow-ups". Atualizado a **cada
> avanço, interrupção, bug encontrado, bug corrigido e pendência**. Quem retoma
> esta missão lê este arquivo primeiro e não precisa de mais nada.

- **Branch de integração:** `feat/followup-vivo` — nascida de `origin/main` `4f89a0da`, zero divergência na criação.
- **Maestro da missão:** terminal `Assistente e Testes` (Lina).
- **Aberto em:** 2026-08-10.
- **Autorização:** Rafael, autonomia total (`workspace.json → guard: off`).

---

## 1. Por que esta missão existe

Sete achados medidos no código em `d59f8292` (worktree principal), antes de
qualquer alteração. Cada um com o arquivo e a linha que o prova.

| # | Achado | Prova |
|---|---|---|
| 1 | **Uma bolinha só de saída.** `NodeCard` renderiza exatamente 1 `Handle type="source"` para os 6 tipos de nó. E não adianta desenhar mais: o nó condicional colapsa N regras em UM booleano (`checks[]` + `combinator`), e a aresta só sabe dizer `cond_result: true\|false`. Não existe vocabulário para "esta aresta sai da regra 2". | `nodes/NodeCard.tsx:69`, `graph-schema.ts:78-95`, `graph-schema.ts:190-200` |
| 2 | **Comparadores crus na tela.** O valor de wire vira rótulo sem tradução: `lead_stage`, `steps_taken`, `eq`, `neq`, `gte`, `lte`, `contains`. | `NodeConfigPanel.tsx:334-338`, `:355-357` |
| 3 | **UUID pedido ao usuário.** "Template de fallback (UUID, opcional)" é um `<Input>` de texto livre. Pior que `eq`. | `NodeConfigPanel.tsx:568`, `:581` |
| 4 | **Jargão.** "Grace (minutos, mín. 15)", "Alvo", "Combinador", "Esgotado". Classes de IA (`hot`/`cold`) chegam sem tradução na aresta — só `no_reply` é traduzido. | `NodeConfigPanel.tsx:442`, `edge-condition-options.ts:23` |
| 5 | **Gatilhos previstos e mortos.** O schema já declara `stage_change` (com `stage_id`) e `conversation_end`; nenhum tem produtor. Só `silence` tem motor vivo. A UI nem os oferece. | `api-schemas.ts:22-42`, `TriggerConfigControl.tsx:19-26`, `silence-sweep.ts` |
| 6 | **BUG — o tempo adaptativo é decorativo.** A tela oferece "Adaptativo (min–max)" e o decisor por LLM já existe escrito. Mas o engine **nunca** enfileira `purpose:'decide_timing'` — `processNode` não devolve `enqueue_turn` para nó `wait`, então o payload de guidance em `engine.ts:165` é código morto. O usuário escolhe adaptativo e o sistema espera **sempre o máximo**, calado. | `node-handlers.ts:206`, `followup-flow-classify.ts:133-137`, `engine.ts:160-167` |
| 7 | **Fila sem dossiê.** `followup_enrollment_events` grava cada passo e nenhuma tela mostra. Única intervenção possível é cancelar. | `QueueTab.tsx`, `/api/v1/ai/followups/queue` |

Somam-se dois defeitos **já catalogados** pelo time no plano do Lina, ambos de
follow-up, ambos em escopo aqui:

- **`IA360-STARVATION`** — o claim é global com teto 20 e ordenado por `next_eval_at`
  crescente; org grande domina os primeiros ticks.

  > **CORRIGIDO PELA MEDIÇÃO (DevVivo, 2026-08-10).** O item do plano dizia
  > *"STARVATION PERSISTENTE … as menores nunca rodam"*. **Não é permanente.**
  > Medido em pg17 com 300 vencidos na org grande e 1 na pequena: a pequena é
  > atendida no **tick 16**, não nunca. Confirmei o mecanismo na fonte —
  > `fn_claim_due_followup_enrollments` faz `set claimed_until = now() + lease` e
  > o `where` exclui `claimed_until >= now()`, então o lote reclamado sai do
  > conjunto de candidatos e o ponteiro avança: `ceil(K/limit)` ticks.
  > A caracterização original veio de **leitura**, não de medição, e estava errada.
  > Continua sendo defeito e o conserto entrou: atraso proporcional **sem teto
  > superior** é 15 min com 300 vencidos e horas com 10 mil, e o tenant pequeno
  > paga por um vizinho grande sem nunca saber.

- **O silêncio do claim** — `runFollowupTick` devolvia `claimed=0` indistinguível de
  "nada vencido".

  > **REFINADO PELA MEDIÇÃO (DevVivo).** O sinal **já existia** na base: `claim_falhou`
  > + `logger.error`, commit `f66f0ddb`, com teste. O que faltava era **consumidor** —
  > a rota de cron só auditava tick com contador não-zero, e claim falhado tem todos
  > zerados. É o anti-pattern nº 3 do `CLAUDE.md` (evento sem consumer), não emissor
  > ausente.
- **`IA360-FLAKY`** — invariante de follow-up instável no `test:db` pinta o CI de
  vermelho aleatoriamente. Dois testes DIFERENTES caindo no mesmo SHA: assinatura de
  interferência de estado, não de defeito de código.

---

## 2. Decisões de produto tomadas (e por quem)

| Decisão | Quem | Racional |
|---|---|---|
| Ramo nomeado é do **nó**, não da aresta isolada — cada regra vira um ramo com id estável e rótulo; a aresta referencia `branch_id`. | Maestro, aprovado por Rafael | Aresta guardando a regra duplicaria a verdade e quebraria ao reordenar regras. |
| A ramificação vale **também para o nó de classificação da IA** — cada classe declarada nasce com a sua própria saída. | Maestro, aprovado por Rafael | Rafael citou o condicional; a estrutura do defeito é a mesma. |
| **UUID sai da tela.** Template vira seletor com nome. | Maestro, aprovado por Rafael | Pedir UUID a um dono de clínica é o defeito de UX mais grave do painel. |
| Retrocompatibilidade é **obrigatória**: fluxo publicado hoje continua rodando sem intervenção. | Maestro | Projeto open-source; clones têm fluxos vivos em produção. |
| O tempo adaptativo é tratado como **bug**, não como feature nova. | Maestro | Controle que a tela oferece e o código ignora mente para o usuário. |

---

## 3. Fronteira de arquivos — quem escreve o quê

**Regra dura: quem não é dono do arquivo não escreve nele.** Precisa mexer em
arquivo alheio? Pede ao dono pelo canal, não edita.

| Frente | Terminal | Arquivos que possui |
|---|---|---|
| **A · Contrato + Ramificação** | Arquiteto | `lib/followup/graph-schema.ts`, `validate-publish.ts`, `graph-mappers.ts`, `edge-condition-options.ts`, `node-handlers.ts` *(só o case `condition`)*, `nodes/NodeCard.tsx`, `nodes/ConditionNode.tsx`, `nodes/ClassifyNode.tsx`, `EdgeConfigPanel.tsx`, `FlowCanvas.tsx`, `NodeConfigPanel.tsx` *(só o `ConditionForm`/`ClassifyForm`)* |
| **B · Motor (tempo neural + starvation)** | DevVivo | `lib/followup/engine.ts`, `turn-bridge.ts`, `node-handlers.ts` *(só o case `wait`)*, `lib/agent-engine/agent/followup-flow-classify.ts`, `followup-turn.ts`, função SQL do claim |
| **C · Gatilhos do sistema** | DevGatilhos | `lib/followup/api-schemas.ts` *(bloco trigger)*, `silence-sweep.ts`, `reactivity.ts`, novos `gatilho-*.ts`, `TriggerConfigControl.tsx`, `app/api/v1/ai/followup-flows/[id]/publish/route.ts`, `app/api/v1/cron/followup-flow-worker/route.ts` |
| **D · Fila viva + dossiê** | Maestro | `app/app/ai/followups/_components/QueueTab.tsx`, novos componentes de dossiê, `app/api/v1/ai/followups/enrollments/**`, `hooks/followup/useFollowupQueue.ts`, `lib/followup/outcome-stats.ts` |
| **E · Linguagem humana** | QAVivo | `lib/followup/vocabulario.ts` *(novo, dono exclusivo)*, `NodeConfigPanel.tsx` *(demais formulários)*, seletor de template, `nodes/nodeVisuals.ts` |

**Ponto de atrito conhecido:** `NodeConfigPanel.tsx` é tocado por A e E. Mitigação —
E quebra o arquivo em um arquivo por formulário **na Wave 0**, antes de A encostar nele.

**Arquivos que mudaram de dono durante a missão** (apontado pelo DevGatilhos — sem
esta linha, quem retomar as frentes descobre no conflito):

| Arquivo | Dono original | Passou para | Por quê |
|---|---|---|---|
| `lib/leads/agent-stage-sync.ts` | ninguém (fora da tabela) | **C · Gatilhos** | decisão do maestro: o conserto do B4 pertence ao emissor, e quem o achou tinha o contexto |
| `lib/followup/turn-bridge.ts` | B · Motor | **compartilhado** com D · Fila | a fila precisa da lista positiva de status para introduzir pausa manual; o motor combina em vez de reverter |
| `tests/invariants/vocabulario-banco-x-typescript.test.ts` | — | **D e E juntos** | os dois o modificam; combinar antes de escrever |

**Faixas de migration reservadas** (evita colisão de numeração):

| Frente | Faixa |
|---|---|
| A · Contrato | `0142` |
| C · Gatilhos | `0143` |
| B · Motor | `0144` |
| D · Fila | `0145` |
| E · Linguagem | `0146` |

Última migration na `main`: `0141`. Toda migration sai com a tripla — arquivo em
`supabase/migrations/` + apêndice idempotente no `supabase/baseline.sql` + linha no
`MANIFEST.md`.

---

## 4. Ondas

### Wave 0 — contrato (bloqueia A e E, não bloqueia B/C/D)

| Item | Dono | Estado |
|---|---|---|
| `W0-CONTRATO` · `graph-schema.ts` v2: ramos nomeados no condicional e no classify, `branch_id` na aresta, retrocompatível, com teste de round-trip de grafo legado | Arquiteto | despachado |
| `W0-VOCAB` · `lib/followup/vocabulario.ts`: dicionário pt-br completo + invariante que reprova valor de wire sem tradução; e quebra do `NodeConfigPanel` em um arquivo por formulário | QAVivo | despachado |

### Wave 1 — arranca junto com a Wave 0 (arquivos disjuntos)

| Item | Dono | Estado |
|---|---|---|
| `W1-GATILHOS` · produtores de `stage_change`, caso aberto e proposta feita + UI do gatilho | DevGatilhos | despachado |
| `W1-FILA` · dossiê do enrollment, timeline de eventos, pausar/adiar/pular | Maestro | despachado |
| `W1-MOTOR` · `decide_timing` vivo, plano de atrasos por enrollment, clamp provado + starvation | DevVivo | despachado |

### Wave 2 — depois da Wave 0

| Item | Dono | Estado |
|---|---|---|
| `W2-RAMOS` · ramificação ponta a ponta: canvas com uma bolinha por regra, engine roteando por `branch_id`, publish validando cobertura | Arquiteto | aguarda W0-CONTRATO |
| `W2-LINGUAGEM` · vocabulário aplicado em todos os formulários, UUID eliminado | QAVivo | aguarda W0-VOCAB |

---

## 5. Critério de aceite — vale para toda frente, em todo marco

Nenhum marco fecha sem os cinco:

1. `pnpm typecheck` e `pnpm lint` zerados.
2. `pnpm test:unit` verde.
3. `pnpm test:db` verde **se tocou schema, RLS ou o motor** — é o único caminho que exercita o `baseline.sql` que o self-hoster aplica.
4. **Spec Playwright dirigindo a tela**, não a API. `curl` é diagnóstico, não prova de UX. Screenshot versionado em `evidence/`.
5. **A prova mostra a IA fazendo o que a tela prometeu.** Não basta o código chamar o decisor: tem que aparecer, na tela, o que a IA escolheu e por quê.

Medida de front-end é por ferramenta (`getBoundingClientRect` / `getComputedStyle`), nunca a olho.

**Teste que não vermelhece não prova.** Todo teste novo passa pela sabotagem: quebre a
linha que ele deveria vigiar, confirme que ele reprova, restaure. Preveja quantas
reprovações espera — reprovar menos que o previsto denuncia mecanismo redundante.

---

## 6. Diário — avanços, bugs, interrupções, pendências

> Ordem cronológica inversa não; cronológica direta. Cada linha declara o SHA.

### 2026-08-10

- **Setup** — `feat/followup-vivo` criada de `origin/main` `4f89a0da`. Cinco worktrees
  (`fv-contrato`, `fv-vocabulario`, `fv-gatilhos`, `fv-fila`, `fv-motor`) + `fv-integra`
  para o maestro. `pnpm install` em cada um.
- **Reconhecimento** — os 7 achados da seção 1, medidos em `d59f8292` antes de tocar
  em qualquer linha.
- **Despacho** — 5 itens abertos no plano do Lina (`FV-W0-CONTRATO`, `FV-W0-VOCAB`,
  `FV-W1-MOTOR`, `FV-W1-GATILHOS`, `FV-W1-FILA`) e repassados com briefing anexado ao
  payload (`lina handoff --context`), não pelo corpo da mensagem — o canal corrompe
  `$`, crase e apóstrofo em silêncio.
- **Troca de dono na frente C** — os dois despachos ao MaestroConexoes foram *roteados*
  sem confirmação de entrega, e ele não deu claim. Não concluí "terminal morto" pelo
  sinal indireto: **conferi o artefato** (plano sem claim, worktree sem arquivo tocado).
  Rafael informou que ele está em outra frente. Terminal `DevGatilhos` (DEVELOPER)
  criado e a frente repassada a ele.
- **Monitor armado** — vigia o **artefato**, não o proxy: commit novo em qualquer
  `fv/*`, terminal em `Blocked`/`Dead`, e frente em silêncio há mais de 25 min. As três
  bordas juntas, porque monitor que só observa o caminho feliz fica calado num
  travamento e o silêncio parece progresso.
  - Limitação medida: `lina history` recusa leitura cross-espaço aqui
    (`leitura cross negada`), então não consigo ler a tela dos colegas. O git é a
    fonte de verdade do monitor — o que é melhor de qualquer forma: branch e SHA são
    fato, estado de terminal é proxy.

#### Ambiente de prova (montado pelo maestro, pronto antes da 1ª entrega)

- **Banco**: Supabase local `pg17` já de pé (`supabase_db_deskcomm-crm`), que é o alvo
  que a doutrina exige (o `baseline.sql` usa `GRANT MAINTAIN`, privilégio pg17+).
- **Isolamento de produção**: os worktrees `fv-*` nasceram do git limpos, **sem
  `.env.local`** — que é exatamente a configuração segura. Esta base já teve
  `pnpm test:e2e` escrevendo organizações e usuários **no banco real**, porque 93
  scripts liam `.env.local` do disco ignorando `process.env`. O repo já tem o conserto
  (`pnpm e2e:env` + `pnpm e2e:build`, que ainda prova que o host de produção não
  sobreviveu no bundle do browser); estou usando essa receita, não uma minha.
- **Porta**: `E2E_PORT=3101`. Há um `next` vivo de **outra sessão** no worktree
  `DeskcommCRM-qa-main`; porta própria para não colidir, e não matei processo nenhum —
  `pkill` amplo nesta máquina mata o trabalho alheio.
- **Ressalva declarada**: o Supabase local é **compartilhado** entre sessões. Não vou
  resetá-lo. As specs semeiam a própria org por rodada; se um vizinho rodar o seed no
  meio, o sintoma típico é "MFA falhou" — que é vizinho, não bug de MFA.

#### Bugs encontrados

| # | Bug | Achado por | Estado |
|---|---|---|---|
| B1 | Modo "Adaptativo" do nó de espera é decorativo — engine sempre usa `max_ms` | Maestro (reconhecimento) | aberto · frente B |
| B2 | Starvation do claim global: org grande monopoliza o tick, pequenas nunca rodam; falha do claim vira `claimed=0` silencioso | MaestroConexoes (W4, pré-existente) | aberto · frente B |
| B3 | Invariante de follow-up instável no `test:db` — CI vermelho aleatório | Maestro (IA 360, pré-existente) | aberto · frente B |
| B4 | **Regras de automação estão mortas para todo card que a IA move.** `lib/leads/agent-stage-sync.ts` grava a atividade em `crm_lead_activities` e **não** emite `lead.stage_changed` em `event_log` — zero ocorrência de `event_log` no arquivo. Só as 3 rotas HTTP emitem (`leads/[id]/move:171`, `_handler.ts:589`, `bulk:200`). E `lib/automation/engine.handler.ts:9` consome exatamente `lead.stage_changed`. Ou seja: a regra que o operador configurou ignora, em silêncio, metade dos movimentos do funil. | DevGatilhos, confirmado por medição independente do maestro | aberto · frente C |

#### Correção de rota — o maestro errou o briefing

O briefing de gatilhos afirmava que `agent-stage-sync.ts:220` emitia `stage_changed` em
`event_log`. **Não emite.** O `type: "stage_changed"` que eu tinha visto num grep é o
tipo da *atividade*, não do evento — inferi o resto. DevGatilhos contradisse, eu remedi
na fonte antes de deferir, e ele estava certo. Briefing corrigido com a ressalva escrita
no próprio arquivo, para não enganar quem o ler depois.

#### Decisões tomadas durante a execução

| Decisão | Quem | Racional |
|---|---|---|
| **"Caso aberto" vira "caso encerrado".** | Maestro, sobre achado do DevGatilhos | Disparar um fluxo no mesmo evento (`ai.handoff_triggered`) que a política de handoff usa para **pausar/cancelar** os follow-ups vivos (`reactivity.ts:226+`) é contradição: o evento que abriria o fluxo é o que mata os outros. E `demandas` abre automaticamente no primeiro inbound de **todo** contato (trigger `trg_demanda_abre_no_inbound`), então o gatilho valeria para qualquer um que escrevesse. O simétrico é coerente e `conversation_end` já está no schema — mesmo trabalho. |
| **"Proposta feita" não precisa de tabela.** | DevGatilhos, aprovado pelo Maestro | `crm_stages.agent_stage_hint` aceita `negotiating` (CHECK, migration `0084`), definido como "há proposta/preço/condições na mesa" — a etapa "Proposta" já carrega o hint. Proposta feita **é** o gatilho de etapa com a etapa certa. Zero tabela nova, doutrina DIRC respeitada no item **C**alcular. |
| **`agent-stage-sync.ts` passa a emitir `event_log`**, em commit próprio, separado do gatilho. | Maestro | Mover card pela IA tem de ser indistinguível de mover pela mão. Regra que ignora metade dos movimentos em silêncio é pior que regra que dispara demais — e o defeito é undiscoverable hoje. Muda comportamento além do follow-up: **está declarado aqui de propósito**. |

#### A prova em tela do B1 — feita, e vermelha de propósito

`tests/e2e/followup-tempo-adaptativo.spec.ts` (commit `e1cc21b6`). Monta o fluxo
pelo canvas, escolhe **"Adaptativo (min–max)"** com janela de **10 a 360 min** e a
orientação *"O lead pediu retorno ainda hoje, em cerca de meia hora"*, publica
pelos botões, matricula um contato, roda o worker e lê o próximo disparo na Fila.

```
Expected: < 360
Received:   360.02346666666665
```

**O motor agendou o teto exato.** A orientação não muda nada e nada na tela deixa
o usuário perceber. Evidência visual versionada, uma imagem para cada metade da
contradição:

- `evidence/followup-vivo/tempo-adaptativo-01-a-promessa-da-tela.png` — o painel
  com a janela de 10 a 360 min e a orientação escrita, que é o que o operador vê.
- `evidence/followup-vivo/tempo-adaptativo-02-o-que-o-motor-agendou.png` — a Fila
  mostrando o disparo no teto, que é o que o motor fez.

> Citadas aqui pelo caminho, e não pela pasta, porque
> `tests/unit/evidencia-citada.test.ts` reprova imagem versionada que nenhum
> documento nomeia — e reprovava: a frase anterior apontava só para o diretório,
> o que deixou o `verify` vermelho até a W2-LINGUAGEM topar com ele.
>
> O rótulo do modo mudou depois desta prova: **"Adaptativo (min–max)"** virou
> **"A IA escolhe a hora"** (W2-LINGUAGEM), e a spec acompanhou. As imagens são
> anteriores à troca.

O teste **nasce vermelho de propósito** — é a metade RED do ciclo e vira o
critério de aceite da frente MOTOR. Continua valendo depois: se alguém voltar a
cair no teto por atalho, inclusive como fallback silencioso quando o modelo não
responde, ele reprova. Cair no teto sem dizer é o defeito, não degradação.

#### Bugs de harness achados no caminho (todos fora do escopo pedido)

| # | Bug | Estado |
|---|---|---|
| H1 | `pnpm e2e:env` executava as crases do próprio comentário — o heredoc precisa ficar sem aspas (as `$API_URL` expandem), então o shell fazia substituição de comando em 3 palavras entre crases. 3 × `comando não encontrado` a cada execução, e o comentário saía mutilado no arquivo gerado. | **corrigido** `fec37ba5`, com controle positivo (3 erros antes, 0 depois, script chegando ao fim nas duas vezes) |
| H2 | `followup-builder.spec.ts` teste 6.2 tem corrida com o `autoFocus` do Radix: digita antes do foco chegar, o `fill` se perde, o campo fica vazio, o submit nasce desabilitado e o teste espera um diálogo que nunca fecha. O teste 6.1 do **mesmo arquivo** já tem a guarda. Reproduzido. | aberto — a spec nova já nasce com a guarda; consertar a 6.2 fica para quem tocar naquele arquivo |
| H3 | `NewFlowDialog` chama `create.mutate` **só com `onSuccess`**. POST que falha não mostra nada ao usuário — falha silenciosa na UI. Fato de código, independente de carga. | aberto · atribuído à frente E (linguagem) |

#### Protocolo do ambiente E2E — nasceu de um achado do DevGatilhos

Ele parou antes de rodar a suíte e perguntou, porque percebeu que
`scripts/seed-e2e-credentials.ts` **rotaciona o TOTP do admin** e derrubaria o run
do maestro em andamento. Virou regra escrita para o time
(`/Users/rafaelmelgaco/fv-briefings/PROTOCOLO-E2E.md`): o maestro é o dono do
seed, ninguém mais o roda, credenciais se copiam; nunca criar `.env.local` num
worktree; uma porta por frente (3101–3106); prazo de 60s nas esperas.

#### Uma medição minha que eu tive de retratar

Rodei os testes do contrato e vi **2 falhas em 180**. Quase reportei que o
Arquiteto havia commitado vermelho. **Não reproduz**: em `841528a8` com árvore
limpa dá 180/180, medido três vezes (inclusive repetindo o caminho torto que eu
tinha digitado). A primeira medição foi feita contra uma árvore que podia estar
sendo escrita naquele instante, e eu não declarei o SHA nem o `git status` junto
com o número. A explicação interessante era "ele errou"; a chata — o meu
instrumento — é a que sobreviveu.

#### A causa real da máquina travada: MEMÓRIA, não CPU

Medido: **swap 22.528 MB usados contra 452 MB livres**, numa máquina de **18 GB de
RAM**, com **8.226.181 pageouts**. A máquina estava em *thrashing*.

Isso reinterpreta tudo o que parecia contenção de CPU: um `next build` parado em
**estado `S` a 0% de CPU não disputa processador — está bloqueado esperando disco
de swap**. Dois builds simultâneos nesta máquina não terminam nenhum dos dois.
(Primeiro visto pelo QAVivo, que reportou 568 MB livres antes de eu medir.)

Regra que entrou em vigor: **um `next build` por vez na máquina inteira**, com o
maestro como dono do token. Vale para `test:db` e Playwright, que sobem container e
browser. **Não** vale para commit, `typecheck` e `lint`.

**Ação do maestro em worktree alheio, registrada de propósito:** matei o `next build`
do `fv-fila` (pids 65417/65480) depois de **duas medições com 12 min de intervalo**,
ambas 0% de CPU e estado `S`, 59 min de vida, zero linhas novas de saída — morto, não
lento. Confirmei o dono por `lsof -p PID -a -d cwd` antes, matei só os dois pelo pid,
reconferi depois. Swap livre subiu de 452 MB para 1.942 MB. Build morto não deixa
artefato aproveitável (o meu, no mesmo estado, tinha `.next` sem `BUILD_ID`), então o
dono perdeu espera, não trabalho. Comunicado a ele com a medição e com a opção de
vetar a prática.

#### O canal mente sobre entrega — e isso escondeu uma frente parada

O `lina handoff` da `W2-LINGUAGEM` respondeu **"ok: enviada"** e **não foi entregue**.
O QAVivo passou horas sem tarefa, e eu o li como parado. Regra: **confirmação de envio
não é prova de entrega; o artefato (claim no plano, commit no git) é o único sinal
confiável.** O inverso, apontado pelo DevGatilhos, é o que mais importa: *"o colega
não respondeu" não se lê como "o colega parou" — olhe a árvore dele antes de cobrar.*
Aconteceu duas vezes comigo no mesmo dia: cobrei o DevVivo por 21 arquivos sem commit
e a mensagem chegou depois de 5 commits dele; cobrei o QAVivo por estar parado quando
ele nunca tinha recebido a tarefa. Nos dois casos o git tinha a resposta.

#### Crédito ao método, não ao caráter

Elogiei o DevGatilhos por ter escrito no código a ressalva sobre o `agent-stage-sync`
e por ter recusado o atalho de ler `crm_lead_activities`. Ele corrigiu o registro para
baixo, e a correção fica: o cabeçalho ele escreveu **no instante em que mediu**, antes
de eu corrigir o briefing — não foi resposta a pedido meu; e recusar o atalho **não lhe
custou nada**, porque o atalho era pior para ele também (dois enrollments no dia em que
o emissor fosse consertado). Creditar a virtude o que veio de estrutura desliga o
alarme: sugere que o bom resultado dependeu de alguém ser cuidadoso, quando dependeu de
o caminho errado ser obviamente pior.

#### A máquina virou o gargalo — e o que isso ensinou

`load average` chegou a **78 em 11 CPUs**. Os consumidores reais **não eram os
builds**: Docker (VM do Supabase) 123%, o app do Lina 115%, Chrome 117% somado,
WindowServer 41%. Um `next build` da integração ficou **48 minutos a 0% de CPU em
estado `S`** — bloqueado, não lento; nenhuma linha nova de saída por mais de uma
hora; `.next` sem `BUILD_ID`, ou seja, artefato inutilizável. Morto e reiniciado
com o cache do Turbopack quente.

Três regras saíram disso:

1. **O critério de serialização não é "isso é uma medição?", é "isso consome a
   máquina?"** (formulação do DevGatilhos, melhor que a minha original). Build não
   contamina resultado, mas é o maior produtor da carga que faz a medição dos
   outros reprovar por teto.
2. **Identifique o processo pelo DONO, nunca pelo nome.** `pgrep -f "next build" |
   head -1` devolvia o processo de *outra frente* — cheguei a reportar tempo de
   build errado por isso. O certo é `lsof -p PID -a -d cwd`. Para matar: confirme o
   dono, mate só o seu pelo pid, e **reconfira depois** que sobrou o que devia.
   `pkill` amplo nesta máquina já matou trabalho de terceiro.
3. **`0% de CPU` com estado `S` é travamento, `R` seria disputa.** A distinção diz
   se você espera ou mata. E uma amostra só não decide: tire três.

#### O exit code que mentiu, de novo

O harness notificou **"completed (exit code 0)"** para o build que eu tinha acabado
de matar. Esse zero era o exit do **último comando da cadeia**, não do build; o
real estava no log: `build exit=143` (SIGTERM). É a mesma classe do
`cmd | tail` que o DevGatilhos apanhou de manhã e que virou regra do time — e o
maestro quase caiu nela três horas depois de escrevê-la. **Sempre leia o exit da
etapa que interessa, gravado por ela mesma, nunca o exit agregado.**

#### Doutrina de medição que esta missão descobriu na prática

Três terminais bateram no **mesmo** muro sem saber, e o custo de cada um
redescobrir sozinho foi o que mais atrasou o dia. Fica escrito:

1. **`user-event` com delay default leva ~16s para abrir um `Select` do Radix sob
   carga** e estoura o teto de 15s do vitest. Reprovação por lentidão, sem defeito
   nenhum. Conserto: `userEvent.setup({ delay: null })`, e teto próprio no teste
   quando ainda faltar — com justificativa **medida no mesmo commit em dois
   estados de máquina** (QAVivo mediu 1,8s livre × 15,7s com seis worktrees
   compilando; 30s é o dobro do pior caso observado).
2. **Nunca validar por pipe.** `cmd | tail` devolve o exit do `tail`: DevGatilhos
   recebeu "exit 0" de um run com 14 falhas, e o pipe comeu justamente as linhas
   que diziam quais. Redirecione para arquivo, capture `$?` na hora, leia depois.
3. **Quem mede tempo não tolera vizinho — e o vizinho pode ser você.** DevGatilhos
   rodava `test:unit`, a suíte de invariantes e o `next build` ao mesmo tempo:
   fabricou a lentidão que reprovou o próprio teste. A contagem dele não era
   comparável nem com a dele mesmo.
4. **Mas nem toda medição é sensível a carga.** `typecheck` e `lint` são
   invariantes: `tsc` erra ou não erra, ficar lento não muda o resultado. Só
   serialize o que tem teto de tempo (vitest, Playwright). Serializar tudo custa
   caro à toa.
5. **Controle no SHA pai.** O Arquiteto rodou `test:unit` em `4f89a0da` e mostrou
   os **mesmos 6 arquivos** falhando sem a mudança dele, nenhum citando follow-up.
   É o que separa "a máquina está lenta" de desculpa.
6. **Número viaja com o alvo.** Toda contagem sai com SHA curto, `git status` e —
   como esta missão aprendeu — **o que mais estava rodando na máquina**. Duas
   vezes hoje o maestro mediu contra árvore em movimento: uma contra o worktree de
   um colega mid-edit (quase virou acusação de commit vermelho, não reproduziu), e
   uma contra a própria árvore no meio de um conflito de merge (o typecheck acusou
   marcadores de conflito).

#### Regra de branch que nasceu de um atrito real

**Branch já consumida pela integração não se reescreve.** `fv/vocabulario` foi
emendada três vezes (`05933159` → `053faadc` → `f2cfa4e1`) depois de eu já ter
mergeado as duas primeiras. Cada reescrita apaga da branch o commit que a
integração consumiu e força um conflito `add/add` no mesmo arquivo. A partir do
primeiro merge do maestro: correção vira **commit novo por cima**, nunca `amend`
nem `rebase`.

#### Pendências abertas

- **H2** e **H3** acima.
- O `e2e` ainda não é check obrigatório na `main` (issue #63). As specs desta
  missão não mudam isso; quem for propor a obrigatoriedade precisa antes de uma
  série verde estável do conjunto atual.
