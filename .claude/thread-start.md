# Thread start

A Claude Duet thread reads this page after `CLAUDE.md`. The thread starts outside the repository, so nothing in `.claude/` loads by itself: no hook, no agents, no skills, and no `@` import. Read `AGENTS.md` and `.claude/pstack-models.md` as files. This page sets up the pinned pstack copy. It does not download pstack.

## 1. Check the pinned pstack

`.agents/pstack/plugin` holds [pstack-claude](https://github.com/michael-denyer/pstack-claude)'s plugin folder at the commit in `.agents/pstack/pin.json`. [`.agents/pstack/README.md`](../.agents/pstack/README.md) says how the weekly workflow updates it. Don't download or install pstack, with the skills CLI or any other way. Run this once, from the root of the todae checkout:

```sh
sh .agents/pstack/check.sh
```

It reads text only. It checks that the copy is the one `pin.json` records, with no uncommitted changes, prints the copy's folder and commit, checks that the copy has poteto-mode and the four agents this page uses, and checks every quoted anchor in `.agents/playbooks/` against the copy. Those playbooks are the repo-specific ones (`changesets.md`, `docs-translation.md`, `tokens.md`). Home's review and CI playbooks are not in that directory, so this check does not anchor-check them. CI runs the same check on every pull request.

If it says to run it from the root of the todae checkout, change to that folder and run it again. Any other stop before it prints the pstack folder means the copy is missing, incomplete or edited. Merge `origin/main` into the branch and run it again. Never edit the copy to make the check pass. If it still stops, tell Ben which line it printed, and keep working from `AGENTS.md`.

Keep the printed folder. The rest of this page calls it `$pstack`. Write it into your notes, because shell variables don't survive to the next shell call.

If the script prints `STOP`, report each line above it to Ben and don't apply that local playbook. Don't guess where an unanchored change belongs. This check stands in for the `check-playbooks.mjs` run that poteto-mode asks for before a project playbook, so skip that run.

## 2. Read pstack the todae way

- **Skills.** The `Skill` tool doesn't list the copy. Where pstack names a skill, as `pstack:<name>` or by its name, read `$pstack/skills/<name>/SKILL.md`. A `<plugin>` path means `$pstack`. A skill that ships with Claude Code isn't in the copy. Use it when the session has it, and say so when it doesn't.
- **Skip these skills:** `babysit`, `fix-ci`, `fix-merge-conflicts`, `get-pr-comments` and `setup-pstack`. Home's `playbooks/review-before-pr.md` and `playbooks/waiting-on-ci.md`, with the repo lines in `AGENTS.md`, replace them. poteto-mode's Babysit playbook still applies, as that waiting-on-ci overlay adapts it. Read `.claude/pstack-models.md` before the first `Agent` call.
- **Agents.** The copy registers no agent types. Where a skill spawns `pstack:poteto-agent` or another `pstack:` agent, spawn `subagent_type: "general-purpose"` instead, and start its prompt with the text of `$pstack/agents/<agent>.md` below its frontmatter. For `poteto-agent`, also give the absolute path of `$pstack/skills/poteto-mode/SKILL.md`. Tell every stand-in that a skill its text names is at `$pstack/skills/<name>/SKILL.md`, and that it reads GitHub through the GitHub MCP tools, not `gh` or `glab`.
- **Subagents and pull requests.** The thread's own session does every write to a pull request: opening, pushing, replying, marking ready or draft, and subscribing. Say that in every subagent's brief. A subagent commits on its own worktree branch and returns. Its worktree never goes into a commit. The thread's session brings that work into its own branch before the review round: a merge, or for arena, the winning base plus hand-ported grafts. Nobody hard-resets the session's branch, whatever pstack says (`git reset --hard origin/<branch>`, or reset from main for a snarled worktree), because that drops commits not yet pushed.
- **One pull request per thread.** Where the work needs more than one, tell Ben it needs one thread per pull request and wait.
- **Verify.** The verify skill is `.claude/skills/verify/SKILL.md`, in the repository. Where pstack names the project `verify` skill or `/create-verification-skill`, read that file. Leave `.cursor/skills/verify/` to Cursor.
- **Scripts.** The scripts under `$pstack` are upstream code, and the session may block them. When one is blocked, work without it and say so.
- **Briefs.** Write each subagent brief from `.claude/task-prompt.md`, and keep its Rules part.
- **Precedence.** Ben's direct requests, `CLAUDE.md` and `AGENTS.md` take precedence over pstack. Home's overlays win where they replace a pstack step, so opening a pull request starts a babysit in `drive` mode. The thread's own session runs the review round and drives the pull request. Status comes from GitHub MCP reads.

## 3. Choose the route

Follow poteto-mode, read in full at `$pstack/skills/poteto-mode/SKILL.md`, when a task touches more than one file or changes a signature other files call, involves a design or architecture choice, or is a bug whose cause is not yet known, or a performance issue. When the intent is already specific, enter that skill directly: `tdd`, `architect`, `how`, `why`, `arena` or `interrogate`. For a smaller task, such as a contained change to one file with an obvious test, a question, or a one-line edit, work directly and verify on the real artifact.

Open every playbook in `.agents/playbooks/` whose `when` line fits. A task that opens a pull request, or pushes new work to one, follows home's `playbooks/review-before-pr.md` and `playbooks/waiting-on-ci.md` with the repo lines in `AGENTS.md`, together with the pstack playbooks they change (`opening-a-pr.md` and `babysit.md` under `$pstack/skills/poteto-mode/playbooks/`).

When the task names an existing pull request, read it first. If it is open, work on its head branch. If you can't push there, tell Ben and don't open a replacement. If it merged or closed, tell Ben and ask before opening a new one. Before the first write to a pull request this session didn't open, call `subscribe_pr_activity` for it. If another session already watches it, write nothing and tell Ben, as `AGENTS.md` says. Otherwise drive it in `drive` mode. Where Ben limited what to touch, keep to that, and still report CI on your push. A request only to check on a pull request reads state and changes nothing, as `AGENTS.md` says.
