---
extends: babysit
when: Driving a todae pull request this session opened to green CI, or waiting on its CI.
---

### Waiting on CI

Cloud sessions have no `gh` and no `watch-pr`, and GitHub stays silent about some pull request states. These changes replace the watcher with GitHub MCP reads and scheduled check-ins.

- **Replace** "Babysitting starts when the user asks for it, which is normally once a phase or a whole stack is built, not when a PR opens." with: A session drives every pull request it opened, from the moment it opens, in `drive` mode.
- **Replace** "A conflict and the watcher's `behind-base` gate are the two blockers you report rather than resolve." with: Resolve a conflict yourself and don't mention it. Merge `origin/main` into the branch (no rebase or force-push), keep both sides, regenerate generated files with `pnpm schema` and `pnpm --filter docs i18n:stamp`, run the review round from `.agents/playbooks/review-before-pr.md` on `<base>..HEAD`, then push. Tell the user only about a conflict you can't settle, such as two pull requests that change the same behavior in incompatible ways.
- **Replace** "On GitHub, status comes from the watcher at `skills/poteto-mode/scripts/watch-pr/watch-pr` under the installed plugin." with: Status comes from the GitHub MCP tools. Read the pull request's `mergeable_state`, the check runs on the head commit, and the open review threads. GitHub runs no `pull_request` workflow on a pull request that conflicts with its base, and every job on a draft finishes as `skipped`, which is not a result. Right before opening, pushing or marking ready, fetch `origin/main` and run `git merge-tree --write-tree HEAD origin/main`, which exits 1 on a conflict.
- **Replace** "Run `drive` and `background` under `/loop` in dynamic mode. Rearm the watcher after every push wave and every verdict you act on. Watcher output drives wakeups. Never add a second sleep loop." with: After opening, pushing or marking ready, schedule a `send_later` check-in about 5 minutes out, since CI takes about four. At each check-in, test-merge `origin/main` as above and read the status. Schedule another check-in while a run is pending, `unknown`, or missing. After two check-ins in a row with no result for the head commit, tell the user what is missing. Once the head commit has a result, cancel any pending check-in with `delete_trigger`.
- **Replace** "On GitHub, stop at `READY` for one PR (single or stack mode)." with: Stop when the head commit's CI is green, `mergeable_state` is clean, and no blocking review thread is open, then report.
