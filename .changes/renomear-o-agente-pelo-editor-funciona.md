---
impacto: nada_mudou
secao: corrigido
titulo: Renomear o agente pelo editor passa a funcionar
---

Editar o **nome** de um agente na tela de configuração não mudava nada. A pessoa
digitava o nome novo, salvava, publicava — e o nome seguia o mesmo em toda tela.
A **descrição** e a **ordem de preferência** sumiam do mesmo jeito, pela mesma
causa.

Nada falhava, e é isso que tornava o problema difícil de enxergar: o campo
aceitava a digitação, validava, o botão de salvar acendia, o aviso verde dizia
"Rascunho salvo", e a publicação respondia que deu certo. Todas essas afirmações
eram verdadeiras — a respeito da **versão** do agente, que era a única coisa
sendo de fato gravada. Esses três campos não pertencem à versão: eles valem para
o agente inteiro, e o editor nunca os enviava.

Agora eles são gravados junto com o rascunho, e a lista de agentes passa a
mostrar o nome novo na hora.

**Já dava para renomear antes?** Sim, por outro caminho: o menu de três pontos
no cartão do agente, na lista, tem "Renomear". Ele sempre funcionou. Quem tentou
pelo editor é que não tinha como saber que precisava sair de lá.
