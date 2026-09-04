---
impacto: capacidade_nova
secao: adicionado
titulo: O servidor pode falar com o Supabase por dentro da rede
---
Quem roda o Supabase na mesma máquina do CRM pode fazer o servidor conversar com ele por dentro da rede dos contêineres, em vez de sair para a internet e voltar. Passa a existir a variável opcional `SUPABASE_INTERNAL_URL` e o arquivo de compose `docker-compose.supabase-interno.yml`.

**Sem configurar nada, nada muda.** A variável nasce vazia e todo caminho continua pela URL pública, exatamente como hoje — inclusive para quem usa Supabase na nuvem, que não deve mexer nisso.

Por que existe: numa VPS real, medimos 3,9 ms por dentro contra 67,6 ms pela volta. E a lentidão é o menor problema — quando o proxy da frente engasga, o que chega no lugar da resposta é uma página HTML de erro que o sistema não sabe ler. Em 24 horas isso derrubou o worker de follow-up, o cron que recupera mensagem presa, e fez uma automação nascer duplicada.

O navegador continua usando a URL pública, que segue obrigatória. Links de mídia e de exportação de LGPD são convertidos de volta para o endereço público antes de sair, então fotos e anexos abrem normalmente.
