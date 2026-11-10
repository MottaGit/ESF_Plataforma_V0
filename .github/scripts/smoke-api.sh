#!/usr/bin/env bash
# Teste de subida da API, usado pelo CI (.github/workflows/ci.yml). Com a API no ar num PostgreSQL que comecou vazio
# (migracoes e dados de demonstracao aplicados ao iniciar, como no deploy), entra com as contas de demonstracao e
# chama as rotas principais de cada tela, inclusive algumas gravacoes, os PDFs e a planilha. Pega o que os testes de
# servico nao pegam: servico esquecido no Program.cs, rota ou politica quebrada, consulta que o PostgreSQL recusa,
# historico de alteracoes gravando de verdade, PDF que nao gera no Linux.
#
# Uso: SEED_DEMO_PASSWORD=... API=http://localhost:5080 bash .github/scripts/smoke-api.sh
set -euo pipefail

API="${API:-http://localhost:5080}"
PASSWORD="${SEED_DEMO_PASSWORD:?defina SEED_DEMO_PASSWORD}"
BODY="$(mktemp)"
JSON=(-H 'Content-Type: application/json')
failures=0

fail() {
  echo "::error title=$1::$2"
  failures=$((failures + 1))
}

login() {
  curl -sS --fail-with-body -X POST "$API/api/auth/login" "${JSON[@]}" \
    -d "{\"email\":\"$1\",\"password\":\"$PASSWORD\"}" | jq -er .token
}

# call TOKEN METODO ROTA [argumentos do curl]: confere se respondeu 2xx; a resposta fica em $BODY.
# TOKEN "-" chama sem login.
call() {
  local token=$1 method=$2 path=$3
  shift 3
  local auth=()
  if [[ $token != - ]]; then auth=(-H "Authorization: Bearer $token"); fi
  local status
  status=$(curl -sS -o "$BODY" -w '%{http_code}' -X "$method" "$API$path" "${auth[@]}" "$@")
  if [[ $status == 2* ]]; then
    printf 'ok   %s %-6s %s\n' "$status" "$method" "$path"
  else
    printf 'ERRO %s %-6s %s\n' "$status" "$method" "$path"
    fail "Rota com erro" "$method $path respondeu $status: $(head -c 500 "$BODY" | tr '\n' ' ')"
  fi
}

# deny TOKEN METODO ROTA [STATUS]: confere que a rota recusa o perfil (403, ou o STATUS informado).
deny() {
  local expected=${4:-403} status
  status=$(curl -sS -o "$BODY" -w '%{http_code}' -X "$2" "$API$3" -H "Authorization: Bearer $1")
  if [[ $status == "$expected" ]]; then
    printf 'ok   %s %-6s %s (recusada, como deve)\n' "$status" "$2" "$3"
  else
    fail "Acesso aberto demais" "$2 $3 deveria responder $expected e respondeu $status."
  fi
}

# expect FILTRO_JQ MENSAGEM: confere a ultima resposta.
expect() {
  if ! jq -e "$1" "$BODY" > /dev/null 2>&1; then fail "Resposta inesperada" "$2"; fi
}

expect_pdf() {
  if [[ $(head -c 4 "$BODY") != "%PDF" ]]; then fail "PDF não gerado" "$1 não devolveu um PDF."; fi
}

# field FILTRO_JQ: valor da ultima resposta (vazio se nao houver).
field() {
  jq -r "$1 // empty" "$BODY" 2>/dev/null || true
}

today=$(TZ=America/Sao_Paulo date +%F)

echo "== Administrador do núcleo (ESF Porto Alegre)"
admin=$(login leonardo.motta@esf.org.br)

for path in /api/auth/me /api/dashboard /api/organization /api/volunteers/load /api/activities/upcoming \
  /api/activities/board /api/notifications /api/notifications/unread /api/national-indicators /api/users \
  /api/audit /api/reports/period-counts /api/me/term; do
  call "$admin" GET "$path"
done

call "$admin" GET "/api/search?q=HORTA"
expect '.projects | length > 0' 'A busca por "HORTA" não achou projeto (função esf_fold no PostgreSQL).'

call "$admin" GET /api/projects
expect 'length > 0' 'A lista de projetos veio vazia: os dados de demonstração não foram criados.'
project=$(field '.[0].id')
projects=$(jq -c '[.[].id]' "$BODY")

call "$admin" GET "/api/projects/$project"
member=$(field '.volunteers[0].volunteerId')
for path in /activities /indicators /updates /files /hours /documents; do
  call "$admin" GET "/api/projects/$project$path"
done
call "$admin" GET "/api/projects/$project/documents/template"
expect_pdf "O modelo de autorização de imagem"

call "$admin" GET "/api/projects/$project/activities"
activity=$(field '.[0].id')
if [[ -n $activity ]]; then
  call "$admin" GET "/api/activities/$activity/details"
  call "$admin" GET "/api/activities/$activity/mentionable"
fi

call "$admin" GET /api/programs
program=$(field '.[0].id')
for path in "" /template /partners /public-page; do
  call "$admin" GET "/api/programs/$program$path"
done

call "$admin" GET /api/volunteers
volunteer=$(field '.[0].id')
for path in "" /hours /documents /certificate/options; do
  call "$admin" GET "/api/volunteers/$volunteer$path"
done
if [[ -n $(field '.full') ]]; then
  call "$admin" POST "/api/volunteers/$volunteer/certificate" "${JSON[@]}" -d '{"kind":"Full"}'
  expect_pdf "O certificado de voluntariado"
fi

echo "== Gravações (passam pelo histórico de alterações)"
call "$admin" POST "/api/projects/$project/activities" "${JSON[@]}" \
  -d '{"title":"Tarefa criada pelo CI","status":"AFazer","priority":"Media"}'
if [[ -n $member ]]; then
  call "$admin" POST "/api/projects/$project/hours" "${JSON[@]}" \
    -d "{\"volunteerId\":\"$member\",\"date\":\"$today\",\"hours\":2,\"description\":\"Visita do CI\"}"
fi
call "$admin" POST "/api/projects/$project/updates" -F 'text=<p>Registro de <strong>andamento</strong> do CI</p>'
call "$admin" GET /api/audit
expect '[.. | strings | select(test("pelo CI"))] | length > 0' \
  'O histórico de alterações não registrou a tarefa criada pelo CI.'

call "$admin" PUT "/api/programs/$program/public-page" "${JSON[@]}" -d '{"enabled":true}'
public_token=$(field '.token')
if [[ -n $public_token ]]; then
  call - GET "/api/public/programs/$public_token"
else
  fail "Página pública" "Ligar a página pública do programa não devolveu o link."
fi

echo "== Relatórios e planilha"
call "$admin" POST /api/reports/projects "${JSON[@]}" -d "{\"projectIds\":$projects,\"format\":\"Completo\"}"
expect_pdf "O relatório completo"
call "$admin" POST /api/reports/projects "${JSON[@]}" -d "{\"projectIds\":$projects,\"format\":\"Resumo\"}"
expect_pdf "O relatório resumido"
call "$admin" POST /api/spreadsheets/export "${JSON[@]}" -d '{"projects":true,"volunteers":true}'
call "$admin" GET /api/spreadsheets/template

echo "== Perfil Usuário"
user=$(login fausto.silva@esf.org.br)
for path in /api/auth/me /api/dashboard /api/projects /api/me/term "/api/activities/upcoming?mine=true"; do
  call "$user" GET "$path"
done
deny "$user" GET /api/audit
deny "$user" GET /api/spreadsheets/template
deny "$user" GET /api/national/panel

echo "== Gestão nacional"
national=$(login nacional@esf.org.br)
for path in /api/auth/me /api/national/panel /api/national/nucleos /api/national/people /api/national-indicators; do
  call "$national" GET "$path"
done
deny "$national" GET /api/audit

echo "== Outro núcleo (ESF Curitiba)"
curitiba=$(login marina.costa@esf.org.br)
call "$curitiba" GET /api/projects
expect "map(.id) | index(\"$project\") | not" 'ESF Curitiba viu um projeto de Porto Alegre na lista.'
# Projeto de Porto Alegre: para Curitiba, nao existe.
deny "$curitiba" GET "/api/projects/$project" 404

echo
if (( failures > 0 )); then
  echo "$failures problema(s) encontrado(s)."
  exit 1
fi
echo "Tudo certo."
