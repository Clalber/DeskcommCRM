---
impacto: capacidade_nova
secao: adicionado
titulo: Catálogo de produtos próprio — com o preço que a IA responde ao cliente
---

Quem vende produto agora tem onde cadastrar o que vende. Antes, o único catálogo
do sistema era o espelho de uma loja Nuvemshop: quem não usa Nuvemshop — a loja
de rua, o showroom, quem vende pelo WhatsApp e só — não tinha lugar nenhum para
pôr preço, e o agente de IA respondia "vou confirmar com a equipe" para a
pergunta mais comum que existe, que é "quanto custa".

Há uma tela nova em **Produtos**, no menu do CRM. Dá para cadastrar um a um, e dá
para **importar a planilha que a loja já tem** — o arquivo do Excel, com os
nomes de coluna que ela já usa (`código` ou `sku`, `preço` ou `valor`,
`estoque` ou `qtd`). Reimportar a mesma planilha com preços novos **atualiza** os
produtos em vez de duplicar, que é o gesto real de quando o custo muda.

A importação recusa em vez de adivinhar. Uma linha com preço que não dá para ler
não entra, e o relatório diz qual linha e qual foi o texto encontrado — um chute
aqui vira preço errado dito a um cliente três dias depois. As linhas boas entram
mesmo assim: uma planilha de 300 itens não morre inteira por causa da linha 7.

Para a IA, a diferença é maior do que parece. A busca dela entende o cliente que
escreve "ifone 15 128" e devolve exatamente o modelo de 128GB — nunca o de
256GB, mesmo sendo quase o mesmo texto, porque é aí que o preço sai errado. E
quando dois produtos casam igualmente bem, ela **pergunta** em vez de escolher.

Só quem é gerente ou administrador altera preço; quem atende lê. Nada muda para
quem já usa a integração com Nuvemshop — aquele catálogo continua onde estava.
