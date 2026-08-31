---
impacto: nada_mudou
secao: corrigido
titulo: Responder pelo Instagram volta a funcionar
---

Toda resposta enviada numa conversa do Instagram falhava dizendo que o
**contato estava sem telefone** — numa conversa que não tem telefone nenhum, por
desenho: quem escreve pelo Direct é identificado por um código da conta, não por
número.

O sistema conhecia esse código e o guardava corretamente ao receber a mensagem,
mas não o consultava na hora de responder. Agora consulta, e só quando o telefone
não resolve — o envio pelo WhatsApp segue exatamente como estava.

A mensagem de erro também deixou de falar em telefone quando o canal não usa
telefone.

**No mesmo conserto:** apertar Enter duas vezes (ou Enter e clicar em enviar)
mandava a mesma frase duas vezes para o cliente. Agora o texto idêntico só sai
uma vez; duas mensagens diferentes em sequência rápida continuam saindo
normalmente.

**Também no mesmo conserto:** a linha da timeline dizia "Entrou pelo WhatsApp"
para todo contato novo, inclusive para quem chegou pelo Instagram — e o campo de
origem do lead gravava WhatsApp no banco, o que contaminava qualquer relatório de
origem. Agora a linha diz o canal certo, e o lead nasce com a origem correta.

Cards criados antes desta versão continuam mostrando o que mostravam: eles são
de WhatsApp, que era o único canal na época.
