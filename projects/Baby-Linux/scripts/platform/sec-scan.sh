#!/usr/bin/env bash
# baby-sec-scan — one-shot local security sweep for a repo or filesystem
# Usage: baby-sec-scan [path]
set -euo pipefail

TARGET="${1:-.}"
TARGET="$(cd "$TARGET" && pwd)"
OUT="${BABY_SCAN_OUT:-/tmp/baby-sec-scan-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT"

echo "==> Baby Linux security scan"
echo "    target: $TARGET"
echo "    output: $OUT"
echo

run() {
  local name="$1"
  shift
  if command -v "$1" >/dev/null 2>&1; then
    echo "── $name ──"
    "$@" >"$OUT/${name}.txt" 2>&1 || echo "(exit $?)" >>"$OUT/${name}.txt"
    echo "    saved $OUT/${name}.txt"
  else
    echo "── $name SKIPPED (not installed) ──"
  fi
}

run gitleaks gitleaks detect --source "$TARGET" -v --no-git 2>/dev/null || \
  run gitleaks gitleaks detect --source "$TARGET" -v

run trivy-fs trivy fs --scanners vuln,secret,misconfig --format table "$TARGET"
run checkov checkov -d "$TARGET" --compact
run tfsec tfsec "$TARGET" --no-color
run semgrep semgrep --config auto "$TARGET"
run hadolint bash -c "find '$TARGET' -iname Dockerfile -print0 | xargs -0 -r hadolint"
run shellcheck bash -c "find '$TARGET' -name '*.sh' -print0 | xargs -0 -r shellcheck"

# IaC directories
if [[ -d "$TARGET" ]]; then
  if find "$TARGET" -name '*.tf' | head -1 | grep -q .; then
    run terrascan terrascan scan -t terraform -d "$TARGET" 2>/dev/null || true
  fi
fi

echo
echo "==> Done. Reports in $OUT"
ls -la "$OUT"
