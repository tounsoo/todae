'use client';

import { Badge, Stack, Text } from '@tounsoo/todae';

export default function StackGaps() {
  return (
    <Stack.Root gap="spacious">
      {(['none', 'condensed', 'normal', 'spacious'] as const).map((gap) => (
        <Stack.Root key={gap} gap="condensed">
          <Text.Root>{gap}</Text.Root>
          <Stack.Root direction="row" gap={gap}>
            <Badge.Root>One</Badge.Root>
            <Badge.Root>Two</Badge.Root>
            <Badge.Root>Three</Badge.Root>
          </Stack.Root>
        </Stack.Root>
      ))}
    </Stack.Root>
  );
}
