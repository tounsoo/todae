---
name: verify
description: "Drive the Todae docs site in English and Korean, locally or on its Vercel preview, and save proof that matches the change. Use for a docs pull request, a preview check, or /verify."
---

# Verify the Todae docs site

The verify skill lives at `.cursor/skills/verify/`. This file points Claude sessions there so `poteto-mode` finds a project verify skill at `.claude/skills/verify/`. Keep the procedure and the helper in that one place.

Read `.cursor/skills/verify/SKILL.md` and follow it. Run its helper from the repo root as that file shows, at `.cursor/skills/verify/verify.mjs`, and read `.cursor/skills/verify/features/README.md` before a run. [0005](../../../docs/decisions/0005-verify-procedure.md) records the procedure.
