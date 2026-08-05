# QA — o agente usando as capacidades da W4

Modelo real, dry-run, pelo endpoint do botão "Executar teste".

## 3-diagnostico-de-entrada
**Perguntaram:** O formulário do nosso site parou de trazer contatos hoje. Consegue descobrir o que houve?
**Esperado:** crm_list_webhook_sources + crm_list_webhook_source_events
**Ferramentas chamadas:** ? → ?
**Status:** completed

**O que o agente respondeu:**

Não há nenhuma entrada automática/webhook cadastrada na clínica — ativa ou desativada. Por isso não existem recebimentos recentes para diagnosticar.

Isso indica que o formulário do site provavelmente não está conectado a este CRM (ou a integração foi removida). Vale conferir no site para qual URL ele está enviando os dados e, se houver uma integração esperada, recriar/configurar a entrada aqui.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "finish_reason": "tool-calls",
    "tokens_in": 3027,
    "tokens_out": 44,
    "tool_calls": [
      {
        "tool_name": "crm_list_webhook_sources",
        "args": {
          "only_active": false
        },
        "result": {
          "entradas": []
        }
      }
    ]
  },
  {
    "step": 1,
    "text": "Não há nenhuma entrada automática/webhook cadastrada na clínica — ativa ou desativada. Por isso não existem recebimentos recentes para diagnosticar.\n\nIsso indica que o formulário do site provavelmente não está conectado a este CRM (ou a integração foi removida). Vale conferir no site para qual URL ele está enviando os dados e, se houver uma integração esperada, recriar/configurar a entrada aqui.",
    "finish_reason": "stop",
    "tokens_in": 3090,
    "tokens_out": 125,
    "tool_calls": []
  }
]
```