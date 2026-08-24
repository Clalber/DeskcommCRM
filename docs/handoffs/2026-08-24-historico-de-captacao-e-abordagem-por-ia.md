# Histórico de leads captados + abordagem escrita pela IA + a automação para de mentir

Entrega de 2026-08-24. Três coisas, e a terceira nasceu de um relato de uso
real: uma automação ligada, um lead entrando pelo formulário, e nenhuma
mensagem chegando ao cliente.

## O relato, reproduzido antes de qualquer conserto

Cenário montado exatamente como a tela o monta (gatilho "contato novo pelo
webhook" → ação "Enviar mensagem no WhatsApp"), disparado por um POST real na
URL da fonte e drenado pela mesma rota de cron que o scheduler bate:

```
run.status          = success      ← ✓ verde na aba Atividade
mensagem.status     = failed
mensagem.error_code = waha_error
```

A causa: `sendMessageHandler` **não lança** quando o envio falha — ele marca a
linha da mensagem (`failed`, ou deixa em `queued`) e a devolve normalmente,
porque quem o chama pela tela é o Inbox, que renderiza a bolha com o estado
dela. A ação da automação só verificava se houve exceção.

Depois do conserto, no mesmo instrumento:

```
run.status          = failed
texto na tela       = "Não conseguimos falar com o serviço de WhatsApp.
                       Confira se ele está no ar."
Central de avisos   = 1 item crítico, nomeando a automação
```

Dois silêncios vizinhos vieram junto:

1. **A janela paralela.** A automação avaliava 7h–22h com
   `new Date().getHours()` — a hora do RELÓGIO DO SERVIDOR. Num contêiner em
   UTC isso é 4h–19h de Brasília, e uma automação disparada às 19h30 do horário
   comercial ficava represada até as 4h da manhã. Pior: quem abriu Conexões e
   mudou a janela do número viu a mudança valer para o agente e não valer para
   a automação. Agora a janela vem de `channel_knobs`, pela MESMA regra pura
   (`janelaDeEnvioAberta`) que o agente usa.
2. **O adiamento invisível.** Quando uma ação pedia adiamento, o motor devolvia
   `retry` e saía sem gravar linha nenhuma — a aba Atividade ficava vazia. Para
   quem montou a regra, "não apareceu nada" e "não rodou" eram a mesma tela.
   Migration 0170 acrescenta o estado `adiado`.

## Evidência pela tela

Produzida por `scripts/evidencia-webhooks.ts` contra o rig fresco (Supabase
local aplicado do `baseline.sql` + `bootstrap`/seed, `next build` + `next
start`), com o app dirigido por Playwright:

| Imagem | O que prova |
|---|---|
| `evidence/webhooks-historico-e-ia/01-leads-recebidos.png` | A aba nova com a tabela: quem, contato, fonte, quando, origem, resultado — e uma linha **"Não entrou"** ao lado das que viraram lead |
| `evidence/webhooks-historico-e-ia/02-detalhe-da-captacao.png` | O painel: campos do formulário, data e hora por extenso, página de origem, **endereço IP** e navegador, com o link para o lead |
| `evidence/webhooks-historico-e-ia/03-atividade-diz-falhou.png` | O conserto do relato: badge **Falhou** e a frase "Não conseguimos falar com o serviço de WhatsApp. Confira se ele está no ar." — onde antes havia ✓ Sucesso |
| `evidence/webhooks-historico-e-ia/04-acao-mensagem-pela-ia.png` | A ação nova no ENTÃO: agente publicado, número, e o campo "O que a IA deve fazer com os dados" preenchido |
| `evidence/webhooks-historico-e-ia/05-mobile-390.png` | 390px: filtros empilhados e a tabela rolando DENTRO do próprio container — o corpo da página não rola na horizontal (medido: `scrollWidth` 390 = `clientWidth` 390) |

Medidas por ferramenta, não a olho (`getBoundingClientRect` via Playwright): a
`TabsList` com quatro abas mede **431,94px** em 1440px de viewport — o skeleton
do primeiro paint foi corrigido de 306px (a medida de três abas) para 432px.

## Living System Checklist — histórico de leads captados

- **Quem me alimenta?** `POST /api/v1/webhooks/in/[token]` — em TODOS os
  desfechos, inclusive nos que recusam (`registrarCaptacao`, chamada em 5
  pontos da rota).
- **Quem eu alimento?** Duas peças reais: a aba "Leads recebidos"
  (`GET /api/v1/lead-captures`) e a ação `send_ai_message`, que lê os campos do
  formulário por `dadosDoFormularioDoContexto` para dar entrada ao agente.
- **Que log eu emito?** A própria linha em `webhook_lead_captures` é o registro
  durável; o `api_audit_log` continua recebendo `webhook.lead_received` e
  `webhook.inbound_invalid_signature`; falha ao gravar vai para o logger
  estruturado com a causa nomeada (nunca em silêncio).
- **Onde apareço na tela?** Aba "Leads recebidos" em `/app/webhooks`, com
  tabela e painel de detalhe.
- **Por qual porta se chega?** `/app/webhooks` já está em
  `lib/navigation/registry.ts` (grupo Canais). A aba é interna à tela.
- **Mecanismo anti-morte?** A captação recusada é o próprio anti-morte: antes,
  um formulário mal mapeado devolvia 400 ao site e sumia. Agora ela aparece com
  o motivo em português e os campos crus.
- **Onde se configura?** A fonte, na aba "Receber dados" (nome, funil, etapa,
  segredo, field_map). O que aparece se faltar: o estado vazio explica.
- **Continuidade IA↔humano?** O histórico é a ENTRADA da IA na abordagem
  pós-formulário. Na volta, o texto gerado fica no `detail.texto_gerado` do run
  — é o que permite ajustar a instrução vendo o que ela produziu.
- **Laço de retorno?** Envio que falha vira `failed` no run **e** aviso crítico
  na Central (`agent_inbox_items`, kind `message_send_stuck`, o mesmo do cron
  `recover-stuck-messages` — é o mesmo fato de negócio).
- **Mapa vivo?** `docs/architecture/ia-360-organizar.architecture.json`: 5
  peças novas, 7 arestas.

## Decisões que valem a pena reler antes de mexer

**Por que uma tabela nova, e não `webhook_events_log`.** Aquele é arquivo
FORENSE e é descartável por desenho: o cron `webhook-log-retention` zera
`raw_body`/`payload_parsed`/`headers` em D+7 e apaga a linha em D+90 (migration
0163). Foi a decisão certa — numa instalação real ele era 468 MB de um banco de
545 MB —, mas um histórico de negócio construído sobre ele MENTE a partir do
sétimo dia: os campos viram `null` e nada na UI distingue "o formulário veio
vazio" de "o corpo foi descartado ontem". Arquivo de depuração e memória de
negócio têm ciclos de vida opostos.

**Por que a RLS exige `manager`.** `fields` é o formulário como a pessoa
preencheu. A policy de `webhook_events_log` é org-flat sem gate de papel, então
hoje qualquer `viewer` lê aquela PII direto pelo PostgREST com a anon key —
mesmo com a rota HTTP exigindo `manager`. A rota não é a única porta.

**Por que a LGPD entra por trigger.** `fn_lgpd_cascade_redact_contact` tem 180
linhas; um 9º passo exigiria reescrevê-la inteira no apêndice do baseline,
criando duas cópias que divergem no primeiro conserto. O gancho é a transição
`is_anonymized false → true` em `contacts`, que roda na mesma transação e
alcança qualquer caminho que anonimize um contato.

**Por que o agente não recebe só um JSON.** Um modelo que recebe
`{"segmento":"clínica"}` sem mais nada escreve SOBRE o JSON, não com ele.
Faltam duas coisas, e o prompt declara as duas: a SITUAÇÃO (abordagem fria,
primeira mensagem, ninguém disse nada — o oposto do turno normal do agente, que
sempre responde a alguém) e a INTENÇÃO do dono do negócio, que é o campo "O que
a IA deve fazer com esses dados". É o mesmo desenho do `prompt_hint` de um
passo de follow-up, que já provou funcionar.

**Por que a ação de IA não tem `send_message` no toolset.** Quem envia é a
automação, com janela, opt-out e throttle. Dar a ferramenta ao modelo faria
dele o remetente, e as guardas ficariam dependendo de ele obedecer.

## O que NÃO foi feito (dívida declarada)

- **A poda de `webhook_lead_captures` não existe.** Uma linha por formulário,
  ~1 kB; um cliente de 300 leads/dia gera ~110 MB/ano. Não é o arquivo bruto
  (23 MB/DIA, medido), mas num plano de 500 MB também não é nada. O cabeçalho
  da migration 0169 descreve a poda pretendida
  (`LEAD_CAPTURE_RETENTION_DAYS`, 365, no mesmo cron do arquivo) — ela NÃO foi
  implementada nesta entrega.
- **O agente da abordagem não lê a base de conhecimento (RAG).** `draft-reply`
  também não lê; a via limpa usa `runModelCall` sem tools. Se a mensagem
  precisar citar material do negócio, isso é frente própria.
- **Nenhuma spec exercita a IA gerando texto de verdade.** O rig não tem chave
  de modelo (`.env.e2e` sem `ANTHROPIC_API_KEY`), então a spec prova a
  CONFIGURAÇÃO pela tela e o caminho de erro; o texto gerado por um modelo real
  não foi medido em CI.
