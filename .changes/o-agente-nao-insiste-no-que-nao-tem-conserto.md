---
impacto: nada_mudou
secao: corrigido
titulo: O agente não insiste mais numa mensagem que não tem como sair
---

Quando o agente de IA tentava responder num **canal excluído**, ou para um
**contato sem endereço naquele canal**, o sistema tratava a falha como se fosse
temporária: refazia o raciocínio do agente e tentava outra vez, até cinco vezes.
Nenhuma delas podia dar certo — o problema só se resolve com alguém agindo.

Na prática isso custava cinco chamadas de inteligência artificial para chegar ao
mesmo lugar, e o operador via a mesma mensagem falhar cinco vezes na conversa.

Agora esses dois casos param na primeira tentativa, e o **aviso na Central**
continua sendo aberto com o motivo escrito. Falhas que de fato passam com o
tempo — canal fora do ar, rede instável, limite do provedor — seguem sendo
retentadas como antes; basta uma delas no lote para tudo voltar a ser retentado.

**No mesmo conserto**, dois ajustes internos que não mudam nada para quem usa a
plataforma: a documentação técnica dizia que a idempotência dependia de um
serviço externo — ela sempre foi guardada no próprio banco —, e dois testes
automatizados deixaram de depender do horário em que a verificação roda.
