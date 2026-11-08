'use client';

import { Avatar, categoryTone } from '@tounsoo/todae';
import styles from './AvatarGroup.module.css';

const PEOPLE = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT' },
  { id: 'katherine', name: 'Katherine Johnson', initials: 'KJ' },
  { id: 'edsger', name: 'Edsger Dijkstra', initials: 'ED' },
];

export default function AvatarGroupExample() {
  const shown = PEOPLE.slice(0, 4);
  const rest = PEOPLE.length - shown.length;
  return (
    <div role="group" aria-label="Assignees" className={styles.avatarGroup}>
      {shown.map((person) => (
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
