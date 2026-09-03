---
impacto: capacidade_nova
secao: adicionado
titulo: O follow-up ganha janela própria, separada do horário de atendimento
---

Responder e cobrar são coisas diferentes, e agora o sistema sabe disso.

O horário de envio do canal sempre valeu para os dois: para responder quem
escreveu, e para o follow-up tocar quem sumiu. Quem abrisse o canal para
atender de madrugada — decisão legítima, o cliente que escreve à meia-noite
merece resposta — abria o follow-up junto, sem saber. O toque de duas horas
passava a poder cair às quatro da manhã, oferecendo horário a quem estava
dormindo.

É o gesto que faz um número ser denunciado no WhatsApp. E o cliente que acorda
com cobrança automática não volta.

Duas variáveis novas separam as coisas:

```
FOLLOWUP_WINDOW_START_HOUR=8
FOLLOWUP_WINDOW_END_HOUR=19
```

A janela do canal segue valendo para responder. A comercial vale só para o
follow-up.

Três decisões que valem registrar. Fora da janela o toque é **adiado** para a
abertura, nunca descartado — o retorno acontece, só em hora decente. Mudam
apenas as horas: fuso e liberação de domingo continuam vindo da configuração
do canal, para não existirem duas verdades sobre o mesmo assunto. E, sem as
duas variáveis declaradas, tudo funciona como antes.

**Precisa refazer algo?** Não. Sem as variáveis, nada muda — o follow-up segue
usando a janela do canal, como sempre usou. Quem quiser separar acrescenta as
duas linhas ao `.env` e reinicia.
