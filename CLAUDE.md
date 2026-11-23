@AGENTS.md

@.claude/pstack-models.md

## Claude only

- Skills and agents from the pstack-claude plugin have the `pstack:` prefix. This repo vendors the plugin in `.agents/pstack/plugin`, so drop the prefix and read `$pstack/skills/<name>/SKILL.md`. `$pstack` is the folder `sh .agents/pstack/check.sh` prints. A `<plugin>` path means that folder. Duet threads follow `.claude/thread-start.md` for the rest of that setup.
- `Agent` has no `readonly` parameter. Where a skill spawns a subagent with `readonly: true`, tell it in its prompt not to edit files, commit or push.
- GitHub work uses the GitHub MCP tools, not `gh` or the `watch-pr` script.
- Fable runs only where `.claude/pstack-models.md` names it or where Ben approves it in his own message in that run.
- Duet threads: nothing in `.claude/` loads by itself, and the `@` imports above do not expand. Read `AGENTS.md`, then `.claude/pstack-models.md`, then `.claude/thread-start.md`. pstack comes from the pinned copy in `.agents/pstack/`.
