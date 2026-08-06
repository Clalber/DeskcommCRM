# O passo 6 levou os 30% a zero? **Não.**

> Medido em 2026-08-06, worktree `DeskcommCRM-tres-papeis`, SHA `16386d0e` (árvore limpa).
> Modelo `gpt-5.6-terra` — o **mesmo** da linha de base, com a chave OpenAI real.
> Instrumento: [`remedir-com-operador.ts`](./remedir-com-operador.ts) · turnos crus em
> [`remedicao-passo6.json`](./remedicao-passo6.json).

---

## A resposta, em uma tabela

| configuração | ferramentas no contexto | vazou | taxa |
|---|---:|---:|---:|
| **A · CONTROLE** (linha de base replicada) | 15 | 1/10 | **10,0%** |
| **B · passo 6 como entregue** (nativas saem) | 14 | 1/10 | **10,0%** |
| **C · cura completa** (operação sai do Conversador) | 7 | 1/10 | **10,0%** |

**As três deram o mesmo número, e vazaram no MESMO cenário** (`3-diagnostico-de-entrada`) — que é
também um dos três que vazaram na linha de base.

---

## ⚠️ Primeiro: o controle NÃO reproduz a linha de base

A configuração A deveria dar ~30% e deu **10%**. Sem isso resolvido, nenhuma comparação com o
número antigo é legítima — e a causa está identificada:

**O instrumento não executa as ferramentas.** Ele chama o modelo com `tool_choice: 'none'`, então o
modelo nunca recebe *resultado* de ferramenta. Isso exercita as portas 1 e 2 do vazamento (nome e
descrição no contexto), mas **não a porta 3** — o DADO retornado.

E a porta 3 era a maioria da linha de base:

| turno da linha de base | o que vazou | porta |
|---|---|---|
| `3-diagnostico-de-entrada` | `webhook` | **1/2** — nome da ferramenta |
| `7-automacoes-e-falhas` | `unsafe_url:https_required` | **3** — dado retornado |
| `9-quem-pode-mexer` | `admin`, `manager`, UUIDs | **3** — dado retornado |

**1 de 3 vazamentos vinha da porta que este instrumento mede — e ele mediu exatamente 1 de 10.**
A calibração é parcial e coerente, não aleatória. Mas é parcial, e o número de cima tem de ser lido
assim: *taxa da porta 1/2, não taxa total*.

---

## O que a medição diz, dentro do que ela mede

**1. O passo 6, como entregue, não mudou nada.** A = B = 10%, mesmo cenário. Era o esperado depois
de olhar os dados: o passo 6 entrega ao Operador as ferramentas NATIVAS com equivalente
(`update_lead_state`, `schedule_followup`), e **nenhum dos vazamentos veio delas**.

**2. Tirar as ferramentas de operação também não zerou.** Em C, com sete ferramentas a menos e
nenhuma de webhook/automação no contexto, o modelo **ainda disse `webhook`**.

Este é o achado que interessa: **parte do vocabulário não vem do contexto, vem do modelo.** Ele sabe
o que é um webhook porque isso está no mundo dele, não porque leu numa `description`. A frase
"não mostrar" fecha as portas 1, 2 e 3 — não fecha o modelo.

**3. Logo, a promessa do passo 6 — "o vazamento vai a zero por ausência, não por filtro" — não se
sustenta como escrita.** Ausência de ferramenta reduz a superfície; não elimina o vazamento.

---

## O que isso muda no desenho (e o que confirma)

A conclusão da linha de base era: **o prompt é a variável dominante** (30% com prompt de operador,
0% com prompt de atendimento, mesmas ferramentas). Esta medição a **reforça** por outro caminho:
mexer só nas ferramentas, mantendo o prompt, não move a agulha.

O que o épico dos três papéis entrega de verdade, então, não é "zero por ausência". É:

- o dono do negócio **deixa de precisar** escrever "atenda E mantenha a casa em ordem" no prompt do
  Conversador, porque agora existe um papel para isso — e é a troca desse prompt que a medição já
  mostrou levar 30% → 0%;
- o gate continua sendo a **rede** para o resíduo que vem do próprio modelo (o `webhook` do caso C),
  que nenhuma remoção de ferramenta alcança.

---

## O que NÃO foi medido (declarado, não estimado)

1. **A taxa com as ferramentas EXECUTADAS.** É o que fecharia a calibração do controle e daria a
   taxa total. Exige o caminho com MCP real contra dados de verdade — worker + banco.
2. **O efeito da troca de prompt no desenho novo.** A hipótese central acima (o dono deixa de
   escrever o prompt híbrido) não foi testada: é mudança de USO, e medi-la exige decidir qual prompt
   o produto passa a sugerir.
3. **Outros modelos.** Tudo em `gpt-5.6-terra`.
4. **n = 10 por configuração.** Uma diferença de um turno move a taxa em 10 pontos; este tamanho
   serve para comparar configurações lado a lado, não para afirmar uma taxa com precisão.

---

## O instrumento reportou sucesso enquanto estava quebrado — registrado

A primeira execução imprimiu **`0,0%` nas três configurações**. Parecia o passo 6 funcionando
perfeitamente.

As 30 chamadas tinham voltado **HTTP 400** (`Function tools with reasoning_effort are not supported
for gpt-5.6-terra in /v1/chat/completions`). Os 30 textos vieram vazios, o detector não achou nada
em texto vazio, e a divisão por `cenarios.length` produziu zero — com cara de resultado.

O erro estava capturado no campo `erro` de cada linha; o resumo só imprimia a taxa. **Instrumento
quebrado devolvendo zero é indistinguível de ausência do defeito — e zero era exatamente o número
que se queria ver.** O script agora recusa calcular taxa quando há turnos que não rodaram, e sai
com código 1.
