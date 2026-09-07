-- ============================================================================
-- 0213 — O DISPARADOR DO LEMBRETE NASCEU, E ESTA MIGRATION É O RECIBO DISSO
--
-- A 0194 termina com uma promessa datada: "Ligar lembrete por padrão fica com o
-- dono do produto NO DIA em que o disparador nascer — aí ele decide com o
-- mecanismo na frente, e não com uma coluna que ninguém lê." Este é aquele dia.
-- O disparador é `lib/followup/gatilho-compromisso.ts`: uma varredura no tick do
-- cron `followup-flow-worker` que, para cada fluxo de follow-up armado com
-- `trigger_config.kind='appointment_upcoming'`, acha os compromissos que
-- começam dentro da antecedência escolhida e inscreve o contato no fluxo.
--
-- ⚠️ ESTA MIGRATION NÃO MUDA ESTRUTURA NENHUMA, e isso é o ponto.
--
-- Nenhuma coluna nova, nenhum índice novo, nenhum default alterado. O que ela
-- faz é gravar NO SCHEMA quem passou a ler cada uma das quatro colunas que a
-- 0177 criou e que ficaram órfãs — porque a próxima pessoa a abrir esta tabela
-- vai fazer exatamente a pergunta que a 0194 fez ("quem lê isto?"), e a resposta
-- mudou. Comentário de coluna é o único lugar em que a resposta viaja junto com
-- a coluna: um clone que aplique só o `baseline.sql` recebe o schema, não o
-- repositório.
--
-- ─── A divisão das duas perguntas, que é a decisão de produto desta entrega ──
--
--   * QUAIS compromissos lembram → `reminder_enabled`, um interruptor por tipo
--     de atendimento, em Ajustes › Agenda. Segue nascendo DESLIGADO (0194): o
--     disparador existir não muda o argumento de que inscrever alguém numa
--     mensagem automática é ato de quem opera, nunca de um default.
--   * QUANTO ANTES → `followup_flow_pointers.trigger_config.params.minutes_before`,
--     no fluxo. É do fluxo que sai a frase, e quem escreve "faltam 60 minutos"
--     precisa mandar nos 60.
--
-- `reminder_minutes_before` fica declarada NÃO LIDA em vez de virar a segunda
-- resposta para a pergunta que o fluxo já responde. Duas fontes com o mesmo nome
-- divergem no primeiro ajuste, e quem perde é sempre a que ninguém abriu
-- (anti-pattern nº 2 do CLAUDE.md). Não é dropada porque a 0177 vive em clones
-- com o baseline aplicado, e derrubar coluna é o tipo de mudança que quebra o
-- `update.sh` de quem estiver no meio de uma leitura — declarar é barato e
-- reversível; dropar não é.
--
-- ─── Por que não há CHECK novo em `trigger_config` ──────────────────────────
--
-- `followup_flow_pointers.trigger_config` é `jsonb` sem CHECK desde sempre, e
-- continua. Quem valida é o Zod do PATCH (`lib/followup/api-schemas.ts`) e a
-- allowlist do publish, que recusa kind sem motor vivo. Pôr o vocabulário de
-- gatilho num CHECK faria o `update.sh` de todo clone quebrar no dia em que uma
-- versão nova do produto gravasse um kind que o CHECK do clone antigo não
-- conhece — é a exceção de "vocabulário ABERTO" que o CLAUDE.md descreve.

comment on column public.calendar_event_types.reminder_enabled is
  'Interruptor do lembrete automático deste tipo de atendimento. LIDO desde a 0213 por lib/followup/gatilho-compromisso.ts: compromisso de tipo desligado — ou sem tipo — nunca vira lembrete. Continua nascendo DESLIGADO (0194): enviar mensagem é irreversível, e quem inscreve alguém é quem opera, em Ajustes › Agenda.';

comment on column public.calendar_event_types.reminder_minutes_before is
  'NÃO LIDA por ninguém, de propósito (0213). A antecedência do lembrete mora no FLUXO que o manda: followup_flow_pointers.trigger_config.params.minutes_before. É do fluxo que sai a frase da mensagem, e responder "quanto antes" em dois cadastros produziria duas respostas. Mantida em vez de dropada porque a 0177 vive em clones com o baseline aplicado.';

comment on column public.calendar_event_types.reminder_template_name is
  'NÃO LIDA por ninguém (0213). O texto do lembrete é o nó de ação do fluxo de follow-up, onde ele pode ter variáveis ({{agendamento.hora}}, {{agendamento.com_quem}}) e ramificar. Um nome de template aqui seria um segundo lugar para escrever a mesma mensagem.';

comment on column public.calendar_appointments.reminder_sent_at is
  'Idempotência do lembrete: preenchido por lib/followup/gatilho-compromisso.ts DEPOIS de o acompanhamento nascer, nunca antes — marcar primeiro trocaria "mandou duas vezes" por "nunca mandou". Compromisso com esta coluna preenchida sai da varredura para sempre.';
