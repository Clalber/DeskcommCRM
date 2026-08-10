import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PainelDeSeguranca } from "@/app/app/ai/agents/[id]/_components/PainelDeSeguranca";
import {
  CONFERENCIAS_DE_SAIDA,
  CONFERENCIA_DE_ENTRADA,
} from "@/lib/ai/guardrails/lista-de-conferencia";

/**
 * O painel do terceiro papel (spec 16 §3.3 e §6).
 *
 * O que estes casos guardam é POLÍTICA, não layout. O painel existe porque a
 * cadeia de conferências rodava e o dono do negócio não sabia — e a decisão de
 * produto que o acompanha é que quase nada ali é escolha dele. Um interruptor que
 * queima o número do cliente não é preferência; **oferecer** o controle já ensina
 * que é opcional.
 *
 * A divisão de trabalho com o teste irmão importa:
 * `seguranca-lista-casa-com-a-cadeia` guarda a LISTA (o que a tela mostra é o que
 * o motor roda); este guarda a POLÍTICA (o que a tela oferece como escolha).
 * Sabotagens diferentes acendem luzes diferentes, e é isso que mostra que os dois
 * medem coisas distintas em vez de um pegar carona no outro.
 */
describe("painel de segurança — o que se confere antes de enviar", () => {
  it("renderiza TODOS os itens da lista, na ordem — nenhum fica pelo caminho", () => {
    render(<PainelDeSeguranca />);

    // ⚠️ ESTE CASO NÃO GUARDA A CADEIA, e o nome anterior dizia que sim.
    // Descoberto por sabotagem: removi uma conferência da lista pura e este caso
    // seguiu VERDE, porque ele renderiza A PARTIR da lista e compara COM a lista
    // — auto-referente. O que ele guarda de verdade é o componente: um `.slice()`,
    // um filtro ou um `key` duplicado que perdesse item no caminho reprova aqui.
    // Quem amarra a lista à cadeia que roda é
    // `seguranca-lista-casa-com-a-cadeia.test.ts`, e essa separação é de propósito
    // (componente não importa `pg`).
    //
    // A ordem é informação: a primeira que barra interrompe as seguintes. Ler o
    // DOM na ordem em que ele foi montado é o que prova isso — comparar conjuntos
    // passaria com a lista embaralhada.
    const itens = screen.getAllByTestId(/^conferencia-[a-z_]+$/);
    const nomes = itens.map((el) => el.getAttribute("data-testid")?.replace("conferencia-", ""));
    expect(nomes).toEqual([
      ...CONFERENCIAS_DE_SAIDA.map((c) => c.nome),
      CONFERENCIA_DE_ENTRADA.nome,
    ]);
  });

  it("NENHUM interruptor — o que não é escolha não se apresenta como escolha", () => {
    const { container } = render(<PainelDeSeguranca />);

    // Medida por ferramenta, não a olho: qualquer controle interativo de ligar e
    // desligar conta. Um switch aqui hoje seria decorativo — a decisão das duas
    // camadas configuráveis mora no servidor, e a tela grava nada. Controle que a
    // tela oferece e o motor ignora é o defeito, não a ausência dele.
    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(0);
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
  });

  it("cada conferência sem escolha DIZ por que não se desliga", () => {
    render(<PainelDeSeguranca />);

    const fixas = CONFERENCIAS_DE_SAIDA.filter((c) => c.escolha === null);
    // 9 das 10 hoje. A contagem entra na asserção de propósito: se alguém tornar
    // uma delas "configurável", este número muda e a mudança tem de ser deliberada.
    expect(fixas).toHaveLength(9);
    for (const c of fixas) {
      const linha = screen.getByTestId(`conferencia-${c.nome}-fixa`);
      expect(linha.textContent).toContain("não se desliga");
      // Proibição sem razão é o que faz alguém procurar como contornar.
      expect(linha.textContent?.length ?? 0).toBeGreaterThan(50);
    }
  });

  it("as configuráveis dizem o CUSTO e de onde a decisão vem hoje", () => {
    render(<PainelDeSeguranca />);

    for (const c of [...CONFERENCIAS_DE_SAIDA, CONFERENCIA_DE_ENTRADA]) {
      if (c.escolha === null) continue;
      const linha = screen.getByTestId(`conferencia-${c.nome}-escolha`);
      expect(linha.textContent).toContain("consulta ao modelo");
      // Sem esta frase o usuário procura o interruptor que não existe e conclui
      // que a tela está quebrada.
      expect(linha.textContent).toContain("configuração do servidor");
    }
  });

  it("a conferência de ENTRADA aparece separada da cadeia de saída", () => {
    render(<PainelDeSeguranca />);
    expect(screen.getByText(/antes de o assistente ler/i)).toBeTruthy();
    expect(screen.getByTestId(`conferencia-${CONFERENCIA_DE_ENTRADA.nome}`)).toBeTruthy();
  });

  it("a tela não fala a NOSSA língua", () => {
    // O mesmo defeito que a spec 16 existe para matar, um nível acima: se o
    // vocabulário interno vaza para quem CONFIGURA, ele vaza de novo para quem é
    // atendido. E seria irônico aqui, no painel da conferência que barra
    // justamente isso.
    const { container } = render(<PainelDeSeguranca />);
    const texto = (container.textContent ?? "").toLowerCase();
    for (const jargao of ["gate", "before_send", "payload", "guardrail", "veto", "_id"]) {
      expect(texto, `vocabulário interno na tela: ${jargao}`).not.toContain(jargao);
    }
  });
});
