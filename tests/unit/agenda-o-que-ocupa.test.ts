/**
 * O QUE OCUPA UM HORÁRIO — e as três decisões que erram em silêncio se invertidas.
 *
 * O motor recebe uma lista de `Ocupado` e não pergunta de onde veio. Quem
 * decide o que entra nessa lista é este arquivo, e cada regra aqui tem um
 * desfecho concreto do lado de fora: oferecer um horário que não existe, ou
 * esconder um que existe.
 *
 * A assimetria que governa as três: **oferecer de menos é recuperável; marcar
 * em cima não é.** Um horário perdido volta quando alguém remarca. Um paciente
 * chegando para uma consulta que não existe custa a confiança, e não tem
 * desfazer.
 */
import { describe, expect, it } from "vitest";

import { ocupadosDoDono, type LinhaDeAgendamento, type LinhaDeEventoExterno } from "@/lib/agenda/ocupados";

const jan = (h: number) => new Date(`2026-03-09T${String(h).padStart(2, "0")}:00:00Z`);

const agendamento = (status: string, h = 12): LinhaDeAgendamento => ({
  starts_at: jan(h).toISOString(),
  ends_at: jan(h + 1).toISOString(),
  status,
});

const externo = (
  transparency: string,
  status: string,
  situacaoDaConexao: string,
  h = 15,
): LinhaDeEventoExterno => ({
  starts_at: jan(h).toISOString(),
  ends_at: jan(h + 1).toISOString(),
  transparency,
  status,
  situacaoDaConexao,
});

describe("agendamentos do próprio CRM", () => {
  it("confirmado e concluído ocupam", () => {
    const r = ocupadosDoDono([agendamento("confirmed"), agendamento("completed", 14)], []);
    expect(r.ocupados).toHaveLength(2);
  });

  it("PENDENTE ocupa — senão dois pacientes pedem o mesmo horário", () => {
    // "Aguardando confirmação" é um pedido em cima daquele horário. Não contar
    // faria o segundo pedido ser aceito e um dos dois levar bolo.
    expect(ocupadosDoDono([agendamento("pending")], []).ocupados).toHaveLength(1);
  });

  it("cancelado NÃO ocupa — o horário voltou a existir", () => {
    expect(ocupadosDoDono([agendamento("cancelled")], []).ocupados).toEqual([]);
  });

  it("não compareceu NÃO ocupa horário futuro", () => {
    expect(ocupadosDoDono([agendamento("no_show")], []).ocupados).toEqual([]);
  });

  it("status desconhecido OCUPA — falha fechada na ação", () => {
    // Vocabulário aberto: se alguém acrescentar uma situação no banco e
    // esquecer daqui, o desfecho seguro é bloquear, não oferecer.
    expect(ocupadosDoDono([agendamento("um_status_que_nao_existe_ainda")], []).ocupados).toHaveLength(1);
  });
});

describe("eventos que vieram do Google", () => {
  it("opaco e confirmado ocupa", () => {
    expect(ocupadosDoDono([], [externo("opaque", "confirmed", "healthy")]).ocupados).toHaveLength(1);
  });

  it("TRANSPARENTE não ocupa — é o 'livre' do Google", () => {
    // Quem marca um evento como "disponível" na agenda do Google está dizendo
    // que aceita compromisso por cima. Contar isso esconderia o dia inteiro de
    // quem usa a agenda para anotar lembretes.
    expect(ocupadosDoDono([], [externo("transparent", "confirmed", "healthy")]).ocupados).toEqual([]);
  });

  it("cancelado no Google não ocupa; TENTATIVO ocupa", () => {
    expect(ocupadosDoDono([], [externo("opaque", "cancelled", "healthy")]).ocupados).toEqual([]);
    expect(ocupadosDoDono([], [externo("opaque", "tentative", "healthy")]).ocupados).toHaveLength(1);
  });
});

describe("a conexão expirada — DECISÃO 3.2, na versão corrigida", () => {
  it("evento de conexão EXPIRADA CONTINUA ocupando", () => {
    // A primeira versão da decisão mandava parar de contar, com a justificativa
    // de que contar "marcaria em cima de compromisso real". O argumento estava
    // invertido: PARAR de contar é que causa o marcar em cima — o compromisso
    // segue existindo no Google, só parou de ser sincronizado.
    for (const situacao of ["token_expired", "scope_missing", "rate_limited", "error", "disconnected"]) {
      const r = ocupadosDoDono([], [externo("opaque", "confirmed", situacao)]);
      expect({ situacao, ocupa: r.ocupados.length }).toEqual({ situacao, ocupa: 1 });
    }
  });

  it("e a defasagem é DEVOLVIDA, não engolida", () => {
    // Falha fechada na ação, aberta na informação: a tela precisa poder dizer
    // "sua agenda do Google desconectou; estes horários podem estar defasados".
    const r = ocupadosDoDono([], [externo("opaque", "confirmed", "token_expired")]);
    expect(r.fontesDefasadas).toEqual(["token_expired"]);
  });

  it("conexão saudável não gera aviso de defasagem", () => {
    const r = ocupadosDoDono([], [externo("opaque", "confirmed", "healthy")]);
    expect(r.fontesDefasadas).toEqual([]);
  });

  it("a mesma situação em dois eventos aparece UMA vez no aviso", () => {
    const r = ocupadosDoDono(
      [],
      [externo("opaque", "confirmed", "token_expired", 15), externo("opaque", "confirmed", "token_expired", 17)],
    );
    expect(r.ocupados).toHaveLength(2);
    expect(r.fontesDefasadas).toEqual(["token_expired"]);
  });
});

describe("o que o banco pode devolver e não pode derrubar a rota", () => {
  it("intervalo invertido ou vazio é descartado, não vira ocupado negativo", () => {
    const r = ocupadosDoDono(
      [{ starts_at: jan(14).toISOString(), ends_at: jan(12).toISOString(), status: "confirmed" }],
      [],
    );
    expect(r.ocupados).toEqual([]);
  });

  it("data ilegível é descartada em vez de virar Invalid Date no motor", () => {
    const r = ocupadosDoDono([{ starts_at: "nao-e-data", ends_at: "tambem-nao", status: "confirmed" }], []);
    expect(r.ocupados).toEqual([]);
  });
});
