---
impacto: nada_mudou
secao: corrigido
titulo: Salvar o rascunho de um agente deixa de escrever por cima do histórico
---

Na tela de um agente, "Salvar rascunho" podia gravar numa versão diferente da
que estava aberta. Acontecia depois de reverter pelo Histórico com trabalho em
andamento: ficava um rascunho anterior à versão publicada, e a tela e o servidor
discordavam sobre qual deles era o rascunho de verdade.

Dois estragos saíam disso. O texto digitado ia para uma versão que a tela não
reabre e o botão não publica — aviso verde de salvo, recarrega, e nada mudou. E
a versão antiga é um retrato: o Histórico promete que ela continua lá, e
regravá-la trocava o conteúdo daquela linha por um texto que ninguém escreveu
ali, sem erro e sem volta.

O servidor passa a escolher o rascunho pela mesma regra da tela, e a versão
superada fica intocada no Histórico.
