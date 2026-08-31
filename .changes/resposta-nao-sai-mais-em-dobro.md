---
impacto: nada_mudou
secao: corrigido
titulo: A resposta não sai mais em dobro, e o Instagram passa a receber sozinho
---

Duas correções que só apareceram com a plataforma em uso de verdade.

**Toda resposta enviada pela tela chegava duas vezes ao cliente.** Quando a rede
engasga, o sistema reenvia o pedido automaticamente — e o servidor tratava o
reenvio como uma segunda mensagem. Agora ele reconhece que é a mesma, e devolve a
que já saiu em vez de mandar de novo. Duas mensagens diferentes em sequência
continuam saindo normalmente; o que deixa de acontecer é a mesma sair duas vezes.

**Conectar uma conta do Instagram passa a inscrevê-la para receber mensagens.**
Antes, a conexão terminava com a tela dizendo "Conectada" e nenhuma mensagem
chegava: além de assinar o webhook no painel da Meta, cada conta precisa ser
inscrita por uma chamada que o sistema não fazia. Agora ele faz — e, se a Meta
recusar, a conexão fica marcada como com problema em vez de fingir que está boa.

A verificação de saúde, que já roda a cada cinco minutos, passou a conferir essa
inscrição e a refazê-la sozinha quando faltar. Quem conectou uma conta antes
desta versão é consertado automaticamente, sem precisar reconectar.
