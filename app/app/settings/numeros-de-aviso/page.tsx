/**
 * Números de aviso — quem a automação pode avisar fora da plataforma.
 *
 * ⚠️ Esta tela existe porque a lista é uma AMARRA de segurança, não uma
 * conveniência: a ação "Avisar um número meu" só envia para número daqui. Sem
 * ela, um erro de digitação numa regra viraria disparo de WhatsApp pelo número
 * da empresa para um desconhecido — e o motor de automação viraria um enviador
 * de mensagens arbitrário.
 */
import type { Metadata } from "next";

import { NumerosDeAvisoClient } from "./NumerosDeAvisoClient";

export const metadata: Metadata = { title: "Números de aviso" };

export default function Page() {
  return <NumerosDeAvisoClient />;
}
