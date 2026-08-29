/**
 * O "digitando…" que dura o tempo do turno.
 *
 * O canal só sabe fazer um disparo: `setTyping(true)` acende o indicador e o
 * WhatsApp o apaga sozinho em poucos segundos. Um turno de agente demora mais
 * que isso — chamada de modelo, tools, RAG, gates —, então quem quer o
 * indicador aceso do começo ao fim precisa RENOVAR. Este módulo é essa
 * renovação, e nada mais: nenhuma decisão de negócio, nenhum I/O próprio.
 *
 * ─── Por que existe um TETO de duração ─────────────────────────────────────
 *
 * `duracaoMaximaMs` não é economia de chamada: é o mecanismo anti-morte deste
 * laço. `parar()` é chamado no `finally` do turno, mas um turno pode ficar
 * pendurado numa chamada de rede que nunca volta — e sem teto o cliente veria
 * "digitando…" para sempre, o que é pior que não ter indicador nenhum: é o
 * sistema afirmando que alguém está escrevendo quando não está.
 *
 * ─── Falhou uma vez, não insiste ───────────────────────────────────────────
 *
 * A primeira sinalização recusada encerra o laço. Uma instalação cujo canal não
 * conhece a rota de presença responderia erro a cada renovação, para sempre, em
 * toda conversa — custo permanente por um recurso que aquela instalação não tem.
 * Uma tentativa por turno é o suficiente para o recurso aparecer sozinho no dia
 * em que o canal for atualizado.
 *
 * `manterDigitando` é PURO de propósito (só `sinalizar`, relógio e sono
 * injetáveis): é o que permite provar renovação e teto sem canal, sem banco e
 * sem esperar 8 segundos. `digitacaoDoTurno`, no fim do arquivo, é a única parte
 * que conhece `ChannelAdapter`.
 */
import type { ChannelAdapter } from '../channel-adapter';
import type { Logger } from '../obs/logger';

/** Ritmo do indicador. Ausente nos knobs do turno = recurso desligado. */
export interface DigitandoKnobs {
  /** De quanto em quanto tempo o indicador é reaceso (ms). */
  renovarAposMs: number;
  /** Teto absoluto de um mesmo laço (ms) — o anti-morte descrito acima. */
  duracaoMaximaMs: number;
}

export interface PulsoDeDigitacao {
  /**
   * Acende o indicador e começa a renovar. Idempotente: a segunda chamada não
   * abre um segundo laço — o turno tem pontos de entrada diferentes e é mais
   * barato garantir isso aqui do que exigir disciplina de quem chama.
   *
   * Não devolve promise de propósito: quem responde o cliente não deve esperar
   * pelo enfeite. O laço roda ao lado; `parar()` é quem o aguarda.
   */
  iniciar(): void;
  /**
   * Apaga o indicador e encerra o laço. Seguro em qualquer estado — antes de
   * iniciar, depois de parar, duas vezes seguidas — porque quem chama é um
   * `finally`, e `finally` não pode ganhar caso novo a cada refatoração.
   */
  parar(): Promise<void>;
}

export interface ManterDigitandoOpts {
  /**
   * Liga (`true`) ou desliga (`false`) o indicador. Devolve se o canal aceitou.
   * Pode rejeitar à vontade: o laço blinda — mas rejeição conta como recusa, e
   * recusa encerra o laço.
   */
  sinalizar: (ligado: boolean) => Promise<boolean>;
  knobs: DigitandoKnobs;
  /** Relógio injetável — os testes provam o teto sem esperar por ele. */
  agora?: () => number;
  /** Sono injetável — os testes o tornam instantâneo. */
  dormir?: (ms: number) => Promise<void>;
}

/**
 * Sono que NÃO segura o processo vivo.
 *
 * Sem `unref`, um worker que terminasse o trabalho ficaria de pé até o último
 * timer de renovação vencer — um processo que não morre por causa de um
 * balãozinho. O `typeof` protege ambiente sem a API (o tipo do timer difere
 * entre runtimes); onde ela não existe, o comportamento é o de antes.
 */
function dormirPadrao(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    if (typeof (timer as { unref?: () => void }).unref === 'function') {
      (timer as { unref: () => void }).unref();
    }
  });
}

export function manterDigitando(opts: ManterDigitandoOpts): PulsoDeDigitacao {
  const agora = opts.agora ?? ((): number => Date.now());
  const dormir = opts.dormir ?? dormirPadrao;

  let laco: Promise<void> | null = null;
  let ativo = false;
  let acendeu = false;
  let parado = false;
  // O executor de Promise roda SÍNCRONO, então `resolverParada` está trocado
  // antes da próxima linha — o valor inicial existe só para o typecheck estrito.
  let resolverParada: () => void = () => {};
  const parada = new Promise<void>((resolve) => {
    resolverParada = resolve;
  });

  async function sinalizarBlindado(ligado: boolean): Promise<boolean> {
    try {
      return await opts.sinalizar(ligado);
    } catch {
      return false;
    }
  }

  return {
    iniciar(): void {
      if (laco !== null || parado) return;
      ativo = true;
      const limite = agora() + opts.knobs.duracaoMaximaMs;
      laco = (async () => {
        // O teto é testado ANTES de cada acendida, nunca depois: acender no
        // instante do limite daria ao cliente mais um ciclo inteiro de
        // "digitando…" além do teto — justamente o que o teto existe para
        // impedir.
        while (ativo && agora() < limite) {
          const aceito = await sinalizarBlindado(true);
          if (!aceito) return;
          acendeu = true;
          if (!ativo) return;
          // `race` com a parada: sem ela, `parar()` esperaria o sono inteiro
          // antes de apagar o indicador — e o cliente veria "digitando…" por
          // vários segundos DEPOIS de a mensagem já ter chegado.
          const restante = limite - agora();
          await Promise.race([dormir(Math.min(opts.knobs.renovarAposMs, restante)), parada]);
        }
      })();
    },

    async parar(): Promise<void> {
      if (parado) return;
      parado = true;
      ativo = false;
      resolverParada();
      if (laco !== null) await laco;
      // Só desliga o que chegou a ligar. Sem isto, um canal que recusou o
      // indicador ainda receberia o `paused` — uma chamada garantidamente inútil
      // por turno, em toda instalação sem o recurso.
      if (acendeu) await sinalizarBlindado(false);
    },
  };
}

/**
 * O indicador de UM turno do agente, amarrado ao canal daquele turno.
 *
 * ─── Por que `ligar` recebe o canal, em vez de o construtor ────────────────
 *
 * O ciclo de vida e o canal nascem em momentos diferentes: `parar()` precisa
 * estar garantido no `finally` desde a primeira linha do turno, e o
 * `ChannelAdapter` só existe umas centenas de linhas depois, quando o turno já
 * resolveu qual agente responde. Construir o pulso cedo e entregar o canal
 * depois é o que permite as duas coisas — em vez de um `finally` que talvez
 * tenha o que parar.
 */
export interface DigitacaoDoTurno {
  /**
   * Acende o indicador por este canal. NO-OP silencioso quando o recurso está
   * desligado (sem knobs) ou quando o canal não sabe sinalizar — o turno chama
   * sem perguntar nada, que é o ponto do seam.
   */
  ligar(channel: ChannelAdapter): void;
  /** Apaga o indicador. Seguro em qualquer estado, inclusive sem nunca ter ligado. */
  parar(): Promise<void>;
}

export interface DigitacaoDoTurnoOpts {
  /** Ausente = recurso desligado nesta instalação; tudo vira no-op. */
  knobs?: DigitandoKnobs | undefined;
  tenantId: string;
  conversationId: string;
  log: Logger;
  agora?: () => number;
  dormir?: (ms: number) => Promise<void>;
}

export function digitacaoDoTurno(opts: DigitacaoDoTurnoOpts): DigitacaoDoTurno {
  let pulso: PulsoDeDigitacao | null = null;

  return {
    ligar(channel: ChannelAdapter): void {
      if (opts.knobs === undefined || pulso !== null) return;
      const setTyping = channel.setTyping;
      if (setTyping === undefined) return;
      let primeiroDesfecho = true;
      pulso = manterDigitando({
        knobs: opts.knobs,
        ...(opts.agora !== undefined ? { agora: opts.agora } : {}),
        ...(opts.dormir !== undefined ? { dormir: opts.dormir } : {}),
        sinalizar: async (ligado: boolean): Promise<boolean> => {
          const aceito = await setTyping.call(channel, {
            tenantId: opts.tenantId,
            conversationId: opts.conversationId,
            typing: ligado,
          });
          // Uma linha por turno, e só na primeira: é o que separa "esta
          // instalação não tem o recurso" de "o recurso está lá e não funciona"
          // sem encher o log a cada renovação.
          if (primeiroDesfecho) {
            primeiroDesfecho = false;
            opts.log.info('indicador de digitação', { aceito_pelo_canal: aceito });
          }
          return aceito;
        },
      });
      pulso.iniciar();
    },

    async parar(): Promise<void> {
      await pulso?.parar();
    },
  };
}
