---
impacto: capacidade_nova
secao: adicionado
titulo: Avisos de mensagem e de CRM chegam com a aba fechada
---

Antes, quem minimizava ou fechava a aba parava de ver aviso de mensagem nova e
de movimento no funil — voltava e descobria tudo de uma vez. Agora o navegador
mostra o aviso na bandeja do sistema mesmo com o site fechado, e clicar nele
abre a conversa certa.

Cada pessoa liga isso em Configurações › Notificações, e o navegador pede
permissão uma vez. **Nada muda para quem não ligar.**

Para a instalação inteira poder mandar esses avisos, quem administra a VPS
gera um par de chaves uma única vez (`npx web-push generate-vapid-keys`) e o
coloca no `.env`, em `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY`.
**Sem essas chaves o produto continua funcionando exatamente como antes**, com
os avisos aparecendo só enquanto o site está aberto.
