# Doutrina de Restrição de Canal

> Lei de arquitetura para tudo que envia mensagem por um canal externo (WhatsApp WAHA,
> WhatsApp Cloud API oficial, e qualquer canal futuro). Complementa
> [`sistema-vivo.md`](./sistema-vivo.md) — não é aspiração, é critério de aceite.

---

## O princípio-raiz

**Todo canal restringe o que você pode enviar. A pergunta que decide a arquitetura não é
*"qual é a restrição?"* — é *"quem a impõe e o que acontece se eu violar?"***

Duas famílias de restrição, com física invertida:

| | **Auto-restrição** | **Hetero-restrição** |
|---|---|---|
| Quem impõe | **você a si mesmo** | **a plataforma a você** |
| Por quê | a plataforma te **bane** se abusar | a plataforma te **proíbe** e te **cobra** |
| Se violar | conta morre, silenciosamente, depois | request falha na hora, com código de erro |
| Exemplo | WAHA: throttle, jitter, warm-up, cap diário | Meta Cloud: janela de 24h, template aprovado, 1 msg/6s por destinatário |
| Natureza | **preventiva e probabilística** | **determinística e verificável** |
| Quem detecta a violação | ninguém — você descobre pelo prejuízo | a API, no retorno |

**Nenhuma é subconjunto da outra.** Generalizar anti-ban em "rate limit" apaga a lógica de
template. Generalizar janela em "posso enviar?" apaga o warm-up. Elas convivem como **regras
irmãs**, nunca fundidas.

---

## Os 4 invariantes (verificáveis)

### 1. Nenhuma feature nomeia um provider

Nenhum código fora de `lib/channels/` pode conter a string `waha`, `graph.facebook.com`,
`meta_cloud` ou equivalente. Features perguntam **capacidades**, nunca identidade.

```ts
// ERRADO — o if novo é a porta de entrada de toda regressão futura
if (session.provider === 'meta_cloud') { /* ... */ }

// CERTO — a feature descreve o que precisa, não com quem fala
if (!caps.freeformOutsideWindow) { /* ... */ }
```

- **Por quê:** cada `if (provider === ...)` é uma chance de alguém escrever o ramo novo e
  esquecer o antigo. É assim que uma implementação regride a outra.
- **Verificação:** `scripts/lint-channels.ts` reprova o vazamento no `gov:verify`. Provider
  novo não exige tocar em feature nenhuma.

### 2. Toda restrição declara ORIGEM e FÍSICA

Uma capability nunca é um booleano solto. Ela diz de que família é, porque isso decide
**o que fazer quando ela barra**:

- **auto-restrição barrou** → adiar e tentar depois (a janela reabre, o cap zera à meia-noite).
  Vetar para sempre seria perder a mensagem por prudência.
- **hetero-restrição barrou** → mudar a forma da mensagem (usar template) ou escalar ao humano.
  Adiar não resolve: amanhã a janela de 24h estará ainda mais fechada.

- **Verificação:** a matriz de capabilities é exaustiva — capability sem linha para algum
  provider reprova o CI. Capability que nenhum provider declara é código morto e sai.

### 3. Cortesia não é anti-ban

Restrição que existe **para não incomodar o cliente** (horário comercial, evitar domingo,
fuso do tenant) vale em **todos** os canais e nunca é desarmada junto com o anti-ban.
Restrição que existe **para não ser banido** (throttle, jitter, warm-up, cap diário) só
arma onde há risco de ban.

- **Anti-exemplo real:** `PACING_DEFAULTS` fundia as duas. Ligar a API oficial desarmando o
  "pacing" levaria o horário comercial junto — e a IA passaria a acordar cliente às 3h da manhã.
- **Verificação:** um teste prova que, com `banRisk: false`, throttle/warm-up/cap **desarmam**
  e horário/domingo/fuso **continuam armados**. Como separar (tipos distintos, flag na decisão)
  é escolha de implementação; o invariante é o teste.

### 4. Restrição não aplicável é registrada, não omitida

Quando um gate não se aplica ao provider da vez, ele devolve `skipped: 'not_applicable'` —
**nunca** um `pass` silencioso, e nunca é removido da cadeia.

- **Por quê:** a diferença entre "não regrediu" e "**consigo provar** que não regrediu" é
  exatamente essa linha no `before_send_traces`.
- **Verificação:** todo gate da cadeia aparece no trace de todo envio, com veredito
  `pass` / `veto` / `skipped` + razão.

---

## Contrato de parâmetros — a regra que mata o mismatch

Aplicável a qualquer canal cuja plataforma hospede a definição da mensagem (templates Meta,
e-mail transacional de terceiro, etc.).

**A definição hospedada na plataforma É o schema. O contrato de parâmetros nunca é
redigitado — é derivado dela por função pura.**

Regras duras:

1. **Ninguém digita quantidade de parâmetro.** Não existe campo "número de variáveis" em
   tela, em jsonb, em nenhum lugar. Se existe, o mismatch é questão de tempo.
2. **Uma derivação, dois consumidores.** A mesma função pura alimenta (a) o formulário da
   tela e (b) o montador do payload de envio. Divergir vira impossível por construção, não
   por disciplina.
3. **Header e botões contam.** O contrato cobre todos os componentes com variável, não só o
   corpo. Contar só o body é a causa nº 1 do erro em produção.
4. **A chave é `(nome, idioma)`.** Nunca só o nome — variantes de idioma têm corpos diferentes.
5. **Bind por hash, não por nome.** Toda config que aponta para uma definição guarda o hash
   do contrato vigente quando foi salva. Hash divergente = config **obsoleta**: não envia,
   não adivinha, vira trabalho visível com o diff do que mudou.
6. **Erro de contagem da plataforma é bug NOSSO.** Se a API remota devolver "parâmetros não
   batem", isso não é erro do usuário: é falha da derivação. Vai para o Sentry como defeito,
   não para a tela como aviso.

---

## Toda configuração tem superfície

Estende o invariante 3 do sistema vivo (*log universal e visível*) para o eixo da
**configuração**: log é sobre o que aconteceu; isto é sobre o que está **valendo**.

**Nenhum mecanismo de backend pode depender de estado configurável que não tenha tela para
ver, tela para mudar, e caminho visível de falha.**

- **Anti-exemplo real:** existir disparo de template por follow-up sem nenhuma área para
  ver ou configurar templates. O mecanismo funciona, mas é operável só por quem lê o banco —
  ou seja, não é operável.
- **Verificação:** para todo estado configurável existe (a) rota de leitura na UI,
  (b) rota de escrita na UI, e (c) o que acontece quando falta configuração é **visível**
  (item de inbox / banner), nunca um `return` mudo no worker.

---

## Enforcement

| Camada | Mecanismo | Efeito |
|---|---|---|
| Lint | `scripts/lint-channels.ts` | nome de provider fora de `lib/channels/` reprova |
| Invariante | matriz capability × provider em `tests/unit/` | capability sem cobertura reprova |
| Invariante | suíte de canal congelada rodando com o provider legado | regressão silenciosa reprova |
| Trace | `before_send_traces` com `skipped` explícito | não-aplicação é auditável, não invisível |
| Gate de sessão | item no Living System Checklist (`sistema-vivo.md`) | nenhuma task de canal fecha sem responder |
