'use client';

import { Avatar, categoryTone, Stack } from '@tounsoo/todae';
import styles from './AvatarGroup.module.css';

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT' },
];

const STACKS = [
  { size: 'sm', className: `${styles.avatarGroup} ${styles.small}` },
  { size: 'md', className: styles.avatarGroup },
  { size: 'lg', className: `${styles.avatarGroup} ${styles.large}` },
] as const;

export default function AvatarGroupSizes() {
  return (
    <Stack.Root direction="row" align="center">
      {STACKS.map(({ size, className }) => (
        <div key={size} role="group" aria-label={`Assignees, ${size}`} className={className}>
          {PEOPLE.map((person) => (
            <Avatar.Root key={person.id} className={styles.avatar} label={person.name} tone={categoryTone(person.id)}>
              <Avatar.Fallback>{person.initials}</Avatar.Fallback>
            </Avatar.Root>
          ))}
        </div>
      ))}
    </Stack.Root>
  );
}
