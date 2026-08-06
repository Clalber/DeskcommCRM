# HANDOFF — Os três papéis do agente (Conversador · Operador · Segurança)

> Documento **vivo**. Alimentado a cada avanço, cada bug encontrado, cada coisa deixada para trás.
> Toda afirmação declara o **SHA curto** de onde foi medida. Número sem SHA não compara.
>
> Contrato: [`docs/specs/16-spec-tres-papeis-do-agente.md`](docs/specs/16-spec-tres-papeis-do-agente.md)
> Doutrina: [`docs/doctrine/separacao-fala-e-operacao.md`](docs/doctrine/separacao-fala-e-operacao.md)
> Branch: `feat/tres-papeis-do-agente` · Base: `origin/main` = `0a85d251`

---

## Estado da esteira

| # | passo | estado | prova |
|---|---|---|---|
| 1 | Gate de vazamento no `before-send` | ✅ **feito** (veio da main) | **30,0% / 0,0%** medidos, 18 turnos |
| 2 | Contrato da declaração | ✅ **feito** `e167b362` | 16 testes · 5 sabotagens · `test:db` verde |
| 3 | Projeção do contexto | ✅ **feito** (este commit) | 18 testes, 3 contra turnos REAIS |
| 4 | Operador por evento | ✅ **feito** `35c88346` | 12 testes · 3 sabotagens com contagem prevista · `test:db` verde |
| 5 | UI dos três papéis + `Testar` no caminho real | 🟡 **parcial** `9b26ad76`+`2b85047e` | 16 testes · 4 sabotagens com contagem prevista · **prova de tela BLOQUEADA, ver abaixo** |
| 6 | Tirar tools de escrita do Conversador | ⬜ | — |

---

## Linha de base medida (SHA `0a85d251`, árvore limpa)

| medida | valor |
|---|---|
| Vazamento com prompt de OPERADOR | **30,0%** (3 em 10) |
| Vazamento com prompt de ATENDIMENTO | **0,0%** (0 em 8) |
| Tools no catálogo MCP | 51 (30 leitura, 20 escrita, 1 handoff) |
| Tools nativas do engine | 12 |
| Teto de tools por agente | 20 → **até 32 num prompt só** |
| Gates de `before_send` | 10 (cadeia v6) |
| `pnpm vitest run` | 2603 passed / 270 arquivos |
| `pnpm lint` | 0 erros, 189 warnings |

---

## Passo 2 — a declaração do turno · `e167b362`

**O que mudou.** `lead_checkpoints` ganhou `declaracao jsonb`; a declaração viaja na chamada de
fechamento que já existe (custo zero), não numa tool que o modelo poderia esquecer.

**A decisão que carrega o desenho:** `undefined`/`NULL` (não declarou) ≠ `{nada_a_declarar:true}`
(avaliou e não havia nada). Um default otimista faria "esqueceu" parecer "não havia nada".

**Consumidor imediato:** `buildHandoffSummary`. Sem ele a declaração seria evento sem consumer.

**Evidência:** 16 testes · suíte 2603 · typecheck limpo · lint 0 erros / 189 warnings (mesmo número
da main, medido com stash) · `test:db` verde (68 arquivos, 462 passed).

**Sabotagem — 5 defeitos, 5 reprovações no teste certo:**

| sabotagem | resultado |
|---|---|
| `.default({})` no lugar do `.optional()` | 2 failed ✅ |
| declaração sai da instrução de fechamento | 1 failed ✅ |
| handoff para de ler a declaração | 2 failed ✅ |
| `.strict()` vira `.passthrough()` | 1 failed ✅ |
| vocabulário interno entra na instrução | 1 failed ✅ |

---

## Passo 3 — a projeção · este commit

**O que mudou.** `lib/agent-engine/agent/projecao.ts`: allowlist do que o Conversador vê. Ligada em
três superfícies — abertura do ritual, releitura via `get_lead_context`, e retorno de
`search_knowledge`.

**O interruptor.** Arma quando **nenhuma ferramenta de catálogo entrou no turno** — é exatamente
onde os ids do contexto não têm uso (as MCP os recebem como argumento; as nativas resolvem pelo
closure). Sem env novo, sem botão para o self-hoster errar. No passo 6 ela passa a valer sozinha.

**Evidência:** 18 testes · suíte **2621 passed / 271 arquivos** · typecheck limpo · lint 0 erros.
Três casos medem contra os turnos REAIS de `gpt-5.6-terra` versionados em `evidence/`, com controle
positivo em cada um e falha declarada se a evidência sumir.

### Achados desta etapa

**🐛 `search_knowledge` vazava dois UUIDs por resultado — corrigido aqui.**
`chunk_id` e `knowledge_source_id` iam crus ao modelo em **toda** busca com RAG. O modelo não tem o
que fazer com eles (nenhuma ferramenta os aceita como argumento); as citações são montadas pelo
código. Era fonte silenciosa do UUID cru que a medição viu chegar à tela do cliente. Não estava
previsto no plano — apareceu ao procurar consumidor para a projeção.

**🐛 Bug que quase entrei, registrado porque o teste dele fica.**
Eu aplicava a tradução de erro ao **corpo das mensagens**. "Meu site tem um webhook quebrado" —
frase legítima de quem vende integração — viraria "não consegui concluir essa verificação", e o
agente responderia a uma pergunta que ninguém fez. A fala de quem está do outro lado é o único dado
que nunca se corrige. Coberto por teste de regressão.

**🔧 Cabeçalho do bloco de estado imprimia `lead_state`** — nome de tabela no prompt, vazamento
gratuito pela porta 2 sem nem precisar de uma ferramenta. Corrigido.

**🐛 Bug MEU que entrou e a sabotagem pegou — `a859a735`.**
`traduzirErroCru` era aplicada a **toda** string do retorno de ferramenta. O detector considera
"webhook" vazamento (com razão, na saída), e a base de conhecimento de qualquer empresa que venda
integração fala webhook: o `content` do `search_knowledge` viraria *"não consegui concluir essa
verificação"* linha após linha. **A projeção destruiria o RAG do tenant** para proteger contra um
vazamento que o gate de saída já cobre.

É a **mesma falha** da fala do cliente, numa irmã que não se parece por fora: as duas nascem de
aplicar num texto de **terceiros** um filtro desenhado para texto do **sistema**. Procurei a classe
depois de pegar a primeira instância e não achei esta.

*Como o teste passava sem medir:* o detector pega UUID (categoria `erro_cru`), então os casos de
evidência passavam pela **tradução** mesmo com a remoção de chave desligada — dois mecanismos
redundantes, e eu atribuía o resultado ao errado. O sinal foi a sabotagem S2 derrubar 1 caso de 3.
Depois da correção: **S2 derruba 3 de 3.**

### Sabotagem do passo 3 — 8 defeitos, 8 reprovações no teste certo

| sabotagem | resultado |
|---|---|
| allowlist vira spread (campo novo passa) | 2 failed ✅ |
| `chaveDeIdentificador` desligada | **3 failed** ✅ (era 1 antes da correção) |
| tradução devolve texto cru (falha aberta) | 1 failed ✅ |
| interruptor arma sempre | 1 failed ✅ |
| tradução volta a pisar na fala do cliente | 1 failed ✅ |
| `chaveDeErro` aceita tudo (volta o bug do RAG) | 1 failed ✅ |
| `chaveDeErro` rejeita tudo (desarma a defesa) | 2 failed ✅ |

---

## Passo 4 — o Operador nasce · `35c88346`

**O que mudou.** `job_queue` aceita `operator_turn`; o job é enfileirado pelo **runtime** ao fim do
turno, logo depois de o checkpoint existir, com `sourceEventId` = job do Conversador (retry não gera
um segundo Operador). Handler em `operator-turn.ts`, registrado no worker. `ai_agent_versions` ganhou
`operator_enabled` (default **false**) e `operator_model` (null = herda).

**Onde o passo 2 se paga.** O curto-circuito usa a distinção que construímos lá:

| declaração | decisão | por quê |
|---|---|---|
| `nada_a_declarar: true` | **não chama modelo** | quem avaliou estava lá, com todo o contexto |
| **ausente** (`null`) | **roda** | ninguém avaliou — é aí que promessa fica órfã |

Há um teste afirmando que os dois estados levam a decisões **opostas**. Se alguém colapsar a
distinção, ele vermelha.

**Evidência:** 7 testes de decisão + 5 invariantes de schema · suíte **2630 passed / 272 arquivos** ·
`test:db` **verde** (69 arquivos, 467 passed) · typecheck limpo · lint 0 erros / 189 warnings.

### Sabotagem do passo 4 — com a contagem PREVISTA antes de rodar

| sabotagem | previsão | resultado |
|---|---|---|
| ausente tratado como vazio | ≥2 | **2 failed** ✅ |
| papel desligado passa a rodar | 2 | **2 failed** ✅ |
| infere "vazio" por listas em vez da afirmação | 1 | **1 failed** ✅ |

> Prever a contagem virou regra depois do passo 3, onde uma sabotagem derrubou 1 caso quando devia
> derrubar 3 — e o verde dos outros 2 vinha de um mecanismo redundante que era, ele próprio, um bug.

### Dois erros meus que as CATRACAS DO REPO pegaram — não eu

1. **Segundo bloco de `job_queue_kind_check` no baseline.** Reconstruir a mesma constraint em N
   blocos quebra o `update.sh` de todo clone com vocabulário posterior. Eu tinha aplicado essa
   lição corretamente ao `agent_inbox_items` **minutos antes**, e a irmã passou batido — o padrão
   pego numa ocorrência dá álibi às outras. Pego por `baseline-constraint-reconstruida.test.ts`.
2. **Kind novo divergindo entre banco e TypeScript** — pego por
   `vocabulario-banco-x-typescript.test.ts`.

Os dois viraram verde **depois** de corrigidos, com run limpo. Registro aqui porque a saída limpa
sem esta nota creditaria ao meu rigor o que foi mérito da catraca.

---

## Passo 5 (parcial) — a mão do Operador e a tela · `9b26ad76`, `2b85047e`

**Fatia 1 — o Operador ganha mão.** Lê `operator_tool_ids` (coluna **própria**, migration 0112),
monta o toolset pela ponte MCP e roda turno de modelo com briefing e custo próprios
(`purpose: 'operator_turn'` — sem isso "quanto custa ligar o papel?" não teria resposta).

*Sem canal, estruturalmente:* `send_message` é nativa do engine e **não existe no catálogo**, então
não há id que a ligue; `crm_send_whatsapp_message` está em `BLOCKED_TOOL_IDS`, agora **exportado
para ser asserível** — garantia que nenhum teste consegue ler é garantia que ninguém percebe quando
some.

**Fatia 2 — a tela.** Navegação por papel dentro do mesmo form (um rascunho, um save). A régua é
dizer a **consequência**: com o papel desligado, a tela explica o que *continua* acontecendo (o
básico é registrado sozinho) **e** o que *para*. Sem a primeira frase o usuário conclui que desligar
deixa o sistema cego, e liga por medo em vez de escolha.

**Evidência:** 16 testes novos (8 de motor, 8 de componente) · suíte unit **1459 passed / 154
arquivos** · `test:db` **verde** (69 arquivos, 467 passed) · typecheck limpo · lint 0 erros ·
**4 sabotagens na tela, 4 reprovações, contagem prevista em cada uma**.

### 🚨 BLOQUEIO: a prova de tela não pôde ser feita nesta máquina

`.env.local` aponta `NEXT_PUBLIC_SUPABASE_URL` para **`…porysaiysiztn.supabase.co`** — a nuvem, não
o Supabase local (que está de pé em `127.0.0.1:54321`). O `playwright.config.ts` sobe o app com
`next start`, que carrega `.env.local`.

**Consequência:** rodar `pnpm test:e2e` nesta máquina, hoje, cria agentes, versões e conversas de
teste **no banco de produção**. Não rodei.

Isto não é específico deste épico: vale para **qualquer** sessão que rode e2e nesta máquina agora.

Saídas possíveis (decisão do Rafael, é config dele):
1. `.env.e2e` apontando para o local, carregado pelo `webServer` do Playwright — conserta para todo
   mundo e é o que a doutrina de QA Visual pressupõe;
2. apontar `.env.local` para o local enquanto se testa (manual, esquecível — foi o que já mordeu
   antes, ver `feedback_env_local_aponta_para_remoto`);
3. rodar a prova numa VPS descartável.

**Enquanto isso, o que está provado da tela é comportamento de componente, não jornada de usuário.**
São coisas diferentes e a diferença está declarada.

---

## Deixado para trás (declarado, não escondido)

| # | o quê | por quê ficou | onde fecha |
|---|---|---|---|
| 1 | **Conteúdo** do bloco de estado (`stage: 'qualifying'`) segue cru | `update_lead_state` precisa dele para marcar o próximo estágio | passo 6, junto com a ferramenta |
| 2 | Retorno de tool **MCP** não é projetado | remover ids quebraria a operação; hoje cobre o gate de saída | passo 6 (Conversador sem elas) |
| 3 | `projeta` é **opcional** no tipo de `buildOpening` | `tests/invariants/**` é congelado por hook; obrigatório forçaria editar invariante | quando houver flip legítimo |
| 4 | Botão **Testar** não exercita guardrail nenhum | `runAgent` deprecated não importa `runBeforeSend` | passo 5 |
| 5 | 2ª camada do fail-safe de vazamento nunca exercitada | o modelo consertou de primeira na observação | — |
| 6 | Inbound sem turno próprio: 5 mensagens → 4 jobs, nenhum `deduped` | fora do escopo da medição que o achou | a investigar |
| 7 | Tudo medido só em `gpt-5.6-terra` | chave Anthropic da máquina sem crédito | — |
| 8 | **O Operador ainda não tem MÃO** | o passo 4 entrega o CANAL (job, disparo, decisão, config); as ferramentas de escrita entram junto com a UI que as configura | passo 5 |
| 9 | Nenhum turno de produção observado com worker real | a projeção e o Operador estão provados por unit + payload real, não por execução ponta a ponta | passo 5, junto com a prova de tela |
| 10 | **Botão `Testar` ainda não exercita guardrail nenhum** | fatia 3 do passo 5, não iniciada — `runAgent` deprecated não importa `runBeforeSend` | passo 5, fatia 3 |
| 11 | Jornada de usuário na tela nova (e2e) | bloqueada pelo `.env.local` apontando para a nuvem (ver 🚨 acima) | quando houver `.env.e2e` |

---

## Regras de trabalho desta frente

1. **Testar a cada avanço, não no fim.** Avanço sem teste não é avanço.
2. **Verde de primeira não prova nada** — sabotar cada afirmação e confirmar a reprovação.
3. **Evidência real acima de fixture.** Fixture mede a imaginação de quem a escreveu — que é a que
   já falhou, senão o defeito não existiria.
4. **Commitar antes de sabotar.** `git checkout <arquivo>` leva junto o trabalho não commitado
   (aconteceu, custou 4 edições).
5. **Não driblar catraca do repo.** O hook de invariantes bloqueou um commit; a saída foi mudar o
   desenho, não exportar a variável de escape.
