-- 0203 — fundação do canal Instagram Direct
--
-- Abre o schema para um canal que NÃO é WhatsApp. É a camada que não depende de
-- nada da Meta: sem ela, nenhuma linha do adapter, do webhook ou da tela roda.
--
-- ─── Por que isto é bloqueante, e foi descoberto tarde ──────────────────────
-- Um plano anterior afirmou que "fora de lib/channels/ a mudança é mínima",
-- apoiado no invariante 1 da doutrina de canal e no `scripts/lint-channels.ts`.
-- O lint é DUAS REGEX sobre nomes de provider — ele não enxerga schema. Medido
-- no banco de uma instalação real:
--
--   conversations_channel_check → CHECK (channel = 'whatsapp')
--
-- Valor único. Uma conversa de Instagram é RECUSADA pelo Postgres antes de
-- qualquer código nosso opinar. E `webhook_events_log_provider_check` não
-- conhece o provider novo, então o corpo cru do webhook seria descartado em
-- silêncio pelo arquivador.
--
-- ─── As quatro mudanças ────────────────────────────────────────────────────
--   1. `channel_sessions` aprende o provider e o identificador da conta.
--   2. `conversations.channel` deixa de ser valor único.
--   3. `webhook_events_log.provider` aprende o provider.
--   4. A identidade externa do contato passa a ser ESCOPADA À SESSÃO — tabela
--      nova. É a única mudança que não é aditiva-trivial; o porquê está nela.
--
-- ─── Idempotência ──────────────────────────────────────────────────────────
-- O `update.sh` do clone re-aplica o baseline SEM `ON_ERROR_STOP`. Toda
-- constraint aqui é `drop ... if exists` + `add`, e todo objeto é
-- `if not exists`. Não há dedup a fazer: as colunas nascem agora, logo estão
-- todas nulas em qualquer clone — não existe dado pré-existente que possa
-- violar as travas.

-- ─── 1. channel_sessions: o provider e a conta do Instagram ────────────────
-- Colunas NULLABLE de propósito. O `not null` que o Chatwoot usa em
-- `channel_instagram.expires_at` não cabe aqui: esta tabela já tem linhas de
-- WhatsApp em todo clone, e um `not null` sem default quebraria o `update.sh`
-- de quem já instalou.
alter table public.channel_sessions
  add column if not exists instagram_user_id text,
  add column if not exists instagram_token_encrypted text,
  add column if not exists instagram_token_expires_at timestamptz;

comment on column public.channel_sessions.instagram_user_id is
  'Id da conta profissional do Instagram (o dono da caixa de entrada). Único entre canais ATIVOS.';
comment on column public.channel_sessions.instagram_token_expires_at is
  'Quando o token de acesso vence. Diferente do WhatsApp, a credencial do Instagram EXPIRA: '
  'sem renovar, o canal do cliente morre em silêncio. Nullable porque as linhas de WhatsApp não têm.';

alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_check;
alter table public.channel_sessions
  add constraint channel_sessions_provider_check
  check (provider = any (array['waha'::text, 'meta_cloud'::text, 'zernio'::text, 'meta_instagram'::text]));

-- Cada provider tem o seu identificador obrigatório. O ramo do Instagram entra
-- na mesma forma dos três anteriores.
alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_ref_check;
alter table public.channel_sessions
  add constraint channel_sessions_provider_ref_check
  check (
       (provider = 'waha'       and waha_session_name    is not null)
    or (provider = 'meta_cloud' and meta_phone_number_id is not null)
    or (provider = 'zernio'     and zernio_account_id    is not null)
    or (provider = 'meta_instagram' and instagram_user_id is not null)
  );

-- Mesmo recorte parcial da 0165: "um identificador vive em UM canal ATIVO".
-- Trava total impediria reconectar a MESMA conta depois de excluí-la — o
-- defeito que a 0107 consertou para (organization_id, phone_number).
create unique index if not exists channel_sessions_instagram_user_id_ativo_unique
  on public.channel_sessions (instagram_user_id)
  where archived_at is null and instagram_user_id is not null;

-- ─── 2. conversations.channel deixa de ser valor único ─────────────────────
--
-- ⚠️ Aqui o vocabulário é o do CANAL, não o do PROVIDER — e a diferença já está
-- provada no valor que existe: é `whatsapp`, não `waha`. Os três provedores de
-- WhatsApp (`waha`, `meta_cloud` e `zernio`) produzem conversa do MESMO canal,
-- porque quem muda entre eles é o transporte, não onde o cliente está falando.
--
-- Por isso o valor novo é `instagram` e não o nome do provider: no dia em que
-- houver um segundo transporte para o Instagram, ele produz conversa deste
-- mesmo canal, e nada aqui muda.
alter table public.conversations
  drop constraint if exists conversations_channel_check;
alter table public.conversations
  add constraint conversations_channel_check
  check (channel = any (array['whatsapp'::text, 'instagram'::text]));

-- ─── 3. webhook_events_log conhece o provider novo ─────────────────────────
-- Sem isto o arquivador engole a falha e o corpo cru do webhook some — sem erro
-- na tela, sem linha no log de quem investiga depois.
alter table public.webhook_events_log
  drop constraint if exists webhook_events_log_provider_check;
alter table public.webhook_events_log
  add constraint webhook_events_log_provider_check
  check (provider = any (array['waha'::text, 'nuvemshop'::text, 'generic'::text,
                               'meta_cloud'::text, 'zernio'::text, 'meta_instagram'::text]));

-- ─── 4. Identidade externa do contato, ESCOPADA À SESSÃO ───────────────────
--
-- Esta é a única decisão não-óbvia da migration, e ela corrige um desenho que
-- parecia natural e está errado.
--
-- O caminho tentador era uma coluna `contacts.instagram_igsid` com índice único
-- por organização, copiando `wa_identity`. NÃO SERVE, por duas razões:
--
--   (a) O IGSID é escopado à CONTA que recebe a mensagem, não à pessoa. A mesma
--       pessoa falando com duas marcas da mesma organização produz DOIS ids
--       diferentes, e ids de contas diferentes não são comparáveis entre si.
--   (b) Uma coluna no contato não diz POR QUAL conta responder. Uma organização
--       com duas contas de Instagram responderia pela conta errada — o pior tipo
--       de defeito, porque a mensagem SAI e chega a alguém.
--
-- Telefone não tem esse problema (o número é global), e é por isso que o modelo
-- que serviu ao WhatsApp por 200 migrations não estica até aqui.
--
-- A tabela é deliberadamente GENÉRICA (`provider_user_id`, não `igsid`): o
-- próximo canal endereçado por id opaco reusa isto em vez de abrir mais uma
-- coluna em `contacts`.
create table if not exists public.channel_contact_identities (
  id uuid primary key default extensions.uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_session_id uuid not null references public.channel_sessions(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  -- O id que o provider dá a esta pessoa NESTA conta. Opaco por contrato: não
  -- interprete, não normalize, não compare com o de outra sessão.
  provider_user_id text not null,
  -- O que o provider diz que é o nome/@ dela. Só para a tela; nunca para casar
  -- identidade.
  provider_username text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A trava que torna o defeito (b) impossível: uma pessoa tem UMA identidade por
-- sessão de canal.
create unique index if not exists channel_contact_identities_sessao_usuario_unique
  on public.channel_contact_identities (channel_session_id, provider_user_id);

-- O caminho de leitura quente é o inverso: "que identidades este contato tem?"
create index if not exists channel_contact_identities_contato_idx
  on public.channel_contact_identities (organization_id, contact_id);

comment on table public.channel_contact_identities is
  'Identidade de um contato num canal que endereça por id opaco em vez de telefone. '
  'Escopada à SESSÃO porque o id do provider é escopado à conta que recebe — a mesma pessoa '
  'falando com duas contas da mesma organização tem dois ids, e responder pelo id errado '
  'manda a mensagem pela conta errada.';

alter table public.channel_contact_identities enable row level security;

drop policy if exists tenant_isolation_channel_contact_identities_all
  on public.channel_contact_identities;
create policy tenant_isolation_channel_contact_identities_all
  on public.channel_contact_identities
  for all
  using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));

-- ─── 5. A Central de avisos aprende o aviso de credencial vencendo ─────────
-- Doutrina "toda configuração tem superfície": o que acontece quando falta
-- configuração precisa ser VISÍVEL, nunca um `return` mudo no worker. Sem este
-- valor no CHECK, o worker que detecta o vencimento não consegue nem abrir o
-- aviso.
alter table public.agent_inbox_items
  drop constraint if exists agent_inbox_items_kind_check;
alter table public.agent_inbox_items
  add constraint agent_inbox_items_kind_check
  check (kind = any (array[
    'qr_rescan'::text, 'job_dead'::text, 'event_dead'::text, 'budget_exceeded'::text,
    'handoff'::text, 'promotion_review'::text, 'judge_unaligned'::text, 'followup_dead'::text,
    'snooze_expired'::text, 'next_action_ambiguous'::text, 'risk_backlog_seeded'::text,
    'reactivation_expired'::text, 'capabilities_missing'::text, 'message_send_stuck'::text,
    'midia_nao_lida'::text, 'channel_template_review'::text, 'channel_number_alert'::text,
    'promise_unfulfilled'::text, 'contact_proposal_expired'::text, 'budget_warning'::text,
    'channel_credential_expiring'::text,
    'other'::text
  ]));
