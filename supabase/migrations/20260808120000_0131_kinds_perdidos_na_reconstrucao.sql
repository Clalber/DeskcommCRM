-- ============================================================================
-- 0131 — OS TRÊS AVISOS QUE A CADEIA DE MIGRATIONS TINHA DEIXADO DE ACEITAR.
--
-- `agent_inbox_items_kind_check` não se altera: é derrubada e reconstruída a
-- cada `kind` novo — sete vezes até aqui. O contrato implícito é que cada
-- reconstrução repita a lista inteira. A 0129 (`midia_nao_lida`) reconstruiu a
-- partir de uma lista que era verdade antes da 0111, e três valores sumiram:
--
--   • `promise_unfulfilled`     (0111) — o aviso do papel Operador: o assistente
--                                       prometeu algo ao cliente e o sistema não
--                                       registrou o cumprimento;
--   • `contact_proposal_expired`(0124) — dado ouvido na conversa venceu sem
--                                       ninguém conferir;
--   • `other`                   (0111) — o escape para aviso sem kind próprio.
--
-- Medido nesta árvore: aplicando a cadeia em ordem, a constraint termina com 15
-- valores; o `baseline.sql` (o que o kit self-host aplica) tem 18. Ou seja o
-- defeito **nunca atingiu o kit** — quem instalou ou atualizou pelo `install.sh`
-- /`update.sh` sempre teve os 18. Quem quebra é o clone que aplica migrations em
-- ordem pelo Supabase CLI, que é o caminho versionado e documentado.
--
-- ═══ POR QUE ISTO ERA INVISÍVEL ═══
--
-- `insertInboxItem` bate 23514, quem chama captura e emite `log.warn`
-- (`lib/agent-engine/agent/operator-turn.ts` faz exatamente isso, de propósito:
-- o aviso não pode derrubar o job que ele descreve). Resultado: nenhum erro
-- aparece em lugar nenhum e a Central apenas **para de receber** aquele sinal.
-- Ninguém vê uma falha; alguém deixa de ver um aviso. Para o papel Operador era
-- fatal, porque esse item é a ÚNICA superfície que ele tem hoje.
--
-- ═══ POR QUE UMA FORWARD-FIX, E NÃO EDITAR A 0129 ═══
--
-- Migration aplicada não se edita (CLAUDE.md): o clone que já rodou a 0129 não
-- rodaria de novo, e o banco dele continuaria errado. Só uma migration NOVA
-- alcança quem já atualizou.
--
-- Não há backfill a fazer: a constraint está sendo ALARGADA. Nenhuma linha
-- existente pode violar uma lista que só ganhou valores — e é por isso que esta
-- migration é segura de re-aplicar.
--
-- A lista abaixo é a canônica do `baseline.sql`, na mesma ordem. As duas devem
-- terminar iguais, e `tests/unit/migrations-nao-encolhem-vocabulario.test.ts`
-- passa a cobrar isso: a lição da issue #159 era sobre BLOCOS, o mecanismo é
-- sobre LISTAS, e reconstruir com lista velha tem o mesmo efeito de um bloco novo.
-- ============================================================================

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
    'promise_unfulfilled',
    'contact_proposal_expired',
    'other'
  ));
