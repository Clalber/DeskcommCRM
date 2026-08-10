-- 0146 — o tick do follow-up para de servir uma organização de cada vez.
--
-- O QUE ERA: `fn_claim_due_followup_enrollments` reclamava os `p_limit` (20)
-- vencidos mais antigos GLOBALMENTE. Quem acumulou fila tem, por construção, os
-- `next_eval_at` mais antigos — então uma organização atrasada ocupa o lote
-- inteiro e as demais só entram quando o ponteiro alcança a posição delas.
--
-- MEDIDO (pg17 descartável, baseline deste commit), duas organizações, teto 20:
--   fila de 25 na grande + 1 vencido na pequena → tick 1 leva 20 da grande e
--                                                 ZERO da pequena;
--   fila de 300 na grande + 1 na pequena       → a pequena só é atendida no
--                                                 TICK 16.
-- Com o cron de minuto em minuto (docker-compose.prod.yml), são 16 minutos de
-- atraso para uma organização que tem UM follow-up para rodar, e o atraso cresce
-- junto com a fila alheia — sem teto.
--
-- Nota de honestidade sobre o diagnóstico: NÃO é inanição permanente. O lease
-- segura o lote reclamado, então o tick seguinte avança para os próximos 20, e a
-- organização pequena entra em `teto(K/20)` ticks, onde K são os vencidos mais
-- antigos que ela. É atraso proporcional à fila do vizinho, não bloqueio eterno.
-- Continua sendo defeito: o atraso não tem limite superior, e quem o paga não
-- tem como saber por quê.
--
-- O QUE PASSA A SER: rodízio. Primeiro o vencido mais antigo de CADA organização,
-- depois o segundo de cada, e assim por diante até fechar `p_limit`. Com UMA
-- organização o resultado é idêntico ao de antes (os 20 mais antigos, na mesma
-- ordem) — a instalação de operador único, que é a de hoje, não muda em nada.
--
-- O `limit p_limit` DENTRO do lateral não é cosmético: sem ele, o sort final
-- ordenaria todos os vencidos do banco. Com ele, cada organização contribui no
-- máximo `p_limit` linhas, e o custo passa a depender do número de organizações
-- com fila, não do tamanho da fila.
--
-- `for update skip locked` sai da subquery e vira uma CTE própria porque o
-- Postgres não aceita `FOR UPDATE` junto de window function. A propriedade que
-- ele garante — dois workers nunca reclamam a mesma linha, e nenhum espera pelo
-- outro — é preservada: quem trava é o mesmo `select ... for update skip locked`
-- sobre `followup_enrollments`, só que sobre o conjunto já escolhido.

create index if not exists idx_followup_enrollments_due_por_org
  on followup_enrollments (organization_id, next_eval_at)
  where status in ('active','waiting_reply');

create or replace function fn_claim_due_followup_enrollments(p_limit int, p_lease_seconds int)
returns setof followup_enrollments
language sql
security definer
set search_path = public
as $$
  with orgs as (
    -- Sem a condição de claim aqui de propósito: o lateral abaixo a aplica, e uma
    -- organização cujos vencidos estão todos com lease apenas devolve zero linhas.
    select distinct organization_id
      from followup_enrollments
     where status in ('active','waiting_reply')
       and next_eval_at <= now()
  ),
  fila as (
    select f.id, f.next_eval_at, f.posicao_na_org
      from orgs
      cross join lateral (
        select d.id,
               d.next_eval_at,
               row_number() over (order by d.next_eval_at) as posicao_na_org
          from followup_enrollments d
         where d.organization_id = orgs.organization_id
           and d.status in ('active','waiting_reply')
           and d.next_eval_at <= now()
           and (d.claimed_until is null or d.claimed_until < now())
         order by d.next_eval_at
         limit p_limit
      ) f
  ),
  escolhidos as (
    -- O rodízio: posição 1 de todas as organizações, depois a 2 de todas, etc.
    -- Empate na mesma posição vai para quem esperou mais.
    select id from fila order by posicao_na_org, next_eval_at limit p_limit
  ),
  travados as (
    select e.id from followup_enrollments e
     where e.id in (select id from escolhidos)
     for update skip locked
  )
  update followup_enrollments e
     set claimed_until = now() + make_interval(secs => p_lease_seconds),
         updated_at = now()
   where e.id in (select id from travados)
  returning e.*;
$$;

revoke execute on function fn_claim_due_followup_enrollments(int, int) from public, anon, authenticated;
