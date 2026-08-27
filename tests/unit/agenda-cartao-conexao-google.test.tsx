/**
 * O CARTÃO DA CONEXÃO — e o ramo que existia sem nunca ser alcançado.
 *
 * `contaConectada` é declarado nas props desde que o cartão nasceu, e o único
 * call site (`_client.tsx`) NUNCA o passava. Medido: `grep -rn "contaConectada="`
 * devolvia zero. Consequências que se compõem:
 *
 *   1. O ramo `google-conectado` era código morto — nenhum teste o citava.
 *   2. O botão "Conectar Google" NUNCA sumia depois de conectar, então a segunda
 *      conexão era um clique no mesmo botão de sempre. Com `onConflict` por
 *      `(org, user, provider, account_email)`, outra conta = outra linha.
 *
 * Estes casos existem para que o ramo não volte a ser inalcançável: eles testam
 * o PAR (com conta → desconectar e sem "conectar"; sem conta → o inverso), que é
 * o que impede um `true` cravado de passar.
 */
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CartaoDaConexaoGoogle } from "@/app/app/agenda/_components/CartaoDaConexaoGoogle";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

afterEach(cleanup);

describe("cartão da conexão do Google", () => {
  it("com conta conectada: mostra a conta E oferece desconectar", () => {
    render(<CartaoDaConexaoGoogle configurado falta={[]} contaConectada="ana@clinica.com.br" />);
    expect(screen.getByTestId("google-conectado")).toBeTruthy();
    expect(screen.getByText("ana@clinica.com.br")).toBeTruthy();
    expect(
      screen.getByTestId("desconectar-google"),
      "conectar sem poder desconectar deixa o refresh token da conta pessoal no " +
        "banco sem via de produto que o apague",
    ).toBeTruthy();
  });

  it("...e o botão de CONECTAR some — senão a segunda conexão é um clique", () => {
    render(<CartaoDaConexaoGoogle configurado falta={[]} contaConectada="ana@clinica.com.br" />);
    expect(screen.queryByTestId("conectar-google")).toBeNull();
  });

  it("sem conta: oferece conectar e NÃO oferece desconectar", () => {
    // O outro lado do par. Sem ele, um `contaConectada` cravado como verdadeiro
    // passaria nos dois casos acima e ninguém veria.
    render(<CartaoDaConexaoGoogle configurado falta={[]} contaConectada={null} />);
    expect(screen.getByTestId("conectar-google")).toBeTruthy();
    expect(screen.queryByTestId("desconectar-google")).toBeNull();
    expect(screen.queryByTestId("google-conectado")).toBeNull();
  });

  it("sem as credenciais da instalação: nenhum dos dois, e diz o que falta", () => {
    render(
      <CartaoDaConexaoGoogle
        configurado={false}
        falta={["GOOGLE_CALENDAR_CLIENT_ID"]}
        contaConectada="ana@clinica.com.br"
      />,
    );
    // A ordem dos ramos importa: quem não configurou a instalação não pode ver
    // "desconectar" só porque há linha no banco.
    expect(screen.getByTestId("google-nao-configurado")).toBeTruthy();
    expect(screen.getByTestId("o-que-falta").textContent).toContain("GOOGLE_CALENDAR_CLIENT_ID");
    expect(screen.queryByTestId("desconectar-google")).toBeNull();
  });
});
