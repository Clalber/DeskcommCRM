/**
 * A PROVA EM TELA DA FRENTE 1 (API + motor) — ainda NÃO escrita, e por isso
 * existe como `skip` com motivo em vez de como promessa num relatório.
 *
 * ─── Por que este arquivo nasce vazio ─────────────────────────────────────
 *
 * A frente 1 é API: ela não tem pixel próprio. A DECISÃO 21 permite que uma
 * frente sem tela feche com prova de caminho real, DESDE QUE declare quem a
 * prova em tela — e a 21.3 fechou o furo dessa declaração: o endereço não é
 * citado num relatório que alguém precisa reler, é CRIADO aqui, para entrar em
 * `tests/unit/e2e-cobertura-completa.test.ts` como qualquer outra spec.
 *
 * O que falta para ela deixar de ser `skip`: a tela de marcar da frente 2
 * consumindo `GET /api/v1/agenda/horarios-livres` e o POST de criação. Enquanto
 * a tela não existe, não há clique para dirigir.
 *
 * ─── O que esta spec vai provar quando existir ────────────────────────────
 *
 * 1. A grade mostra os horários que a rota devolveu, no fuso de APRESENTAÇÃO de
 *    quem olha — não no fuso da jornada, e não no do servidor (que em produção é
 *    UTC, medido: `node:22-alpine` sem `tzdata` e o serviço `app` sem `TZ`).
 * 2. Marcar pela tela cria o agendamento e o horário SOME da grade sem F5.
 * 3. Um bloqueio de dia inteiro deixa o dia sem horário E a tela diz POR QUÊ —
 *    "você ainda não publicou seus horários" é diferente de "não tenho vaga", e
 *    as duas chegam como a mesma lista vazia se a tela não distinguir.
 * 4. Schedule mal configurado devolve 422 com motivo e a tela mostra o motivo,
 *    em vez de uma grade vazia silenciosa.
 */
import { test } from "@playwright/test";

test.skip("marcar um horário pela tela e vê-lo sumir da grade", async () => {
  // Bloqueada pela frente 2: a tela de marcar ainda não consome a rota.
  // Ver o cabeçalho deste arquivo para o que ela vai afirmar.
});
