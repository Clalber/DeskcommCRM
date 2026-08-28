---
impacto: capacidade_nova
secao: adicionado
titulo: O agente mostra "digitando…" enquanto pensa
---

Quando o agente de IA vai responder alguém, o cliente passa a ver **"digitando…"**
no topo da conversa — do momento em que o agente começa a pensar até a mensagem
sair. Antes havia um silêncio de vários segundos entre a pergunta e a resposta,
e silêncio, no WhatsApp, é o que faz o cliente achar que ninguém viu.

O indicador é reaceso a cada 8 segundos, porque o WhatsApp o apaga sozinho, e
tem teto de 1 minuto: um turno que trave não deixa o cliente vendo "digitando…"
para sempre — o que seria pior que não ter o recurso, já que afirmaria que
alguém está escrevendo quando não está.

Ele só acende depois de o agente ter decidido que **vai mesmo responder**: quem
está em atendimento humano, quem pediu para não ser incomodado e as conversas
fora do horário de envio não veem sinal nenhum. Nada aqui atrasa, segura ou
bloqueia mensagem — se o indicador falhar, a resposta sai igual.

Não há ação a tomar. Vem ligado; quem preferir sem ele põe
`AGENT_TYPING_ENABLED=false` no `.env`. Conexão cujo canal não conhece o
indicador simplesmente segue sem ele, sem erro e sem precisar de configuração.
