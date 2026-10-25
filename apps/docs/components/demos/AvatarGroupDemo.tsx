'use client';

import { Avatar, categoryTone, Stack } from '@tounsoo/todae';
import styles from './AvatarGroupDemo.module.css';

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT' },
  { id: 'katherine', name: 'Katherine Johnson', initials: 'KJ' },
  { id: 'edsger', name: 'Edsger Dijkstra', initials: 'ED' },
];

export function AvatarGroupExample() {
  const rest = PEOPLE.length - 4;
  return (
    <div role="group" aria-label="Assignees" className={styles.avatarGroup}>
      {PEOPLE.slice(0, 4).map((person) => (
        <Avatar.Root key={person.id} className={styles.avatar} label={person.name} tone={categoryTone(person.id)}>
          <Avatar.Fallback>{person.initials}</Avatar.Fallback>
        </Avatar.Root>
      ))}
      {rest > 0 && (
        <Avatar.Root className={styles.avatar} label={`${rest} more`}>
          <Avatar.Fallback>+{rest}</Avatar.Fallback>
        </Avatar.Root>
      )}
    </div>
  );
}

const STACKS = [
  { size: 'sm', className: `${styles.avatarGroup} ${styles.small}` },
  { size: 'md', className: styles.avatarGroup },
  { size: 'lg', className: `${styles.avatarGroup} ${styles.large}` },
] as const;

export function AvatarGroupSizes() {
  return (
    <Stack.Root direction="row" style={{ alignItems: 'center' }}>
      {STACKS.map(({ size, className }) => (
        <div key={size} role="group" aria-label={`Assignees, ${size}`} className={className}>
          {PEOPLE.slice(0, 3).map((person) => (
            <Avatar.Root key={person.id} className={styles.avatar} label={person.name} tone={categoryTone(person.id)}>
              <Avatar.Fallback>{person.initials}</Avatar.Fallback>
            </Avatar.Root>
          ))}
        </div>
      ))}
    </Stack.Root>
  );
}
