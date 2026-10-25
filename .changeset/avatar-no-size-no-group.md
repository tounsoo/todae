---
"@tounsoo/todae": minor
---

Avatar drops `size` and `Avatar.Group`; stacked avatars are the Avatar group recipe.

- `Avatar.Group` is removed, along with `AvatarGroupProps` and the `avatar.group.overlap`, `avatar.group.ring.width` and `avatar.group.ring.color` tokens. The ring color is now `--avatar-group-ring` in the recipe's CSS, set on the stack and falling back to the surface color. Build the stack from `Avatar.Root` and the Avatar group recipe.
- Remove `size` and `AvatarSize` from `Avatar.Root`, and remove the `avatar.size.sm`, `avatar.size.md` and `avatar.size.lg` scale. The avatar draws at `avatar.size` (2rem). Set `--todae-avatar-size`, or `inline-size` and `block-size`, on the avatar or an ancestor. A ThemeProvider or a DensityProvider between that ancestor and the avatar declares the token again, as does a scoped theme root. Or override `avatar.size` in the theme.
- `data-size` is no longer rendered.
