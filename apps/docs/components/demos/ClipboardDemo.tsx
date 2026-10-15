'use client';

import { Button, Code, Stack, Text, useClipboard } from '@tounsoo/todae';

const command = 'pnpm add @tounsoo/todae';

export function CopyCommand() {
  const { copy, status } = useClipboard();
  return (
    <Stack.Root gap="condensed" align="start">
      <Code.Root>{command}</Code.Root>
      <Stack.Root gap="condensed" direction="row" wrap align="center">
        <Button.Root onClick={() => copy(command)}>Copy command</Button.Root>
        {status === 'copied' ? <Text.Root>Copied</Text.Root> : null}
        {status === 'failed' ? <Text.Root>Could not copy</Text.Root> : null}
      </Stack.Root>
    </Stack.Root>
  );
}
