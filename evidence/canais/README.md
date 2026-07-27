# evidence/canais/ — as provas do seam de canais (WhatsApp API Oficial)

Índice dos artefatos da branch `feat/canais-oficial`. Plano:
`docs/superpowers/plans/2026-07-27-canais-seam-fases-0-2.md` · Registro:
`HANDOFF-canais-oficial.md`.

**Esta pasta é versionada de propósito.** A Task 0 gravou tudo em
`.superpowers/evidence/`, que o `.gitignore` ignora (linhas 84 e 92) — a prova existia
no disco de uma máquina só, e nenhum clone a recebia. `evidence/` na raiz é a convenção
versionada do repo (é onde as waves do CRM Vivo gravam), e o guarda
`tests/unit/evidencia-citada.test.ts` só sabe cobrar citação de arquivo que o `git`
entrega. Prova fora do `git` é afirmação, não lastro.

---

## `baseline/` — a foto do "antes" (Task 0, SHA `4536ab1`)

A referência contra a qual **toda** task posterior se compara. Nada aqui é regenerável
com fidelidade: os screenshots dependem de dados, build e servidor vivos naquele
momento. Tratar como **evidência histórica** (ver `evidence/README.md`) — sobrescrever
destrói a única cópia.

### Screenshots — a jornada WAHA vivida pela tela

| Arquivo | O que prova |
|---|---|
| `evidence/canais/baseline/01-login.png` | login com conta real (`.e2e-creds.json`), MFA TOTP incluso |
| `evidence/canais/baseline/02-qr.png` | tela de conectar WhatsApp com o QR do WAHA renderizado |
| `evidence/canais/baseline/03-inbox.png` | inbox carregado com conversa real |
| `evidence/canais/baseline/04-texto-enviado.png` | mensagem de texto enviada **pelo inbox** (não por API) |
| `evidence/canais/baseline/05-audio-enviado.png` | áudio enviado pelo inbox — o caminho multimodal antes do seam |
| `evidence/canais/baseline/06-followup.png` | follow-up agendado pela tela |
| `evidence/canais/baseline/07-radar.png` | Radar de Risco carregado com a demanda esfriada |

Re-gerar (aponta para OUTRA pasta — nunca para `baseline/`):

```bash
CANAIS_EVIDENCE_DIR=evidence/canais/task4 \
  pnpm exec playwright test --config tests/journeys/playwright.config.ts
```

Pré-requisitos: Supabase local com `supabase/baseline.sql` aplicado, WAHA na 3030,
`next build` + `next start` no ar, `.e2e-creds.json` semeado. Receita completa na seção
"Receita do ambiente" do `HANDOFF-canais-oficial.md`.

### `gates.csv` — a cadeia `before_send` de um turno REAL de IA

8 gates + header, todos `pass`, na ordem `stop → lgpd → pacing → spinning → promise →
semantic_promise → case_promise → disclosure`. **Esta sequência não pode mudar** nas
Fases 0–2 — é a prova mais dura do plano.

Sai de `before_send_traces.trace` (array `jsonb`), que só é escrito em turno de agente
(exige `job_id` de `job_queue`) — envio manual pelo inbox não grava nada. Provocar um
turno: `npx tsx scripts/provoke-agent-turn.ts`. Re-gerar o CSV:

```bash
psql "$DATABASE_URL" -c "\copy (select e->>'gate' as gate, e->>'verdict' as verdict, coalesce(e->>'code','') as code from before_send_traces t, jsonb_array_elements(t.trace) e order by t.created_at, (e->>'gate')) to 'evidence/canais/<task>/gates.csv' csv header"
```

### `unit.txt` — a suíte unitária

`pnpm run test:unit` → **1038 passaram / 136 arquivos · exit 0**. É verde, e essa é a
régua: qualquer vermelho a partir daqui é regressão das Tasks 1–7, sem constante conhecida
para descontar.

A gravação da Task 0 tinha 1035✓/1✗ — o vermelho era o próprio plano citando prova por
nome puro (Ressalva 1 do handoff). Consertada a citação, este arquivo foi regravado: uma
régua que embute um defeito já corrigido mede errado.

### `e2e.txt` / `e2e-paralelo.txt` — a suíte e2e, duas réguas diferentes

- `e2e.txt` — execução **em série** (`--workers=1`). É a régua de regressão: sem
  concorrência sobre fixtures compartilhadas, uma falha aqui é candidata a defeito real.
- `e2e-paralelo.txt` — a execução original com **5 workers**, mantida só para a
  comparação série × paralelo. Teste que só falha aqui é candidato a flake de
  concorrência, não a defeito.

Comparar as duas listas é o que separa flake de defeito. Nenhuma das duas é verde — a
classificação está no `HANDOFF-canais-oficial.md`, Ressalva 3.

```bash
set -o pipefail
E2E_PORT=3007 pnpm exec playwright test --workers=1 2>&1 | tee evidence/canais/baseline/e2e.txt
echo "exit=$?" >> evidence/canais/baseline/e2e.txt
```

`$?` só vale com `pipefail` ligado (senão é o exit do `tee`). E **não** troque por
`${PIPESTATUS[0]}`: é variável do bash, e no zsh expande para vazio — o registro sai
`exit=` e ninguém percebe.

`E2E_PORT` é obrigatório se a 3001 estiver ocupada por outro worktree: o config usa
`reuseExistingServer: false` de propósito (reusar servidor alheio testa o build errado) e
aborta a suíte inteira em vez de rodar contra o processo de outra sessão.
