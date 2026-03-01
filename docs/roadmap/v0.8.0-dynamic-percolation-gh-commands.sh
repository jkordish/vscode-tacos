#!/usr/bin/env bash
set -euo pipefail

# Create GitHub issues from docs/roadmap/v0.8.0-dynamic-percolation-issues.md.
#
# Default mode is dry-run (prints commands only).
# Use --apply to actually create issues.
#
# Examples:
#   docs/roadmap/v0.8.0-dynamic-percolation-gh-commands.sh
#   docs/roadmap/v0.8.0-dynamic-percolation-gh-commands.sh --apply
#   docs/roadmap/v0.8.0-dynamic-percolation-gh-commands.sh --apply --kind child

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CATALOG_PATH="$ROOT_DIR/docs/roadmap/v0.8.0-dynamic-percolation-issues.md"
APPLY=0
KIND="all" # all | epic | child

usage() {
  cat <<USAGE
Usage: $(basename "$0") [--apply] [--kind all|epic|child]

Options:
  --apply            Actually create issues with gh issue create.
  --kind <kind>      Limit to issue type: all (default), epic, or child.
  -h, --help         Show this help text.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=1
      shift
      ;;
    --kind)
      if [[ $# -lt 2 ]]; then
        echo "Missing value for --kind" >&2
        exit 1
      fi
      KIND="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ "$KIND" != "all" && "$KIND" != "epic" && "$KIND" != "child" ]]; then
  echo "Invalid --kind value: $KIND" >&2
  exit 1
fi

if [[ ! -f "$CATALOG_PATH" ]]; then
  echo "Catalog file not found: $CATALOG_PATH" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required but not installed." >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "gh auth is not active. Run: gh auth login" >&2
  exit 1
fi

if [[ $APPLY -eq 1 ]]; then
  OUTPUT_DIR="$(mktemp -d -t tacos-v080-issues-XXXXXX)"
  cleanup() {
    rm -rf "$OUTPUT_DIR"
  }
  trap cleanup EXIT
else
  timestamp="$(date +"%Y%m%d-%H%M%S")"
  OUTPUT_DIR="$ROOT_DIR/docs/roadmap/.issue-body-staging/v0.8.0-$timestamp"
  mkdir -p "$OUTPUT_DIR"
fi

extract_section_body() {
  local heading="$1"
  awk -v h="$heading" '
    $0 == h { in_section=1; next }
    in_section && /^### / { exit }
    in_section { print }
  ' "$CATALOG_PATH"
}

extract_title() {
  local heading="$1"
  if [[ "$heading" =~ ^###\ DP-[0-9]{3}:\  ]]; then
    echo "${heading#*: }"
    return
  fi
  if [[ "$heading" =~ ^###\ E[0-9]+\.\  ]]; then
    echo "${heading#*\. }"
    return
  fi

  echo "$heading"
}

heading_id() {
  local heading="$1"
  if [[ "$heading" =~ ^###\ (DP-[0-9]{3}): ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi
  if [[ "$heading" =~ ^###\ (E[0-9]+)\. ]]; then
    echo "${BASH_REMATCH[1]}"
    return
  fi

  echo "unknown"
}

emit_or_create() {
  local heading="$1"
  local title
  local id
  local body_file

  title="$(extract_title "$heading")"
  id="$(heading_id "$heading")"
  body_file="$OUTPUT_DIR/${id}.md"

  {
    echo "> Source catalog: docs/roadmap/v0.8.0-dynamic-percolation-issues.md"
    echo
    echo "# ${title}"
    echo
    extract_section_body "$heading"
  } > "$body_file"

  if [[ $APPLY -eq 1 ]]; then
    echo "Creating issue: $title"
    gh issue create --title "$title" --body-file "$body_file"
  else
    printf "gh issue create --title %q --body-file %q\n" "$title" "$body_file"
  fi
}

EPIC_HEADINGS=()
while IFS= read -r line; do
  EPIC_HEADINGS+=("$line")
done < <(grep -E '^### E[0-9]+\.' "$CATALOG_PATH")

CHILD_HEADINGS=()
while IFS= read -r line; do
  CHILD_HEADINGS+=("$line")
done < <(grep -E '^### DP-[0-9]{3}:' "$CATALOG_PATH")

if [[ "$KIND" == "all" || "$KIND" == "epic" ]]; then
  for heading in "${EPIC_HEADINGS[@]}"; do
    emit_or_create "$heading"
  done
fi

if [[ "$KIND" == "all" || "$KIND" == "child" ]]; then
  for heading in "${CHILD_HEADINGS[@]}"; do
    emit_or_create "$heading"
  done
fi

if [[ $APPLY -eq 1 ]]; then
  echo "Done. Issues created from catalog."
else
  echo
  echo "Staged body files: $OUTPUT_DIR"
  echo "Dry-run complete."
  echo "Use --apply to actually create issues."
fi
