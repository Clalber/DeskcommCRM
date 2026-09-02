---
impacto: nada_mudou
secao: corrigido
titulo: O atendimento automático para de negar uma reunião que ele mesmo marcou
---

O agente de IA marcava a reunião, confirmava ao cliente — e minutos depois, se a
conversa continuasse, dizia que **nenhum horário estava marcado**. A reunião
estava gravada e confirmada o tempo todo.

Foi medido numa conversa real, com um cliente do outro lado. Ele perguntou
"qual horário você marcou para mim?" e ouviu que não havia nada. Perguntou de
novo, apontando a reunião, e ouviu um pedido de desculpas por uma marcação que
tinha acontecido de verdade.

A causa é um nome. O contexto que o agente recebe traz o identificador do
contato num campo chamado `lead_id` — herança de quando "lead" e "contato" eram
a mesma coisa. Só que a consulta de compromissos tem **dois** campos com esses
nomes, e eles apontam para coisas diferentes: `lead_id` é o negócio no funil,
`contact_id` é a pessoa. O agente usou o nome que recebeu, a busca procurou um
negócio com o identificador de uma pessoa, não achou vínculo nenhum — e ele
concluiu, com sinceridade, que a reunião não existia.

Nada no sistema reclamava. A consulta era válida e a resposta vazia era uma
resposta legítima; só estava respondendo a outra pergunta.

**Dois consertos, e o segundo é o que fecha a porta.**

O primeiro é o nome: o contexto passou a entregar também um campo `contact_id`,
com o mesmo valor e o nome verdadeiro. O campo antigo continua onde estava para
não quebrar quem já o consome.

O segundo veio de uma revisão adversarial que derrubou o primeiro. Nada impede o
agente de mandar os DOIS campos — os valores são idênticos —, e nesse caso o
caminho antigo vencia e o sintoma voltava. A consulta passou então a separar
duas situações que ela tratava como uma só: "este negócio não tem nada marcado"
e "isto nem é um negócio". A primeira continua devolvendo lista vazia, que é a
resposta certa. A segunda virou uma recusa que **diz o que fazer** — e o agente
se corrige na mesma resposta, em vez de anunciar ao cliente que ele não tem
reunião.

**Precisa refazer algo?** Não. Nenhuma configuração nova, nenhum passo de
atualização. As reuniões marcadas sempre estiveram corretas no banco — o que
estava errado era o que o agente dizia sobre elas.
