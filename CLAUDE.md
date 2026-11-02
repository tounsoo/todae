# Claude instructions

Read [`AGENTS.md`](AGENTS.md) for the repository's rules. They apply to every agent, including the rule that `.claude/`, `.agents/` and this file change only with Ben's yes.

Duet threads: read [`.claude/thread-start.md`](.claude/thread-start.md) next.

## Architecture and decisions

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) before adding or changing a component, hook, recipe, token or docs page. It records the concepts and decisions new work must follow. When a decision changes, update it in the same pull request.

## Project playbooks

`.agents/playbooks/` holds todae's playbooks. A thread opens each one whose `when` line fits the task, as `.claude/thread-start.md` says. [0006](docs/decisions/0006-claude-threads-install-pstack.md) records this layout.

- `review-before-pr.md` runs the review on the branch before a pull request opens.
- `waiting-on-ci.md` drives a pull request to green with the GitHub MCP tools.
- `docs-translation.md` changes an English docs page and its Korean twin together, then stamps the translation.
- `tokens.md` keeps every design token change behind Ben's approval and runs the token checks.
- `changesets.md` adds the changeset a shipping change needs.

`.claude/models.md` is the pstack model sheet. A change to a role's model or effort goes there, with Ben's yes.

## Verify, pull requests and briefs

- `.claude/skills/verify/SKILL.md` proves a change on the commit it was tested at and ends in PASS, FAIL or BLOCKED. Run it on the commit that ends each review round in `review-before-pr.md`, so before a pull request opens and before each push of new work. [0007](docs/decisions/0007-claude-verify-and-pr-template.md) records it.
- `.github/pull_request_template.md` lays out every pull request body. `node .claude/skills/verify/verify.mjs body` prints its Verification section.
- `.claude/task-prompt.md` is the template for a brief that starts a thread or a subagent.
