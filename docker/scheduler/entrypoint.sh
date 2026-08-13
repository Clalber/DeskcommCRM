#!/bin/sh
# Entrypoint do deskcomm-scheduler: escreve o crontab e entrega o PID 1 ao crond.
#
# Por que gerar em runtime em vez de assar o arquivo na imagem: o INTERNAL_SECRET
# só existe no .env do cliente, e o busybox crond não expande variáveis dentro da
# linha do cron. Então a expansão acontece aqui, uma vez, no start.
#
# O que MUDOU em relação à versão anterior (o `command:` inline do compose): não
# há mais `apk add --no-cache curl tzdata` a cada start. curl e tzdata vêm na
# imagem. O cron do cliente deixa de depender de a VPS ter internet e de o mirror
# do Alpine estar de pé no momento de um restart — que é justamente o momento em
# que a máquina está se recuperando de alguma coisa.
set -eu

if [ -z "${INTERNAL_SECRET:-}" ]; then
  echo "scheduler: INTERNAL_SECRET vazio — os crons responderiam 401 em silêncio." >&2
  echo "scheduler: confira a chave no .env e suba de novo." >&2
  exit 1
fi

APP_ORIGIN="${SCHEDULER_APP_ORIGIN:-http://app:3000}"

umask 077
cat > /etc/crontabs/root <<EOF
* * * * * curl -fsS -m25 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/agent-dispatcher >/dev/null 2>&1
* * * * * curl -fsS -m25 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/followup-flow-worker >/dev/null 2>&1
* * * * * curl -fsS -m45 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/event-log-drain >/dev/null 2>&1
* * * * * curl -fsS -m25 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/routing-worker >/dev/null 2>&1
* * * * * curl -fsS -m25 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/recover-stuck-messages >/dev/null 2>&1
*/5 * * * * curl -fsS -m25 -H "Authorization: Bearer $INTERNAL_SECRET" "$APP_ORIGIN/api/v1/cron/storage-redaction?limit=50" >/dev/null 2>&1
*/5 * * * * curl -fsS -m25 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/snooze-watcher >/dev/null 2>&1
*/5 * * * * curl -fsS -m25 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/attendant-heartbeat >/dev/null 2>&1
*/5 * * * * curl -fsS -m45 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/channel-health >/dev/null 2>&1
*/10 * * * * curl -fsS -m60 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/contact-avatars >/dev/null 2>&1
*/15 * * * * curl -fsS -m60 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/risk-watcher >/dev/null 2>&1
*/30 * * * * curl -fsS -m60 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/contact-phones >/dev/null 2>&1
17 * * * * curl -fsS -m60 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/contact-proposals-watcher >/dev/null 2>&1
0 12 * * * curl -fsS -m60 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/lgpd-sla-watcher >/dev/null 2>&1
30 3 * * * curl -fsS -m120 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/kb-conversations-batch >/dev/null 2>&1
15 4 * * * curl -fsS -m60 -H "Authorization: Bearer $INTERNAL_SECRET" $APP_ORIGIN/api/v1/cron/sync-model-catalog >/dev/null 2>&1
EOF

exec crond -f -l 2
