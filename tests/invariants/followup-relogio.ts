/**
 * O relógio que os invariantes de follow-up injetam no engine — e por que ele
 * NÃO é `new Date()`.
 *
 * São dois relógios no caminho, e só um decide. O engine grava `next_eval_at`
 * com o relógio do PROCESSO (o `clock` injetado): um `advance` grava
 * `clock()`, querendo dizer "pronto para o próximo passo agora". Quem lê é o
 * claim, em SQL, perguntando `next_eval_at <= now()` — o relógio do POSTGRES.
 *
 * MEDIDO nesta base (25 iterações replicando `trigger → end`, medindo o estado
 * IMEDIATAMENTE ANTES do claim, que é o instante que decide):
 *
 *     5 de 25 ticks reclamaram ZERO
 *     nas 5, `next_eval_at - now()` era POSITIVO: 7,1 / 7,8 / 10,6 / 10,7 / 13,2 ms
 *     nas 5, `claimed_until` era null e `status` era 'active'
 *
 * Correlação perfeita: o instante gravado pelo processo ainda é FUTURO para o
 * banco, o enrollment não é devido, o tick devolve `claimed: 0`. Uma medição
 * anterior minha, feita DEPOIS do claim, mostrou 0 de 25 no futuro e quase me
 * fez descartar a hipótese — medir o instante errado responde outra pergunta.
 *
 * Em PRODUÇÃO isso não é defeito e não se conserta aqui: o tick seguinte vem um
 * minuto depois (`docker-compose.prod.yml`), e 13ms somem nesse intervalo. O
 * problema é exclusivo de teste, onde dois ticks são consecutivos — e o sintoma
 * (`expected 0 to be greater than or equal to 1`) imita exatamente o de vaga
 * roubada por outro arquivo, que é uma causa real e diferente. Foi por essa
 * semelhança que ele sobreviveu a duas rodadas de conserto: reproduzido 3 vezes
 * em 12 execuções do teste SOZINHO, em banco fresco, sem outro arquivo por
 * perto — o que refuta a contaminação e obriga a olhar para dentro.
 *
 * Ancorar o relógio do teste atrás do banco resolve a CLASSE inteira de uma vez.
 * A alternativa seria empurrar `next_eval_at` à mão entre cada par de ticks —
 * são 42 chamadas de `runFollowupTick` em três arquivos, e bastaria esquecer uma
 * para o vermelho intermitente voltar por onde ninguém está olhando.
 */

/**
 * Folga de uma ordem de grandeza sobre o maior desvio observado (13,2ms), e duas
 * ordens ABAIXO da menor tolerância das asserções de tempo destes arquivos (2s).
 * Nada aqui depende do valor exato: ele só precisa ser maior que o desvio entre
 * os dois relógios e menor que a menor janela que os testes medem.
 */
export const ATRASO_DO_RELOGIO_DE_TESTE_MS = 250;

/**
 * Relógio para os deps do engine nos testes: o instante do processo, deslocado
 * para trás o suficiente para que tudo que o engine marca como "pronto agora"
 * também esteja pronto para o `now()` do Postgres.
 */
export function relogioAncoradoNoBanco(): () => Date {
  return () => new Date(Date.now() - ATRASO_DO_RELOGIO_DE_TESTE_MS);
}
