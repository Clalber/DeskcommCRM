---
impacto: nada_mudou
secao: corrigido
titulo: As verificações param de acusar erro por credencial que uma cópia não tem
---

Quem mantém uma cópia própria do DeskcommCRM recebia um **aviso de erro** a cada
mudança enviada. Medido numa instalação real: **23 de 23 envios**, sempre o mesmo
aviso, enquanto todas as outras verificações passavam.

A causa não era defeito no que foi enviado. O passo que corta a versão precisa de
uma credencial que só existe no projeto de origem, e toda cópia nasce sem ela —
então ele morria na primeira linha, em todo envio, desde sempre.

Agora esse passo é **pulado** quando a credencial não existe, com uma explicação
no relatório dizendo que é o esperado e como cortar a versão à mão. Onde a
credencial existe, nada muda.

**A mesma armadilha, desarmada no relógio.** O disparo automático de tarefas
também exigia credencial, e ligá-lo sem ela faria a verificação falhar de poucos
em poucos minutos — a **pior enxurrada de avisos** que este sistema sabe
produzir. Agora ele avisa uma vez e para; num disparo manual, o erro continua
alto, porque ali há alguém esperando resposta.

**Por que isso importa mais do que parece:** alarme que toca sempre é
indistinguível de alarme quebrado. Recebendo aviso em toda mudança, a pessoa para
de abrir o aviso — e o dia em que a falha for real ela chega na mesma caixa, com
a mesma cara, e não é lida.
