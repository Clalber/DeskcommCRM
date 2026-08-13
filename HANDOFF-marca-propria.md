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
| **0** | **Encoding do `.env` — bloqueador medido** | ✅ `c3764437` |
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

## Fase 0 — ENTREGUE (`c3764437`)

**O conserto.** `envq` passa a aspas duplas escapando `` \ " $ ` ``; o ramo de aspas
duplas do `load_env` desfaz esse escape (sentinela `\001` para não reprocessar `\\`).
O ramo de aspas simples **fica** — clone que atualiza não reescreve o `.env`.

**Prova que eu mesmo rodei**, com o `envq` real do disco (não uma cópia):

| valor | linha gravada | `load_env` | `source` | contêiner |
|---|---|---|---|---|
| `Sant'Ana Odontologia` | `APP_NAME="Sant'Ana Odontologia"` | ok | ok | ok (rc=0) |
| `Casa "Bela" #1` | `APP_NAME="Casa \"Bela\" #1"` | ok | ok | ok (rc=0) |
| `se$nha P$ss` | `APP_NAME="se\$nha P\$ss"` | ok | ok | ok (rc=0) |

`pnpm test:shell` medido por mim: **EXIT=0 · 232 ✓ · 0 ✗** (era 201). Os casos novos
cobrem os três consumidores contra uma lista única de 8 valores, mais **controle
positivo** (o formato antigo é recusado pelo Compose — é isso que prova que o teste
vigia) e retrocompatibilidade com `.env` no formato velho.

Sabotagem, previsto vs medido: **9/9, 9/9, 1/1, 24/24** (a última é guarda de vacuidade).

**Residual conhecido e documentado:** o parser do Compose não desfaz `` \` `` dentro de
aspas duplas, então valor com crase chega feio ao contêiner. Mantido de propósito — a
alternativa é o `source .env` do README **executar** o que está entre crases.

**Revisão que fiz do trabalho do subagente:** ele alterou 7 asserções pré-existentes.
Conferi uma a uma — são todas troca de aspas na asserção (`grep -qx "X='v'"` →
`grep -qx 'X="v"'`), acompanhando o formato novo, ainda ancoradas com `-qx`/`^`.
Nenhuma afrouxada.

> ⚠️ **Ainda não provado:** instalação real numa VPS. Isto cobre o encoding e seus três
> leitores, não a jornada do comprador ponta a ponta.

---

---

## Decisões das 6 lentes novas (43 achados brutos → 6 aprovados)

### PACKAGING: **NÃO.** Não vira monorepo, não vira pacote npm.

Regra de extração é ≥2 consumidores independentes; medido **1** — os 8 importadores de
`lib/branding` estão todos em `app/` e `components/`, e o worker não renderiza marca
nenhuma. Custo do contrário: 2 Dockerfiles (`--frozen-lockfile` quebra em workspace),
`output: "standalone"` (o artefato vira `.next/standalone/apps/web/server.js` e quebra o
`COPY`/`CMD`), 2 tsconfig, 2 aliases de vitest, e **53 testes de arquitetura ancorados em
caminho top-level cujo helper devolve `[]` em diretório inexistente** — ou seja, trocar
risco de gate vacuamente verde por zero ganho.

**O packaging que de fato falta é outro: um emissor de build-time multi-formato.** A marca
atravessa 4 fronteiras de processo e **3 não consomem TypeScript**: o `StyleSheet` do
`@react-pdf` (não lê CSS var), o HTML inline dos e-mails, e os templates Go do Supabase
Auth. ~80 linhas + um teste que reprova quando o gerado diverge do commitado. Fase 4.

**Imagem Docker por marca fica proibida — agora com prova:** `update.sh:158-159` grava
`APP_IMAGE` no `.env` **incondicionalmente**, e `set_env_var` faz `grep -v` + append sem
merge. A imagem do revendedor seria substituída pela upstream num update de rotina, em
silêncio. O desenho atual (imagem genérica + marca em runtime) está certo — o trabalho é
**protegê-lo** com um caso em `update-guard.test.sh`.

### Os 6 ângulos aprovados

| # | Ângulo | Fase | Custo |
|---|---|---|---|
| 1 | **Forma do que se grava** — jsonb guarda ENTRADA (`{format, algo, semente_hex}`), nunca saída; schema *loose com catchall* (exceção declarada ao `.strict()` do repo); resolvedor **nunca lança** | 1 | ~3h |
| 2 | **O gate de derivação mede o token errado**, em 3 eixos | 1 | ~1,5d |
| 3 | **A varredura de marca não alcança onde a marca sai** | 4 (parte na 1) | ~7h |
| 4 | **Emissor multi-formato** (o packaging real) | 4 | ~2d |
| 5 | **Diagnóstico emite FORMA, nunca IDENTIDADE** | 1 | ~3h |
| 6 | **Billing entrega o cliente do revendedor para nós** | 0/1 | ~1d |

**Ângulo 1 — por que é irreversível.** Ninguém tinha medido o que o **código velho** faz
com o jsonb do código novo. E o rollback põe código velho sobre schema novo *por
construção*: `update.sh` aplica o baseline antes de puxar a imagem, e `agent.sh` reverte
só `APP_IMAGE`. Com `.strict()`, chave desconhecida **lança** — e como `branding()` é
chamado em `app/layout.tsx`, um throw ali é **500 em todas as telas**. O envelope
`{format, algo}` nasce na Fase 1 mesmo sem tela de import/export: é a única superfície que
atravessa instalações, e retrofit é impossível (sem ele, toda linha existente vira "algo
desconhecido").

**Ângulo 2 — a régua ordena invertido.** Simulação de dicromacia (matrizes Machado 2009)
reproduzida de forma independente:

| par | ΔH | ΔE deuteranopia |
|---|---|---|
| oliva `#7f8c3a` × warning | **44,7°** (passa com folga) | **0,0231** |
| verde-água `#1abc9c` × success | **27,2°** (mal passa) | **0,1264** |

Maior ângulo, pior separação. Troca: **ΔE em OKLab sobre a cor simulada**, piso ≥ 0,05.
Mais duas correções: **(b)** quem se move são as *nossas* semânticas, nunca o accent — a
cor da marca é a única que não nos pertence; **(c)** o piso é por **papel × superfície**,
não pela semente — medido na Sage, `accent-600` vs bg = 5,51 (o que o piso checa) mas o
anel de foco usa `accent-500` e dá **3,79**; com a semente no piso de 3,0, o anel pousa em
~2,07 **com o gate verde**. Por isso os pares saem extraídos do `globals.css`, nunca
listados à mão.

### Os que NÃO valem (isto impede o épico de inchar)

Monorepo · `@deskcomm/tokens` no npm · Turborepo/Nx · style-dictionary · regra eslint de
fronteira · **regressão visual por screenshot em qualquer volume** (não pega nenhum dos
defeitos medidos, e custa 136 MB num repo cuja estratégia é otimizar para fork) · Percy /
Chromatic / Argos (check pago = vermelho permanente em fork) · Storybook (os defeitos são
de container e tema, não de componente) · `prefers-contrast` · domínio por organização ·
DSN de Sentry por org · página de status pública · phone-home · cota de logo ·
"remover o selo é pago" · **seletor de fonte** (Atkinson Hyperlegible foi escolhida pelo
Braille Institute por legibilidade; trocá-la não muda percepção de marca e só piora a
leitura do operador).

### Correção de um erro meu

**Eu afirmei que `app/design` é rota pública sem auth. É falso.** Minha sonda procurou em
`middleware.ts`, que **não existe** — o Next 16 renomeou para `proxy.ts`, que existe e
está na raiz. `/design` não está em `PUBLIC_PATHS` (`lib/auth/public-paths.ts:5-27`), e
`proxy.ts:32` redireciona quem não bate na allowlist. A rota é **autenticada**; o
problema real é vazamento cross-tenant, e o conserto é `notFound()` fora de dev (20 min),
não remover da build. Grep sobre arquivo inexistente devolve vazio, indistinguível de
"não achei" — [[feedback_instrumento_quebrado_devolve_zero]] outra vez.

### A pergunta que ninguém tinha feito: **quantas identidades o produto precisa modelar?**

`lib/lgpd/pdf-renderer.tsx:277` imprime, no documento entregue ao **titular de dados**:

> `DeskcommCRM · Relatório LGPD Art. 18 II · DPO: contato via canal oficial do controlador`

Dois defeitos. O primeiro é o vazamento de marca (ângulo 3 pega). O segundo ninguém tocou:
**o sistema já sabe o DPO e não o imprime** — `lib/env.ts:134` tem `LGPD_DPO_EMAIL` e
`lib/lgpd/sla-alarm.ts:93` resolve `organizationDpoEmail || env.LGPD_DPO_EMAIL`.

E o buraco que o whitelabel abre: em toda outra superfície, marca = **quem vende**. No
relatório de Art. 18, a identidade correta é o **controlador** — a empresa cujos dados
são. Se a Fase 4 tratar esse rodapé como "mais uma saída sem DOM" e trocar o nome pela
marca do revendedor, ela **piora** o defeito: nomeia o revendedor como controlador num
documento que responde a um direito legal, quando o controlador é o cliente dele.

**DECIDIDO (2026-08-13): quatro papéis, três identidades de marca, zero campos novos.**

`organizations` **já** separa `legal_name` (NOT NULL) de `display_name` — medido no
`baseline.sql`. A identidade jurídica já está modelada; ninguém a estava usando.

| Papel | Onde vive | O que carrega |
|---|---|---|
| Nós (o produto) | selo removível | só isso |
| **Instalação** | `platform_branding` | marca visual pré-login |
| **Organização — marca** | `display_name` + `settings.branding` | o que aparece na tela pós-login |
| **Organização — controlador** | `legal_name` *(já existe)* | identidade jurídica no PDF de LGPD |

**Por que `controlador` não é campo novo:** DIRC responde **I — Integrar**. O controlador
de dados é a organização, e a organização já declara sua razão social. Criar
`controlador_nome` seria duplicação sem source of truth (anti-pattern nº 2 do CLAUDE.md).

**Consequência para a Fase 4:** o rodapé do PDF de LGPD passa a imprimir `legal_name` +
DPO resolvido (`organizationDpoEmail || env.LGPD_DPO_EMAIL`), **não** a marca. Trocar o
nome pela marca do revendedor ali pioraria o defeito — nomearia o revendedor como
controlador num documento que responde a um direito legal.

**O caso previsto:** revendedor hospeda para um cliente que atende sob outra razão social.
Resolve-se com **uma organização por razão social**, que é o que a tenancy já modela — não
com um campo a mais. Se algum dia uma organização precisar declarar controlador diferente
da própria razão social, aí sim é campo novo, e a razão estará escrita aqui.

---

## Achados novos confirmados por mim

| Achado | Evidência |
|---|---|
| **Todo projeto Supabase do revendedor nasce chamado "DeskcommCRM"** | `install.sh:918` usa `${APP_NAME:-DeskcommCRM}`; `APP_NAME` só é coletado em `:1024` — **106 linhas depois** |
| **O primeiro e-mail que o cliente do revendedor recebe diz o nome do nosso produto** | `supabase/templates/confirmation.html:4` e `recovery.html:4`; e **nenhum script sobe esses templates** — só `config.toml` (Supabase local) e um teste |
| **A tela de dinheiro entrega nosso contato ao cliente do revendedor** | `lib/navigation/registry.ts:453` (porta de 1ª classe, "Billing") → `app/app/settings/billing/page.tsx:26` mostra `suporte@deskcomm.app` |

---

## Próximo passo exato

Fase 1, com o escopo revisado acima. Ordem interna: **(a)** forma do dado + envelope
`{format, algo}` e a decisão das 3-ou-4 identidades; **(b)** `lib/branding/` com
`rampa.ts` e `contraste.ts` já com os 3 eixos corrigidos; **(c)** `[data-theme="light"]`
no `globals.css` + rider de `forced-colors`; **(d)** gate de marca case-insensitive com
dívida congelada. Prova em tela a cada passo.
