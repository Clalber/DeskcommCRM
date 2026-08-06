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
| 4 | Operador por evento | ⬜ | — |
| 5 | UI dos três papéis + `Testar` no caminho real | ⬜ | — |
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
