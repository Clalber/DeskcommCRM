-- 0212 — Notificação para número externo
--
-- ⚠️ O PEDIDO, e por que ele não cabia no que existia
--
-- "Quando um lead chega a uma etapa que eu escolhi, quero ser avisado no MEU
-- WhatsApp — não vou ficar com a plataforma aberta 24h."
--
-- A ação `send_whatsapp_message` do motor de automação resolve o destinatário a
-- partir do CONTATO do evento; não existe caminho para um número livre. E as
-- guardas dela (`checarGuardasDeContato`) falam todas de cliente — existe, não
-- bloqueado, tem telefone, consentimento. Avisar a própria equipe não tem
-- nenhuma delas. Por isso a ação nova em vez de um campo na existente: um
-- `if (numero) pula todas as guardas` é a forma que produz acidente.
--
-- ─── AS TRÊS TABELAS, E O QUE CADA UMA IMPEDE ──────────────────────────────
--
-- 1. `org_notify_numbers` — a lista do que pode ser avisado.
--    A ação só envia para número REGISTRADO. Sem isso, o motor de automação
--    vira um enviador de WhatsApp arbitrário: um erro de digitação na regra, ou
--    uma regra adulterada, dispara para qualquer número do mundo pelo número da
--    empresa.
--
-- 2. `org_notify_sends` — o ledger, e a peça que sustenta o resto.
--    A reserva é gravada ANTES do envio. O `event-log/drain` devolve à fila
--    evento preso em `processing` há mais de 10 minutos, e `consumed_by` só é
--    gravado depois do handler INTEIRO: um crash entre o envio e o registro
--    reexecuta todas as ações, e o dono recebe o aviso duas vezes. A doutrina
--    exige reserva antes do efeito externo; o `unique` abaixo é essa reserva.
--
--    ⚠️ `notify_number_id` ENTRA na chave. Uma regra aceita até 10 ações: duas
--    `notify_number` para números diferentes no mesmo evento são dois avisos
--    legítimos, e uma chave sem o número deduplicaria o segundo em silêncio.
--
--    O ledger é também quem permite suprimir o ECO. Toda mensagem que o CRM
--    manda volta pelo webhook como `fromMe=true`, e a ingestão cria contato e
--    conversa para o destinatário — o número do dono viraria um LEAD no CRM.
--    A supressão é por identidade do envio (`external_id`) ou por reserva EM
--    VOO, nunca por "este número está cadastrado": suprimir por número mataria
--    o registro de mensagens legítimas para ele (o defeito #108 de volta).
--
-- 3. `org_notify_quota` — o balde do teto por hora.
--    Uma tempestade de mudança de etapa vira uma tempestade de WhatsApp, e o
--    primeiro dia de uso real termina com a pessoa silenciando a conversa — o
--    que desliga a notificação para sempre.
--
--    ⚠️ O contador NÃO pode ser `count(*)` seguido de envio: dois workers leem
--    19 ao mesmo tempo, os dois passam, e o teto vira 21. Por isso uma LINHA
--    por balde, incrementada por upsert atômico que devolve o valor novo.
--    Em memória zeraria a cada deploy; em Redis seria placebo, porque Redis é
--    opcional no self-host.

-- ---------------------------------------------------------------------------
-- 1. Os números que podem ser avisados
-- ---------------------------------------------------------------------------

create table if not exists public.org_notify_numbers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Guardado canônico (`canonicalPhoneBR`). A comparação NUNCA é igualdade
  -- crua: a mesma pessoa chega com 12 ou 13 dígitos conforme o nono dígito, e
  -- é `samePhone`/`phoneLookupVariants` quem resolve (lib/channels/phone-variants.ts).
  phone_e164 text not null,
  label text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create unique index if not exists org_notify_numbers_org_phone_key
  on public.org_notify_numbers (organization_id, phone_e164);

alter table public.org_notify_numbers enable row level security;

drop policy if exists org_notify_numbers_select on public.org_notify_numbers;
create policy org_notify_numbers_select on public.org_notify_numbers
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

drop policy if exists org_notify_numbers_write on public.org_notify_numbers;
create policy org_notify_numbers_write on public.org_notify_numbers
  using (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  )
  with check (
    public.fn_is_platform_admin()
    or ((organization_id in (select public.fn_user_org_ids()))
        and public.fn_role_at_least(organization_id, 'manager'))
  );

-- ---------------------------------------------------------------------------
-- 2. O ledger — reserva antes do envio
-- ---------------------------------------------------------------------------

create table if not exists public.org_notify_sends (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  event_id uuid not null,
  -- ⚠️ `restrict`, não `cascade`: remover um número da lista não pode apagar o
  -- registro do que já foi enviado por ele. Pior, apagaria também a reserva EM
  -- VOO, e o eco atrasado deixaria de casar — o número viraria contato. Ledger
  -- que evapora não é ledger.
  notify_number_id uuid not null references public.org_notify_numbers(id) on delete restrict,
  channel_session_id uuid not null references public.channel_sessions(id) on delete cascade,
  -- Cópia do destino no momento do envio: a supressão do eco precisa comparar
  -- telefone, e o cadastro pode ser editado ou removido depois.
  phone_e164 text not null,
  -- Preenchido DEPOIS que o adapter responde. Nasce nulo, e é por isso que a
  -- supressão precisa do caminho "reserva em voo": o eco chega antes disto.
  external_id text,
  status text not null default 'reserved',
  attempts int not null default 0,
  reserved_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint org_notify_sends_status_check
    check (status in ('reserved', 'sent', 'failed'))
);

-- A RESERVA. `23505` neste índice significa "este evento já foi notificado
-- para este número" — o retry do drain para aqui, e não em dobro no celular.
create unique index if not exists org_notify_sends_reserva_key
  on public.org_notify_sends (organization_id, rule_id, event_id, notify_number_id);

-- Supressão do eco por identidade do envio.
create index if not exists org_notify_sends_external_idx
  on public.org_notify_sends (organization_id, external_id)
  where external_id is not null;

-- Supressão do eco por reserva EM VOO, e o varredor que fecha reserva presa.
create index if not exists org_notify_sends_em_voo_idx
  on public.org_notify_sends (organization_id, channel_session_id, phone_e164, reserved_at)
  where status = 'reserved';

alter table public.org_notify_sends enable row level security;

drop policy if exists org_notify_sends_select on public.org_notify_sends;
create policy org_notify_sends_select on public.org_notify_sends
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

-- Sem policy de escrita: quem grava é o motor, com service role. Um usuário
-- logado que pudesse inserir aqui poderia forjar supressão de eco.

-- ---------------------------------------------------------------------------
-- 3. O balde do teto por hora
-- ---------------------------------------------------------------------------

create table if not exists public.org_notify_quota (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  notify_number_id uuid not null references public.org_notify_numbers(id) on delete cascade,
  -- `date_trunc('hour', now())` — o balde.
  hora timestamptz not null,
  enviados int not null default 0,
  primary key (organization_id, rule_id, notify_number_id, hora)
);

alter table public.org_notify_quota enable row level security;

drop policy if exists org_notify_quota_select on public.org_notify_quota;
create policy org_notify_quota_select on public.org_notify_quota
  for select using (
    (organization_id in (select public.fn_user_org_ids())) or public.fn_is_platform_admin()
  );

-- ---------------------------------------------------------------------------
-- 5. O incremento ATÔMICO do balde
-- ---------------------------------------------------------------------------
--
-- ⚠️ Existe porque `count(*)` seguido de envio NÃO é teto: dois workers leem 19
-- ao mesmo tempo, os dois passam, e saem 21 avisos. Aqui o incremento e a
-- leitura são a MESMA operação, então o segundo worker recebe 21 e recusa.
--
-- Não é `security definer`: quem chama é o motor com service role, que já
-- bypassa RLS. Definer só ampliaria o alcance sem necessidade — e esta função
-- recebe a organização como PARÂMETRO, que é exatamente a forma que vira
-- escrita cross-tenant se um dia alguém puder executá-la com outra sessão.

create or replace function public.fn_notify_quota_incr(p_org uuid, p_rule uuid, p_numero uuid)
returns int
language plpgsql
as $$
declare
  v_hora timestamptz := date_trunc('hour', now());
  v_total int;
begin
  insert into public.org_notify_quota (organization_id, rule_id, notify_number_id, hora, enviados)
  values (p_org, p_rule, p_numero, v_hora, 1)
  on conflict (organization_id, rule_id, notify_number_id, hora)
  do update set enviados = public.org_notify_quota.enviados + 1
  returning enviados into v_total;
  return v_total;
end;
$$;

-- As TRÊS origens de EXECUTE, e não duas: o `revoke from public` não remove o
-- grant direto que o `ALTER DEFAULT PRIVILEGES` do baseline dá a `anon`, e
-- nenhum dos dois remove o de `authenticated`. Custo de esquecer a terceira
-- medido na 0207.
revoke execute on function public.fn_notify_quota_incr(uuid, uuid, uuid) from public, anon, authenticated;
grant  execute on function public.fn_notify_quota_incr(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. O kind novo da Central
-- ---------------------------------------------------------------------------
--
-- Falha de notificação PRECISA de rótulo próprio. Cair em `other` mata a
-- triagem justamente do aviso que existe para dizer que um aviso não chegou.
--
-- A dança drop+recreate é a mesma das 0203/0205: o CHECK é fechado, e
-- acrescentar valor exige reconstruí-lo inteiro.

alter table public.agent_inbox_items
  drop constraint if exists agent_inbox_items_kind_check;

alter table public.agent_inbox_items
  add constraint agent_inbox_items_kind_check check (kind in (
    'qr_rescan',
    'job_dead',
    'event_dead',
    'budget_exceeded',
    'handoff',
    'promotion_review',
    'judge_unaligned',
    'followup_dead',
    'snooze_expired',
    'next_action_ambiguous',
    'risk_backlog_seeded',
    'reactivation_expired',
    'capabilities_missing',
    'message_send_stuck',
    'midia_nao_lida',
    'channel_template_review',
    'channel_number_alert',
    'channel_credential_expiring',
    'promise_unfulfilled',
    'contact_proposal_expired',
    'midia_nao_lida',
    'budget_warning',
    'conhecimento_nao_indexado',
    'notificacao_nao_entregue',
    'other'
  ));

comment on table public.org_notify_sends is
  'Ledger de notificação para número externo. A reserva é gravada ANTES do envio (idempotência do drain at-least-once) e é ela que permite suprimir o eco do próprio envio sem transformar o número avisado em contato.';
