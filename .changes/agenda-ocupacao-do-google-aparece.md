---
impacto: nada_mudou
secao: corrigido
titulo: A ocupação do Google volta a aparecer na Agenda, em qualquer período
---

Quem conectava o Google Agenda via a agenda **vazia** aqui, mesmo com os eventos
já importados. Medido numa instalação real: 114 eventos no banco, um deles na
semana desenhada, e a tela mostrando nada.

O servidor entregava esses blocos na primeira pintura. Assim que a tela buscava
os dados atualizados, essa lista era **substituída inteira** — e a busca nunca
devolveu ocupação. Na visão de Mês nem o primeiro instante sobrevivia.

Agora a ocupação vem junto dos agendamentos, para o período que estiver na tela.
Bloco do Google continua sem título, sem clique e sem arraste — é ocupação, não
compromisso seu.

**O que ainda não funciona:** o caminho contrário. Compromissos marcados aqui
seguem sendo recusados pelo Google na publicação. O motivo dessa recusa passa a
ser registrado a cada tentativa, em vez de descartado — era o dado que faltava
para consertar.
