@AGENTS.md

## Claude only

- Work happens in T3 Code threads (Claude Code) on a branch named `t3/<slug>`, one pull request per thread. `AGENTS.md` has the rest of the flow under **How work happens**.
- A thread opens a ready pull request into `main`, gets `Checks` and `rule-checker` green, and has a Gemini 4 Neon review subagent review it, for at most three rounds.
- Mike merges only on Ben's word. Threads never merge or force-push, and do not edit `AGENTS.md` or `CLAUDE.md` outside a pull request Ben approves.
- Threads may use `gh` and the GitHub MCP tools.
- Call Matt Pocock's skills with the prefix, such as `mattpocock-skills:tdd`, `mattpocock-skills:diagnosing-bugs`, `mattpocock-skills:code-review` (not the built-in `code-review`) and `mattpocock-skills:pr`. `AGENTS.md` lists the rest, and the ones only Ben or Mike types.
- Prove a change with `.claude/skills/verify/SKILL.md` before opening a pull request and before each push of new work.
- `Agent` has no `readonly` parameter. When a subagent must not write, say in its prompt not to edit files, commit or push.
- Thread and subagent briefs use `.claude/task-prompt.md`.
