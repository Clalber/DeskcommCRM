/**
 * Os estados que contam como "pareamento em andamento".
 *
 * Uma fonte só para os DOIS lados que precisam concordar: o predicado do índice
 * parcial da migration 0204 e o filtro da rota que busca a vencedora depois de
 * um `23505`. Se divergirem, o índice barra um conjunto e a rota lê outro — e o
 * sintoma seria um 409 em situação que deveria devolver a sessão pendente.
 *
 * `FAILED`/`STOPPED` ficam de FORA de propósito: são a órfã que o defeito da
 * retentativa deixava para trás, e o `catch` do WAHA agora produz. Contá-las
 * como pendentes travaria TODA conexão nova — o conserto viraria um defeito
 * pior que o original.
 */
export const STATUS_DE_PAREAMENTO_PENDENTE = ["STARTING", "SCAN_QR_CODE"] as const;

/**
 * O provider a que esta trava se aplica.
 *
 * O defeito é do fluxo de QR do WAHA — insert antes de falar com o serviço, e
 * cliente que retenta. A migration 0203 tornou `channel_sessions`
 * multi-provider, então a trava precisa do mesmo alcance do defeito: sem isto,
 * uma sessão de outro canal em STARTING bloquearia um pareamento de WhatsApp.
 */
export const PROVIDER_DO_QR = "waha" as const;
