#!/usr/bin/env bash
# Just Orange CLI — zero-decision recipe generator (local + cache)
set -euo pipefail

ORANGE=$'\033[38;5;208m'
CYAN=$'\033[38;5;51m'
WHITE=$'\033[97m'
RED=$'\033[38;5;203m'
GREEN=$'\033[38;5;120m'
YELLOW=$'\033[38;5;227m'
PURPLE=$'\033[38;5;141m'
NC=$'\033[0m'
BOLD=$'\033[1m'
DIM=$'\033[2m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_SCRIPT="$SCRIPT_DIR/../core/recipe_engine.sh"
# Prefer repo-local cache; fall back to ~/Just_Orange if that's where we live
if [[ -d "$SCRIPT_DIR/../core" ]]; then
  CACHE_DB="$SCRIPT_DIR/../core/cache.db"
else
  CACHE_DB="${HOME}/Just_Orange/core/cache.db"
fi

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo -e "${RED}Missing dependency: $1${NC}"
    echo -e "${DIM}Install it, then re-run. (Need: bash curl jq sqlite3)${NC}"
    exit 1
  }
}

need_cmd curl
need_cmd jq
need_cmd sqlite3

banner() {
  clear
  echo -e "${ORANGE}${BOLD}"
  cat <<'EOF'
     ██ ██    ██ ███████ ████████      ██████  ██████   █████  ███    ██  ██████  ███████
     ██ ██    ██ ██         ██        ██    ██ ██   ██ ██   ██ ████   ██ ██       ██
     ██ ██    ██ ███████    ██        ██    ██ ██████  ███████ ██ ██  ██ ██   ███ █████
██   ██ ██    ██      ██    ██        ██    ██ ██   ██ ██   ██ ██  ██ ██ ██    ██ ██
 █████   ██████  ███████    ██         ██████  ██   ██ ██   ██ ██   ████  ██████  ███████
EOF
  echo -e "${NC}${CYAN}                Zero-Decision Recipe Generator${NC}\n"
}

ensure_key() {
  if [[ -z "${OPENAI_API_KEY:-}" ]]; then
    banner
    echo -e "${YELLOW}${BOLD}OpenAI API Key Required${NC}"
    echo -e "${DIM}(Key stays in this shell session only)${NC}\n"
    read -r -s -p "${CYAN}Enter your key (sk-...): ${NC}" OPENAI_API_KEY
    echo
    [[ -z "$OPENAI_API_KEY" ]] && echo -e "${RED}Key required!${NC}" && exit 1
    export OPENAI_API_KEY
    echo -e "${GREEN}Key loaded.${NC}\n"
    sleep 0.8
  fi
}

init_db() {
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
  );" 2>/dev/null || true
}

cache_count() {
  sqlite3 "$CACHE_DB" "SELECT COUNT(*) FROM recipes;" 2>/dev/null || echo 0
}

view_cached_recipes() {
  init_db
  local total
  total=$(cache_count)
  [[ "$total" -eq 0 ]] && echo -e "${YELLOW}No cached recipes yet — generate one first.${NC}\n" && sleep 1.5 && return

  while true; do
    mapfile -t entries < <(sqlite3 -separator $'\t' "$CACHE_DB" \
      "SELECT rowid, COALESCE(ingredients,''), COALESCE(taste,''), COALESCE(prep,0), COALESCE(eat,0),
              COALESCE(allergens,''), COALESCE(exclusions,''), datetime(ts,'unixepoch','localtime'),
              substr(recipe,1,80)
       FROM recipes ORDER BY ts DESC LIMIT 40;")

    total=${#entries[@]}
    clear
    echo -e "${ORANGE}${BOLD}Cached recipes (${total} shown)${NC}\n"

    local i=1
    for line in "${entries[@]}"; do
      IFS=$'\t' read -r id ings taste prep eat allergens exclusions date snippet <<<"$line"
      echo -e "${CYAN}${BOLD}$i${NC}) ${PURPLE}${date}${NC}  ${DIM}#${id}${NC}"
      echo -e "   ${DIM}Ingredients:${NC} ${WHITE}${ings:-?}${NC}"
      echo -e "   ${DIM}Taste:${NC} ${GREEN}${taste:-?}${NC} · ${DIM}Prep ≤${NC}${YELLOW}${prep}m${NC} · ${DIM}Total ≤${NC}${YELLOW}${eat}m${NC}"
      [[ -n "$allergens" && "$allergens" != "none" ]] && echo -e "   ${RED}Avoid: $allergens${NC}"
      [[ -n "$exclusions" && "$exclusions" != "none" ]] && echo -e "   ${RED}Exclude: $exclusions${NC}"
      echo -e "   ${DIM}${snippet//$'\n'/ }…${NC}"
      echo -e "${DIM}   ────────────────────────────────────${NC}"
      ((i++)) || true
    done

    echo -e "\n${CYAN}Options:${NC} (v) View full · (d) Delete · (c) Clear all · (enter) Back"
    read -r -n1 -p "${CYAN}>${NC} " opt; echo
    case "$opt" in
      v|V)
        read -r -p "${CYAN}Number [1-${total}]:${NC} " vid
        if [[ "$vid" =~ ^[0-9]+$ ]] && ((vid >= 1 && vid <= total)); then
          local rid
          rid=$(echo "${entries[$((vid - 1))]}" | cut -f1)
          echo
          sqlite3 "$CACHE_DB" "SELECT recipe FROM recipes WHERE rowid=$rid;"
          echo
          read -r -n1 -p "Press any key…"
        fi
        ;;
      d|D)
        read -r -p "${RED}Delete number [1-${total}]:${NC} " did
        if [[ "$did" =~ ^[0-9]+$ ]] && ((did >= 1 && did <= total)); then
          local rid
          rid=$(echo "${entries[$((did - 1))]}" | cut -f1)
          sqlite3 "$CACHE_DB" "DELETE FROM recipes WHERE rowid=$rid;"
          echo -e "${RED}Deleted.${NC}"; sleep 0.8
        fi
        ;;
      c|C)
        read -r -p "${RED}Type YES to clear entire cache:${NC} " conf
        if [[ "$conf" == "YES" ]]; then
          sqlite3 "$CACHE_DB" "DELETE FROM recipes;"
          echo -e "${RED}Cache cleared.${NC}"; sleep 1
          return
        fi
        ;;
      *) return ;;
    esac
  done
}

show_stats() {
  init_db
  clear
  banner
  local total unique_taste last
  total=$(cache_count)
  unique_taste=$(sqlite3 "$CACHE_DB" "SELECT COUNT(DISTINCT taste) FROM recipes;" 2>/dev/null || echo 0)
  last=$(sqlite3 "$CACHE_DB" "SELECT datetime(MAX(ts),'unixepoch','localtime') FROM recipes;" 2>/dev/null || echo "—")
  echo -e "${BOLD}${ORANGE}Local stats${NC}\n"
  echo -e "  Cached recipes : ${GREEN}${BOLD}${total}${NC}"
  echo -e "  Distinct tastes: ${GREEN}${unique_taste}${NC}"
  echo -e "  Last generated : ${WHITE}${last:-—}${NC}"
  echo -e "  Cache path     : ${DIM}${CACHE_DB}${NC}"
  echo -e "  Model          : ${DIM}gpt-4o-mini (token-capped)${NC}\n"
  read -r -n1 -p "Press any key…"
}

generate_recipe() {
  ensure_key
  clear
  banner

  read -r -e -p "${CYAN}>${NC} Ingredients (comma-separated): " INGREDIENTS_INPUT
  [[ -z "$INGREDIENTS_INPUT" ]] && echo -e "${RED}Required!${NC}" && sleep 1.5 && return

  echo -e "\n${BOLD}${ORANGE}Prep time:${NC}"
  PS3="${CYAN}>${NC} Choose [1-5]: "
  local PREP=15
  select opt in "< 5 mins" "5-10 mins" "10-20 mins" "20-30 mins" "> 30 mins"; do
    case $REPLY in
      1) PREP=5; break ;;
      2) PREP=10; break ;;
      3) PREP=20; break ;;
      4) PREP=30; break ;;
      5) PREP=60; break ;;
    esac
  done

  echo -e "\n${BOLD}${ORANGE}Eat / total time:${NC}"
  PS3="${CYAN}>${NC} Choose [1-3]: "
  local EAT=25
  select opt in "While multitasking (~15m total)" "Quick meal (~25m)" "Relaxed (~45m)"; do
    case $REPLY in
      1) EAT=15; break ;;
      2) EAT=25; break ;;
      3) EAT=45; break ;;
    esac
  done

  read -r -e -p $'\n'"${CYAN}>${NC} Allergens to avoid (optional): " ALLERGENS_INPUT
  read -r -e -p "${CYAN}>${NC} Other exclusions (optional): " EXCLUSIONS_INPUT

  echo -e "\n${BOLD}${ORANGE}Taste profile:${NC}"
  PS3="${CYAN}>${NC} Choose [1-6]: "
  local TASTE="savory/umami"
  select opt in "spicy" "sweet" "savory/umami" "sour" "fresh/herby" "mild/neutral"; do
    [[ $REPLY =~ ^[1-6]$ ]] && TASTE="$opt" && break
  done

  clear
  echo -e "${YELLOW}${BOLD}Generating recipe…${NC}\n"
  echo -e "${WHITE}Ingredients:${NC} $INGREDIENTS_INPUT"
  echo -e "${WHITE}Taste:${NC} $TASTE · Prep ≤${PREP}min · Total ≤${EAT}min"
  [[ -n "${ALLERGENS_INPUT:-}" ]] && echo -e "${RED}Avoid: $ALLERGENS_INPUT${NC}"
  [[ -n "${EXCLUSIONS_INPUT:-}" ]] && echo -e "${RED}Exclude: $EXCLUSIONS_INPUT${NC}"
  echo

  local RECIPE ERR
  set +e
  RECIPE=$("$CORE_SCRIPT" \
    --ingredients "$INGREDIENTS_INPUT" \
    --taste "$TASTE" \
    --prep "$PREP" \
    --eat "$EAT" \
    --allergens "${ALLERGENS_INPUT:-none}" \
    --exclusions "${EXCLUSIONS_INPUT:-none}" 2>/tmp/jo_err.$$)
  local rc=$?
  set -e
  ERR=$(cat /tmp/jo_err.$$ 2>/dev/null || true)
  rm -f /tmp/jo_err.$$

  if [[ $rc -ne 0 || -z "$RECIPE" || "$RECIPE" == *"\"error\""* ]]; then
    echo -e "${RED}Failed to generate recipe.${NC}"
    [[ -n "$ERR" ]] && echo -e "${DIM}$ERR${NC}"
    echo -e "${DIM}$RECIPE${NC}"
  else
    clear
    echo -e "${GREEN}${BOLD}Your zero-decision recipe:${NC}\n"
    echo -e "${ORANGE}${BOLD}$(printf '%s\n' "$RECIPE" | head -1)${NC}"
    echo -e "${WHITE}$(printf '%s\n' "$RECIPE" | tail -n +2)${NC}"
    echo -e "\n${DIM}Cached · gpt-4o-mini · $CACHE_DB${NC}\n"
  fi

  echo -e "${CYAN}You have $(cache_count) recipes cached${NC}"
  read -r -n1 -p $'\nPress any key…'
}

# —— main menu ——
init_db
while true; do
  banner
  CACHED_COUNT=$(cache_count)
  echo -e "${YELLOW}You have ${GREEN}${BOLD}${CACHED_COUNT}${NC}${YELLOW} recipes cached${NC}\n"
  echo -e "${BOLD}${ORANGE}What would you like to do?${NC}"
  echo -e " ${CYAN}1${NC}) Create new recipe"
  echo -e " ${CYAN}2${NC}) View cached recipes"
  echo -e " ${CYAN}3${NC}) Stats"
  echo -e " ${CYAN}4${NC}) Exit\n"
  read -r -p "${CYAN}>${NC} Choose [1-4]: " choice
  case "$choice" in
    1) generate_recipe ;;
    2) view_cached_recipes ;;
    3) show_stats ;;
    4) clear; echo -e "\n${GREEN}Happy cooking! 🍊${NC}\n"; exit 0 ;;
    *) echo -e "${RED}Invalid choice${NC}"; sleep 0.8 ;;
  esac
done
