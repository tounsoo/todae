# 0016. CI fails a new page, section or check that leaves CLAUDE.md and the verify skill behind

- **Date:** 2026-11-13
- **Status:** Active
- **Source:** Ben's rule from his agent review on 2026-11-12, that a pull request that adds a page, section or check also updates `CLAUDE.md` and the verify skill in the same pull request, and his "All three" on 2026-11-13 to enforce it in CI.

## Decision

CI's Agent docs job runs `.github/scripts/agent-docs.mjs` on every pull request that changes more than Markdown no tool reads, drafts included. It diffs the pull request from its merge base with the base branch and lists what it adds:

- a docs page: a `page` file under `apps/docs/app/(en)/` whose route the base had no page for. A page that moves, which Git pairs as a rename, doesn't count, and neither does a Korean page, since each one has an English twin.
- a docs section: a group `id` in `SITE_GROUPS` in `apps/docs/components/siteGroups.ts` that the base didn't have.
- a check: a job, or a step that runs a command, in a workflow that pull requests start, or a command that the root `pnpm check` chains, that the base didn't have. A step is known by its name, or by its command when it has none, across its whole workflow, so a step copied into another job isn't new. A step that only uses an action, such as checkout or a cache, isn't a check.

When it adds any of them, the pull request must also change `CLAUDE.md` and a file under `.claude/skills/verify/`, or carry a line `Agent docs unchanged: <reason>` in its body. Otherwise the job fails and names what it found and what is missing. The job reads the body when it runs, so a line added later counts at the next push or re-run. `Checks` needs the job, and it is skipped only on a push and on a change that is only Markdown no tool reads. The verify skill runs the same script for docs and tooling changes, so a thread sees the failure before it pushes.

It misses a section heading inside a page, a new test file, a lint rule, and a check added as a script under an existing command, such as a new `pnpm test` file or a new step inside a script that an existing step runs. Renaming a step, or changing the command of a step with no name, counts as a new check.

## Why

Agents learn the repository from `CLAUDE.md` and the verify skill, and the rule to update them with each new page, section or check was a written rule that threads missed: PRs 453, 463 and 465 added docs pages without either. A written rule is the last resort in `AGENTS.md`, so the rule became a check. The body line keeps a pull request that has nothing to add from changing the agent docs for its own sake, and puts the reason in front of Ben before he merges.
