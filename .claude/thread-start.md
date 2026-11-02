# Thread start

A Claude Duet thread reads this page after `CLAUDE.md`. The thread starts outside the repository, so nothing in `.claude/` loads by itself: no hook, no agents, no skills, and no `@` import. This page sets up pstack by hand.

## 1. Install pstack and check the playbooks

Run this block once, from the root of the todae checkout, in one shell call: save it to a scratch file and run `sh` on that file. It installs the latest [pstack-claude](https://github.com/michael-denyer/pstack-claude) skills into a new temp folder outside the repository, fetches the four pstack agent files at the same commit, and checks the todae playbooks against that commit's playbooks.

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
echo "pstack $sha is in $pstack"

playbooks="$pstack/.claude/skills/poteto-mode/playbooks"
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
```

If the block says to run it from the root of the todae checkout, change to the folder where you cloned todae and run it again. Any other stop before it prints the pstack folder means the install failed. Tell Ben which line it printed, and keep working from `AGENTS.md` and the standalone todae playbooks. `review-before-pr.md` and `waiting-on-ci.md` change pstack's own playbooks, so run the install again before you open a pull request or change an open one in any way, such as pushing to it, marking it ready, replying on it or driving its CI. That gate wins over the line in `review-before-pr.md` that pushing the branch is fine at any time. If it still fails, ask Ben how to go on first.

Keep the printed folder. The rest of this page calls it `$pstack`, so poteto-mode is at `$pstack/.claude/skills/poteto-mode/SKILL.md`. Write it into your notes, because shell variables don't survive to the next shell call.

The install goes into a temp folder on purpose. Run inside the repository, it would add skill files that fail the Forbidden paths job and leak into the pull request. With `-g`, it would land in `~/.claude/skills` for every later session.

If the block prints `STOP`, report each line above it to Ben and don't apply that playbook. Don't guess where an unanchored change belongs. When the flagged playbook is `review-before-pr.md` or `waiting-on-ci.md`, a pull request task can't follow it, so ask Ben how to go on before you open a pull request or change an open one in any way, such as pushing to it, marking it ready, replying on it or driving its CI. That gate wins over the line in `review-before-pr.md` that pushing the branch is fine at any time. This check stands in for the `check-playbooks.mjs` run that poteto-mode asks for before a project playbook, and gives the same verdict on well-formed playbooks, so skip that run. The plain text check needs no downloaded code.

## 2. Read pstack the todae way

These adaptations apply to every task, since pstack is written for a plugin install.

- **Skills.** The `Skill` tool doesn't list the temp install. Where pstack names a skill, as `pstack:<name>` or by its name, read `$pstack/.claude/skills/<name>/SKILL.md`. A `<plugin>` path in a skill means `$pstack/.claude`. A skill that ships with Claude Code, such as `plugin-dev:skill-development` or `run`, isn't in the install; use it if the session has it, and say so in the reply if it doesn't.
- **Skip these skills:** `babysit`, `fix-ci`, `fix-merge-conflicts`, `get-pr-comments` and `setup-pstack`. `CLAUDE.md` and the todae playbooks drive pull requests and CI, and `.claude/models.md` is the model sheet. poteto-mode's Babysit playbook is a different file and still applies, as `.agents/playbooks/waiting-on-ci.md` adapts it.
- **Models.** `.claude/models.md` overrides the upstream model defaults. Read it before the first `Agent` call. Fable runs only where that sheet names it or Ben approves it in his own message in the run.
- **Agents.** The install brings no agent types, so `pstack:poteto-agent` and the other `pstack:` agents don't exist. Where a skill spawns one, spawn `subagent_type: "general-purpose"` instead, and start its prompt with the text of `$pstack/.claude/agents/<agent>.md` below its frontmatter. For `poteto-agent`, also give the absolute path of `$pstack/.claude/skills/poteto-mode/SKILL.md`, as poteto-mode asks. Tell every stand-in that a skill its text names is at `$pstack/.claude/skills/<name>/SKILL.md`, and that it reads GitHub through the GitHub MCP tools, not `gh` or `glab`.
- **Subagents and pull requests.** The thread's own session, never a subagent, does every write to a pull request: opening, pushing, replying, marking ready or draft, and subscribing. That holds for stand-ins, arena candidates, interrogate reviewers, sub-coordinators and Autopilot owners alike, so say it in every subagent's brief. A subagent that writes files commits on its own worktree branch and returns; its worktree never goes into a commit. The thread's session brings that work into its own branch before the review round: a merge, or for arena, the winning base plus hand-ported grafts. Nobody hard-resets the session's branch, whatever pstack says (`git reset --hard origin/<branch>`, or reset from main for a snarled worktree), because that drops commits not yet pushed.
- **One pull request per thread.** A thread opens or drives one pull request. Where the work would need more than one, as Autopilot, a stacked plan or a split into narrow pull requests would, tell Ben it needs one thread per pull request and wait for his answer.
- **Read-only subagents.** `Agent` has no `readonly` parameter. Where a skill spawns a subagent with `readonly: true`, add a line to its prompt telling it not to edit files, commit, or push.
- **GitHub.** Use the GitHub MCP tools, not `gh`, Origin, or the `watch-pr` script. `gh` isn't signed in here.
- **Verify.** todae's own verify skill is `.claude/skills/verify/SKILL.md`, in the repository, not in `$pstack`. Where pstack names the project `verify` skill or `/create-verification-skill`, read that file. It covers every change type, the docs site included. Leave `.cursor/skills/verify/` to Cursor.
- **Scripts.** Other upstream scripts under `$pstack` are downloaded code, and the session may block them. If one is blocked, work without it and say so in the reply.
- **Briefs.** Write each subagent brief from `.claude/task-prompt.md`, and keep its Rules part.
- **Precedence.** Ben's direct requests, `CLAUDE.md` and `AGENTS.md` take precedence over pstack. For example, a pull request body follows `.github/pull_request_template.md` and keeps the three sections and the tested commit `AGENTS.md` requires, and nothing is rebased or force-pushed without Ben's yes. The todae playbooks also win over pstack: where one replaces a pstack step, any other pstack sentence that says otherwise no longer applies. So opening a pull request does start a babysit in `drive` mode, even for a small or docs-only pull request, whatever `opening-a-pr.md`, `babysit.md` or poteto-mode say about holding it or choosing `check`. The thread's own session runs the review round and drives the pull request, as the subagents bullet above says, even where pstack has an Autopilot owner or phase agent open it. Status comes from GitHub MCP reads, not the watcher those files name.

## 3. Choose the route

Follow poteto-mode, read in full at `$pstack/.claude/skills/poteto-mode/SKILL.md`, when a task meets any of these:

- it touches more than one file, or changes a signature other files call
- it involves a design or architecture choice
- it is a bug whose cause is not yet known, or a performance issue

When the intent is already specific, enter that skill directly: `tdd`, `architect`, `how`, `why`, `arena` or `interrogate`. For a smaller task, such as a contained change to one file with an obvious test, a question, or a one-line edit, work directly and verify on the real artifact.

Whatever the route, open every todae playbook in `.agents/playbooks/` whose `when` line fits the task. A task that opens a pull request, or pushes new work to one, always follows `review-before-pr.md` and `waiting-on-ci.md`, together with the pstack playbooks they change (`opening-a-pr.md` and `babysit.md` under `$pstack/.claude/skills/poteto-mode/playbooks/`). When the task names an existing pull request, first read it. If it is open, work on its head branch instead of the designated branch `review-before-pr.md` names; if you can't push there, tell Ben and don't open a replacement. If it merged or closed, tell Ben and ask before opening a new one. Before the first write to a pull request this session didn't open, call `subscribe_pr_activity` for it. If its result says another session already watches it, write nothing to it and tell Ben; this replaces the line in `waiting-on-ci.md` that keeps going on the backstop. Otherwise it counts, for `waiting-on-ci.md`, as one this session opened, and you drive it in `drive` mode. Where Ben limited what to touch, keep to that, and still report CI on your push. A request only to check on a pull request this session doesn't drive reads its state with the GitHub MCP tools, by the status rules in `waiting-on-ci.md` (a draft's skipped `Checks`, a conflict, a pull request CI skips, a check list that hasn't started), and names any conflict in the report; it pushes, schedules, subscribes to and resolves nothing. It uses those status rules even when the anchor check in section 1 printed `STOP` for `waiting-on-ci.md`. For a pull request this session drives, a check is a live status read that reports what it finds, a conflict included. `CLAUDE.md` lists the todae playbooks.
