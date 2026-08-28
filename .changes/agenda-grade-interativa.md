---
impacto: capacidade_nova
secao: adicionado
titulo: A agenda virou agenda — clicar num horário marca, arrastar um card remarca
---

A grade da Agenda mostrava a semana e não aceitava nada: clicar num espaço vazio
não fazia nada, e arrastar um compromisso não fazia nada. Para marcar era preciso
sair da grade, abrir "Novo agendamento" e escolher a data de novo no
mini-calendário — mesmo tendo acabado de apontar para o horário na tela.

Agora a grade responde:

- **Clicar num horário livre abre a marcação já naquele horário.** Os horários
  que aceitam clique são exatamente os que você publicou em Equipe › Atendimento
  — os mesmos que o agente de IA oferece ao cliente. A tela não inventa horário:
  se não está publicado, não é clicável.
- **Horário que não aceita marcação diz por quê**, em vez de ficar apagado sem
  explicação: "você ainda não publicou seus horários", "já há um compromisso
  neste horário", "fora dos horários que você publicou".
- **Arrastar um compromisso para outro horário remarca**, com uma confirmação
  antes — quem foi atendido recebe aviso da mudança, então o gesto não consuma
  sozinho. Soltar fora dos horários publicados é recusado com o motivo, e o
  compromisso volta para onde estava; se o servidor recusar, ele volta também.
- **Quem usa teclado remarca do mesmo jeito**: com o compromisso em foco,
  `Alt + ↑/↓` salta de vaga em vaga, `Alt + ←/→` muda de dia, `Enter` confirma e
  `Esc` desfaz.

Nada muda no que já estava marcado, e nada precisa ser configurado para isto
funcionar — se a sua equipe já publicou os horários de atendimento, a grade já
está clicável.
