-- 0203 — um pareamento pendente por organização, garantido pelo Postgres
--
-- ─── O defeito, medido em produção ──────────────────────────────────────────
--
-- UM clique em "Conectar novo WhatsApp" criou DUAS sessões. Prova no
-- `api_audit_log` de uma instalação real: dois `channel.connected` com
-- `request_id` DISTINTOS, 489 ms apart — e antes disso 375 ms, na tentativa
-- anterior. Uma pareava; a outra ficava órfã em `FAILED`, sem número, e o
-- operador apagava na mão a cada tentativa.
--
-- ─── Por que não é duplo clique ─────────────────────────────────────────────
--
-- `lib/api/client.ts` RETENTA mutação: laço em `:126`, status retentáveis em
-- `:151`, erro de rede/timeout em `:188`, backoff de ~200 ms em `:39`, timeout
-- padrão de 10 s em `:16`. E `POST /api/v1/channel-sessions` chama
-- `waha.startSession()` DEPOIS do insert — WAHA lento faz o cliente abortar e
-- retentar com a linha já gravada.
--
-- O cliente faz a parte dele: a `Idempotency-Key` nasce FORA do laço
-- (`client.ts:117`), então todas as tentativas mandam a mesma. Quem não a
-- honrava era a rota.
--
-- ─── Por que a trava mora AQUI, e não numa consulta antes do insert ─────────
--
-- A primeira tentativa de conserto consultava "existe pendente?" e só então
-- inseria. Isso é read-then-write: duas requisições concorrentes leem "não
-- existe" e as duas inserem. Com retentativa a ~200 ms o insert anterior
-- PROVAVELMENTE já commitou — e "provavelmente" não é invariante.
--
-- Um índice único parcial é atômico por construção. A rota passa a inserir e
-- tratar `23505`, que é a forma de o Postgres dizer "outro chegou primeiro".
--
-- ─── O recorte, e por que cada exclusão existe ──────────────────────────────
--
--   `phone_number is null`  — sessão COM número já foi pareada. Incluí-la
--        impediria conectar um segundo aparelho, que é o caso de uso legítimo.
--   `archived_at is null`   — canal arquivado é canal que o operador excluiu
--        (0106). Mesmo recorte parcial da 0165 e da 0107.
--   `status in (...)`       — só `STARTING` e `SCAN_QR_CODE` são pareamento EM
--        ANDAMENTO. `FAILED`/`STOPPED` é a órfã que este defeito deixava para
--        trás: contá-la travaria TODA conexão nova, trocando o defeito por um
--        pior.
--   `provider = 'waha'`     — a 0202 tornou esta tabela MULTI-PROVIDER. Sem o
--        escopo, uma sessão de Instagram em STARTING bloquearia o pareamento de
--        um WhatsApp (e vice-versa), e a dedup acima marcaria FAILED uma linha
--        que não tem nada a ver com este defeito. O defeito é do fluxo de QR do
--        WAHA; a trava tem o mesmo alcance que ele.
--
-- ─── Deduplicação ANTES da constraint (doutrina de migrations, item 8) ──────
--
-- Índice único falha se os dados atuais o violam, e o `update.sh` do clone roda
-- SEM `ON_ERROR_STOP` — falharia em verde, deixando o clone sem a trava e sem
-- ninguém saber. Então as duplicatas são resolvidas primeiro.
--
-- Quem FICA é a pendente mais RECENTE: numa duplicação por retentativa, é a que
-- o cliente recebeu na resposta e a que a tela está exibindo o QR.
--
-- As perdedoras viram `FAILED`, não são apagadas. Apagar é tentador e errado:
-- `conversations`/`messages` apontam para `channel_sessions` com FK RESTRICT, e
-- uma sessão órfã pode ter recebido mensagem no intervalo. `FAILED` tira a linha
-- do índice, mantém o histórico, aparece na tela e o `channel-health` a trata
-- como estado que avisa (`lib/channels/health.ts`).
--
-- Idempotente: depois da primeira passada não sobra duplicata, e a segunda casa
-- zero linhas.

with pendentes as (
  select id,
         row_number() over (
           partition by organization_id
           order by created_at desc nulls last, id desc
         ) as posicao
    from public.channel_sessions
   where provider = 'waha'
     and archived_at is null
     and phone_number is null
     and status in ('STARTING', 'SCAN_QR_CODE')
)
update public.channel_sessions s
   set status = 'FAILED',
       status_reason = 'duplicata de pareamento resolvida pela migration 0203',
       last_status_change_at = now()
  from pendentes p
 where p.id = s.id
   and p.posicao > 1;

create unique index if not exists channel_sessions_um_pareamento_pendente_por_org
  on public.channel_sessions (organization_id)
  where provider = 'waha'
    and archived_at is null
    and phone_number is null
    and status in ('STARTING', 'SCAN_QR_CODE');

comment on index public.channel_sessions_um_pareamento_pendente_por_org is
  'Um pareamento em andamento por organização. A tela mostra um QR por vez, e a '
  'retentativa de POST do cliente HTTP criava uma segunda sessão órfã. A rota '
  'insere e trata 23505 como "já existe pendente".';
