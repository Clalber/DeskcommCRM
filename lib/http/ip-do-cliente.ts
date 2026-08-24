/**
 * DE ONDE VEIO A REQUISIÇÃO — uma régua só.
 *
 * O repo lia isto inline em 15 lugares (`x-forwarded-for?.split(",")[0]`), e só
 * um deles — o rate limit de autenticação — tinha o plano B do `x-real-ip`, que
 * é o que o Nginx costuma setar sozinho. Quinze cópias de uma leitura é quinze
 * lugares para consertar quando a hospedagem muda de header.
 *
 * ═══ O QUE ESTE VALOR NÃO É ═══
 *
 * Não é prova de origem. Os dois headers são escritos por quem está na frente e
 * podem ser forjados por quem faz a requisição quando não há proxy conferindo.
 * Nada no produto pode DECIDIR com base neste valor — nem autorizar, nem
 * bloquear. Ele serve para (a) isolar um balde de rate limit, onde forjar só
 * troca o atacante de balde, e (b) mostrar a quem opera de onde as coisas
 * chegaram, para reconhecer padrão.
 *
 * ═══ `null` em vez de sentinela ═══
 *
 * "Não sei de onde veio" precisa ser inexprimível como se fosse uma origem.
 * Uma string tipo `"desconhecido"` vira balde compartilhado no rate limit e
 * vira uma linha que parece um IP na tela.
 */

/** O primeiro salto do `x-forwarded-for`, ou o `x-real-ip`. `null` = sem proxy à frente. */
export function ipDoCliente(headers: Headers): string | null {
  const encaminhado = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (encaminhado) return encaminhado;
  const real = headers.get("x-real-ip")?.trim();
  return real || null;
}

/**
 * O mesmo valor, mas só quando o Postgres o aceitaria como `inet`.
 *
 * A coluna `webhook_lead_captures.remote_ip` é `inet`, e um INSERT com texto que
 * não é IP falha com `22P02` — o que derrubaria o registro inteiro da captação
 * por causa de um header malformado (que é justamente o que um cliente hostil
 * mandaria). Aqui o valor inválido vira `null`: a linha entra, sem a origem.
 *
 * A validação é de FORMA, não de veracidade — ver o cabeçalho.
 */
export function ipDoClienteParaInet(headers: Headers): string | null {
  const bruto = ipDoCliente(headers);
  if (bruto === null) return null;
  // IPv4 com quatro octetos em faixa, ou IPv6 na forma que o Postgres aceita
  // (hex e `:`, com o sufixo IPv4 opcional do `::ffff:1.2.3.4`).
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bruto);
  if (ipv4) {
    return ipv4.slice(1).every((o) => Number(o) <= 255) ? bruto : null;
  }
  if (/^[0-9a-fA-F:]+(\.\d{1,3}){0,3}$/.test(bruto) && bruto.includes(":")) return bruto;
  return null;
}
