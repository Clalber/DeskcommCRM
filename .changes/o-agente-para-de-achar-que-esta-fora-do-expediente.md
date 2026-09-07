---
impacto: nada_mudou
secao: corrigido
titulo: O agente para de achar que está fora do expediente por causa do fuso
---

O agente recebia o horário de cada mensagem do histórico em UTC, e não no fuso
configurado na organização. Num fuso de Brasília isso adianta o relógio em três
horas: uma conversa das 20h chegava até ele como se fossem 23h.

O efeito aparecia como recusa educada. Perguntado se dava para atender, ele
respondia que já estava fora do horário — com a loja aberta e alguém do outro
lado esperando. Não havia erro em lugar nenhum: o dado estava certo, só que
medido no fuso errado.

Agora o horário chega ao agente no fuso da organização. Quando o fuso está
ausente ou é inválido, o padrão do produto (`America/Sao_Paulo`) é usado em vez
de a montagem do contexto falhar.
