'use client';

import { EmptyState, Stack, Text, type EmptyStateTitleAs } from '@tounsoo/todae';
import { type ReactNode } from 'react';

type EmptyListProps = { title: string; level: EmptyStateTitleAs; children: ReactNode };

function EmptyList({ title, level, children }: EmptyListProps) {
  return (
    <EmptyState.Root>
      <EmptyState.Title as={level}>{title}</EmptyState.Title>
      <EmptyState.Description>{children}</EmptyState.Description>
    </EmptyState.Root>
  );
}

export default function EmptyStateLevels() {
  return (
    <Stack.Root>
      <Text.Root as="h2">Team settings</Text.Root>
      <EmptyList title="No members yet" level="h3">
        Invite people to give them access.
      </EmptyList>
    </Stack.Root>
  );
}
