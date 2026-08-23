# Runbook — DeskcommCRM em VPS com CloudPanel (Nginx)

> Cenário: VPS com **CloudPanel** já instalado (Nginx ocupando as portas 80/443).
> O instalador detecta o conflito e para — este runbook mostra como contornar.
>
> Testado em: Ubuntu 22.04, CloudPanel v2, Docker 27, Node 20, 8 GB RAM.

---

## Pré-requisitos

| Item | Detalhe |
|---|---|
| VPS | Ubuntu 20.04+ com CloudPanel v2 instalado |
| Docker | Instalado (`docker compose version` ≥ 2.x) |
| Domínio | DNS apontando para o IP da VPS (A record, proxy **desligado**) |
| Supabase | Projeto criado em supabase.com (free tier suficiente) |
| IA | Chave OpenRouter (gratuita) ou Anthropic/OpenAI |

---

## Por que o instalador para?

O CloudPanel usa Nginx como proxy reverso nativo nas portas **80 e 443**.
O `install.sh` detecta isso e recusa subir um segundo proxy (Caddy) nas mesmas portas:

```
✗ Libere as portas 80 e 443 (ou use a instalação que já existe) e rode de novo.
A instalação parou. Nada ficou pela metade sem conserto.
```

A solução: deixar o **app Docker rodar na porta interna 3000** e configurar o
**CloudPanel/Nginx como proxy reverso** para ele.

---

## Passo 1 — Clonar e preparar o `.env`

```bash
cd /var/www
git clone https://github.com/melgarafael/DeskcommCRM.git DeskcommCRM
cd DeskcommCRM
cp .env.hostgator.example .env
nano .env
```

Campos obrigatórios:

```dotenv
DOMAIN=cloud.seudominio.com.br
ACME_EMAIL=voce@seudominio.com.br
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_DB_URL=postgresql://postgres...
NEXT_PUBLIC_APP_URL=https://cloud.seudominio.com.br
NEXT_PUBLIC_ADMIN_URL=https://cloud.seudominio.com.br
OPENROUTER_API_KEY=sk-or-v1-...
OWNER_EMAIL=voce@seudominio.com.br
OWNER_PASSWORD=senha-forte-aqui
```

> **Deixe `REVERSE_PROXY` comentado** — o instalador detecta o ambiente sozinho.

---

## Passo 2 — Rodar o instalador

```bash
bash hostgator-setup-kit/install.sh --yes
```

O instalador vai:
- ✅ Gerar todos os segredos automaticamente
- ✅ Aplicar o schema no Supabase
- ❌ Parar ao tentar subir o Caddy (conflito de porta — esperado)

Quando parar no erro de porta, pressione **Ctrl+C** e siga para o passo 3.

> **Nota:** A aplicação do schema no Supabase pode levar 3–5 minutos sem
> output visível. Se o cursor ficar parado, verifique no dashboard do Supabase
> se as tabelas estão sendo criadas antes de cancelar.

---

## Passo 3 — Subir os containers manualmente (sem Caddy)

```bash
cd /var/www/DeskcommCRM
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

O Caddy vai falhar — isso é esperado. Confirme os outros containers:

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep deskcomm
```

Saída esperada:

```
deskcommcrm-scheduler-1   Up (healthy)
deskcommcrm-app-1         Up (healthy)   3000/tcp
deskcommcrm-srh-1         Up
deskcommcrm-waha-1        Up             3000/tcp
deskcommcrm-redis-1       Up (healthy)   6379/tcp
deskcommcrm-worker-1      Up (healthy)   8787/tcp
```

Anote o IP interno do container do app:

```bash
docker inspect deskcommcrm-app-1 \
  --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
# Exemplo: 172.19.0.6
```

---

## Passo 4 — Criar o site no CloudPanel

1. Acesse `https://SEU-IP:8443`
2. **Sites → Add Site** → Domain: `cloud.seudominio.com.br`
3. Vá em **Sites → cloud.seudominio.com.br → Vhost**
4. Substitua o conteúdo pelo bloco abaixo (ajuste o IP do `proxy_pass`):

```nginx
server {
  listen 80;
  listen [::]:80;
  listen 443 quic;
  listen 443 ssl;
  listen [::]:443 quic;
  listen [::]:443 ssl;
  http2 on;
  http3 off;
  {{ssl_certificate_key}}
  {{ssl_certificate}}
  server_name cloud.seudominio.com.br;
  {{root}}
  {{nginx_access_log}}
  {{nginx_error_log}}
  if ($scheme != "https") {
    rewrite ^ https://$host$request_uri permanent;
  }
  location ~ /.well-known {
    auth_basic off;
    allow all;
  }
  {{settings}}
  include /etc/nginx/global_settings;
  index index.html;
  location / {
    proxy_pass http://172.19.0.6:3000/;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Server $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_pass_request_headers on;
    proxy_max_temp_file_size 0;
    proxy_connect_timeout 900;
    proxy_send_timeout 900;
    proxy_read_timeout 900;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
    proxy_temp_file_write_size 256k;
  }
}
```

> Mantenha as variáveis `{{ssl_certificate_key}}`, `{{ssl_certificate}}`, `{{root}}`,
> `{{nginx_access_log}}`, `{{nginx_error_log}}` e `{{settings}}` — são templates do CloudPanel.

---

## Passo 5 — Emitir o certificado SSL

1. No Cloudflare, adicione: **A** | `cloud` | IP da VPS | Proxy **desligado**
2. CloudPanel → **SSL/TLS → Actions → New Let's Encrypt Certificate**
3. Domain: `cloud.seudominio.com.br` → **Create and Install**

---

## Passo 6 — Corrigir as URLs do app

```bash
cd /var/www/DeskcommCRM
sed -i 's|NEXT_PUBLIC_APP_URL=https://seudominio.com.br|NEXT_PUBLIC_APP_URL=https://cloud.seudominio.com.br|' .env
sed -i 's|NEXT_PUBLIC_ADMIN_URL=https://seudominio.com.br|NEXT_PUBLIC_ADMIN_URL=https://cloud.seudominio.com.br|' .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --force-recreate app
```

---

## Verificação final

```bash
curl https://cloud.seudominio.com.br/api/v1/health
```

Resposta esperada: `{"data":{"supabase":"ok","redis":"ok","waha":"ok"}}`

---

## Atualizações futuras

```bash
cd /var/www/DeskcommCRM
bash hostgator-setup-kit/update.sh
```

---

## Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| Instalador para com erro de porta | CloudPanel/Nginx nas portas 80/443 | Esperado — siga o Passo 3 |
| Schema trava sem output | Latência com Supabase us-west-2 | Aguarde 5 min; verifique tabelas no dashboard |
| Let's Encrypt falha na validação | DNS ainda não propagou | Aguarde 1–2 min e tente novamente |
| App não responde após reinício | IP interno do container mudou | `docker inspect deskcommcrm-app-1` e atualize o `proxy_pass` |
| `waha: degraded` no health | WAHA sem sessão pareada | Normal — conecte em Configurações → WhatsApp |
