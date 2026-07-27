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
2. Evidência gravada em `.superpowers/evidence/canais/<task>/`
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
| Task 0 (baseline de regressão) | ⬜ não iniciada |

**Nada de código foi escrito ainda.** O primeiro ato é gravar a foto do "antes" (Task 0):
sem ela, "não regrediu" é afirmação e não medição.

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
