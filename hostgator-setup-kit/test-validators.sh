#!/usr/bin/env bash
#
# Testa os validadores do install.sh — as guardas que impedem alguém de avançar
# a instalação com um dado errado. Só casos que NÃO dependem de rede: formato,
# papel da chave, projeto cruzado, Direct-connection e senha não codificada.
# As checagens online (curl/psql) são provadas na instalação real.
#
#   bash hostgator-setup-kit/test-validators.sh
#
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

INSTALL_SH_LIB=1 . ./install.sh
set +e   # o install.sh liga `set -e`; aqui esperamos validadores falharem de propósito

fail=0
# ok <descrição> <pass|reject> <validador> <valor> [trecho esperado na mensagem]
#
# O trecho esperado não é firula: sem ele o teste passa por acaso. Provado —
# ao remover o guard da Direct connection, a URL seguia até o psql e era
# rejeitada por *falha de conexão*, com o teste ainda verde. Rejeição só conta
# quando é pelo motivo certo, e é a mensagem que diz o motivo à pessoa.
ok() {
  local desc="$1" expect="$2" fn="$3" val="${4-}" want="${5-}"
  local out rc
  if out="$("$fn" "$val" 2>&1)"; then rc=0; else rc=$?; fi
  if [ "$expect" = pass ]; then
    if [ $rc -eq 0 ]; then printf '  ✓ %s\n' "$desc"
    else printf '  ✗ %s  (esperava aceitar, rejeitou: %s)\n' "$desc" "$(printf '%s' "$out" | head -1)"; fail=1; fi
    return
  fi
  if [ $rc -eq 0 ]; then
    printf '  ✗ %s  (esperava rejeitar, aceitou)\n' "$desc"; fail=1; return
  fi
  if [ -n "$want" ] && ! printf '%s' "$out" | grep -qi -- "$want"; then
    printf '  ✗ %s  (rejeitou, mas pelo motivo errado)\n     esperava falar de: %s\n     disse: %s\n' \
      "$desc" "$want" "$(printf '%s' "$out" | head -1)"; fail=1; return
  fi
  printf '  ✓ %s\n' "$desc"
}

# A anon/service_role e a db_url comparam contra o projeto declarado.
NEXT_PUBLIC_SUPABASE_URL="https://abcdefghijklmnop.supabase.co"

# JWT falso: header.payload.assinatura, payload com role e ref.
mkjwt() {
  local payload; payload="$(printf '{"iss":"supabase","ref":"%s","role":"%s"}' "$2" "$1" \
    | base64 | tr -d '\n' | tr '+/' '-_' | tr -d '=')"
  printf 'eyJhbGciOiJIUzI1NiJ9.%s.assinatura' "$payload"
}

echo "domínio"
ok "aceita subdomínio"        pass   v_domain "crm.empresa.com.br"
ok "rejeita com https://"     reject v_domain "https://crm.empresa.com.br"  "sem https"
ok "rejeita com caminho"      reject v_domain "crm.empresa.com.br/app"      "sem barra"
ok "rejeita sem ponto"        reject v_domain "localhost"                   "falta o ponto"

echo "e-mail"
ok "aceita e-mail válido"     pass   v_email "voce@empresa.com.br"
ok "rejeita sem @"            reject v_email "voce.empresa.com.br"          "inválido"

echo "chaves do Supabase (formato/papel/projeto)"
ok "rejeita service_role no campo anon" reject v_anon    "$(mkjwt service_role abcdefghijklmnop)" "preciso da 'anon'"
ok "rejeita anon no campo service_role" reject v_service "$(mkjwt anon abcdefghijklmnop)"         "preciso da 'service_role'"
ok "rejeita chave de outro projeto"     reject v_anon    "$(mkjwt anon zzzzzzzzzzzzzzzz)"         "OUTRO projeto"
ok "rejeita texto que não é chave"      reject v_anon    "minha-chave-secreta"                    "não parece uma chave"

echo "connection string"
ok "rejeita [YOUR-PASSWORD] não trocado" reject v_db_url "postgresql://postgres.abcdefghijklmnop:[YOUR-PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres" "troque isso pela senha"
ok "rejeita Direct connection (IPv6)"    reject v_db_url "postgresql://postgres:senha@db.abcdefghijklmnop.supabase.co:5432/postgres"                                "Session pooler"
ok "rejeita string de outro projeto"     reject v_db_url "postgresql://postgres.zzzzzzzzzzzzzzzz:senha@aws-1-us-west-2.pooler.supabase.com:5432/postgres"          "mesmo projeto"
ok "rejeita o que não é URL de Postgres" reject v_db_url "aws-1-us-west-2.pooler.supabase.com"                                                                     "começa com postgresql"

echo "chaves de IA e senha"
ok "rejeita chave Anthropic com prefixo errado" reject v_anthropic "sk-proj-abc123" "começa com 'sk-ant-'"
ok "rejeita chave OpenAI com prefixo errado"    reject v_openai    "minha-chave"    "começa com 'sk-'"
ok "aceita OpenAI vazia (é opcional)"           pass   v_openai    ""
ok "rejeita senha curta"                        reject v_password  "1234567"        "muito curta"
ok "aceita senha de 8+"                         pass   v_password  "12345678"

echo "leitura do .env (load_env)"
. ./_common.sh
set +e
TMP="$(mktemp -d)"
cat > "$TMP/.env" <<'EOF'
# comentário deve ser ignorado
APP_NAME='Loja do João'
SENHA_COM_HASH='a#b'
SENHA_COM_CIFRAO='p$ass'
COM_ASPAS_DUPLAS="valor com espaço"
SEM_ASPAS=simples
LEGADO_SEM_ASPAS=Loja Antiga
linha sem igual
EOF
( load_env "$TMP/.env"
  eq() { if [ "$2" = "$3" ]; then printf '  ✓ %s\n' "$1"; else printf '  ✗ %s  esperava [%s] obteve [%s]\n' "$1" "$3" "$2"; exit 1; fi; }
  eq "nome com espaço"            "$APP_NAME"            "Loja do João"
  eq "senha com # não trunca"     "$SENHA_COM_HASH"      'a#b'
  eq "senha com \$ não expande"    "$SENHA_COM_CIFRAO"    'p$ass'
  eq "aspas duplas"               "$COM_ASPAS_DUPLAS"    "valor com espaço"
  eq "sem aspas"                  "$SEM_ASPAS"           "simples"
  eq "legado sem aspas c/ espaço" "$LEGADO_SEM_ASPAS"    "Loja Antiga"
) || fail=1
rm -rf "$TMP"

echo "credenciais do provisionamento (sb_carrega_credenciais)"
# Este bloco existe porque a leitura já foi feita com `eval`, e com `eval` ela
# EXECUTAVA o conteúdo: o provisionamento imprime `CHAVE='valor'` sem escapar a
# aspa simples, e SUPABASE_REGION — que vem do ambiente — é interpolada dentro da
# connection string. Medido: com `eval`, o marcador abaixo era criado.
TMP2="$(mktemp -d)"
(
  MARCA="$TMP2/executou"
  # Exatamente o que o provisionamento emite quando a região traz uma aspa simples.
  VENENO="postgresql://postgres.ref:senha@aws-0-sa-east-1'\$(touch $MARCA)'.pooler.supabase.com:5432/postgres"
  PATH_ANTES="$PATH"
  unset NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY SUPABASE_DB_URL

  sb_carrega_credenciais "$(printf "SUPABASE_DB_URL='%s'\n" "$VENENO")"

  eq() { if [ "$2" = "$3" ]; then printf '  ✓ %s\n' "$1"; else printf '  ✗ %s  esperava [%s] obteve [%s]\n' "$1" "$3" "$2"; exit 1; fi; }
  if [ -e "$MARCA" ]; then printf '  ✗ aspa simples no valor EXECUTOU comando\n'; exit 1; fi
  printf '  ✓ aspa simples no valor não executa comando\n'
  eq "valor com aspa chega literal"    "${SUPABASE_DB_URL:-}"  "$VENENO"

  # Chave fora da lista fixa é ignorada — a saída não pode criar variável qualquer.
  sb_carrega_credenciais "PATH='/pwn'"
  eq "chave desconhecida é ignorada"   "$PATH"                 "$PATH_ANTES"

  # E o caminho feliz continua inteiro.
  unset SUPABASE_DB_URL
  sb_carrega_credenciais "$(printf "NEXT_PUBLIC_SUPABASE_URL='https://abc.supabase.co'\nSUPABASE_DB_URL='postgresql://u:p@h:5432/postgres'\n")"
  eq "url normal chega íntegra"        "${NEXT_PUBLIC_SUPABASE_URL:-}" "https://abc.supabase.co"
  eq "db_url normal chega íntegra"     "${SUPABASE_DB_URL:-}"          "postgresql://u:p@h:5432/postgres"
) || fail=1
rm -rf "$TMP2"

echo "integração: o install.sh não INTERPRETA a saída do provisionamento"
# O bloco de cima guarda a FUNÇÃO; este guarda o PONTO DE CHAMADA — trocar
# `sb_carrega_credenciais "$_sb_out"` de volta por `eval "$_sb_out"` passava
# despercebido, porque a função continuava correta e ninguém mais a chamava.
#
# Guarda o COMPORTAMENTO, não o texto: uma asserção do tipo "não existe a palavra
# eval" pegaria só a reincidência literal, e `. <(printf %s "$_sb_out")` executa
# igual. Aqui o install.sh roda de verdade (docker é stub, nada de rede) com um
# provisionamento que devolve uma aspa simples no valor; se qualquer mecanismo
# interpretar aquilo, o marcador aparece.
TMP3="$(mktemp -d)"
(
  MARCA="$TMP3/executou"
  mkdir -p "$TMP3/bin" "$TMP3/proj"
  cp install.sh _common.sh "$TMP3/"
  : > "$TMP3/proj/docker-compose.prod.yml"
  printf '#!/usr/bin/env bash\nexit 0\n' > "$TMP3/bin/docker"; chmod +x "$TMP3/bin/docker"
  cat > "$TMP3/supabase-provision.sh" <<'PROV'
#!/usr/bin/env bash
# O que o provisionamento emite quando SUPABASE_REGION (que vem do ambiente)
# traz uma aspa simples: ela fecha o literal do printf e o resto vira código.
VENENO="postgresql://u:p@aws-0-x'\$(touch $MARCA)'.pooler.supabase.com:5432/postgres"
printf "NEXT_PUBLIC_SUPABASE_URL='https://ref.supabase.co'\n"
printf "NEXT_PUBLIC_SUPABASE_ANON_KEY='a'\n"
printf "SUPABASE_SERVICE_ROLE_KEY='s'\n"
printf "SUPABASE_DB_URL='%s'\n" "$VENENO"
PROV

  saida="$(cd "$TMP3/proj" && env PATH="$TMP3/bin:$PATH" MARCA="$MARCA" \
    SUPABASE_ACCESS_TOKEN=fake NEXT_PUBLIC_SUPABASE_URL= \
    bash "$TMP3/install.sh" --yes 2>&1 || true)"

  # Sem esta checagem o teste passaria por VACUIDADE: se o install.sh morresse
  # antes do bloco (stub quebrado, refactor movendo o trecho), nada executaria o
  # veneno e o silêncio seria lido como aprovação.
  if ! printf '%s' "$saida" | grep -q "credenciais entraram sozinhas"; then
    printf '  ✗ o install.sh não chegou ao bloco do Supabase — teste inconclusivo, não verde\n'; exit 1
  fi
  if [ -e "$MARCA" ]; then
    printf '  ✗ o install.sh INTERPRETOU a saída do provisionamento (eval/source no ponto de chamada?)\n'; exit 1
  fi
  printf '  ✓ ponto de chamada não interpreta a saída\n'
) || fail=1
rm -rf "$TMP3"

echo "sincronia: o install.sh grava as chaves que o .env.hostgator.example promete"
# O install.sh monta o .env a partir de uma LISTA FECHADA de `envq` e fecha com
# `} > .env`, que TRUNCA. Chave fora da lista simplesmente não é gravada — e se a
# pessoa a tiver posto à mão, some no próximo install, num script que o README
# vende como idempotente. Medido: uma chave posta à mão é carregada por load_env
# e depois DESCARTADA na escrita.
#
# Passou despercebido porque o env-example-sync do repo compara .env.example com
# lib/env.ts e nunca olha para o install.sh — ninguém guardava esta ponta.
#
# DÍVIDA: chaves que o install.sh hoje não grava. A lista só pode ENCOLHER; se
# uma delas passar a ser gravada, o teste manda tirá-la daqui.
DIVIDA="AGENT_DISPATCH_CONSUMER NUVEMSHOP_APP_ID NUVEMSHOP_CLIENT_ID NUVEMSHOP_CLIENT_SECRET RESEND_API_KEY RESEND_FROM_EMAIL"
EXEMPLO="${EXEMPLO_ENV:-../.env.hostgator.example}"
if [ ! -f "$EXEMPLO" ]; then
  # Pular é aceitável (o kit também roda solto, fora do repo), mas em voz alta:
  # pulo silencioso é indistinguível de teste que passou.
  printf '  — pulado: %s não existe (kit fora do repositório)\n' "$EXEMPLO"
else
  GRAVA="$(grep -oE '^[[:space:]]*envq [A-Z_0-9]+' install.sh | awk '{print $2}' | sort -u)"
  novas=""
  for k in $(grep -oE '^[A-Z_0-9]+=' "$EXEMPLO" | tr -d '=' | sort -u); do
    printf '%s\n' "$GRAVA" | grep -qx "$k" && continue
    case " $DIVIDA " in *" $k "*) continue ;; esac
    novas="$novas $k"
  done
  if [ -n "$novas" ]; then
    printf '  ✗ o .env.hostgator.example promete chave(s) que o install.sh não grava:%s\n' "$novas"
    printf '     quem instalar pelo kit não recebe essa configuração; quem puser à mão perde no próximo install\n'
    fail=1
  else
    printf '  ✓ nenhuma chave nova fora da lista de escrita\n'
  fi
  estagnada=""
  for k in $DIVIDA; do
    printf '%s\n' "$GRAVA" | grep -qx "$k" && estagnada="$estagnada $k"
  done
  if [ -n "$estagnada" ]; then
    printf '  ✗ já é gravada pelo install.sh — tire da lista DÍVIDA deste teste:%s\n' "$estagnada"
    fail=1
  else
    printf '  ✓ dívida ainda condiz (%s chaves conhecidas, só pode encolher)\n' "$(printf '%s' "$DIVIDA" | wc -w | tr -d ' ')"
  fi
fi

echo
if [ "$fail" = 0 ]; then echo "todos os validadores passaram"; else echo "FALHOU"; fi
exit "$fail"
