import { test } from "@playwright/test";

/**
 * O AGENTE MARCA CONSULTA, E O EFEITO APARECE NA AGENDA — prova em tela da frente 4.
 *
 * ## Por que esta spec existe antes do código que ela testa
 *
 * A DECISÃO 21 permite que uma frente sem pixel feche declarando quem a prova em tela.
 * A 21.1 corrigiu o endereço para MCP: nenhuma tela chama uma ferramenta de IA — quem
 * chama é o modelo. Então a régua não é "arrume uma spec de outro que te cubra", é
 * **cliente MCP real age, e o efeito aparece na tela**.
 *
 * Molde: `tests/e2e/agente-organiza-operacao.spec.ts`, que já prova capacidade MCP
 * assim ("pela tela E pelo caminho real de um cliente MCP").
 *
 * ## ⚠️ NASCE `skip`, E ISSO É MARCADOR DE FRENTE ABERTA — não dívida escondida
 *
 * Quatro das cinco ferramentas do `CONTRATO-MCP-agenda.md` ainda não existem, e as três
 * de escrita dependem de rotas que o backend ainda não tem: medido em `c7cd171d`,
 * `app/api/v1/agenda/agendamentos/route.ts` exporta **só `POST`** — não há `PATCH` nem
 * `DELETE`, então remarcar e cancelar não têm caminho de produção para embrulhar.
 *
 * A DECISÃO 21.3 permite a spec pulada como marcador enquanto a frente está ABERTA. O
 * que ela NÃO permite é fechar com ela: `tests/unit/entrega-sem-tela-declara-quem-prova.test.ts`
 * reprova `.skip` assim que existir o `evidence/calendario/ENTREGA-frente-4-mcp.md`, que
 * é o artefato de FECHAMENTO. O mecanismo já distingue os dois momentos — por isso a
 * dívida pode ficar pendurada nele antes de existir código, que é a ordem certa.
 *
 * ## O que esta spec vai provar quando sair do `skip`
 *
 * 1. o agente marca consulta por MCP → o compromisso aparece na Agenda, com autoria `ai`;
 * 2. o agente desmarca → o horário volta a aparecer como livre para o próximo;
 * 3. **e o que impede esta wave de abrir buraco:** o agente NÃO consegue marcar em
 *    horário ocupado nem fora do expediente, provado pelo CAMINHO REAL. Mock não responde
 *    isso — a recusa nasce da leitura da jornada e do que já está marcado, e um mock do
 *    banco já teria passado por ela.
 *
 * ⚠️ O PAPEL DO TOKEN NÃO SERÁ ATALHO DE TESTE. As escritas de agenda pedem
 * `ai_operator` por PARIDADE com as rotas que elas espelham. O molde gasta um parágrafo
 * explicando isso na spec dele, e esta vai gastar também — senão a próxima pessoa lê
 * como afrouxamento.
 */
test.skip("o agente marca consulta e o efeito aparece na Agenda", () => {
  // Implementar quando `crm_book_appointment`, `crm_cancel_appointment` e as rotas
  // PATCH/DELETE de `agendamentos` existirem. Ver o cabeçalho para o que provar.
});
