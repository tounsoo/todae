'use client';

import { Avatar, Stack } from '@tounsoo/todae';
import type { CSSProperties } from 'react';

const small = { '--todae-avatar-size': '1.5rem' } as CSSProperties;
const large = { '--todae-avatar-size': '2.5rem' } as CSSProperties;

export default function AvatarSizes() {
  return (
    <Stack.Root direction="row">
      <Avatar.Root style={small} label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root style={large} label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    </Stack.Root>
  );
}
