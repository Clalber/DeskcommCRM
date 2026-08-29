---
impacto: nada_mudou
secao: corrigido
titulo: Salvar a Proteção de envio sem preencher a data volta a funcionar
---

Em **Conexões → Proteção de envio**, ajustar a janela de horários e salvar **sem**
preencher "número em uso desde" devolvia **"Falha ao salvar os knobs."** e não
salvava nada — nem os campos que você tinha mexido.

A tela sempre disse que a data é opcional, e é mesmo: em branco, o número passa a
ser tratado como recém-criado. O que acontecia é que o sistema mandava a data
"vazia" de um jeito que o banco recusava, em vez de simplesmente não mandá-la.

A mensagem de erro também melhorou. Antes ela dizia só "falha", sem indicar o
campo — agora traz o motivo que o banco deu, para quem administra saber o que
corrigir em vez de tentar às cegas.
