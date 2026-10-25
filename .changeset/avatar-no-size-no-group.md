---
"@tounsoo/todae": minor
---

Avatar drops `size` and `Avatar.Group`; stacked avatars are the Avatar group recipe.

- `Avatar.Group` is removed, along with `AvatarGroupProps` and the `avatar.group.overlap`, `avatar.group.ring.width` and `avatar.group.ring.color` tokens. The ring color is now `--avatar-group-ring` in the recipe's CSS, set on the stack and falling back to the surface color. Build the stack from `Avatar.Root` and the Avatar group recipe.
- Remove `size` and `AvatarSize` from `Avatar.Root`. It draws at `avatar.size.md`. Set `--todae-avatar-size-md` on the avatar, or on an ancestor with no `data-appearance` or `data-density` element and no scoped theme root between them. A ThemeProvider or a DensityProvider carries one of those attributes. Such an element, or a scoped theme root, in between declares the token again. Or override `avatar.size.md` in the theme.
- A theme value for `avatar.size.sm` or `avatar.size.lg` no longer resizes an avatar on its own. Set `--todae-avatar-size-md` to `var(--todae-avatar-size-sm)` or `var(--todae-avatar-size-lg)`.
- `data-size` is no longer rendered.
