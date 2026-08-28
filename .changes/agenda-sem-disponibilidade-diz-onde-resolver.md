---
impacto: nada_mudou
secao: corrigido
titulo: "Agenda sem responsável configurado: o aviso agora diz onde resolver"
---

Numa instalação nova, ou quando um novo tipo de agendamento aponta para alguém
que ainda não cadastrou horário de atendimento, tentar ver ou marcar um horário
mostrava "Invalid input: expected object, received undefined" — frase correta
para quem lê o código e inútil para quem opera a clínica.

Agora a mensagem diz o que realmente falta e onde resolver: "A disponibilidade
deste responsável ainda não foi configurada. Configure em Equipe →
Atendimento." Continua sendo a mesma recusa de antes (nenhum horário é
oferecido enquanto isso não for configurado) — só a explicação ficou legível.

Quem já tinha disponibilidade cadastrada não percebe nenhuma diferença.
