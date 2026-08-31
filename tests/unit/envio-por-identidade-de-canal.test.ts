/**
 * Enviar para quem NÃO tem telefone.
 *
 * ─── O defeito, medido em produção ──────────────────────────────────────────
 *
 * O canal Instagram recebeu a primeira mensagem real e o envio falhou com
 * "Contato sem telefone para envio WhatsApp." — numa conversa de um canal que
 * não usa telefone. O contato nasce sem número DE PROPÓSITO: a pessoa é
 * endereçada por um id opaco que a conta emitiu, guardado em
 * `channel_contact_identities` e escopado à sessão.
 *
 * O adapter já sabia disso: `resolveRecipient` devolve `providerUserId`. Quem
 * monta o envelope é que nunca preenchia esse campo — estava na lista de
 * pendências desde o primeiro dia do canal, e o transporte inteiro foi
 * construído sem ligar a última peça.
 *
 * ─── A regra que este arquivo protege ───────────────────────────────────────
 *
 * Quem escolhe o endereço é o ADAPTER, não a rota. A rota entrega TODOS os
 * endereços que o CRM conhece; o canal por telefone ignora o id opaco, e o
 * canal por id opaco ignora o telefone. Um `if` de provider aqui seria o que a
 * doutrina de restrição de canal existe para impedir.
 */
import { describe, expect, it, vi } from "vitest";

import { getAdapter } from "@/lib/channels";

const IGSID = "9876543210000001";
const TELEFONE = "+5519999999999";

describe("o adapter escolhe o endereço que serve para ELE", () => {
  it("o canal por id opaco usa o providerUserId e ignora o telefone", () => {
    const adapter = getAdapter("meta_instagram");

    // Com telefone e SEM identidade: não há para onde mandar.
    expect(
      adapter.resolveRecipient({
        isGroup: false,
        groupChatId: null,
        phoneNumber: TELEFONE,
        waIdentity: `phone:${TELEFONE}`,
        waLid: null,
      }),
    ).toBeNull();

    // Com a identidade: resolve. É a diferença que o segundo passo do handler
    // produz — e sem ele TODA mensagem deste canal falhava.
    expect(
      adapter.resolveRecipient({
        isGroup: false,
        groupChatId: null,
        phoneNumber: TELEFONE,
        waIdentity: `phone:${TELEFONE}`,
        waLid: null,
        providerUserId: IGSID,
      }),
    ).toBe(IGSID);
  });

  it("o canal oficial IGNORA o id opaco — ele endereça por telefone", () => {
    // O controle que protege o WhatsApp. Se a resolução genérica tivesse
    // passado a aceitar "qualquer endereço serve", este canal começaria a
    // mandar mensagem para um id que a plataforma dele não conhece.
    const oficial = getAdapter("meta_cloud");

    expect(
      oficial.resolveRecipient({
        isGroup: false,
        groupChatId: null,
        phoneNumber: null,
        waIdentity: null,
        waLid: null,
        providerUserId: IGSID,
      }),
    ).toBeNull();
  });

  it("o canal por QR segue resolvendo por telefone, com ou sem id opaco", () => {
    const qr = getAdapter("waha");
    const semIdOpaco = qr.resolveRecipient({
      isGroup: false,
      groupChatId: null,
      phoneNumber: TELEFONE,
      waIdentity: `phone:${TELEFONE}`,
      waLid: null,
    });

    // O id opaco não pode MUDAR o destino de quem endereça por número: seria
    // uma regressão silenciosa no caminho mais quente do produto.
    const comIdOpaco = qr.resolveRecipient({
      isGroup: false,
      groupChatId: null,
      phoneNumber: TELEFONE,
      waIdentity: `phone:${TELEFONE}`,
      waLid: null,
      providerUserId: IGSID,
    });

    expect(semIdOpaco).toBeTruthy();
    expect(comIdOpaco).toBe(semIdOpaco);
  });
});

describe("a rota de envio busca a identidade quando o telefone não resolve", () => {
  it("o seam exporta a busca — a rota não entra no módulo do canal", async () => {
    // A rota de envio não pode importar de `lib/channels/instagram/...`: ela
    // não pode saber de qual canal a identidade é. A tabela é genérica de
    // propósito, e a porta é o índice do seam.
    const seam = await import("@/lib/channels");
    expect(typeof seam.identidadePorContato).toBe("function");
  });

  it("a rota chama a busca com o escopo da SESSÃO, não só da organização", async () => {
    // O escopo é o que impede responder pela conta errada: o mesmo id pertence
    // a pessoas diferentes em contas diferentes. Uma busca só por organização
    // acharia a identidade de outra conta e mandaria a mensagem para outra
    // pessoa — o pior desfecho possível, porque a mensagem SAI.
    const { readFileSync } = await import("node:fs");
    const rota = readFileSync("app/api/v1/messages/_handler.ts", "utf8");

    expect(rota).toContain("identidadePorContato");
    expect(rota).toContain("channelSessionId: c.channel_session_id");

    // E a busca é o SEGUNDO passo: só quando o primeiro não resolveu. Rodá-la
    // sempre poria uma consulta a mais em todo envio de WhatsApp, que é o
    // caminho mais quente do produto.
    // A busca a medir é a CHAMADA, não o `import` do topo — foi essa confusão
    // que fez a primeira versão deste caso recortar uma fatia vazia e ficar
    // vermelha por instrumento quebrado, não por defeito.
    const inicio = rota.indexOf("let chatId");
    const chamada = rota.indexOf("await identidadePorContato", inicio);
    expect(inicio).toBeGreaterThan(-1);
    expect(chamada).toBeGreaterThan(inicio);
    expect(rota.slice(inicio, chamada)).toContain("if (!chatId");
  });
});
