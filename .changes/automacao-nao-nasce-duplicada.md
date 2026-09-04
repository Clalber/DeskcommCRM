---
impacto: nada_mudou
secao: corrigido
titulo: Criar uma automação deixa de gerar duas iguais
---
Criar uma automação podia produzir duas idênticas. Não era clique repetido: quando a rede engasga no meio do envio, o navegador reenvia o mesmo pedido sozinho — e a tela de automações não reconhecia que era o mesmo pedido, criando outra regra.

O efeito prático era pior que uma linha duplicada na lista: com duas regras iguais, cada mudança de etapa disparava a ação **duas vezes**, e quem estava configurando um aviso no WhatsApp recebia tudo em dobro.

Agora a criação reserva o pedido antes de executá-lo. A repetição encontra a reserva e devolve a mesma automação, em vez de criar outra. Não é preciso fazer nada; automações duplicadas que já existem continuam lá e podem ser apagadas na tela.
