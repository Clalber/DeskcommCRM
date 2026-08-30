-- 0208 — a credencial do aplicativo, e a linha que existe antes da autorização
--
-- A 0203 abriu o schema do canal. Esta abre o que falta para CONECTAR uma conta:
-- o aplicativo do cliente na Meta, e o estado intermediário em que a conexão
-- existe mas ninguém autorizou nada ainda.
--
-- ─── 1. Por que o verify token não cabe onde ele estava ────────────────────
--
-- `channel_sessions.webhook_secret_encrypted` é UMA coluna, e o código a usa
-- para duas coisas que na Meta são diferentes:
--
--   • o POST do webhook a lê como chave do HMAC — que na Meta é o App Secret;
--   • o GET do handshake a lê como verify token.
--
-- Mantê-las no mesmo lugar obriga o operador a colar o App Secret no painel da
-- Meta, no campo "Verify Token". Esse campo é configuração: fica legível no
-- dashboard, viaja em captura de tela de suporte, e é digitado por quem estiver
-- ajudando a configurar. Um segredo que ASSINA não pode morar num campo que se
-- mostra. São dois segredos com ciclos de vida distintos, e passam a ter duas
-- colunas.
--
-- ─── 2. Por que a linha precisa nascer sem `instagram_user_id` ─────────────
--
-- A constraint que a 0203 escreveu exige o id da CONTA para toda linha do
-- canal:
--
--   (provider = 'meta_instagram' and instagram_user_id is not null)
--
-- Só que esse id chega no FIM do fluxo — ele volta da Meta junto com o token,
-- depois que a pessoa autorizou. E a autorização não pode nem começar antes da
-- linha existir, porque é da linha que sai o `webhook_path_token`, isto é, a URL
-- que o operador cola na Meta para o webhook ser aprovado. A ordem real é:
--
--   linha nasce → operador configura o webhook na Meta → autoriza → id chega
--
-- Como estava, a primeira seta era proibida pelo Postgres: o fluxo inteiro era
-- impossível de executar, e o defeito só apareceria na primeira tentativa real
-- de conectar uma conta.
--
-- O identificador que É conhecido no nascimento é o do APLICATIVO. Trocar a
-- exigência para ele não afrouxa nada — segue havendo identificador obrigatório
-- por provider — e passa a espelhar o canal por QR, onde `waha_session_name`
-- existe desde o começo e `phone_number` só aparece depois que a pessoa lê o
-- código. É o mesmo formato de problema, com a mesma resposta.
--
-- ─── Idempotência ─────────────────────────────────────────────────────────
-- Colunas `if not exists`; constraint `drop if exists` + `add`; índice
-- `if not exists`. Não há dado a corrigir antes das travas: as colunas nascem
-- nesta migration, e nenhum clone tem conta de Instagram conectada — o
-- transporte deste canal nunca foi publicado.

-- ─── Colunas do aplicativo ────────────────────────────────────────────────
--
-- `text` e não `bytea` para o segredo, seguindo `instagram_token_encrypted` da
-- 0203. Diverge de `meta_token_encrypted`/`zernio_token_encrypted`, que são
-- `bytea` — as duas formas trafegam o mesmo hex `\x…` por PostgREST e fazem
-- round-trip idêntico, então a diferença é de gosto, não de comportamento.
-- Unificar os tipos é trabalho à parte: misturar conversão de tipo numa
-- migration que também entrega funcionalidade é como se perde um sábado.
alter table public.channel_sessions
  add column if not exists instagram_app_id text,
  add column if not exists instagram_verify_token_encrypted text;

comment on column public.channel_sessions.instagram_app_id is
  'Id do aplicativo que o CLIENTE criou na Meta. Público (aparece na URL de autorização), '
  'ao contrário do App Secret, que vai cifrado em webhook_secret_encrypted.';
comment on column public.channel_sessions.instagram_verify_token_encrypted is
  'Token de verificação do webhook, inventado pelo operador e colado no painel da Meta. '
  'Coluna PRÓPRIA porque webhook_secret_encrypted guarda o App Secret, que assina o HMAC: '
  'um segredo que assina não pode morar num campo de configuração que a Meta exibe.';

-- ─── O identificador obrigatório passa a ser o do aplicativo ──────────────
--
-- ⚠️ A prosa fica ACIMA do par `drop`/`add`, nunca entre eles: a guarda que
-- compara migration e baseline mede a distância entre a constraint e o seu
-- `check`, e um comentário no meio a cega — defeito já pago neste repo.
alter table public.channel_sessions
  drop constraint if exists channel_sessions_provider_ref_check;
alter table public.channel_sessions
  add constraint channel_sessions_provider_ref_check
  check (
       (provider = 'waha'       and waha_session_name    is not null)
    or (provider = 'meta_cloud' and meta_phone_number_id is not null)
    or (provider = 'zernio'     and zernio_account_id    is not null)
    or (provider = 'meta_instagram' and instagram_app_id is not null)
  );

-- ─── Uma conexão pendente por aplicativo, por organização ─────────────────
--
-- A lição da 0204, aplicada com o recorte certo. Lá o erro seria deixar duas
-- linhas pendentes disputarem o mesmo pareamento; aqui o erro seria o OPOSTO —
-- travar por organização impediria conectar duas contas de Instagram, que é um
-- caso legítimo e para o qual `channel_contact_identities` foi desenhada.
--
-- Então a trava é por (organização, aplicativo) e só enquanto a conexão está
-- PENDENTE: assim que a autorização grava `instagram_user_id`, a linha sai do
-- recorte e a organização pode abrir outra conexão com o mesmo aplicativo para
-- uma segunda conta. Clicar "salvar" duas vezes deixa de criar linha órfã.
create unique index if not exists channel_sessions_instagram_app_pendente_unique
  on public.channel_sessions (organization_id, instagram_app_id)
  where provider = 'meta_instagram' and archived_at is null and instagram_user_id is null;
