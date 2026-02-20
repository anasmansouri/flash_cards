#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Please set OPENAI_API_KEY first."
  exit 1
fi

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
curl -s "http://localhost:3001/api/cards/$CARD_ID/generation" -H "Authorization: Bearer $TOKEN"
echo

echo "Reveal payload (should not be demo sentence if OpenAI works):"
curl -s -X POST "http://localhost:3001/api/cards/$CARD_ID/unknown" -H "Authorization: Bearer $TOKEN"
echo
