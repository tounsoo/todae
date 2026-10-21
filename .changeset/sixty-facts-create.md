---
"@tounsoo/todae": minor
---

A nested ThemeProvider with no appearance keeps the enclosing provider's appearance.

- A nested ThemeProvider that relied on resetting its subtree to `system` now needs `appearance="system"`.
