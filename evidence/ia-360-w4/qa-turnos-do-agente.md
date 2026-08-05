# QA — o agente usando as capacidades da W4

Modelo real, dry-run, pelo endpoint do botão "Executar teste".

## 1-ler-o-funil
**Perguntaram:** Quais são as etapas do nosso funil hoje? Lista pra mim na ordem.
**Esperado:** crm_list_pipelines e/ou crm_list_stages
**Ferramentas chamadas:** ? → ? → ?
**Status:** completed

**O que o agente respondeu:**

No funil **Pedidos**, as etapas estão nesta ordem:

1. Carrinho abandonado  
2. Aguardando pagamento  
3. Pago *(desfecho de sucesso)*  
4. Em separacao  
5. Enviado  
6. Entregue  
7. Pos-venda  
8. Cancelado *(desfecho de perda)*  
9. Etapa QA audit 1785946673207

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "finish_reason": "tool-calls",
    "tokens_in": 3032,
    "tokens_out": 39,
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
    "tokens_in": 3188,
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

---

## 2-marcador-existente
FALHOU: HTTP 401
{"error":{"code":"unauthenticated","message":"Authentication required"}}

---

## 3-diagnostico-de-entrada
FALHOU: HTTP 401
{"error":{"code":"unauthenticated","message":"Authentication required"}}

---

## 4-capacidade-apenas-humana
FALHOU: HTTP 401
{"error":{"code":"unauthenticated","message":"Authentication required"}}

---

## 5-barreira-de-verdade
FALHOU: HTTP 401
{"error":{"code":"unauthenticated","message":"Authentication required"}}