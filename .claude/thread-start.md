# Thread start

A Claude Duet thread reads this page after `CLAUDE.md`. The thread starts outside the repository, so nothing in `.claude/` loads by itself: no hook, no agents, no skills, and no `@` import. This page sets up pstack by hand, from the pinned copy in the repository.

## 1. Check the pinned pstack

`.agents/pstack/plugin` holds [pstack-claude](https://github.com/michael-denyer/pstack-claude)'s plugin folder at the commit in `.agents/pstack/pin.json`, and [`.agents/pstack/README.md`](../.agents/pstack/README.md) says how a weekly workflow updates it. Don't download or install pstack in the session, with the skills CLI or any other way: the session refuses code from an external source, and the copy is the version Ben reviewed. Run this once, from the root of the todae checkout:

```sh
sh .agents/pstack/check.sh
```

It reads text only. It checks that the committed copy is upstream's folder word for word, prints the copy's folder and commit, checks that the copy has poteto-mode and the four agents this page uses, and checks the todae playbooks against the copy's playbooks. CI runs the same check on every pull request.

If it says to run it from the root of the todae checkout, change to the folder where you cloned todae and run it again. Any other stop before it prints the pstack folder means the copy is missing, incomplete or edited, as on a branch cut before the copy was added. Merge `origin/main` into the branch and run it again. Never edit the copy to make the check pass. If it still stops, tell Ben which line it printed, and keep working from `AGENTS.md` and the standalone todae playbooks. `review-before-pr.md` and `waiting-on-ci.md` change pstack's own playbooks, so ask Ben how to go on before you open a pull request or change an open one in any way, such as pushing to it, marking it ready, replying on it or driving its CI.

Keep the printed folder. The rest of this page calls it `$pstack`, so poteto-mode is at `$pstack/skills/poteto-mode/SKILL.md`. Write it into your notes, because shell variables don't survive to the next shell call.

If the script prints `STOP`, report each line above it to Ben and don't apply that playbook. Don't guess where an unanchored change belongs. When the flagged playbook is `review-before-pr.md` or `waiting-on-ci.md`, a pull request task can't follow it, so ask Ben how to go on before you open a pull request or change an open one in any way, such as pushing to it, marking it ready, replying on it or driving its CI. This check stands in for the `check-playbooks.mjs` run that poteto-mode asks for before a project playbook, and gives the same verdict on well-formed playbooks, so skip that run.

## 2. Read pstack the todae way

These adaptations apply to every task, since pstack is written for a plugin install.

- **Skills.** The `Skill` tool doesn't list the copy. Where pstack names a skill, as `pstack:<name>` or by its name, read `$pstack/skills/<name>/SKILL.md`. A `<plugin>` path in a skill means `$pstack`. A skill that ships with Claude Code, such as `plugin-dev:skill-development` or `run`, isn't in the copy; use it if the session has it, and say so in the reply if it doesn't.
- **Skip these skills:** `babysit`, `fix-ci`, `fix-merge-conflicts`, `get-pr-comments` and `setup-pstack`. `CLAUDE.md` and the todae playbooks drive pull requests and CI, and `.claude/models.md` is the model sheet. poteto-mode's Babysit playbook is a different file and still applies, as `.agents/playbooks/waiting-on-ci.md` adapts it.
- **Models.** `.claude/models.md` overrides the upstream model defaults. Read it before the first `Agent` call. Fable isn't used: no role runs it unless Ben asks for it in his own message in the run.
- **Agents.** The copy registers no agent types, so `pstack:poteto-agent` and the other `pstack:` agents don't exist. Where a skill spawns one, spawn `subagent_type: "general-purpose"` instead, and start its prompt with the text of `$pstack/agents/<agent>.md` below its frontmatter. For `poteto-agent`, also give the absolute path of `$pstack/skills/poteto-mode/SKILL.md`, as poteto-mode asks. Tell every stand-in that a skill its text names is at `$pstack/skills/<name>/SKILL.md`, and that it reads GitHub through the GitHub MCP tools, not `gh` or `glab`.
- **Subagents and pull requests.** The thread's own session, never a subagent, does every write to a pull request: opening, pushing, replying, marking ready or draft, and subscribing. That holds for stand-ins, arena candidates, interrogate reviewers, sub-coordinators and Autopilot owners alike, so say it in every subagent's brief. A subagent that writes files commits on its own worktree branch and returns; its worktree never goes into a commit. The thread's session brings that work into its own branch before the review round: a merge, or for arena, the winning base plus hand-ported grafts. Nobody hard-resets the session's branch, whatever pstack says (`git reset --hard origin/<branch>`, or reset from main for a snarled worktree), because that drops commits not yet pushed.
- **One pull request per thread.** A thread opens or drives one pull request. Where the work would need more than one, as Autopilot, a stacked plan or a split into narrow pull requests would, tell Ben it needs one thread per pull request and wait for his answer.
- **Read-only subagents.** `Agent` has no `readonly` parameter. Where a skill spawns a subagent with `readonly: true`, add a line to its prompt telling it not to edit files, commit, or push.
- **GitHub.** Use the GitHub MCP tools, not `gh`, Origin, or the `watch-pr` script. `gh` isn't signed in here.
- **Verify.** todae's own verify skill is `.claude/skills/verify/SKILL.md`, in the repository, not in `$pstack`. Where pstack names the project `verify` skill or `/create-verification-skill`, read that file. It covers every change type, the docs site included. Leave `.cursor/skills/verify/` to Cursor.
- **Scripts.** The scripts under `$pstack` are upstream code, and the session may block them. If one is blocked, work without it and say so in the reply.
- **Briefs.** Write each subagent brief from `.claude/task-prompt.md`, and keep its Rules part.
- **Precedence.** Ben's direct requests, `CLAUDE.md` and `AGENTS.md` take precedence over pstack. For example, a pull request body follows `.github/pull_request_template.md` and keeps the three sections and the tested commit `AGENTS.md` requires, and nothing is rebased or force-pushed without Ben's yes. The todae playbooks also win over pstack: where one replaces a pstack step, any other pstack sentence that says otherwise no longer applies. So opening a pull request does start a babysit in `drive` mode, even for a small or docs-only pull request, whatever `opening-a-pr.md`, `babysit.md` or poteto-mode say about holding it or choosing `check`. The thread's own session runs the review round and drives the pull request, as the subagents bullet above says, even where pstack has an Autopilot owner or phase agent open it. Status comes from GitHub MCP reads, not the watcher those files name.

## 3. Choose the route

Follow poteto-mode, read in full at `$pstack/skills/poteto-mode/SKILL.md`, when a task meets any of these:

- it touches more than one file, or changes a signature other files call
- it involves a design or architecture choice
- it is a bug whose cause is not yet known, or a performance issue

When the intent is already specific, enter that skill directly: `tdd`, `architect`, `how`, `why`, `arena` or `interrogate`. For a smaller task, such as a contained change to one file with an obvious test, a question, or a one-line edit, work directly and verify on the real artifact.

Whatever the route, open every todae playbook in `.agents/playbooks/` whose `when` line fits the task. A task that opens a pull request, or pushes new work to one, always follows `review-before-pr.md` and `waiting-on-ci.md`, together with the pstack playbooks they change (`opening-a-pr.md` and `babysit.md` under `$pstack/skills/poteto-mode/playbooks/`). When the task names an existing pull request, first read it. If it is open, work on its head branch instead of the designated branch `review-before-pr.md` names; if you can't push there, tell Ben and don't open a replacement. If it merged or closed, tell Ben and ask before opening a new one. Before the first write to a pull request this session didn't open, call `subscribe_pr_activity` for it. If its result says another session already watches it, write nothing to it and tell Ben; this replaces the line in `waiting-on-ci.md` that tells the user the pull request isn't watched here. Otherwise it counts, for `waiting-on-ci.md`, as one this session opened, and you drive it in `drive` mode. Where Ben limited what to touch, keep to that, and still report CI on your push. A request only to check on a pull request this session doesn't drive reads its state with the GitHub MCP tools, by the status rules in `waiting-on-ci.md` (a draft's failing `Checks`, a conflict, a check list that hasn't started), and names any conflict in the report; it pushes, schedules, subscribes to and resolves nothing. It uses those status rules even when the anchor check in section 1 printed `STOP` for `waiting-on-ci.md`. For a pull request this session drives, a check is a live status read that reports what it finds, a conflict included. `CLAUDE.md` lists the todae playbooks.
