---
impacto: nada_mudou
secao: corrigido
titulo: O segundo material que você ensina ao agente volta a funcionar
---

Ensinar mais de um documento ao mesmo assistente não funcionava, e **não havia como perceber**:
o primeiro material era lido normalmente, e do segundo em
diante a tela mostrava "pronto" enquanto o conteúdo nunca ficava disponível para
a busca. O assistente respondia "não encontrei isso" sobre uma coisa que estava
escrita num arquivo que você subiu — e nenhum aviso aparecia em lugar nenhum.

Medido numa instalação real: cinco documentos enviados para o mesmo assistente,
um funcionou, quatro ficaram parados. Os cinco apareciam como concluídos.

A causa era interna: a numeração das versões do acervo passou a contar por
documento, mas a regra do banco continuava contando por assistente — então o
segundo documento sempre esbarrava no primeiro. Não era intermitente; nunca
funcionava.

Agora cada material tem a própria contagem, e os materiais antigos continuam
válidos como estavam. Se você já subiu documentos que ficaram parados, basta
reenviá-los depois de atualizar.

Para quem opera uma instalação, nada muda no dia a dia: nenhuma configuração
nova, nenhum passo de atualização.
