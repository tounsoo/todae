'use client';

import { Avatar, categoryTone, Stack, Text } from '@tounsoo/todae';
import type { CSSProperties } from 'react';

// A drawn portrait, inline so the demo needs no network.
const PORTRAIT =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#d8d4cc"/><circle cx="20" cy="16" r="7" fill="#6b645a"/><path d="M6 40c2-9 8-13 14-13s12 4 14 13z" fill="#6b645a"/></svg>',
  );

export function AvatarStates() {
  return (
    <Stack.Root direction="row">
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
    </Stack.Root>
  );
}

const step = (name: 'sm' | 'lg'): CSSProperties => ({ '--todae-avatar-size-md': `var(--todae-avatar-size-${name})` }) as CSSProperties;

export function AvatarSizes() {
  return (
    <Stack.Root direction="row">
      <Avatar.Root style={step('sm')} label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root style={step('lg')} label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    </Stack.Root>
  );
}

export function AvatarBesideName() {
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

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT' },
  { id: 'katherine', name: 'Katherine Johnson', initials: 'KJ' },
  { id: 'edsger', name: 'Edsger Dijkstra', initials: 'ED' },
];

export function AvatarTones() {
  return (
    <Stack.Root direction="row" style={{ flexWrap: 'wrap' }}>
      {PEOPLE.map((person) => (
        <Avatar.Root key={person.id} label={person.name} tone={categoryTone(person.id)}>
          <Avatar.Fallback>{person.initials}</Avatar.Fallback>
        </Avatar.Root>
      ))}
    </Stack.Root>
  );
}
