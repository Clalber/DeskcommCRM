---
impacto: nada_mudou
secao: corrigido
titulo: O aprendizado do agente volta a rodar, com o modelo que você escolheu
---
O ciclo que faz o agente aprender com os próprios atendimentos estava parado. Ele tinha dois modelos escritos direto no código, de um fornecedor específico, e a instalação que usasse outro via toda rodada falhar com "modelo inválido" — todo dia, em silêncio, com a tela de Propostas parada e sem nada explicando por quê.

Agora os dois passos — **Avaliar o próprio atendimento** e **Extrair a lição** — usam o modelo escolhido em Provedores de IA, como todos os outros pontos já faziam. Nada a fazer: quem já tem um modelo padrão na instalação continua igual.

Se a tela de Propostas seguir parada, vale conferir se esses dois pontos têm modelo escolhido. Quando falta, a mensagem de erro agora **diz qual ponto configurar**, em vez de citar um modelo que o seu fornecedor nunca reconheceu.

Um detalhe que só aparece para quem já usava: o registro de qual modelo julgou cada atendimento vinha errado, com o fornecedor fixo no código em vez do que realmente rodou. Vereditos antigos seguem com a anotação errada; os novos gravam o modelo de verdade.
