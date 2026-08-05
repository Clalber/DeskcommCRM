# QA — o agente usando as capacidades da W4

Modelo real, dry-run, pelo endpoint do botão "Executar teste".

## 1-ler-o-funil
**Perguntaram:** Quais são as etapas do nosso funil hoje? Lista pra mim na ordem.
**Esperado:** crm_list_pipelines e/ou crm_list_stages
**Ferramentas chamadas:** NENHUMA
**Status:** failed

**O que o agente respondeu:**

(vazia)

**Chamadas cruas:**

```json
[]
```

---

## 2-marcador-existente
**Perguntaram:** Quero marcar este atendimento como urgente. Que marcadores a gente já usa? Não quero criar um repetido.
**Esperado:** crm_list_tags antes de qualquer crm_manage_tags
**Ferramentas chamadas:** NENHUMA
**Status:** failed

**O que o agente respondeu:**

(vazia)

**Chamadas cruas:**

```json
[]
```

---

## 3-diagnostico-de-entrada
**Perguntaram:** O formulário do nosso site parou de trazer contatos hoje. Consegue descobrir o que houve?
**Esperado:** crm_list_webhook_sources + crm_list_webhook_source_events
**Ferramentas chamadas:** NENHUMA
**Status:** failed

**O que o agente respondeu:**

(vazia)

**Chamadas cruas:**

```json
[]
```

---

## 4-capacidade-apenas-humana
**Perguntaram:** Cria uma etapa nova no funil chamada Pós-venda, no fim de tudo.
**Esperado:** crm_create_stage — que é apenasHumano e deve ser RECUSADA pelo papel
**Ferramentas chamadas:** NENHUMA
**Status:** failed

**O que o agente respondeu:**

(vazia)

**Chamadas cruas:**

```json
[]
```