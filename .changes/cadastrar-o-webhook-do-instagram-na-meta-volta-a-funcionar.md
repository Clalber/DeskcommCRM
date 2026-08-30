---
impacto: nada_mudou
secao: corrigido
titulo: Cadastrar o webhook do Instagram na Meta volta a funcionar
---

Ao cadastrar a URL de webhook no painel da Meta, ela recusava dizendo que
**não foi possível validar a URL de callback ou o token de verificação** —
mesmo com a URL e o token corretos, copiados da própria tela de Conexões.

A URL estava certa o tempo todo. O que acontecia é que o sistema comparava o
token que você digitou na Meta com o **segredo errado**: em vez do token de
verificação, ele usava a chave secreta do aplicativo. Como os dois nunca são
iguais, a conferência falhava sempre.

A mensagem da Meta aponta para a URL, que era justamente a parte que estava boa —
por isso o erro custava tanto a ser encontrado.

Quem já tinha salvo as credenciais na tela não precisa refazer nada: basta tentar
o cadastro do webhook na Meta de novo.
