-- 0204 — a 0202 encolheu o vocabulário de avisos, e a guarda não viu

-- ─── O defeito ──────────────────────────────────────────────────────────────
--
-- A migration 0202 reconstruiu `agent_inbox_items_kind_check` para acrescentar
-- `channel_credential_expiring` — e, ao reescrever a lista inteira, DERRUBOU
-- `conhecimento_nao_indexado`, que a 0181 tinha acrescentado dois dias antes.
--
-- Consequência para quem aplica migrations em ordem (`supabase db push`): o
-- worker que detecta acervo não indexado tenta abrir o aviso, o INSERT viola o
-- CHECK com 23514, e **o aviso simplesmente nunca abre**. Silencioso — é a falha
-- que o invariante 3 da doutrina de Sistema Vivo chama de demanda sem próximo
-- passo: o sistema sabe do problema e não tem como dizer.
--
-- ─── Por que ninguém viu ────────────────────────────────────────────────────
--
-- Existe guarda para exatamente isto — `tests/unit/kind-check-migration-x-
-- baseline.test.ts`, cujo cabeçalho diz que uma régua que "parasse de casar
-- devolveria [] e o teste ficaria verde por não medir nada". Foi o que houve: a
-- régua só reconhecia `check (kind in (...))`, e a 0202 escreveu
-- `check (kind = any (array[...]))`. A migration ficou INVISÍVEL para a guarda,
-- que passou a comparar o baseline com uma migration anterior e a dar verde.
--
-- A régua foi corrigida junto com esta migration; foi ela que revelou o buraco.
--
-- ─── Forward-fix, e não edição da 0202 ──────────────────────────────────────
--
-- A 0202 já foi commitada, publicada em imagem e aplicada. A doutrina de
-- migrations proíbe editar migration aplicada: quem já a registrou não a
-- re-executa, e o conserto não chegaria nele. Esta reconstrói a lista COMPLETA
-- — a do `baseline.sql`, que é a fonte —, na forma canônica do repo.
--
-- Idempotente e sem dado a corrigir: só ALARGA o conjunto aceito, então nenhuma
-- linha existente pode violá-la.

alter table public.agent_inbox_items
  drop constraint if exists agent_inbox_items_kind_check;
alter table public.agent_inbox_items
  add constraint agent_inbox_items_kind_check check (kind in (
    'qr_rescan', 'job_dead', 'event_dead', 'budget_exceeded', 'handoff',
    'promotion_review', 'judge_unaligned', 'followup_dead',
    'snooze_expired', 'next_action_ambiguous', 'risk_backlog_seeded',
    'reactivation_expired', 'capabilities_missing', 'message_send_stuck',
    'midia_nao_lida', 'channel_template_review', 'channel_number_alert',
    'channel_credential_expiring', 'promise_unfulfilled',
    'contact_proposal_expired', 'budget_warning',
    'conhecimento_nao_indexado', 'other'
  ));
