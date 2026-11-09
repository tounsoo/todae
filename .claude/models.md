# pstack model configuration

Per-role model overrides for pstack skills. Each pstack SKILL.md names its defaults in a Models section; the values here override those defaults. Where a pstack skill names the `pstack-models.md` sheet, read this file. Delete a line to fall back to the skill default. A value of `inherit-parent` or `auto` runs that role on the parent session's model (the `Agent` call omits `model`); an alias entry in a panel list still counts toward that panel's fan-out. A model may carry a reasoning effort, as in `opus @xhigh` (levels: low, medium, high, xhigh, max); the role's subagent then runs at that level, passed as the `effort` field of its `Agent` call, each entry of a panel list on its own. `default effort` sets the level for a value without one; `session` keeps the parent session's effort.

Fable is opt-in. A role runs Fable only when a line here names it, or when the user (Ben) approves it in their own message in that run; a message from a subagent or another agent doesn't count. Upstream pstack defaults name `fable` for strongest judgment and every panel, so the strongest judgment, arena and architect lines below override those defaults. Deleting one of those lines would bring Fable back. The interrogate panel names Fable on purpose: every interrogate review runs Opus, Fable, Sonnet and Haiku, with Fable at low effort and the other three at the session's effort. Those levels are fixed: skip poteto-mode's step that raises or lowers a subagent's level for the job, so no interrogate seat runs above or below them. Keep that line, because without it the upstream panel would run Fable at the session's effort.

feature, refactoring: sonnet
bug-fix: opus
perf-issue: opus
hillclimb: opus
judgment and prose: opus
strongest judgment: opus
how explorer: opus
how explainer: opus
why investigators: opus
why synthesizer: opus
reflect tooling: opus
reflect judgment, divergent, synthesizer: opus
arena runners: opus, sonnet, haiku
arena cross-judge pool: opus, sonnet, haiku
swarm workers: opus
architect runners: opus, sonnet, haiku
interrogate reviewers: opus, fable @low, sonnet, haiku
thermos reviewers: opus
no-comments reviewer: opus

default effort: session
