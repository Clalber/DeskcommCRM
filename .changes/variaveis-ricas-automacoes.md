---
impacto: capacidade_nova
secao: adicionado
titulo: Variaveis de agendamento e etapa em automacoes de lead
---
Automações de lead ganham variáveis novas nas mensagens: agendamento (data, hora, profissional, tipo de consulta), etapa, funil, responsável, qualificação e campos personalizados. Valem em qualquer gatilho que resolva um lead — não só na mudança de etapa — e tanto no envio ao cliente quanto no aviso para um número seu. Dados internos (responsável, qualificação, anotações e profissional do agendamento) são bloqueados nas mensagens ao CLIENTE e liberados só nos avisos internos.

**Muda o comportamento de regras que já existem:** uma mensagem que use variável de agendamento e não encontre reunião marcada para o futuro deixa de ser enviada, em vez de sair com o campo em branco. A automação registra o passo como pulado, com o motivo escrito, na aba Atividade. Vale para reunião pendente ou confirmada, com dez minutos de carência para a que acabou de começar.

Nos gatilhos de contato e de mensagem recebida, a automação passou a localizar o negócio aberto do contato — então a ação "avisar outro sistema (webhook)" leva os dados do lead no corpo, onde antes ia sem eles.

**O agente de IA passa a poder gravar campos personalizados** do lead pela ferramenta `crm.update_lead`. A gravação mescla com o que já existe (não apaga campo preenchido) e aceita qualquer chave, inclusive as que o funil não declara — essas ficam disponíveis para as automações lerem, mas não aparecem na tela do lead.
