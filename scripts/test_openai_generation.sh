#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Please set OPENAI_API_KEY first."
  exit 1
fi

echo "Preflight: checking key with OpenAI /v1/models ..."
HTTP_CODE=$(curl -s -o /tmp/openai_preflight_body.txt -w "%{http_code}" https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "OpenAI preflight failed (HTTP $HTTP_CODE)."
  echo "Response snippet:"
  head -c 300 /tmp/openai_preflight_body.txt; echo
  echo "Fix key/project/billing first, then retry."
  exit 1
fi

echo "OpenAI key accepted (HTTP 200)."

EMAIL="openai-test-$(date +%s)@example.com"

javac backend-java/src/Main.java -d backend-java/out
java -cp backend-java/out Main >/tmp/java_api.log 2>&1 &
PID=$!
cleanup(){ kill $PID >/dev/null 2>&1 || true; }
trap cleanup EXIT
sleep 1

TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/signup \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"secret12\"}" | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s -X PATCH http://localhost:3001/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"knownLanguage":"en","targetLanguage":"de","level":"A1"}' >/dev/null

CREATE=$(curl -s -X POST http://localhost:3001/api/cards \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"aufgeben","groupMode":"default"}')

CARD_ID=$(echo "$CREATE" | sed -E 's/.*"cardId":"([^"]+)".*/\1/')

echo "Create response: $CREATE"
echo "Generation status:"
STATUS=$(curl -s "http://localhost:3001/api/cards/$CARD_ID/generation" -H "Authorization: Bearer $TOKEN")
echo "$STATUS"
echo

echo "Reveal payload:"
REVEAL=$(curl -s -X POST "http://localhost:3001/api/cards/$CARD_ID/unknown" -H "Authorization: Bearer $TOKEN")
echo "$REVEAL"
echo

if echo "$STATUS" | grep -q '"source":"openai"'; then
  echo "✅ OpenAI generation is active."
else
  echo "⚠️ Backend used demo fallback. See 'error' in generation status above and /tmp/java_api.log"
fi
