/**
 * A fronteira entre o BANCO e o motor de horários livres.
 *
 * `attendant_availability.schedule` é um **jsonb**, e jsonb não tem forma. O
 * motor (`horariosLivres`) é função pura e assume forma. Alguém tem que fazer a
 * travessia, e é aqui — uma vez só, para nenhuma rota reinventar.
 *
 * ─── Por que não é "só um cast" ───────────────────────────────────────────
 *
 * Medido com o que a coluna devolve de verdade, chamando o motor direto:
 *
 *   schedule `{}` (o DEFAULT da coluna) → TypeError em `windows.filter`
 *   `windows` ausente                   → TypeError
 *   `windows: null`                     → TypeError
 *   `timezone` ausente                  → **não** explode: usa o fuso do PROCESSO
 *
 * Os três primeiros são o caminho normal: todo atendente recém-criado tem o
 * `schedule` no default, então a agenda dele derrubaria a rota no primeiro
 * acesso.
 *
 * ⚠️ O QUARTO É O GRAVE, E É INVERTIDO — INVISÍVEL EM DEV, ERRADO EM PRODUÇÃO.
 *
 * Sem `timezone`, o `Intl` cai no fuso do processo. Medido neste repo:
 * `docker-compose.prod.yml:222` define `TZ: UTC` **apenas** no `scheduler`; o
 * serviço `app` não define TZ, e o `Dockerfile` é `node:22-alpine` sem
 * `tzdata`. Em produção o processo roda em **UTC**. Para uma clínica em São
 * Paulo isso faz a jornada 09:00–18:00 valer como 06:00–15:00 na parede dela —
 * horário oferecido às 6 da manhã, nenhum depois das 15h, e nenhum erro em
 * lugar nenhum. No Mac de quem desenvolve o `TZ` é `America/Sao_Paulo` e o
 * mesmo código acerta.
 *
 * ─── A peça que resolve já existia ────────────────────────────────────────
 *
 * `availabilityScheduleSchema` (`lib/schemas/routing.ts`) é o schema que a
 * DECISÃO 1 nomeia como fonte única: preenche os defaults, valida o fuso contra
 * o próprio `Intl` e recusa janela invertida. Aqui não há validação nova — há
 * reuso, e a garantia de que o motor nunca vê jsonb cru.
 */
import { availabilityScheduleSchema } from "@/lib/schemas/routing";

import type { JornadaDaAgenda } from "./horarios-livres";

export type LeituraDaJornada =
  | {
      ok: true;
      jornada: JornadaDaAgenda;
      /**
       * ⚠️ "NÃO PUBLIQUEI" E "NÃO TENHO VAGA" SÃO ESTADOS DIFERENTES.
       *
       * Sem janela publicada a agenda devolve zero horário — e a tela **não**
       * pode dizer "nenhum horário disponível" e calar, porque o dono concluiria
       * que está lotado. Ela diz "você ainda não publicou seus horários de
       * atendimento" e leva para lá (DECISÃO 1.1). Quem sabe distinguir é este
       * campo; sem ele os dois estados chegam à tela como a mesma lista vazia.
       */
      publicouHorarios: boolean;
    }
  | {
      ok: false;
      /** Legível por humano — vai para a tela e para o aviso, nunca só para o log. */
      motivo: string;
    };

/**
 * Lê o `schedule` como ele vem do banco.
 *
 * `safeParse`, nunca `parse`: `windows: null` é representável no jsonb e um
 * `parse` viraria 500 numa rota de leitura.
 *
 * E a recusa **nunca** vira lista vazia silenciosa. Falha fechada na AÇÃO (não
 * oferece horário) e ABERTA na INFORMAÇÃO (diz o que está errado). Devolver `[]`
 * sem motivo faz o dono concluir "não tenho horário livre" quando o que ele tem
 * é schedule corrompido — e essa conclusão errada não gera chamado nenhum, então
 * ninguém descobre.
 */
export function lerJornadaDoBanco(scheduleDoBanco: unknown): LeituraDaJornada {
  const lido = availabilityScheduleSchema.safeParse(scheduleDoBanco ?? undefined);

  if (!lido.success) {
    const primeiro = lido.error.issues[0];
    const onde = primeiro?.path?.length ? ` (em \`${primeiro.path.join(".")}\`)` : "";
    return { ok: false, motivo: `${primeiro?.message ?? "formato inesperado"}${onde}` };
  }

  return {
    ok: true,
    jornada: { timezone: lido.data.timezone, windows: lido.data.windows },
    publicouHorarios: lido.data.windows.length > 0,
  };
}
