---
impacto: nada_mudou
secao: corrigido
titulo: Quando o Google recusa a agenda, a tela passa a dizer o motivo
---

Conectar a agenda do Google falhava com **"Não consegui ler os dados da conta"**
e o conselho **"Tente de novo"**. Medido em produção: três tentativas seguidas,
as três idênticas, e nenhuma tinha como dar certo.

O Google devolvia o motivo — e o sistema jogava fora. No registro ficava apenas
`HTTP 403`, sem a frase que explica o quê. Sem ela não havia como diagnosticar
sem adivinhar.

Pior que a falta de diagnóstico era o conselho errado. Esse tipo de recusa
**nunca passa sozinho**, e mandar tentar de novo faz a pessoa repetir para
sempre um caminho fechado, ocupando o lugar da instrução que resolveria.

Agora a recusa por permissão tem tela própria, dizendo a causa mais comum — a
API do Google Agenda desligada no projeto do Google Cloud da instalação — e onde
ligá-la. O motivo exato que o Google devolveu passa a ficar registrado.
