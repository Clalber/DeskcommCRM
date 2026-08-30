-- 0207 — a conversa nasce sabendo de que canal veio
--
-- ─── O defeito que isto destrava ───────────────────────────────────────────
--
-- `fn_upsert_wa_conversation` (0027) grava `channel = 'whatsapp'` LITERAL no
-- corpo. Era correto enquanto havia um canal só. A 0203 abriu
-- `conversations_channel_check` para `('whatsapp','instagram')` — mas nenhuma
-- conversa consegue nascer com o valor novo, porque a única função que as cria
-- não pergunta.
--
-- O sintoma seria mudo do pior jeito: a mensagem do Instagram entraria numa
-- conversa marcada como WhatsApp. Toda tela que filtra por canal mostraria o
-- lugar errado, o relatório contaria no balde errado, e ninguém veria erro
-- nenhum — porque `'whatsapp'` é um valor VÁLIDO.
--
-- ─── Por que uma função NOVA, e não um parâmetro na existente ──────────────
--
-- Acrescentar parâmetro cria overload, e o PostgREST resolve chamada por nome:
-- as chamadas existentes passariam a falhar com `is not unique`. É exatamente a
-- armadilha que a 0202 documentou ao manter a assinatura de
-- `fn_conversation_assign` idêntica. Função nova, nome novo, zero risco para
-- quem já chama.
--
-- A antiga FICA e continua servindo o WhatsApp. Trocar todos os chamadores num
-- movimento só seria mexer no caminho mais quente do produto para ganhar
-- elegância — e o custo de um erro ali é mensagem que não entra.
--
-- ─── O recorte do conflito ─────────────────────────────────────────────────
--
-- `(organization_id, contact_id, channel_session_id) where is_group = false` é o
-- MESMO da 0027. Precisa ser: é um índice único PARCIAL, e um `on conflict` que
-- não repita o predicado exato não encontra o índice e o Postgres recusa a
-- instrução inteira.

create or replace function public.fn_upsert_conversation_do_canal(
  p_org uuid, p_contact uuid, p_session uuid, p_channel text
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.conversations (
    organization_id, contact_id, channel_session_id, channel, status,
    is_group, unread_count_for_assignee, metadata
  )
  values (p_org, p_contact, p_session, p_channel, 'open', false, 0, '{}'::jsonb)
  on conflict (organization_id, contact_id, channel_session_id) where is_group = false
  do update set updated_at = now()
  returning id into v_id;
  return v_id;
end; $$;

-- Função nova em `public` nasce EXPOSTA, e são DUAS origens de EXECUTE:
-- ⚠️ SÃO TRÊS ORIGENS, não duas — e o CLAUDE.md só nomeia duas.
--
-- O invariante `hardening-definer-varredura` pegou esta função executável por
-- `authenticated`: qualquer usuário LOGADO, de QUALQUER organização, podia
-- chamá-la. E ela recebe a organização como PARÂMETRO — quem chamasse criaria
-- conversa dentro da empresa de outra pessoa, com a sessão dele.
--
-- A função irmã (`fn_upsert_wa_conversation`) revoga das três, em três blocos
-- diferentes do baseline; escritas assim, longe umas das outras, a terceira não
-- se parece com regra. Aqui as três ficam juntas.
--
--   (A) o `alter default privileges ... grant all on functions to anon` do
--       baseline, que vale para toda função criada depois dele — e que
--       `revoke from public` NÃO remove;
--   (B) o grant a PUBLIC que o Postgres dá a qualquer função ao criá-la, que
--       `revoke from anon` NÃO remove.
-- Tratar só uma deixa a função alcançável como RPC pela chave anônima, que vai
-- para o browser. Vigiado por `hardening-definer-varredura`.
revoke all on function public.fn_upsert_conversation_do_canal(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_upsert_conversation_do_canal(uuid, uuid, uuid, text) to service_role;

comment on function public.fn_upsert_conversation_do_canal(uuid, uuid, uuid, text) is
  'Cria ou reencontra a conversa de um contato numa sessão, com o CANAL explícito. A irmã fn_upsert_wa_conversation fixa whatsapp no corpo e não serve para canal novo.';
