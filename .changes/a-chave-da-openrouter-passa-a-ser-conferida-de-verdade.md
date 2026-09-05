---
impacto: nada_mudou
secao: corrigido
titulo: A chave da OpenRouter passa a ser conferida de verdade
---

Ao cadastrar uma chave da OpenRouter em Agente de IA › Credenciais, o sistema
conferia a chave pedindo o catálogo de modelos — que é público. O catálogo
responde a mesma coisa com chave certa, com chave errada e sem chave nenhuma,
então a tela dizia "validada" para qualquer texto colado no campo.

Quem digitasse a chave com um caractere a menos só descobria depois, quando a
primeira conversa não fosse respondida — e o erro aparecia longe dali, na fila
do agente, sem ligação visível com o cadastro.

A conferência passa a usar o endereço que exige a credencial. Chave inválida é
recusada na hora, na tela onde ela foi digitada.
