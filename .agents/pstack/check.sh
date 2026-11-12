#!/bin/sh
# Checks the pinned pstack copy and the todae playbooks that change its playbooks. Reads text only: it runs
# nothing from the copy and downloads nothing. Run it from the root of the todae checkout:
#   sh .agents/pstack/check.sh
# It checks the committed copy against pin.json's tree id, prints the copy's folder and commit, then says
# whether every quoted anchor in .agents/playbooks/ is still in the pstack playbook it extends. CI's Forbidden
# paths job and the weekly update workflow (.github/workflows/pstack-update.yml) run it too.
set -u

[ -d .agents/playbooks ] || { echo "Run this from the root of the todae checkout."; exit 1; }
[ -f .agents/pstack/pin.json ] || { echo "pstack: this checkout has no .agents/pstack/pin.json, so it has no pinned copy."; exit 1; }
pstack="$(pwd)/.agents/pstack/plugin"
pin() { sed -n "s/^[[:space:]]*\"$1\":[[:space:]]*\"\([0-9a-f]\{40\}\)\".*/\1/p" .agents/pstack/pin.json | head -n 1; }
sha=$(pin commit)
[ -n "$sha" ] || { echo "pstack: .agents/pstack/pin.json names no commit."; exit 1; }
[ -f "$pstack/skills/poteto-mode/SKILL.md" ] || { echo "pstack: the copy has no poteto-mode skill."; exit 1; }
for agent in poteto-agent comment-sicko thermo-nuclear-review-subagent thermo-nuclear-code-quality-review-subagent; do
  [ -f "$pstack/agents/$agent.md" ] || { echo "pstack: the copy has no $agent agent."; exit 1; }
done
# Git's id for a folder changes with any file in it, so an equal id means the committed copy is the one
# pin.json records. CI's Forbidden paths job checks that id against upstream whenever pin.json changes.
tree=$(pin tree)
[ -n "$tree" ] || { echo "pstack: .agents/pstack/pin.json has no tree id."; exit 1; }
have=$(git rev-parse -q --verify "HEAD:.agents/pstack/plugin" 2>/dev/null) || have=""
[ "$have" = "$tree" ] || { echo "pstack: the committed copy in .agents/pstack/plugin isn't the one pin.json records. Don't edit it by hand: the pstack update workflow changes it."; exit 1; }
[ -z "$(git status --porcelain --ignored -- .agents/pstack/plugin 2>/dev/null)" ] || { echo "pstack: .agents/pstack/plugin has uncommitted changes or extra files, ignored ones included. git restore and git clean on that folder put it back."; exit 1; }
find "$pstack" -type f -name 'LICENSE*' | grep -q . || { echo "pstack: the copy has no LICENSE file."; exit 1; }
echo "pstack $sha is in $pstack"

playbooks="$pstack/skills/poteto-mode/playbooks"
bad=0
bom=$(printf '\357\273\277')
cr=$(printf '\r')
for file in .agents/playbooks/*.md .agents/playbooks/.*.md .agents/playbooks/.md; do
  [ -e "$file" ] || [ -L "$file" ] || continue
  [ -f "$file" ] && [ -r "$file" ] || { printf '%s\n' "$file: is not a readable file"; bad=1; continue; }
  body=$(sed "s/$cr\$//; 1s/^$bom//" "$file")
  front=$(printf '%s\n' "$body" | awk 'NR == 1 && /^---$/ { inside = 1; next } inside && /^---$/ { closed = 1; exit } inside { kept = kept $0 "\n" } END { if (closed) printf "%s", kept }')
  printf '%s\n' "$front" | grep -m 1 '^when:' | grep -q '^when:[[:space:]]*[^[:space:]]' || { printf '%s\n' "$file: its frontmatter needs a when: line"; bad=1; }
  bases=$(printf '%s\n' "$front" | sed -n 's/^extends:[[:space:]]*//p' | head -n 1 | tr ',' '\n' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; /^$/d')
  text=""
  set -f
  old_ifs=$IFS
  IFS='
'
  for base in $bases; do
    if [ "${base#*[/ \\]}" = "$base" ] && [ -f "$playbooks/$base.md" ] && [ -r "$playbooks/$base.md" ]; then
      text="$text
$(tr -s '[:space:]' ' ' < "$playbooks/$base.md")"
    else
      printf '%s\n' "$file: extends $base, which this pstack has no playbook for"; bad=1
    fi
  done
  IFS=$old_ifs
  set +f
  changes=$(printf '%s\n' "$body" | grep -E '^[[:space:]]*([-*]|[0-9]+\.)[[:space:]]+\*\*(After|Before|Replace|In)\*\*')
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    anchor=$(printf '%s\n' "$line" | sed -n 's/^[[:space:]]*[^[:space:]]*[[:space:]][[:space:]]*\*\*[A-Za-z]*\*\*[[:space:]][[:space:]]*"\([^"]*\)".*/\1/p')
    anchor=$(printf '%s' "$anchor" | tr -s '[:space:]' ' ')
    if [ -z "$anchor" ]; then
      printf '%s\n' "$file: a change has no quoted step text to anchor on: $line"; bad=1
    else
      case "$text" in
        *"$anchor"*) ;;
        *) printf '%s\n' "$file: \"$anchor\" is not in any playbook it extends"; bad=1 ;;
      esac
    fi
  done <<EOF
$changes
EOF
done
if [ "$bad" = 0 ]; then echo "Every todae playbook anchor matches pstack $sha."; else echo "STOP: a todae playbook no longer matches pstack $sha."; exit 1; fi
