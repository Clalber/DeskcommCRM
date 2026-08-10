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
  crescente; org grande monopoliza cada tick e as pequenas nunca rodam. `runFollowupTick`
  engole a falha do claim e devolve `claimed=0`, indistinguível de "nada vencido".
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

#### Pendências abertas

- Nenhuma além dos bugs acima.
