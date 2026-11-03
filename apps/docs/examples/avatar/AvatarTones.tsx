'use client';

import { Avatar, categoryTone, Stack } from '@tounsoo/todae';

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT' },
  { id: 'katherine', name: 'Katherine Johnson', initials: 'KJ' },
  { id: 'edsger', name: 'Edsger Dijkstra', initials: 'ED' },
];

export default function AvatarTones() {
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
