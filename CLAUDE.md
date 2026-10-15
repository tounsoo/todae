# Claude instructions

## Architecture and decisions

Read [`ARCHITECTURE.md`](ARCHITECTURE.md) before adding or changing a component, hook, recipe, token or docs page. It records the concepts and decisions new work must follow. When a decision changes, update it in the same pull request.

## Docs translations

The docs site is in English and Korean. A change to an English `page.mdx` in `apps/docs/app/(en)` also changes its Korean twin in `apps/docs/app/ko`, in the same pull request, then runs `pnpm --filter docs i18n:stamp ko <slug>`. `apps/docs/TRANSLATING.md` has the details.

## Changesets

A pull request that changes what `@omsoo.design/todae` ships adds a changeset, as the Releases section of `ARCHITECTURE.md` says. Write it with `pnpm changeset --patch @omsoo.design/todae -m "…"` (or `--minor` for a breaking change before 1.0), since `pnpm changeset` alone asks questions in a terminal. A change that ships nothing but still trips the CI check gets `pnpm changeset --empty`.

## pstack skills

`.claude/skills/` and `.claude/agents/` hold [pstack-claude](https://github.com/michael-denyer/pstack-claude), the Claude Code port of pstack. Its licenses are in `.claude/skills/poteto-mode/references/licenses/`. Cloud sessions don't load plugins, so `sh .claude/update-pstack.sh [commit]` copies the port in at a pinned commit. To update, rerun it with a newer commit and review the diff. It leaves out `babysit`, `fix-ci`, `fix-merge-conflicts` and `get-pr-comments`, because this file and the GitHub tools already drive pull requests, and `setup-pstack`, because the container doesn't keep the model sheet it writes.

Use the `poteto-mode` skill for a task that touches more than one file, changes a signature other files call, involves a design choice, or is a bug or performance issue whose cause isn't known yet. Work directly on smaller tasks.

Where pstack and this file disagree, this file wins:

- The agents are project agents, so they have no plugin prefix. Where a skill names `pstack:<agent>`, use `subagent_type: "<agent>"`.
- The port was written as a plugin, so a `<plugin>` path in a skill means `.claude/`.
- `Agent` has no `readonly` parameter. Where a skill spawns a subagent with `readonly: true`, add a line to its prompt telling it not to edit files, commit, or push.
- Reviews in the review loop run `/code-review` at the rows of its table. Pull requests open as the review loop says, not as pstack's Opening a PR playbook says.
- Merge conflicts are resolved as [Waiting on CI](#waiting-on-ci) says, not reported the way pstack's Babysit playbook says.
- GitHub work uses the GitHub MCP tools, not `gh` or the `watch-pr` script in `poteto-mode/scripts`.

Before committing English docs prose or writing a pull request description, use the `unslop` skill on it.

## Bug fixes

Outside the review loop, a reported bug, or one found while working, follows poteto-mode's Bug fix playbook, `.claude/skills/poteto-mode/playbooks/bug-fix.md`. Its last step, Opening a PR, is the review loop below.

## Pull request review loop

Open the pull request, and post its link, only after a review round comes back with no blocking findings. Until then, commit to the session's branch and push it as usual. The goal is to finish in as few rounds as possible, so each round should fix the cause, not just the symptom the reviewer pointed at.

Each round's review runs in an `Agent` at that round's row of this table. `<base>` is `git merge-base origin/main HEAD`, so commits that landed on `main` after the branch started are not in the review. The table is for the reviewer only: the advisor runs as step 4 says, and the fixes always run on the session's default model and effort.

| Round | `model` | `effort` | Command                                          |
| ----- | ------- | -------- | ------------------------------------------------ |
| 1     | `opus`  | `xhigh`  | `/code-review xhigh <base>..HEAD`                |
| 2–5   | `opus`  | `high`   | `/code-review high <last-reviewed-commit>..HEAD` |

A review covers the commit range and the code that directly depends on what the range changes, such as code that imports a changed export, CSS that uses a changed token, custom property or selector, a token that aliases a changed token, docs pages in both languages that describe the changed behavior, and the tests that cover it. It does not cover the whole repository; a whole-repository review is a separate task, run when the person asks for one.

1. Commit the work and run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm tokens:check`, and `pnpm schema` (it must leave no diff), committing any fixes they need. Then start an `Agent` with this round's `model` and `effort` from the table, have it run this round's command, and return the findings. Ask it to review the scope the paragraph above describes, and to mark each finding as new on this branch or already on `main` at `<base>`. The reviewer only reviews: it does not edit files, commit, or push. If the reviewer cannot run, tell the person in your next reply rather than reviewing at a different row.

   From round 2, the command reviews only the commits made since the last review. Also give the reviewer the previous round's blocking findings, and have it say which are still open. If the branch was rebased or `origin/main` was merged in since the last review, have the reviewer run `/code-review high <base>..HEAD` instead.

2. Sort the findings. Only blocking findings start another round: a bug, a test or CI failure, or a statement in docs that is wrong about what the code does. Wording, style, missing edge-case caveats and other nits are not blocking: fix the ones that are plainly right along with the blocking fixes, but they never start a round of their own. In a round with no blocking findings, leave the nits. A bug or wrong docs statement that was already on `main` at `<base>` is blocking only if the branch touches that behavior or makes it worse; otherwise list it as a follow-up when you report back.
3. Before fixing anything, use the `principle-fix-root-causes` skill, then work through each blocking finding:
   - Does your diagnosis name the root cause, or only the symptom?
   - Does the same bug or pattern exist elsewhere in the change? Fix it there too.
   - Could your fix introduce a new problem the next review would flag? Prefer the smallest fix. In docs, remove or narrow a wrong claim rather than adding new claims or examples, since every new claim is something the next review can find wrong.
   - Are your tests enough to catch a regression?
4. Ask an advisor for advice when the loop is stuck: a finding comes back after you fixed it, or you are about to start a third round. Start an `Agent` at `opus` / `xhigh` and give it the branch, the findings, what earlier rounds changed, and your diagnosis and fix plan. Ask it to read `.claude/skills/principle-attack-the-premise/SKILL.md`, write down the premise the earlier fixes shared and how to test it, go through the step 3 questions, say why the earlier fixes did not hold, and say whether changing the design would end the loop sooner than another fix. The advisor only advises: it does not edit files, commit, or push. The session does the fixing itself, on its default model. If you go against the advisor's advice, say why in your summary. If the advisor cannot run, tell the person in your next reply rather than carrying on silently.
5. Fix every blocking finding and commit the fixes. Add or update tests for each fix. When a cheap test path exists (see `tdd`), the test fails before the fix for the reason the finding names, and it checks behavior a user of the code can see, as `principle-test-behavior-not-implementation` says. Then go back to step 1.
6. When a round returns no blocking findings, push the branch. If no pull request is open yet, open one and post its link. CI skips draft pull requests, so if the pull request is a draft, mark it ready for review, then wait for CI. [Waiting on CI](#waiting-on-ci) says how to wait. If CI fails, or a comment on the pull request raises something step 2 counts as blocking, treat it as a blocking finding and continue from step 3. When CI is green on the latest commit and every commit has been through a clean round, report back.

Never run more than 5 rounds in all, before and after the pull request opens. If round 5 still leaves blocking findings or unreviewed commits, stop and report back with what is open and why it keeps coming back, so the person can decide. Don't open a pull request then; if one is open, or the person asks for one anyway, leave it as a draft until they say otherwise.

## Waiting on CI

Some pull request states never produce a CI result, so never end a turn on the pull request subscription alone:

- **A merge conflict means no CI run.** GitHub does not run the `pull_request` workflow on a pull request that conflicts with its base, and when the pull request was opened already conflicted, no event says so. Right before opening a pull request, pushing to it, or marking it ready, fetch `origin/main` and run `git merge-tree --write-tree HEAD origin/main`, which exits 1 on a conflict. On a conflict, merge `origin/main`, resolve it, and go back to step 1, where the reviewer runs `<base>..HEAD`. If that would be a sixth round, stop and report back as the round cap says.
- **A draft's run is skipped.** Every job skips on a draft, so a run whose conclusion is `skipped` is not a result. Mark the pull request ready, unless the round cap says to keep it a draft, and wait for the run that starts then.
- **Check until the head commit has a result.** After opening a pull request, pushing to it, or marking it ready, schedule a check-in with `send_later` about 5 minutes out before ending the turn; CI takes about four. When it fires, read the pull request's `mergeable_state` and the head commit's check runs with the GitHub tools, then:
  - Green: report back as step 6 says.
  - Red: it is a blocking finding, as step 6 says.
  - `dirty`: a conflict, handled as above.
  - Still running, `unknown`, or no run yet: schedule another check-in. If two check-ins in a row find no result for the head commit, tell the person what is missing rather than waiting silently.

  Once the head commit has a result, cancel any pending check-in with `delete_trigger` and the `trigger_id` that `send_later` returned.
