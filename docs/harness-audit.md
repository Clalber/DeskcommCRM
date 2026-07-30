---
type: harness-audit
project: DeskcommCRM
status: draft
last_updated: 2026-07-29
generated_by: auditoria documental (Claude Code) — verificação de arquivos, CI e configs
confidence: alta (todos os itens verificados por leitura direta de arquivo/config; nenhum comando executado)
---

# Auditoria do harness — DeskcommCRM

"Harness" = a infraestrutura que permite a um humano ou agente instalar, entender,
alterar e **verificar** o projeto com segurança. Um harness fraco não impede o trabalho;
ele torna o trabalho não-verificável, e é aí que a regressão entra sem ninguém ver.

Nada aqui foi executado — a auditoria é read-only por instrução. Todos os itens foram
verificados por leitura de arquivo, config e workflow.

---

## Nível de maturidade: **H3 — Verificável** (encostando em H4)

| Nível | Veredito | Evidência |
|---|---|---|
| H0 — Não documentado | superado | 102 docs, README de 283 linhas em 3 idiomas, PRDs, specs |
| H1 — Documentado | ✅ | `README.md`, `ARCHITECTURE.md`, `VISION.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md` |
| H2 — Reproduzível | ✅ | Quickstart no README, `docs/SETUP.md`, `.nvmrc`, `packageManager` fixo, `pnpm-lock.yaml`, `docker-compose.yml`, `install.sh` do kit self-host, `baseline.sql` |
| H3 — Verificável | ✅ | `lint` + `typecheck` + `test:unit` + `build` existem; CI roda os 3 primeiros em PR |
| H4 — Preparado para agentes | ⚠️ **parcial** | `CLAUDE.md` doutrinal existe e é forte; `AGENTS.md` **passou a existir nesta auditoria**; o comando único (`gov:verify`) existe mas **exclui os gates que a própria doutrina chama de obrigatórios** |
| H5 — Automação avançada | ❌ | CI não roda o gate de isolamento RLS nem E2E; ambiente local atualmente quebrado (`node_modules` sem `typescript`/`eslint`) |

**Por que não H4:** a instrução da auditoria é explícita — não atribuir H4/H5 só porque
os arquivos existem. Aqui os arquivos existem e são de boa qualidade, mas o *processo* de
verificação tem um buraco estrutural: o comando único e o CI ambos ignoram
`tests/invariants/` e `tests/e2e/`. Um agente que segue o harness ao pé da letra pode
mergear uma mudança de RLS sem que um único invariante de isolamento rode. Fechado esse
buraco (itens 14 e 15 abaixo), o projeto vira H4 imediatamente e H5 fica a um passo.

**O que puxa este projeto para cima e é incomum:** doutrina escrita e específica
(`CLAUDE.md`), Definition of Done de 13 itens, ~31 invariantes de banco, gate de
install+update do `baseline.sql` num Postgres descartável, doutrina de QA visual com
ambiente fresco estilo VPS, e uma máquina de governança de agentes (`loop/`) com
maker≠checker e hash-check. Isso é maquinário de H5. Ele só não está *ligado no CI*.

---

## Os 20 itens

Legenda: ✅ existente e funcional · ⚠️ existente mas incompleto · ❌ não identificado · 💡 recomendado

| # | Item | Status | Evidência / lacuna |
|---|---|---|---|
| 1 | README útil | ✅ | 283 linhas: o que é, quickstart de 5 min, stack, estrutura, testes, roadmap, suporte. Traduzido (EN/ES) |
| 2 | Instruções de instalação | ✅ | README §Quickstart + `docs/SETUP.md` + `docs/deploy-selfhost/` + `docs/deploy-hostgator/` + `install.sh` |
| 3 | Versão de runtime definida | ✅ | `.nvmrc` = 20, `engines.node >=20`, `packageManager: pnpm@9.15.9` |
| 4 | Lockfile | ✅ | `pnpm-lock.yaml`, e o CI usa `--frozen-lockfile` |
| 5 | `.env.example` | ⚠️ | Existe (+ `.env.hostgator.example`), mas **faltam 6 vars** de `lib/env.ts`, entre elas 3 secrets: `IMPERSONATE_COOKIE_SECRET`, `INTERNAL_CRON_SECRET`, `LGPD_SIGNING_KEY` |
| 6 | Comando de desenvolvimento | ✅ | `pnpm dev`. Nota: `docs/testing/` documenta que E2E fresco exige `build` + `start`, não `dev` |
| 7 | Comando de build | ✅ | `pnpm build`; exercitado no workflow `perf.yml` |
| 8 | Comando de lint | ⚠️ | `pnpm lint` existe e roda no CI, mas **falha localmente hoje** — `eslint` ausente de `node_modules` |
| 9 | Comando de formatação | ✅ | `pnpm format` / `format:check` (Prettier). ⚠️ `format:check` **não está no CI** |
| 10 | Checagem de tipos | ⚠️ | `pnpm typecheck` (`tsc --noEmit`, TS 6 estrito), roda no CI, mas **falha localmente hoje** — `typescript` ausente de `node_modules` |
| 11 | Testes unitários | ✅ | 155 arquivos `*.test.ts(x)`; `pnpm test:unit` no CI |
| 12 | Testes de integração | ⚠️ | ~31 invariantes de banco em `tests/invariants/` + `tests/api/` — excelentes, mas **fora do `test:unit` e fora do CI**. Só via `pnpm test:db` (exige Docker) |
| 13 | Testes E2E | ⚠️ | 17 specs Playwright, incluindo os P0 `vps-fresh-onboarding` e `vps-webhook-outbound-ssrf`. **Não rodam no CI** |
| 14 | Comando único de verificação | ⚠️ | `pnpm gov:verify` existe = `typecheck && lint && test:unit`. **Omite `test:db` e `test:e2e`** — verde não significa verificado |
| 15 | CI executando verificações | ⚠️ | `ci.yml` roda typecheck + lint + test:unit. **Não roda `test:db`** (o gate que `CLAUDE.md` chama de obrigatório), nem E2E, nem `format:check`. `perf.yml` faz build + bundle size; `publish-image.yml` publica imagem no GHCR |
| 16 | Proteção contra secrets | ⚠️ | `.gitignore` cobre `.env*` (com exceção só para os `.example`) e o Sentry tem `beforeSend` que higieniza PII. **Sem** gitleaks/trufflehog no CI, **sem** pre-commit hook |
| 17 | Documentação arquitetural | ✅ | `ARCHITECTURE.md` (1 página) + `docs/specs/` 01–15 com schema e payloads + `docs/architecture/agent-turn` + `graphify-out/` (7310 nós) |
| 18 | Regras para agentes de IA | ✅ | `CLAUDE.md` doutrinal (convenções não-negociáveis, 14 anti-patterns, doutrinas de migration/QA/branch), `.claude/agents/` com frota especializada, `loop/` com maker≠checker. **`AGENTS.md` criado nesta auditoria** — antes, agentes não-Claude entravam sem contexto |
| 19 | Critérios de conclusão de tarefa | ✅ | Definition of Done de 13 itens em `CLAUDE.md`; `docs/doctrine/sistema-vivo.md` com o Living System Checklist; template de PR com o checklist |
| 20 | Ambiente reproduzível | ⚠️ | Muito bom no papel: `docker-compose.yml` (dev), `.prod.yml`, `Dockerfile` + `Dockerfile.worker`, `baseline.sql` auto-curativo, `scripts/test-db.sh` com Postgres efêmero pg17. Mas o checkout local está com `node_modules` incompleto, e a receita de ambiente fresco tem armadilhas documentadas (pg17 obrigatório, `node_modules` real e não symlink, fora de `/tmp`) — reproduzível **com conhecimento tácito**, não trivialmente |

---

## Plano de correção, por relação custo × benefício

Ordenado por retorno. Nada aqui foi aplicado — a auditoria não altera CI, `package.json`
nem código.

### 1. Adicionar `pnpm test:db` ao CI 🔴 · custo: ~15 linhas de YAML

O maior buraco do harness. Runner do GitHub Actions já tem Docker, e `scripts/test-db.sh`
sobe e derruba o Postgres efêmero sozinho (trap no EXIT). Um job novo em `ci.yml` liga
~31 invariantes de isolamento + o gate de install/update do `baseline.sql` — os artefatos
mais valiosos do repo, hoje inertes.

### 2. Adicionar os E2E ao CI (ou a um workflow nightly) 🔴 · custo: ~30 linhas

`vps-fresh-onboarding.spec.ts` protege a primeira impressão, que a doutrina classifica
como o caminho mais crítico do produto. Rodar em PR pode ser lento; um workflow nightly
+ trigger manual já elimina a regressão silenciosa.

### 3. Renomear/reforçar o comando único 🟠 · custo: 2 linhas

Duas opções: (a) `gov:verify` passa a incluir `test:db` (exige Docker em toda máquina de
dev), ou (b) mantém `gov:verify` como o loop rápido e cria `verify:full` =
`gov:verify && test:db`, com `AGENTS.md` e o DoD apontando para `verify:full` como
critério de merge. **Recomendo (b)** — preserva o loop rápido e torna a diferença explícita.

### 4. Completar `.env.example` 🟠 · custo: 6 linhas

As 6 vars ausentes, com comentário sobre quais são obrigatórias. Os 3 secrets são o caso
grave: quem instala não sabe que precisa gerá-los.

### 5. Adicionar scan de secret no CI 🟡 · custo: ~10 linhas

`gitleaks` como step. Projeto open-source com screenshots de evidência sendo commitados
tem risco real de vazamento acidental.

### 6. `format:check` no CI 🟡 · custo: 2 linhas

O script existe e não é exercitado.

---

## Não pôde ser confirmado

- Se `typecheck`/`lint`/`test:unit` **passam hoje** — `node_modules` incompleto e a
  auditoria não instala dependências. Todo status "✅" nos itens 8, 10 e 11 refere-se à
  *existência e configuração* do comando, não a uma execução verde observada.
- Taxa de sucesso histórica do CI — não consultamos a API do GitHub Actions.
- Cobertura de teste em % — configurada no Vitest (`provider: v8`), nunca coletada aqui.
- Se as branch protection rules do GitHub exigem o CI verde para merge — é config de
  repositório remoto, invisível no checkout.
