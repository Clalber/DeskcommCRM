# HANDOFF — Marca Própria (whitelabel)

> **LEIA ISTO ANTES DE QUALQUER COISA, EM TODA SESSÃO QUE TOCAR ESTE ÉPICO.**
> E alimente este arquivo **a cada avanço** — não no fim, não "quando der".
> Handoff atualizado depois é handoff que ninguém escreveu.

---

## Protocolo desta sessão (lei, não sugestão)

Imposto por Rafael em 2026-08-13, terceira repetição da mesma correção. Palavras dele:

> *"O Claude tem mania de assumir que só porque o código funciona em testes
> automatizados o trabalho está concluído. Mas os bugs, gaps e lacunas de
> usabilidade aparecem quando USAMOS a ferramenta, e são muitas; quando deixamos
> para consertar só no fim, gasta-se um tempo 3x maior do que o de desenvolvimento
> em investigação e correção."*

**O ciclo, sem exceção:**

```
avanço → Playwright na tela como usuário → as 5 lentes → HANDOFF atualizado → próximo avanço
```

**As 5 lentes de todo teste** (nenhuma substitui outra; teste automatizado verde cobre
parte da primeira e mais nada):

| Lente | A pergunta |
|---|---|
| **Técnica** | a peça faz o que promete? |
| **Funcional** | o fluxo completo entrega o resultado ao usuário? |
| **Fundacional** | a base aguenta — schema, RLS, migration, baseline, update de clone? |
| **Doutrinária** | respeita a lei do repo — Sistema Vivo, DIRC, migrations, tenancy? |
| **Empírica** | a experiência real é BOA? um leigo entende? está claro? |

**Âncora de arquitetura:** o público-alvo principal instala o CRM numa **VPS da
HostGator** pelo `hostgator-setup-kit/`, com **Supabase cloud**. Toda decisão se
avalia contra isso primeiro — não contra a Vercel, não contra o laptop. E a pergunta
que quase sempre é esquecida: **como isto chega a um clone que JÁ RODA e vai atualizar?**

---

## Onde estou

| | |
|---|---|
| **Worktree** | `/Users/rafaelmelgaco/DeskcommCRM-marca` |
| **Branch** | `feat/marca-propria`, criada de `origin/main` @ `f9abedd0` |
| **Banco** | Supabase local `127.0.0.1:54321` — **compartilhado com outras sessões**, checar antes de DDL |
| **Blueprint** | https://claude.ai/code/artifact/1aa1b097-d6f4-4aff-b388-194b1e546ca2 |

> ⚠️ O worktree principal (`/Users/rafaelmelgaco/DeskcommCRM`) é de **outra sessão** —
> mudou de `fix/alertas-de-seguranca-github` para `fix/issues-triadas` no meio desta.
> Não commitar lá.

---

## Estado das fases

**A ordem mudou depois da reancoragem.** A antiga fazia sentido para a Vercel, onde nada
chega ao usuário sem deploy. Sob a âncora VPS, o valor chega antes por outro caminho: o
que o comprador percebe primeiro não é upload de logo, é **a interface não parecer a
nossa** — e cor é o eixo mais barato, mais visível, e o único que a doc de venda declara
impossível hoje.

| # | Fase | Estado |
|---|---|---|
| **0** | **Encoding do `.env` — bloqueador medido** | 🟡 em andamento |
| 1 | Tabela de marca + resolver + **cor por instalação** + reconciliar `white-label.md` | ⬜ |
| 2 | Marca **por organização** (nome + cor), capturada no `welcome` e editável | ⬜ |
| 3 | Upload de logo (bucket, policies, 512 KB, delete-on-replace) | ⬜ |
| 4 | Vazamentos hardcoded (MFA, convite, alarme, PDF) + ampliar o gate de marca | ⬜ |
| 5 | Favicon + templates de auth do Supabase | ⬜ |
| 6 | *(fora do épico, mas ele expôs)* dar `image:` ao worker | ⬜ |

Fases 0–3 substituem o plano anterior de 6 fases. As tasks do rastreador ainda usam a
numeração antiga — a correspondência está aqui.

---

## O que já foi MEDIDO (não presumido)

Cada linha aqui foi verificada lendo o arquivo. Onde diz *(workflow)*, o número veio
de um agente que rodou o cálculo — e está marcado de propósito.

### A premissa do pedido estava parcialmente errada

- **`lib/branding.ts` já existe** — nome + logo por `.env`, lidos em runtime.
  Deliberadamente **não** `NEXT_PUBLIC_*`: a imagem Docker é pré-buildada e a marca
  do revendedor nunca apareceria. **8 call sites; 6 rodam sem organização resolvida.**
- **`docs/white-label.md` já promete isso em público**, em 3 idiomas, e lista os
  buracos exatos: *cores/fontes/tema não configuráveis*, *marca por instalação e não
  por organização*, *textos e e-mails seguem o padrão do produto*.
- **`docs/design-system/screen-flow/03-screen-inventory.md:149`** já inventariou a
  rota `/app/settings/tenant/branding` com `<BrandingForm>`, prioridade P2.
- **`app/design/lib/tokens.ts`** tem 5 paletas completas (sage/clay/mist/plum/olive),
  accent de 11 stops, neutros light e dark **desenhados separadamente**.

### Defeitos pré-existentes encontrados no caminho

| Defeito | Evidência | Fase que conserta |
|---|---|---|
| **Gate de marca verde enquanto a marca vaza** — `/Deskcomm/` case-**sensitive** | `tests/unit/branding.test.ts:90`; passam `support@deskcomm.com.br` (`app/account-suspended/page.tsx:17`), `suporte@deskcomm.app` (`app/app/settings/billing/page.tsx:26`), `deskcommcrm-recovery-codes.txt` (`components/auth/RecoveryCodesPanel.tsx:34`) | 1 |
| **Colisão de cor Δ=0,0° no tema escuro** — `--color-success` é a mesma string de `--color-accent-400` | `app/globals.css:167` e `:193`, ambos `#82a077` | 1 |
| **Corrida no `settings` jsonb** — SELECT→spread→UPDATE sem `.select()`; `visibility_mode` mora no mesmo jsonb | `app/actions/settings/updateTenant.ts:56-83` | 3 |
| **`[data-theme="light"]` não existe** — `:root` casa só `<html>`, então tema claro não é escopável em subárvore | `grep -c 'data-theme="light"' app/globals.css` = 0 | 1 |

### Topologia real do público-alvo

- **Supabase é cloud**, provisionado pela Management API (`hostgator-setup-kit/supabase-provision.sh`).
  Storage não consome disco da VPS, mas consome **cota do plano do cliente**,
  competindo com `whatsapp-media`. Plano grátis: 2 projetos por usuário.
- **O scheduler da VPS já roda 16 crons** (`docker-compose.prod.yml:145-172`) — o
  anti-morte por cron **existe** para o público principal. A Vercel é o caso degradado.
- Serviços do compose: `app`, `worker`, `waha`, `redis`, `srh`, `scheduler`, `caddy`.
  **Dois processos Node** (app + worker), não N lambdas — isso muda a escolha de cache.
- A única policy de escrita em `organizations` é `orgs_write_platform_admin`
  (`supabase/baseline.sql:3415`, `FOR ALL`). Pelo client de sessão o UPDATE de um
  admin de tenant casa **0 linhas e o PostgREST devolve sucesso**. O molde correto
  (admin client + gate de papel + filtro explícito) está em `updateTenant.ts:31-50`.

---

---

## Fase 0 — o bloqueador, medido por mim

### O defeito

`hostgator-setup-kit/install.sh:436` grava o `.env` com aspas simples e escape `'\''`.
Para `APP_NAME = Sant'Ana Odontologia` isso produz `APP_NAME='Sant'\''Ana Odontologia'`,
e o **Docker Compose recusa ler o arquivo inteiro**:

```
failed to read .env: line 1: unexpected character "\" in variable name "\''Ana Odontologia'"
docker compose config -> rc=1    ps -> rc=1    pull -> rc=1
```

**Controle positivo:** o mesmo arquivo, uma variável mudada (sem apóstrofo) → rc=0.
**Controles negativos:** cifrão e cerquilha passam (rc=0) — o defeito é específico do apóstrofo.

Onde morde: `APP_NAME` é a **última** pergunta da entrevista (`install.sh:996`), sem
validador; o `.env` é escrito em `:1303`; o baseline é aplicado e o dono é criado por
caminhos que **não usam compose** (passam) — e só então `dc pull`/`dc up -d` (`:1473`)
morrem. O comprador fica com Supabase provisionado, schema aplicado, admin criado, e um
erro sobre "variable name" que não aponta para nada que ele digitou. Como `dc()` não passa
`--env-file`, **todo** comando do kit passa a falhar: `healthcheck.sh`, `update.sh`,
`backup.sh`, e o agente de 5 em 5 minutos.

"Sant'Ana", "D'Ávila", "Espaço D'Or" são nomes de empresa brasileiros comuns. E vale para
`OWNER_PASSWORD` com apóstrofo.

### Por que nenhum gate pegava

O round-trip do `.env` em `test-validators.sh:303-325` exercita **só** o `load_env` do
bash, e o fixture não tem apóstrofo interno. Nenhum teste do kit roda `docker compose`
contra um `.env` gerado. Ponto cego em dois eixos ao mesmo tempo: o **consumidor** não
coberto e o **caractere** não coberto.

### São TRÊS consumidores, não dois

1. `load_env` (`_common.sh:252-276`) — parsing manual com `printf -v`, **não** `source`.
2. `docker compose` via `env_file: .env` (`docker-compose.prod.yml:34,71`).
3. `source .env && curl …` — receita real em `hostgator-setup-kit/README.md:143`.

### A solução, escolhida por medição

18 combinações (6 valores × 3 consumidores):

| encoding + leitor | `load_env` | `source` | contêiner |
|---|---|---|---|
| atual (aspas simples + `'\''`) | 6/6 | 6/6 | **4/6** |
| aspas duplas + `load_env` atual | **3/6** | 6/6 | 6/6 |
| **aspas duplas + `load_env` com patch** | **6/6** | **6/6** | **6/6** |

`envq` passa a usar aspas duplas escapando `` \ " $ ` ``, e o `load_env` desfaz esse
escape. O ramo de aspas simples **fica** — clone que atualiza não reescreve o `.env`.

> ⚠️ **Nota sobre o meu instrumento:** o contador automático de falhas do meu script
> media só o contêiner (incrementava dentro de `$( )`, que é subshell). As linhas
> individuais são a verdade; a tabela acima veio delas, não do contador.

---

## Achados fora do escopo, que o épico expôs

| Achado | Evidência | O que muda |
|---|---|---|
| **O worker não tem `image:`, só `build:`** — único dos 7 serviços | `docker compose -f docker-compose.prod.yml config` resolvido pelo próprio Docker | `install.sh` roda `dc up -d` sem escopo → **a VPS compila**, contra o que `hostgator-setup-kit/README.md:91` promete. E `update.sh` (`dc pull` + `up -d` sem `--build`) → **o worker segue com código velho**. Consequência é inferência da semântica do Compose; falta observar numa VPS |
| **Regra para o épico** | — | Trabalho agendado da marca vai em `app/api/v1/cron/*` batido pelo `scheduler`, **nunca** no worker — é o único componente que não recebe código novo |
| **Apêndice do baseline: bucket chega, mudança de policy some** | Reprodução em Postgres descartável: `ERROR: policy already exists` e o statement seguinte entra | Todo bloco de policy do apêndice nasce com `drop policy if exists`. Todo bucket com `on conflict (id) do …` |
| **Cota do Supabase é do cliente e ninguém a mede** | `docs/SETUP.md:76` (1 GB, e é a única ocorrência no repo — está no guia de **dev**) | O bucket de marca disputa 1 GB com toda a mídia de WhatsApp, que **não tem poda por idade** (`media_retention_days` é campo morto). Teto de upload **512 KB**, não 2 MB, e apagar o objeto anterior na troca |
| **A organização sempre nasce "Minha Empresa"** | `install.sh:1441`, literal — logo depois de o instalador perguntar `APP_NAME` | O `install.sh` não ganha pergunta nova; passa a **usar** o que já tem |
| **Não existe favicon** | `public/` só tem `llms.txt`; nenhum `app/icon.*` | A aba não tem marca nenhuma, nem a nossa |

---

## Bugs achados executando

_(esta seção enche quando eu começar a clicar na tela)_

---

## Próximo passo exato

Fase 0 em implementação por subagente: trocar o `envq`, patchar o `load_env`, e cobrir
com fixture de apóstrofo nos **três** consumidores (o teste do `docker compose config`
é o que não existia). Sabotagem obrigatória para provar que o teste vigia.
