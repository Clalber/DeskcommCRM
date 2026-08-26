# CAL-W0-MOTOR — a sabotagem, colada

> Medido em 2026-08-26 13:43 -0300 no worktree
> `/Users/rafaelmelgaco/wt/cal-api`, branch `cal/w1-api`,
> SHA `8fc8591e`, árvore limpa antes de começar
> (`git status --porcelain` vazio). Cada bloco abaixo é a saída literal do
> `vitest`, não um resumo dela.
>
> **Esta é a SEGUNDA rodada.** A primeira mediu o SHA `a3b22591`; depois disso
> os arquivos mudaram (um tipo renomeado, um trecho de código morto removido).
> Sabotagem medida sobre um arquivo que mudou depois não prova o arquivo de
> agora — os números bateram, mas quem confere merece a rodada certa, não a
> promessa de que a diferença era cosmética.

Teste que não vermelhece não é rede de segurança, é decoração. Cada
mecanismo do motor foi quebrado de propósito, um de cada vez, e a
**contagem foi prevista antes de rodar** — prever obriga a entender o que
o teste vigia; conferir depois só confirma o que aconteceu.

## Base — antes de qualquer sabotagem
```console
$ npx vitest run tests/unit/agenda-fuso.test.ts tests/unit/agenda-horarios-livres.test.ts
Tests  31 passed (31)
```

## Sabotagem 1 — o buffer não infla o compromisso ocupado

A que o despacho pediu nominalmente. Sem a inflação, o vizinho que encosta no
compromisso volta a ser oferecido.

**Previsto: 1 falha.**

```console
Tests  1 failed | 30 passed (31)
  - ❯ tests/unit/agenda-horarios-livres.test.ts (19 tests | 1 failed)
  - × com 15min de buffer dos dois lados, o vizinho que ENCOSTA também sai
  - ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:179:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Sabotagem 2 — `windows` vazio volta a significar 24/7

A régua do roteamento aplicada à agenda — o erro mais provável de quem vier
"unificar as duas leituras" da mesma coluna. Oferece consulta às 3 da manhã.

**Previsto: 1 falha.**

```console
Tests  1 failed | 30 passed (31)
  - ❯ tests/unit/agenda-horarios-livres.test.ts (19 tests | 1 failed)
  - × dia sem janela publicada é ZERO horário — e não 24/7
  - ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:92:19
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Sabotagem 3 — fuso ingênuo: meia-noite UTC no lugar da conversão

Tratar hora de parede como se fosse UTC — o defeito clássico de agenda.

**Previsto: ~14 falhas.**

```console
Tests  15 failed | 16 passed (31)
  - ❯ tests/unit/agenda-horarios-livres.test.ts (19 tests | 15 failed)
  - × o almoço parte o dia em duas janelas, e não sobra horário às 12h
  - × o último slot precisa CABER na janela: 50min de duração não gera um às 17:30
  - × o intervalo da grade é independente da duração
  - × sem buffer, só o horário do compromisso some
  - × com 15min de buffer dos dois lados, o vizinho que ENCOSTA também sai
  - × compromisso que termina exatamente quando o slot começa NÃO bloqueia (sem buffer)
  - × o aviso mínimo come o começo do dia
  - × a janela de agendamento corta o futuro distante
  - × horário que já passou não aparece, mesmo sem aviso mínimo
  - × exceção com horário ABRE um sábado que a jornada não tem
  - × exceção com horário SUBSTITUI a jornada do dia, não soma a ela
  - × a virada do horário de verão não desloca a hora de parede da jornada
  - × atendente e consultante em fusos diferentes veem o MESMO instante
  - × a jornada de um fuso, o compromisso em UTC: o conflito é resolvido no instante
  - × `de` e `ate` recortam: meio dia consultado devolve meio dia de horários
  - ⎯⎯⎯⎯⎯⎯ Failed Tests 15 ⎯⎯⎯⎯⎯⎯⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:116:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:132:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:144:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:162:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:179:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:193:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[6/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:208:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:224:73
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[8/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:238:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[9/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:272:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:288:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[11/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:314:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[12/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:336:30
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[13/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:356:44
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[14/15]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:386:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[15/15]⎯
```

## Sabotagem 4 — exceções de data ignoradas

O dia bloqueado volta a atender e o sábado aberto some.

**Previsto: 3 falhas.**

```console
Tests  3 failed | 28 passed (31)
  - ❯ tests/unit/agenda-horarios-livres.test.ts (19 tests | 3 failed)
  - × exceção que bloqueia o dia zera aquele dia, e só aquele
  - × exceção com horário ABRE um sábado que a jornada não tem
  - × exceção com horário SUBSTITUI a jornada do dia, não soma a ela
  - ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:257:30
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/3]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:272:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/3]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:288:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/3]⎯
```

## Sabotagem 5 — o corte do aviso mínimo

⚠️ **Eu rotulei errado a minha própria sabotagem.** Previ uma falha, caíram
duas — e as duas estão certas: aquela linha carrega DUAS regras, o aviso mínimo
e o piso do "horário que já passou". Apagá-la derruba as duas. A previsão
errada é o dado: quem prevê pelo rótulo, e não pela linha, subestima o alcance.

**Previsto: 1 falha — e o medido corrige a previsão.**

```console
Tests  2 failed | 29 passed (31)
  - ❯ tests/unit/agenda-horarios-livres.test.ts (19 tests | 2 failed)
  - × o aviso mínimo come o começo do dia
  - × horário que já passou não aparece, mesmo sem aviso mínimo
  - ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:208:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:238:26
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯
```

## Sabotagem 6 — o corte da janela de agendamento

Marcar para daqui a um ano volta a ser possível.

**Previsto: 1 falha.**

```console
Tests  1 failed | 30 passed (31)
  - ❯ tests/unit/agenda-horarios-livres.test.ts (19 tests | 1 failed)
  - × a janela de agendamento corta o futuro distante
  - ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
  - ❯ tests/unit/agenda-horarios-livres.test.ts:223:30
  - ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## Restaurado — a árvore volta ao commit, e o verde com ela
```console
$ git status --porcelain lib/agenda/    # (vazio)
Tests  31 passed (31)
```
