'use client';

import { Button, Stack, Text } from '@tounsoo/todae';

export default function StackButtons() {
  return (
    <Stack.Root>
      <Text.Root>Stacked label</Text.Root>
      <Button.Root>Primary</Button.Root>
      <Button.Root variant="secondary">Secondary</Button.Root>
    </Stack.Root>
  );
}
