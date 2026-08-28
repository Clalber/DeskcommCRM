---
efeito: capacidade_nova
---

O schema e o vocabulário do CRM passam a comportar um canal que não é WhatsApp.

Nada muda para quem opera hoje: nenhum canal novo aparece na tela, nenhum envio
troca de caminho, e a instalação existente segue idêntica. É a camada de baixo
do Instagram Direct — o transporte ainda não existe, e tentar usá-lo falha alto
(`unknown_channel_provider`) em vez de sair calado pelo canal errado.

Quem atualiza recebe: três colunas nullable em `channel_sessions`, os CHECKs de
`conversations.channel` e `webhook_events_log.provider` aceitando o canal novo,
e a tabela `channel_contact_identities`. Não há ação a tomar.
