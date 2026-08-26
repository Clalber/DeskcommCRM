/**
 * A PROVA EM TELA DA FRENTE 3 (Google Calendar BYO) — ainda NÃO escrita, e por
 * isso existe como `skip` com motivo em vez de como promessa num relatório.
 *
 * ─── Por que este arquivo nasce vazio, e por que nasce AGORA ──────────────
 *
 * A frente 3 é OAuth e worker: ela não tem pixel próprio. O botão "Conectar
 * Google" e a faixa de estado da conexão moram na tela da Agenda, que é da
 * frente 2. A DECISÃO 21 deixa uma frente sem tela fechar com prova de caminho
 * real DESDE QUE declare quem a prova em tela — e a 21.3 fechou o furo dessa
 * declaração: o endereço não é citado num relatório que alguém precisa reler,
 * concordar e lembrar. É criado aqui, e passa a existir para
 * `tests/unit/e2e-cobertura-completa.test.ts` como qualquer outra spec.
 *
 * Eu tinha proposto o nome e escrito "se o VPS preferir outro, a escolha é
 * dele". O diagnóstico estava certo e o remédio era fraco: nome combinado por
 * mensagem é exatamente a transferência que evapora. Quem for dono da tela pode
 * renomear, mover ou reescrever isto à vontade — o que ele não consegue é fazer
 * a obrigação sumir em silêncio.
 *
 * ─── A ORDEM DOS DOIS CASOS NÃO É ACIDENTAL ───────────────────────────────
 *
 * O caso SEM CHAVE vem primeiro de propósito. Ele não é borda: é a primeira
 * tela que 100% dos self-hosters vê, porque `GOOGLE_CALENDAR_CLIENT_ID` e
 * `GOOGLE_CALENDAR_CLIENT_SECRET` são opcionais (DECISÃO 3.1) e nenhuma
 * instalação nova as tem. Uma spec que só cobrisse o caminho feliz deixaria sem
 * prova justamente o estado que todo mundo encontra no dia 1.
 *
 * ─── O que estas specs vão provar quando existirem ────────────────────────
 *
 * 1. SEM CHAVE NA INSTALAÇÃO: a tela da Agenda abre inteira, o botão "Conectar
 *    Google" NÃO aparece, e no lugar dele há uma linha dizendo o que falta e
 *    onde obter. O que se prova aqui é que a ausência de configuração degrada
 *    com explicação em vez de derrubar o módulo — `configuracaoDoGoogle()`
 *    devolve `null` justamente para isto, e há teste unitário de que ela não
 *    lança. O que falta é a tela consumir esse `null`.
 *
 * 2. COM CHAVE: clicar "Conectar Google" leva ao consentimento (o destino é
 *    `accounts.google.com`, com `access_type=offline` e `prompt=consent` — os
 *    dois parâmetros sem os quais a reconexão volta sem `refresh_token` e a
 *    integração morre em uma hora); voltar do consentimento grava a conexão; e
 *    a faixa da Agenda passa a dizer que a agenda está conectada, com o e-mail
 *    da conta.
 *
 * ─── O que falta para deixarem de ser `skip` ──────────────────────────────
 *
 * Da minha frente: nada nas rotas — `connect` e `callback` existem e têm 17
 * casos unitários, incluindo sabotagem da guarda que separa organizações.
 * Falta da frente 2: a tela da Agenda renderizar o botão e a faixa de estado.
 * Enquanto não houver botão, não há clique para dirigir.
 *
 * E falta, para o caso 2 rodar em CI de verdade, uma conta Google de teste com
 * consentimento pré-aprovado — que é o motivo de esta spec entrar em
 * `FORA_DO_CI` no `e2e.yml`, e não de ela ficar sem existir.
 */
import { test } from "@playwright/test";

test.skip("sem chave do Google, a Agenda abre e explica o que falta", async () => {
  // Bloqueada pela frente 2: a tela ainda não consome `googleEstaConfigurado()`.
  // Ver o cabeçalho para o que ela vai afirmar.
});

test.skip("conectar a agenda do Google pela tela e ver a faixa mudar", async () => {
  // Bloqueada pela frente 2 (o botão) e por uma conta Google de teste.
  // Ver o cabeçalho.
});
