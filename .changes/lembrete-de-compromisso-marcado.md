---
impacto: capacidade_nova
secao: adicionado
titulo: O follow-up avisa o cliente antes de um compromisso marcado
---
O construtor de fluxo ganhou um gatilho novo: **Antes de um compromisso marcado**. Escolha com quanta antecedência o fluxo começa — uma hora, um dia — e ele inscreve sozinho quem tem hora marcada na agenda, a tempo de a mensagem chegar antes.

O texto da mensagem aceita as mesmas variáveis das automações: `{{nome}}`, `{{agendamento.data}}`, `{{agendamento.hora}}`, `{{agendamento.tipo}}` e `{{agendamento.com_quem}}`. A hora sai no fuso do compromisso, não no do servidor. Chaves que este gatilho não conhece (`{{telefone}}`, `{{campo.x}}`) saem vazias no texto que usa as de cima — é a mesma regra das automações.

**Nada dispara sem você ligar.** O lembrete só vale para os tipos de atendimento com o botão «Ligar lembrete» acionado em Ajustes › Agenda, e todos nascem desligados — inclusive os que já existem. Compromisso marcado sem tipo nunca gera lembrete. Publicar o fluxo sem nenhum tipo ligado mostra um aviso na tela, em vez do «Fluxo publicado» de sempre.

**Um fluxo de lembrete por conta.** Publicar um segundo fluxo armado por compromisso é recusado, com o motivo escrito: os dois se anulariam, porque o de janela maior alcança o compromisso primeiro e o outro nunca dispara. Para ter «um dia antes» e «uma hora antes» ao mesmo tempo ainda falta trabalho.

Três comportamentos que valem saber antes de armar: **hora marcada tem prioridade** — se o contato estiver no meio de outro acompanhamento quando o lembrete vencer, aquele é cancelado, e o motivo fica escrito na linha do tempo dele; **remarcar devolve o lembrete** — mudar a hora faz o compromisso ser lembrado de novo, na hora nova; e o mesmo compromisso nunca lembra duas vezes, mesmo que o servidor fique fora do ar e volte.

A mensagem fala sempre **do compromisso que a disparou**, e não "do próximo da agenda do contato" — então quem tem duas coisas marcadas recebe um lembrete para cada, cada um com a sua hora.

Um limite conhecido: cancelar um compromisso **não** cancela um lembrete já em andamento. Num fluxo com espera, o cliente pode receber o aviso de algo que já foi desmarcado.
