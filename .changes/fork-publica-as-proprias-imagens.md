---
impacto: exige_acao
secao: alterado
titulo: Esta instalação passa a seguir as versões deste fork
---

As três imagens do sistema (aplicação, worker e agendador) passam a vir do
registro **deste fork**, não do projeto de origem.

**Por que isso era necessário.** O `update.sh` reescreve o endereço das imagens
no `.env` a cada atualização, montando-o a partir de uma constante no código.
Enquanto ela apontasse para o projeto de origem, qualquer funcionalidade
própria — a começar pelo canal de Instagram — desapareceria na primeira
atualização, com o sistema no ar e nada na tela dizendo o que houve.

**O que muda para quem opera.** Nada no dia a dia: atualizar continua sendo o
mesmo botão, e o backup automático antes de cada atualização continua igual. O
que muda é de onde a versão nova vem.

**A ação, uma única vez, em instalação que já existia:** apontar a pasta do
projeto no servidor para este repositório. Instalação nova já nasce certa.

**A consequência a assumir:** as versões deste fork são independentes. Trazer
novidade do projeto de origem passa a ser uma decisão explícita, não algo que
chega sozinho.

## Requer atenção

Numa instalação que já existe, apontar a pasta do projeto no servidor para este
repositório — uma vez só:

```bash
cd /opt/deskcomm
git remote set-url origin https://github.com/Clalber/DeskcommCRM.git
git fetch origin --tags
bash hostgator-setup-kit/update.sh
```

Enquanto isso não for feito, a atualização continua puxando as imagens do
projeto de origem e as funcionalidades próprias somem a cada versão nova.

Instalação nova não precisa de nada: ela já clona deste repositório.
