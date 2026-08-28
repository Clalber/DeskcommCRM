---
impacto: nada_mudou
secao: corrigido
titulo: Quatro consertos que a versão anterior anunciou e não trouxe chegam agora
---

A lista de mudanças da versão 1.10.0 anunciou quatro consertos que não estavam
dentro dela. Foi um erro nosso de ordem: os textos que descrevem os consertos
entraram no projeto antes do código deles, e a versão foi fechada no meio.

Se você atualizou para a 1.10.0 esperando alguma destas quatro coisas, elas
chegam agora:

- **A instalação nova não obriga mais a verificação em duas etapas logo de
  cara.** Quem instalava pelo instalador automático era parado por uma tela de
  verificação em duas etapas logo depois do primeiro acesso, sem nunca ter sido
  avisado disso.
- **Quando a inteligência artificial falha ao responder, o erro deixa de
  sumir.** A falha ficava só no registro técnico do servidor e não chegava a
  ninguém.
- **O instalador para de confundir comentário com valor de configuração.** No
  arquivo de exemplo da VPS, um comentário escrito na mesma linha do valor era
  lido como parte do valor.
- **Uma rede a mais contra vazamento entre empresas.** Uma tabela nova criada
  sem a proteção que separa os dados de cada empresa passa a ser recusada antes
  de chegar a você.

Nada a fazer além de atualizar normalmente. Quem instalar do zero a partir
desta versão nunca viu o problema.
