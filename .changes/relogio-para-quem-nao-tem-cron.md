---
impacto: capacidade_nova
secao: adicionado
titulo: O follow-up anda mesmo em hospedagem sem agendador
---

Em ambientes que não têm agendador de verdade — o plano gratuito da Vercel é o
caso comum — os follow-ups e as tarefas de bastidor só andavam quando alguém
abria o sistema. Um lead que respondia de madrugada ficava esperando.

Agora existe uma batida de relógio que pode vir de fora: um serviço gratuito de
cron chama uma vez a cada poucos minutos e o sistema faz o que estava pendente.
O passo a passo está no runbook do relógio.

**Quem roda numa VPS com o agendador normal não precisa fazer nada** — ali o
relógio já existia e continua igual.
