---
impacto: nada_mudou
secao: corrigido
titulo: O ciclo de release para de acusar erro em quem não é o projeto de origem
---

Quem mantém uma cópia própria do DeskcommCRM recebia um e-mail de **"workflow
failed"** a cada mudança enviada. Medido numa instalação real: **12 de 12 envios**,
sempre o mesmo aviso, enquanto todas as outras verificações passavam.

A causa não era um defeito no código enviado. O passo que corta a versão precisa
de uma credencial que só existe no projeto de origem, e toda cópia nasce sem ela
— então ele morria na primeira linha, em todo envio, desde sempre.

Agora esse passo é **pulado** quando a credencial não existe, com uma explicação
no relatório dizendo que é o esperado e como cortar a versão à mão. Onde a
credencial existe, nada muda.

**Por que isso importa mais do que parece:** alarme que toca sempre é
indistinguível de alarme quebrado. Recebendo vermelho em toda mudança, a pessoa
para de abrir o vermelho — e o dia em que a falha for real ela chega na mesma
caixa, com a mesma cara, e não é lida.
