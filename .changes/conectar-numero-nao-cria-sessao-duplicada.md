---
impacto: nada_mudou
secao: corrigido
titulo: Conectar um número para de criar duas conexões
---

Clicar em **Conectar novo WhatsApp** criava **duas** conexões: uma pareava e a
outra ficava parada, sem número, esperando ser apagada na mão. Acontecia toda
vez.

A causa não era o clique. Quando o WhatsApp demora a responder, o sistema tenta
de novo sozinho — e a tentativa nova criava outra conexão em vez de aproveitar a
primeira. Agora o banco de dados garante que existe **uma** conexão em andamento
por vez, e a segunda tentativa recebe a que já estava lá.

Junto vai um conserto de um caso pior, que só aparecia quando o WhatsApp estava
fora do ar: a conexão que falhava era **apagada**, e a tela ficava girando em
"Preparando…" para sempre porque procurava algo que não existia mais. Agora ela
fica registrada como falha — visível, com o motivo, e sem travar a próxima
tentativa.

Se você abrir a tela de instalação enquanto uma conexão já está em andamento, ela
agora **mostra essa conexão** em vez de tentar criar outra — antes, insistir pelos
dois caminhos deixava a tela acompanhando uma conexão e o WhatsApp preparando
outra.

Conexões que já existem não são afetadas, e conectar um segundo número continua
funcionando normalmente. Contas de outros canais não entram nessa contagem: o
limite de uma conexão em andamento vale só para o WhatsApp.
