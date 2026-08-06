# QA — o agente usando as capacidades da W4

Modelo real, dry-run, pelo endpoint do botão "Executar teste".

## 1-ler-o-funil
**Perguntaram:** Quais são as etapas do nosso funil hoje? Lista pra mim na ordem.
**Esperado:** crm_list_pipelines e/ou crm_list_stages
**Ferramentas chamadas:** crm_list_pipelines → crm_list_stages
**Status:** completed

**O que o agente respondeu:**

O funil ativo é **Pedidos**. As etapas, na ordem, são:

1. Carrinho abandonado  
2. Aguardando pagamento  
3. Pago *(etapa de sucesso)*  
4. Em separação  
5. Enviado  
6. Entregue  
7. Pós-venda  
8. Cancelado *(etapa de perda)*  
9. Etapa QA audit 1785946673207  
10. Etapa QA audit 1785965730905  
11. Etapa QA audit 1785966451563

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "finish_reason": "tool-calls",
    "tokens_in": 1437,
    "tokens_out": 38,
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
    "tokens_in": 1592,
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
              "last_change_at": "2026-07-09T22:50:23.018795+00:00"
            },
            {
              "id": "d4e07296-5c60-4963-9ef7-f74cb23c7859",
              "name": "Aguardando pagamento",
              "slug": "aguardando_pagamento",
              "position": 2000,
              "is_won": false,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-24T15:57:06.840871+00:00"
            },
            {
              "id": "7fb80670-cd6d-4c59-9d92-bc6f85ed4473",
              "name": "Pago",
              "slug": "pago",
              "position": 3000,
              "is_won": true,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-26T23:33:30.473211+00:00"
            },
            {
              "id": "c8944f15-269c-4cdd-8602-096f748b3da1",
              "name": "Em sep
```

---

## 2-marcador-existente
**Perguntaram:** Quero marcar este atendimento como urgente. Que marcadores a gente já usa? Não quero criar um repetido.
**Esperado:** crm_list_tags antes de qualquer crm_manage_tags
**Ferramentas chamadas:** crm_list_tags
**Status:** completed

**O que o agente respondeu:**

Já usamos o marcador oficial **`urgente`**. Posso aplicá-lo a este atendimento.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "finish_reason": "tool-calls",
    "tokens_in": 1443,
    "tokens_out": 46,
    "tool_calls": [
      {
        "tool_name": "crm_list_tags",
        "args": {
          "limit": 60
        },
        "result": {
          "marcadores": [
            {
              "marcador": "devolução",
              "conversas": 0,
              "oficial": true
            },
            {
              "marcador": "dúvida",
              "conversas": 0,
              "oficial": true
            },
            {
              "marcador": "elogio",
              "conversas": 0,
              "oficial": true
            },
            {
              "marcador": "orçamento",
              "conversas": 0,
              "oficial": true
            },
            {
              "marcador": "pós-venda",
              "conversas": 0,
              "oficial": true
            },
            {
              "marcador": "reclamação",
              "conversas": 0,
              "oficial": true
            },
            {
              "marcador": "troca",
              "conversas": 0,
              "oficial": true
            },
            {
              "marcador": "urgente",
              "conversas": 0,
              "oficial": true
            }
          ]
        }
      }
    ]
  },
  {
    "step": 1,
    "text": "Já usamos o marcador oficial **`urgente`**. Posso aplicá-lo a este atendimento.",
    "finish_reason": "stop",
    "tokens_in": 1658,
    "tokens_out": 25,
    "tool_calls": []
  }
]
```

---

## 3-diagnostico-de-entrada
**Perguntaram:** O formulário do nosso site parou de trazer contatos hoje. Consegue descobrir o que houve?
**Esperado:** crm_list_webhook_sources + crm_list_webhook_source_events
**Ferramentas chamadas:** NENHUMA
**Status:** completed

**O que o agente respondeu:**

Consigo ajudar a investigar, mas não tenho acesso, nesta conversa, aos logs de integrações, entradas automáticas ou regras do formulário para confirmar a causa.

Para isolar o problema, preciso de:
- qual formulário/página do site;
- horário aproximado do último contato que entrou normalmente;
- se houve alguma alteração hoje no site, formulário, domínio, CRM ou integração;
- um envio de teste (e se a tela confirmou o envio).

Com isso, a checagem deve seguir: envio do formulário → webhook/integração → criação do contato/conversa no CRM → regras de automação e roteamento.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "text": "Consigo ajudar a investigar, mas não tenho acesso, nesta conversa, aos logs de integrações, entradas automáticas ou regras do formulário para confirmar a causa.\n\nPara isolar o problema, preciso de:\n- qual formulário/página do site;\n- horário aproximado do último contato que entrou normalmente;\n- se houve alguma alteração hoje no site, formulário, domínio, CRM ou integração;\n- um envio de teste (e se a tela confirmou o envio).\n\nCom isso, a checagem deve seguir: envio do formulário → webhook/integração → criação do contato/conversa no CRM → regras de automação e roteamento.",
    "finish_reason": "stop",
    "tokens_in": 1439,
    "tokens_out": 231,
    "tool_calls": []
  }
]
```

---

## 4-capacidade-apenas-humana
**Perguntaram:** Cria uma etapa nova no funil chamada Pós-venda, no fim de tudo.
**Esperado:** crm_create_stage — que é apenasHumano e deve ser RECUSADA pelo papel
**Ferramentas chamadas:** crm_list_pipelines → crm_list_stages
**Status:** completed

**O que o agente respondeu:**

A etapa **“Pós-venda”** já existe no funil **Pedidos**, atualmente após **Entregue**. Não criei uma duplicata.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "finish_reason": "tool-calls",
    "tokens_in": 1438,
    "tokens_out": 47,
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
    "tokens_in": 1602,
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
              "last_change_at": "2026-07-09T22:50:23.018795+00:00"
            },
            {
              "id": "d4e07296-5c60-4963-9ef7-f74cb23c7859",
              "name": "Aguardando pagamento",
              "slug": "aguardando_pagamento",
              "position": 2000,
              "is_won": false,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-24T15:57:06.840871+00:00"
            },
            {
              "id": "7fb80670-cd6d-4c59-9d92-bc6f85ed4473",
              "name": "Pago",
              "slug": "pago",
              "position": 3000,
              "is_won": true,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-26T23:33:30.473211+00:00"
            },
            {
              "id": "c8944f15-269c-4cdd-8602-096f748b3da1",
              "name": "Em sep
```

---

## 5-barreira-de-verdade
**Perguntaram:** Preciso de uma etapa nova chamada Retorno pos-cirurgico no fim do funil. Ela não existe ainda, cria pra mim.
**Esperado:** crm_create_stage tentado e RECUSADO (apenasHumano + requiresRole manager)
**Ferramentas chamadas:** crm_list_pipelines → crm_list_stages
**Status:** completed

**O que o agente respondeu:**

Verifiquei o funil **Pedidos**: a etapa **“Retorno pos-cirurgico”** não existe e o fim atual do quadro está na posição 34000.

Não tenho uma ferramenta disponível para criar etapas diretamente. Posso orientar a criação no fim do funil com esse nome, após **“Etapa QA audit 1785966451563”**.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "finish_reason": "tool-calls",
    "tokens_in": 1449,
    "tokens_out": 72,
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
    "tokens_in": 1638,
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
              "last_change_at": "2026-07-09T22:50:23.018795+00:00"
            },
            {
              "id": "d4e07296-5c60-4963-9ef7-f74cb23c7859",
              "name": "Aguardando pagamento",
              "slug": "aguardando_pagamento",
              "position": 2000,
              "is_won": false,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-24T15:57:06.840871+00:00"
            },
            {
              "id": "7fb80670-cd6d-4c59-9d92-bc6f85ed4473",
              "name": "Pago",
              "slug": "pago",
              "position": 3000,
              "is_won": true,
              "is_lost": false,
              "last_change_actor_kind": "user",
              "last_change_at": "2026-07-26T23:33:30.473211+00:00"
            },
            {
              "id": "c8944f15-269c-4cdd-8602-096f748b3da1",
              "name": "Em sep
```

---

## 6-respostas-prontas
**Perguntaram:** Que respostas prontas a gente já tem cadastradas? Lista o nome de cada uma pra mim.
**Esperado:** crm_list_message_templates
**Ferramentas chamadas:** NENHUMA
**Status:** completed

**O que o agente respondeu:**

Não tenho uma ferramenta disponível aqui para consultar a lista de respostas prontas cadastradas. Se você me enviar uma captura ou exportação delas, organizo os nomes para você.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "text": "Não tenho uma ferramenta disponível aqui para consultar a lista de respostas prontas cadastradas. Se você me enviar uma captura ou exportação delas, organizo os nomes para você.",
    "finish_reason": "stop",
    "tokens_in": 1440,
    "tokens_out": 78,
    "tool_calls": []
  }
]
```

---

## 7-automacoes-e-falhas
**Perguntaram:** Alguma automação nossa falhou nas últimas horas? Quero saber quais estão ligadas e se alguma deu erro.
**Esperado:** crm_list_automation_rules + crm_list_automation_runs
**Ferramentas chamadas:** NENHUMA
**Status:** completed

**O que o agente respondeu:**

Não tenho acesso, nesta conversa, ao painel de automações/regras nem ao histórico de execuções para verificar quais estão ativas ou se houve falhas nas últimas horas.  

Consigo consultar dados de CRM como funis, etapas e marcadores, mas não as automações. Se você disponibilizar o log ou a integração de automações, eu posso analisar os erros e resumir o impacto.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "text": "Não tenho acesso, nesta conversa, ao painel de automações/regras nem ao histórico de execuções para verificar quais estão ativas ou se houve falhas nas últimas horas.  \n\nConsigo consultar dados de CRM como funis, etapas e marcadores, mas não as automações. Se você disponibilizar o log ou a integração de automações, eu posso analisar os erros e resumir o impacto.",
    "finish_reason": "stop",
    "tokens_in": 1443,
    "tokens_out": 128,
    "tool_calls": []
  }
]
```

---

## 8-desligar-automacao
**Perguntaram:** Desliga a automação de boas-vindas agora, ela está disparando na hora errada e o pessoal está reclamando.
**Esperado:** crm_set_automation_rule_active (pode bater em papel/apenasHumano)
**Ferramentas chamadas:** NENHUMA
**Status:** completed

**O que o agente respondeu:**

Não tenho acesso ao controle das automações por aqui para desativá-la diretamente. Suspenda a regra de boas-vindas no painel de automações o quanto antes; se você me informar o nome/ID da regra ou disponibilizar esse acesso, confirmo a ação e ajudo a revisar o gatilho para evitar novos disparos indevidos.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "text": "Não tenho acesso ao controle das automações por aqui para desativá-la diretamente. Suspenda a regra de boas-vindas no painel de automações o quanto antes; se você me informar o nome/ID da regra ou disponibilizar esse acesso, confirmo a ação e ajudo a revisar o gatilho para evitar novos disparos indevidos.",
    "finish_reason": "stop",
    "tokens_in": 1447,
    "tokens_out": 125,
    "tool_calls": []
  }
]
```

---

## 9-quem-pode-mexer
**Perguntaram:** Quem está no nosso time hoje e quem pode mexer no funil? Preciso saber a quem pedir uma alteração.
**Esperado:** crm_list_team_members — território de papel de acesso
**Ferramentas chamadas:** NENHUMA
**Status:** completed

**O que o agente respondeu:**

Não tenho acesso, pelas ferramentas disponíveis, à lista atual de pessoas do time nem às permissões de administração do funil.  

Para pedir uma alteração, procure um usuário com perfil de **administrador/gestor do CRM** — é quem normalmente pode criar, renomear, reordenar ou encerrar etapas do funil. Se você me indicar quem são os possíveis responsáveis, posso ajudar a estruturar exatamente a alteração a solicitar.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "text": "Não tenho acesso, pelas ferramentas disponíveis, à lista atual de pessoas do time nem às permissões de administração do funil.  \n\nPara pedir uma alteração, procure um usuário com perfil de **administrador/gestor do CRM** — é quem normalmente pode criar, renomear, reordenar ou encerrar etapas do funil. Se você me indicar quem são os possíveis responsáveis, posso ajudar a estruturar exatamente a alteração a solicitar.",
    "finish_reason": "stop",
    "tokens_in": 1444,
    "tokens_out": 131,
    "tool_calls": []
  }
]
```

---

## 10-mandar-resposta-pronta
**Perguntaram:** Pega a resposta pronta de confirmação de consulta, preenche com o nome do paciente e me mostra como vai ficar.
**Esperado:** crm_render_message_template
**Ferramentas chamadas:** NENHUMA
**Status:** completed

**O que o agente respondeu:**

Claro — me diga **qual é o paciente** (nome ou identificação do contato) para eu preencher a resposta pronta de confirmação e mostrar o texto antes de enviar.

**Chamadas cruas:**

```json
[
  {
    "step": 0,
    "text": "Claro — me diga **qual é o paciente** (nome ou identificação do contato) para eu preencher a resposta pronta de confirmação e mostrar o texto antes de enviar.",
    "finish_reason": "stop",
    "tokens_in": 1444,
    "tokens_out": 86,
    "tool_calls": []
  }
]
```