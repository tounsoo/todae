# Thread start

A Claude Duet thread reads this page after `CLAUDE.md`. The thread starts outside the repository, so nothing in `.claude/` loads by itself: no hook, no agents, no skills, and no `@` import. This page sets up pstack by hand.

## 1. Install pstack and check the playbooks

Run this block once, in one shell call, from the root of the todae checkout. It installs the latest [pstack-claude](https://github.com/michael-denyer/pstack-claude) skills into a new temp folder outside the repository, fetches the four pstack agent files at the same commit, and checks the todae playbooks against that commit's playbooks.

```sh
[ -d .agents/playbooks ] || { echo "Run this from the root of the todae checkout."; exit 1; }
repo=https://github.com/michael-denyer/pstack-claude
sha=$(git ls-remote "$repo" HEAD | cut -f1)
[ -n "$sha" ] || { echo "pstack: could not read the upstream HEAD."; exit 1; }
pstack=$(mktemp -d)
(cd "$pstack" && npx --yes skills@1.7.4 add "$repo/tree/$sha/plugins/pstack/skills" --skill "*" -a claude-code --yes >/dev/null) || { echo "pstack: the skills install failed."; exit 1; }
mkdir -p "$pstack/.claude/agents"
for agent in poteto-agent comment-sicko thermo-nuclear-review-subagent thermo-nuclear-code-quality-review-subagent; do
  curl -fsS -o "$pstack/.claude/agents/$agent.md" "https://raw.githubusercontent.com/michael-denyer/pstack-claude/$sha/plugins/pstack/agents/$agent.md" || { echo "pstack: could not fetch the $agent agent."; exit 1; }
done
echo "pstack $sha is in $pstack/.claude"

playbooks="$pstack/.claude/skills/poteto-mode/playbooks"
bad=0
for file in .agents/playbooks/*.md; do
  grep -q '^when:[[:space:]]*[^[:space:]]' "$file" || { echo "$file: its frontmatter needs a when: line"; bad=1; }
  bases=$(awk 'NR == 1 && /^---$/ { front = 1; next } front && /^---$/ { exit } front && sub(/^extends:[ \t]*/, "") { print }' "$file" | tr ',' ' ')
  text=""
  for base in $bases; do
    if [ -f "$playbooks/$base.md" ]; then
      text="$text $(tr -s '[:space:]' ' ' < "$playbooks/$base.md")"
    else
      echo "$file: extends $base, which this pstack has no playbook for"; bad=1
    fi
  done
  changes=$(grep -E '^[[:space:]]*([-*]|[0-9]+\.)[[:space:]]+\*\*(After|Before|Replace|In)\*\*' "$file")
  while IFS= read -r line; do
    [ -n "$line" ] || continue
    anchor=$(printf '%s\n' "$line" | sed -n 's/^[^"]*\*\*[A-Za-z]*\*\*[[:space:]]*"\([^"]*\)".*/\1/p' | tr -s '[:space:]' ' ' | sed 's/ *$//')
    if [ -z "$anchor" ]; then
      echo "$file: a change has no quoted step text to anchor on: $line"; bad=1
    else
      case "$text" in
        *"$anchor"*) ;;
        *) echo "$file: \"$anchor\" is not in any playbook it extends"; bad=1 ;;
      esac
    fi
  done <<EOF
$changes
EOF
done
if [ "$bad" = 0 ]; then echo "Every todae playbook anchor matches pstack $sha."; else echo "STOP: a todae playbook no longer matches pstack $sha."; exit 1; fi
```

Keep the printed folder. The rest of this page calls it `$pstack`. Write it into your notes, because shell variables don't survive to the next shell call.

The install goes into a temp folder on purpose. Run inside the repository, it would add skill files that fail the Forbidden paths job and leak into the pull request. With `-g`, it would land in `~/.claude/skills` for every later session.

If the block prints `STOP`, report each line above it to Ben and don't apply that playbook. Don't guess where an unanchored change belongs. pstack ships `check-playbooks.mjs` for this, but the plain text check above needs no downloaded code to run.

## 2. Read poteto-mode

Read `$pstack/.claude/skills/poteto-mode/SKILL.md` in full and follow it. Read these adaptations first, since poteto-mode is written for a plugin install.

- **Skills.** The `Skill` tool doesn't list the temp install. Where pstack names a skill, as `pstack:<name>` or by its name, read `$pstack/.claude/skills/<name>/SKILL.md`. A `<plugin>` path in a skill means `$pstack/.claude`.
- **Skip these skills:** `babysit`, `fix-ci`, `fix-merge-conflicts`, `get-pr-comments` and `setup-pstack`. `CLAUDE.md` and the todae playbooks drive pull requests and CI, and `.claude/models.md` is the model sheet. poteto-mode's Babysit playbook is a different file and still applies, as `.agents/playbooks/waiting-on-ci.md` adapts it.
- **Models.** `.claude/models.md` overrides the upstream model defaults. Read it before the first `Agent` call. Fable runs only where that sheet names it or Ben approves it in his own message in the run.
- **Agents.** The install brings no agent types, so `pstack:poteto-agent` and the other `pstack:` agents don't exist. Where a skill spawns one, spawn `subagent_type: "general-purpose"` instead, and start its prompt with the text of `$pstack/.claude/agents/<agent>.md` below its frontmatter. For `poteto-agent`, also give the absolute path of `$pstack/.claude/skills/poteto-mode/SKILL.md`, as poteto-mode asks.
- **Read-only subagents.** `Agent` has no `readonly` parameter. Where a skill spawns a subagent with `readonly: true`, add a line to its prompt telling it not to edit files, commit, or push.
- **GitHub.** Use the GitHub MCP tools, not `gh`, Origin, or the `watch-pr` script. `gh` isn't signed in here.
- **Verify.** todae has no `.claude/skills/verify/`. For the docs site, follow the verify line in `AGENTS.md`.
- **Scripts.** Other upstream scripts under `$pstack` are downloaded code, and the session may block them. If one is blocked, work without it and say so in the reply.

## 3. Project playbooks

poteto-mode opens the todae playbooks in `.agents/playbooks/` by itself, from each one's `extends` and `when` lines. `CLAUDE.md` lists them.
