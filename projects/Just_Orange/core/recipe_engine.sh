#!/usr/bin/env bash
# Just Orange — core recipe engine (token-efficient, cached, cheap)
set -euo pipefail

MODEL="${JO_MODEL:-gpt-4o-mini}"
MAX_TOKENS="${JO_MAX_TOKENS:-180}"
RETRIES="${JO_RETRIES:-3}"
TIMEOUT="${JO_TIMEOUT:-20}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DB="${JO_CACHE_DB:-$SCRIPT_DIR/cache.db}"

json_error() {
  jq -n --arg msg "$1" '{"error": $msg}'
  exit 1
}

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  if [[ -t 0 ]] && [[ "${0##*/}" == "recipe_engine.sh" ]]; then
    read -r -s -p $'\nEnter OpenAI API Key (sk-...): ' OPENAI_API_KEY
    echo
    [[ -z "$OPENAI_API_KEY" ]] && json_error "API key required"
    export OPENAI_API_KEY
  else
    json_error "OPENAI_API_KEY not set"
  fi
fi

INGREDIENTS=""
TASTE="mild"
PREP=""
EAT=""
ALLERGENS="none"
EXCLUSIONS="none"

while [[ $# -gt 0 ]]; do
  case $1 in
    --ingredients) INGREDIENTS="${2:-}"; shift 2 ;;
    --taste)       TASTE="${2:-mild}"; shift 2 ;;
    --prep)        PREP="${2:-}"; shift 2 ;;
    --eat)         EAT="${2:-}"; shift 2 ;;
    --allergens)   ALLERGENS="${2:-none}"; shift 2 ;;
    --exclusions)  EXCLUSIONS="${2:-none}"; shift 2 ;;
    -h|--help)
      echo "Usage: recipe_engine.sh --ingredients \"a,b\" --prep N --eat N [--taste t] [--allergens x] [--exclusions y]"
      exit 0
      ;;
    *) json_error "Unknown argument: $1" ;;
  esac
done

[[ -z "${INGREDIENTS}" || -z "${PREP}" || -z "${EAT}" ]] && json_error "Missing required args: --ingredients --prep --eat"

# Validate numbers
[[ "$PREP" =~ ^[0-9]+$ && "$EAT" =~ ^[0-9]+$ ]] || json_error "prep and eat must be integers"

INGREDIENTS_RAW="$INGREDIENTS"
# Normalize whitespace
INGREDIENTS=$(printf '%s' "$INGREDIENTS" | tr -s ' ' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
TASTE=$(printf '%s' "${TASTE:-mild}" | tr -s ' ')
ALLERGENS=$(printf '%s' "${ALLERGENS:-none}" | tr ',' '/' | tr -s ' ')
EXCLUSIONS=$(printf '%s' "${EXCLUSIONS:-none}" | tr ',' '/' | tr -s ' ')

CACHE_KEY=$(printf "%s|%s|%s|%s|%s|%s" \
  "$(printf '%s' "$INGREDIENTS" | tr '[:upper:]' '[:lower:]')" \
  "$(printf '%s' "$TASTE" | tr '[:upper:]' '[:lower:]')" \
  "$PREP" "$EAT" \
  "$(printf '%s' "$ALLERGENS" | tr '[:upper:]' '[:lower:]')" \
  "$(printf '%s' "$EXCLUSIONS" | tr '[:upper:]' '[:lower:]')" \
  | sha256sum | awk '{print $1}')

mkdir -p "$(dirname "$CACHE_DB")"
sqlite3 "$CACHE_DB" "CREATE TABLE IF NOT EXISTS recipes(
  hash TEXT PRIMARY KEY,
  ingredients TEXT,
  taste TEXT,
  prep INTEGER,
  eat INTEGER,
  allergens TEXT,
  exclusions TEXT,
  recipe TEXT,
  ts INTEGER
);"

CACHED=$(sqlite3 "$CACHE_DB" "SELECT recipe FROM recipes WHERE hash='$CACHE_KEY' AND recipe IS NOT NULL AND recipe != '';")
if [[ -n "$CACHED" ]]; then
  printf '%s\n' "$CACHED"
  exit 0
fi

# Token-efficient prompt — one recipe, strict format
PROMPT=$(cat <<EOF
Using only these exact ingredients: ${INGREDIENTS}.
Create one very short ${TASTE} recipe.
Prep ≤${PREP}min, ready to eat ≤${EAT}min.
Never add anything else.
Skip allergens: ${ALLERGENS}.
Never use: ${EXCLUSIONS}.
Strict format only:
TITLE
Ingredients (quantities):
- item (qty)
Steps:
1. First step.
2. Second step.
3. Serve.
EOF
)

# Build JSON safely with jq
REQUEST_BODY=$(jq -n \
  --arg model "$MODEL" \
  --arg content "$PROMPT" \
  --argjson max "$MAX_TOKENS" \
  '{
    model: $model,
    messages: [{role: "user", content: $content}],
    max_tokens: $max,
    temperature: 0.3
  }')

RESPONSE=""
for i in $(seq 1 "$RETRIES"); do
  HTTP_CODE=0
  RESPONSE=$(curl -sS --max-time "$TIMEOUT" \
    -w "\n%{http_code}" \
    https://api.openai.com/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${OPENAI_API_KEY}" \
    -d "$REQUEST_BODY" || true)

  HTTP_CODE=$(printf '%s\n' "$RESPONSE" | tail -n1)
  BODY=$(printf '%s\n' "$RESPONSE" | sed '$d')

  if [[ "$HTTP_CODE" == "200" ]]; then
    RECIPE=$(printf '%s' "$BODY" | jq -r '.choices[0].message.content // empty')
    if [[ -n "$RECIPE" && "$RECIPE" != "null" ]]; then
      # Escape for SQLite
      sql_escape() { printf '%s' "$1" | sed "s/'/''/g"; }
      sqlite3 "$CACHE_DB" "INSERT OR REPLACE INTO recipes VALUES(
        '$(sql_escape "$CACHE_KEY")',
        '$(sql_escape "$INGREDIENTS_RAW")',
        '$(sql_escape "$TASTE")',
        $PREP,
        $EAT,
        '$(sql_escape "${ALLERGENS:-none}")',
        '$(sql_escape "${EXCLUSIONS:-none}")',
        '$(sql_escape "$RECIPE")',
        $(date +%s)
      );"
      printf '%s\n' "$RECIPE"
      exit 0
    fi
  fi

  # rate limit / server errors → backoff
  sleep $((i * 2))
  RESPONSE="$BODY"
done

ERR=$(printf '%s' "${RESPONSE:-}" | jq -r '.error.message // "unknown error"' 2>/dev/null || echo "unknown error")
json_error "API failed: $ERR"
