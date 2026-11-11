'use client';

import { Avatar, Stack, Text } from '@tounsoo/todae';

// A drawn portrait stands in for the person's photo URL.
const PORTRAIT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#d8d4cc"/><circle cx="20" cy="16" r="7" fill="#6b645a"/><path d="M6 40c2-9 8-13 14-13s12 4 14 13z" fill="#6b645a"/></svg>',
  );

export default function AvatarBesideName() {
  return (
    <Stack.Root direction="row" style={{ alignItems: 'center' }}>
      <Avatar.Root>
        <Avatar.Image src={PORTRAIT} />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Text.Root>Ada Lovelace</Text.Root>
    </Stack.Root>
  );
}
