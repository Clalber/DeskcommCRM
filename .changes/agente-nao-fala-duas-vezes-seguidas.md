---
impacto: nada_mudou
secao: corrigido
titulo: O atendimento automático para de mandar duas mensagens seguidas sem ninguém ter escrito
---

Quem escrevia duas mensagens em sequência às vezes recebia **duas respostas** —
a segunda sem responder a nada. Medido numa conversa real:

```
[cliente] Blz
[cliente] Preciso estruturar meu negócio mesmo
[agente]  Combinado, Clalber. Até sexta, às 14h, com o Thiago.
[agente]  Clalber, conferi por aqui: sua reunião está confirmada…
```

Ninguém escreveu entre uma resposta e outra.

A causa é uma corrida no agrupamento de mensagens. Quando duas chegam juntas, o
sistema junta a segunda no atendimento da primeira — mas só consegue fazer isso
enquanto o primeiro atendimento **ainda não começou**. Se a segunda mensagem
chega depois disso, nasce um segundo atendimento. O primeiro lê a conversa
inteira e responde as duas; o segundo roda sem nada novo para responder, e
responde assim mesmo.

O conserto não foi ampliar o agrupamento, e a diferença importa: juntar a
mensagem num atendimento **já em andamento** faria a mensagem nova ficar sem
resposta nenhuma, porque ele pode já ter lido a conversa. Silêncio é pior que
repetição — a repetição incomoda, o silêncio perde o cliente e não deixa rastro.

Em vez disso, cada atendimento passou a conferir uma coisa antes de começar:
**a mensagem que me trouxe aqui já foi respondida?** Se já houve resposta depois
dela, o atendimento anterior já a alcançou, e este encerra sem falar. Quem
escreve depois da resposta continua sendo atendido normalmente — é o segundo
caso do teste, e ele existe para o conserto não virar mudez.

**Precisa refazer algo?** Não. Nenhuma configuração nova, nenhum passo de
atualização.
