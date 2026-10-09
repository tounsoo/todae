'use client';

import { Avatar, Stack, Text } from '@tounsoo/todae';

// A drawn portrait, inline so the demo needs no network.
const PORTRAIT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#d8d4cc"/><circle cx="20" cy="16" r="7" fill="#6b645a"/><path d="M6 40c2-9 8-13 14-13s12 4 14 13z" fill="#6b645a"/></svg>',
  );

export function AvatarStates() {
  return (
    <Stack direction="row">
      <Avatar.Root label="Ada Lovelace">
        <Avatar.Image src={PORTRAIT} />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root label="Grace Hopper">
        <Avatar.Fallback>GH</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root label="Alan Turing">
        <Avatar.Image src="data:image/png;base64,missing" />
        <Avatar.Fallback>AT</Avatar.Fallback>
      </Avatar.Root>
    </Stack>
  );
}

export function AvatarSizes() {
  return (
    <Stack direction="row">
      <Avatar.Root size="sm" label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root size="lg" label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    </Stack>
  );
}

export function AvatarBesideName() {
  return (
    <Stack direction="row" style={{ alignItems: 'center' }}>
      <Avatar.Root>
        <Avatar.Image src={PORTRAIT} />
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Text>Ada Lovelace</Text>
    </Stack>
  );
}
