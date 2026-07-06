#!/usr/bin/env bash
set -euo pipefail

echo "Running Claude post-edit quality checks..."

if [ ! -f package.json ]; then
  echo "No package.json found. Skipping JS/TS quality checks."
  exit 0
fi

if command -v jq >/dev/null 2>&1; then
  HAS_JQ=1
else
  HAS_JQ=0
fi

detect_pm() {
  if [ -f pnpm-lock.yaml ]; then echo "pnpm"; return; fi
  if [ -f yarn.lock ]; then echo "yarn"; return; fi
  if [ -f bun.lockb ] || [ -f bun.lock ]; then echo "bun"; return; fi
  echo "npm"
}

has_script() {
  local script_name="$1"

  if [ "$HAS_JQ" -eq 1 ]; then
    jq -e ".scripts[\"$script_name\"]" package.json >/dev/null 2>&1
  else
    grep -q "\"$script_name\"" package.json
  fi
}

script_is_placeholder_test() {
  if [ "$HAS_JQ" -eq 1 ]; then
    local test_script
    test_script="$(jq -r '.scripts.test // ""' package.json)"
    echo "$test_script" | grep -qi "no test specified\|exit 1\|Error:"
  else
    grep -A 3 '"scripts"' package.json | grep -qi '"test".*no test specified\|exit 1\|Error:'
  fi
}

run_script() {
  local pm="$1"
  local script_name="$2"

  echo ""
  echo "==> Running $script_name"

  case "$pm" in
    pnpm) pnpm run "$script_name" ;;
    yarn) yarn "$script_name" ;;
    bun) bun run "$script_name" ;;
    npm) npm run "$script_name" ;;
    *) npm run "$script_name" ;;
  esac
}

PM="$(detect_pm)"
echo "Detected package manager: $PM"

if has_script "typecheck"; then
  run_script "$PM" "typecheck"
else
  echo "No typecheck script found. Skipping."
fi

if has_script "lint"; then
  run_script "$PM" "lint"
else
  echo "No lint script found. Skipping."
fi

if has_script "test"; then
  if script_is_placeholder_test; then
    echo "Test script appears to be a placeholder. Skipping."
  else
    run_script "$PM" "test"
  fi
else
  echo "No test script found. Skipping."
fi

echo ""
echo "Claude post-edit quality checks completed."
