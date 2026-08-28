-- 0206 — a tabela de identidade externa entra com RBAC, não só com tenancy

-- ─── O defeito ──────────────────────────────────────────────────────────────
--
-- A 0203 criou `channel_contact_identities` com UMA policy `for all` que só
-- checa organização. Isso significa que qualquer papel — inclusive `viewer` —
-- pode INSERIR, ALTERAR e APAGAR linhas da própria organização falando direto
-- com o PostgREST, com o JWT dele.
--
-- Não é hipótese: é o mesmo defeito que a 0181 consertou no acervo, onde um
-- `viewer` DELETAVA `ai_chunks`. Aqui o estrago é mais silencioso — a linha
-- amarra a PESSOA do outro lado ao contato do CRM, então apagá-la faz a próxima
-- mensagem daquele cliente chegar como se fosse de um desconhecido, e alterá-la
-- faz a resposta sair para a pessoa errada.
--
-- ─── Por que ninguém viu ────────────────────────────────────────────────────
--
-- `tests/invariants/rbac-config-ia-canais.test.ts` existe exatamente para isto
-- ("a dívida de RBAC não cresce") e reprova toda tabela nova com `cmd = 'ALL'`
-- sem `role_at_least`. Ele não viu porque roda contra o BASELINE, e a 0202
-- nunca tinha sido refletida lá. A guarda estava certa; faltava a tabela chegar
-- ao banco que ela inspeciona.
--
-- ─── O formato ─────────────────────────────────────────────────────────────
--
-- O par select/write da 0150, igual ao de `channel_sessions`: quem é da
-- organização LÊ; escrever exige `admin`. Os dois lados preservam
-- `fn_is_platform_admin()`, senão o suporte cega.
--
-- O worker não entra nesta conta: usa `service_role`, que é `bypassrls`. É ele
-- quem grava estas linhas na prática — nenhuma tela escreve aqui.

drop policy if exists tenant_isolation_channel_contact_identities_all
  on public.channel_contact_identities;

drop policy if exists channel_contact_identities_tenant_select
  on public.channel_contact_identities;
create policy channel_contact_identities_tenant_select
  on public.channel_contact_identities
  for select using (
    organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin()
  );

drop policy if exists channel_contact_identities_tenant_write
  on public.channel_contact_identities;
create policy channel_contact_identities_tenant_write
  on public.channel_contact_identities
  for all using (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'admin'))
    or public.fn_is_platform_admin()
  ) with check (
    (organization_id in (select public.fn_user_org_ids())
      and public.fn_role_at_least(organization_id, 'admin'))
    or public.fn_is_platform_admin()
  );
