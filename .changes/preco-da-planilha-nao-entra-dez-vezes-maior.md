---
impacto: nada_mudou
secao: corrigido
titulo: O preço da planilha deixa de entrar dez vezes maior no catálogo
---

O catálogo de produtos aceita uma planilha para a loja não ter de cadastrar item
por item. A leitura do preço tinha um erro de escala nas duas formas mais comuns
de uma planilha brasileira chegar.

**Um centavo escrito com um dígito só.** Quando a célula está formatada como
número e mostra `1.299,90`, o Excel grava `1299,9` no arquivo — ele corta o zero
do fim. O sistema lia esse único dígito como separador de milhar e gravava
**R$ 12.999,00** no lugar de R$ 1.299,90. Dez vezes o preço, sem recusar a linha
e sem avisar ninguém — e é esse preço que o atendimento automático responderia ao
cliente.

**Uma observação escrita ao lado do preço.** Quem escreve `R$ 5.499,00 (promo até
10)` na mesma célula via os dígitos da observação grudarem no valor, e o produto
entrava a R$ 54.990.010,00.

Agora um ou dois dígitos depois da vírgula são sempre centavos — grupo de milhar
tem sempre três, então um grupo menor não pode ser outra coisa. E célula com
qualquer texto junto do número passa a ser **recusada**, com a linha apontada no
relatório e a instrução de como escrever, em vez de virar um número plausível que
ninguém confere numa lista de 300 itens.

Para quem opera, nada muda: nenhuma configuração nova, nenhum passo de
atualização. E nenhum catálogo precisa ser corrigido — o conserto sai na mesma
versão que traz a importação de planilha, então nenhuma loja chegou a importar
com o preço errado.
