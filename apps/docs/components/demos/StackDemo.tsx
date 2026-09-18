'use client';

import { Button, Stack, Text } from '@tounsoo/todae';

export function StackButtons() {
  return (
    <Stack>
      <Text>Stacked label</Text>
      <Button.Root>Primary</Button.Root>
      <Button.Root variant="secondary">Secondary</Button.Root>
    </Stack>
  );
}
