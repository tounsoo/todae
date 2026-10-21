---
"@tounsoo/todae": minor
---

A nested ThemeProvider or DensityProvider that sets no value keeps the enclosing provider's.

- A nested ThemeProvider that relied on resetting its subtree to `system` now needs `appearance="system"`.
- A nested DensityProvider that relied on resetting its subtree to `comfortable` now needs `density="comfortable"`.
