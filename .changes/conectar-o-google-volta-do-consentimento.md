---
impacto: capacidade_nova
secao: corrigido
titulo: Conectar a agenda do Google passa a concluir de verdade
---

Quem clicava em conectar a conta do Google era levado à tela de autorização,
autorizava, e voltava para uma página de erro — a conexão nunca se completava.
Não era problema da conta nem da instalação: a volta da tela de autorização era
recusada pelo sistema antes de chegar ao lugar certo, em qualquer instalação.
Se você tentou conectar e desistiu, tente de novo: agora vai até o fim.

A mesma recusa acontecia na volta da conexão com a Nuvemshop, e também foi
corrigida.

Para conectar o Google, quem administra a instalação continua precisando
cadastrar as credenciais em Administração › Google e registrar o endereço de
retorno no console do Google — exatamente o endereço que a própria tela mostra,
terminando em /api/v1/agenda/google/callback. Sem esse endereço registrado, o
Google recusa a autorização antes de o sistema ser chamado.
