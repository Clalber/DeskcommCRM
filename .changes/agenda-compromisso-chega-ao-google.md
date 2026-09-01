---
impacto: nada_mudou
secao: corrigido
titulo: Compromisso marcado aqui passa a chegar no Google Agenda
---

Compromissos marcados no CRM nunca chegaram ao Google Agenda — em instalação
nenhuma, desde sempre. O sistema tentava a cada cinco minutos e o Google recusava
todas as vezes.

O motivo estava numa regra da própria API. O evento ia com **duas identidades**
ao mesmo tempo, e a documentação do Google diz que só uma pode ir na criação. A
recusa vinha sem explicação, e o sistema descartava o pouco que ela dizia.

Agora vai só uma identidade. O reconhecimento dos eventos que o sistema criou —
o que evita o mesmo compromisso ocupar dois horários — passou a usar essa
identidade que ficou.

**Precisa refazer algo?** Não. Os compromissos que estavam parados na fila sobem
sozinhos na próxima rodada, e não há nada antigo para corrigir: como nenhum
chegou lá, não existe evento duplicado para limpar.
