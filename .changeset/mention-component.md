---
"@tounsoo/todae": patch
---

Add Mention.Root, MentionText and defineMentionSource, with their prop and source types: one `defineMentionSource` object feeds both `useMentions` while composing and `MentionText` in a sent message, which draws each mention as a Mention.Root button or link with a peek card from the source's `renderPeek`, styled by the new `mention.*` tokens.
