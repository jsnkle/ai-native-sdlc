#!/bin/bash
# Copy the per-repo template into a project and substitute the project name.
#
# Usage: scripts/new-project.sh <target-dir> <project-name> [--force] [--with-example]
#
#   Existing files in <target-dir> are skipped (and listed) unless --force, so this
#   doubles as the first brownfield step: it adds what is missing and leaves what is there.
#   intent/_example is removed unless --with-example.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$here/plugin/template"

usage() { sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

target=""; name=""; force=0; with_example=0
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    --with-example) with_example=1 ;;
    -h|--help) usage ;;
    -*) echo "unknown flag: $arg" >&2; usage ;;
    *) if [ -z "$target" ]; then target="$arg"; elif [ -z "$name" ]; then name="$arg"; else usage; fi ;;
  esac
done
[ -n "$target" ] && [ -n "$name" ] || usage
[[ "$name" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || { echo "project name must be [A-Za-z0-9._-]" >&2; exit 1; }

mkdir -p "$target"
target="$(cd "$target" && pwd)"

copied=(); skipped=()
while IFS= read -r -d '' f; do
  rel="${f#$src/}"
  case "$rel" in README.md) continue ;; esac                      # plugin/template/README.md describes the template, not the project
  [ $with_example -eq 1 ] || case "$rel" in intent/_example/*) continue ;; esac
  dest="$target/$rel"
  if [ -e "$dest" ] && [ $force -eq 0 ]; then skipped+=("$rel"); continue; fi
  mkdir -p "$(dirname "$dest")"
  sed "s/{{PROJECT_NAME}}/$name/g" "$f" > "$dest"
  [ -x "$f" ] && chmod +x "$dest"
  copied+=("$rel")
done < <(find "$src" -type f -print0 | sort -z)

echo "Project: $name"
echo "Target:  $target"
echo
echo "Copied (${#copied[@]}):"
for f in "${copied[@]:-}"; do [ -n "$f" ] && echo "  + $f"; done
if [ ${#skipped[@]} -gt 0 ]; then
  echo
  echo "Skipped, already present (${#skipped[@]}), use --force to overwrite:"
  for f in "${skipped[@]}"; do echo "  = $f"; done
fi

cat <<NEXT

Next steps
  1. cd "$target" && claude
  2. /plugin marketplace add jsnkle/ai-native-sdlc  then  /plugin install ai-native-sdlc@jsnkle
     (or trust the marketplace declared in .claude/settings.json when prompted)
  3. Edit CLAUDE.md: real build/test/lint commands with a line of healthy output each.
  4. Record the source-of-truth decision in intent/README.md.
  5. Run /ai-native-sdlc:adopt to assess the repo and finish phase 1.
  6. Add ANTHROPIC_API_KEY to repository secrets before enabling the workflows in .github/workflows/.
NEXT
