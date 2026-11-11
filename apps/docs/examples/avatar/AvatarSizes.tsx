'use client';

import { Avatar, Stack } from '@tounsoo/todae';
import styles from './AvatarSizes.module.css';

export default function AvatarSizes() {
  return (
    <Stack.Root direction="row">
      <Avatar.Root className={styles.small} label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
      <Avatar.Root className={styles.large} label="Ada Lovelace">
        <Avatar.Fallback>AL</Avatar.Fallback>
      </Avatar.Root>
    </Stack.Root>
  );
}
