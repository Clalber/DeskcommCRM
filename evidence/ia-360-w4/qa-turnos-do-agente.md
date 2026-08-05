# QA — o agente usando as capacidades da W4

Modelo real, dry-run, pelo endpoint do botão "Executar teste".

## 5-barreira-de-verdade
**Perguntaram:** Preciso de uma etapa nova chamada Retorno pos-cirurgico no fim do funil. Ela não existe ainda, cria pra mim.
**Esperado:** crm_create_stage tentado e RECUSADO (apenasHumano + requiresRole manager)
**Ferramentas chamadas:** ? → ? → ? → ?
**Status:** completed

**O que o agente respondeu:**

Não consegui criar a etapa: seu perfil atual é **agent**, e essa alteração exige permissão de **manager**.

Confirmei que **“Retorno pos-cirurgico”** ainda não existe no funil **Pedidos**. Um gestor pode criá-la no fim do funil.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "finish_reason": "tool-calls",
    "tokens_in": 3044,
    "tokens_out": 55,
    "tool_calls": [
      {
        "tool_name": "crm_list_pipelines",
        "args": {
          "include_archived": false
        },
        "result": {
          "pipelines": [
            {
              "id": "e6d6192c-13a1-4be0-847b-69b39fa4f390",
              "name": "Pedidos",
              "slug": "pedidos",
              "description": null,
              "is_default": true,
              "is_archived": false,
              "position": 1000,
              "vocabulary": {
                "won": "Pago",
                "deal": "Pedido",
                "lead": "Cliente",
                "lost": "Cancelado",
                "stage": "Etapa",
                "deal_plural": "Pedidos",
                "lead_plural": "Clientes",
                "stage_plural": "Etapas"
              }
            }
          ]
        }
      }
    ]
  },
  {
    "step": 1,
    "finish_reason": "tool-calls",
    "tokens_in": 3216,
    "tokens_out": 45,
    "tool_calls": [
      {
        "tool_name": "crm_list_stages",
        "args": {
          "pipeline_id": "e6d6192c-13a1-4be0-847b-69b39fa4f390"
        },
        "result": {
          "etapas": [
            {
              "id": "9e71b0ca-039b-4ee4-aa5e-567c587f8956",
              "name": "Carrinho abandonado",
              "slug": "carrinho_abandonado",
              "position": 1000,
              "is_won": false,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-17T22:12:48.493356+00:00"
            },
            {
              "id": "d4e07296-5c60-4963-9ef7-f74cb23c7859",
              "name": "Aguardando pagamento",
              "slug": "aguardando_pagamento",
              "position": 2000,
              "is_won": false,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-08-02T11:53:52.769737+00:00"
            },
            {
              "id": "7fb80670-cd6d-4c59-9d92-bc6f85ed4473",
              "name": "Pago",
              "slug": "pago",
              "position": 3000,
              "is_won": true,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-07T13:18:31.838236+00:00"
            },
            {
              "id": "c8944f15-269c-4cdd-8602-096f748b3da1",
              "name": "Em sep
```