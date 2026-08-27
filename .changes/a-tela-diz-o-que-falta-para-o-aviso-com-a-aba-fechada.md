---
impacto: nada_mudou
secao: corrigido
titulo: A tela de Notificações passa a dizer o que falta para o aviso chegar com a aba fechada
---

A tela dizia que o aviso por Push "já funciona", sem conferir se esta instalação
tinha como enviá-lo. Quem ligava a opção via o navegador pedir permissão,
concedia, e depois não recebia nada com a aba fechada — sem nenhuma pista do
motivo, e sem como descobrir o que fazer.

Agora, quando faltam as chaves do Web Push, a própria tela avisa que os avisos
só aparecem com o site aberto e mostra o comando para gerar o par de chaves e
onde colocá-lo. Quando as chaves já estão no lugar, ela anuncia que o aviso
chega também com a aba fechada e para de pedir configuração.

**Você não precisa fazer nada.** A opção de Push continua podendo ser ligada dos
dois jeitos: mesmo sem as chaves, o aviso na bandeja do sistema já funciona
enquanto o DeskcommCRM está aberto numa aba.
