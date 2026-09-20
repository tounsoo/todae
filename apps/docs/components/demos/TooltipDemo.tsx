'use client';

import { Button, Chip, Stack, Tooltip } from '@tounsoo/todae';

export function TooltipArchive() {
  return (
    <Tooltip>
      <Tooltip.Trigger>
        <Button.Root aria-label="Archive">
          <Button.Icon>
            <span>+</span>
          </Button.Icon>
        </Button.Root>
      </Tooltip.Trigger>
      <Tooltip.Content>Archive</Tooltip.Content>
    </Tooltip>
  );
}

export function TooltipOverflow() {
  return (
    <Stack direction="row">
      <Chip>Design</Chip>
      <Chip>Tokens</Chip>
      <Tooltip>
        <Tooltip.Trigger>
          <Chip.Overflow overflowCount={2} />
        </Tooltip.Trigger>
        <Tooltip.Content>Schema, Docs</Tooltip.Content>
      </Tooltip>
    </Stack>
  );
}

export function TooltipPolicy() {
  return (
    <Tooltip interactive>
      <Tooltip.Trigger>
        <Button.Root variant="ghost">Policy</Button.Root>
      </Tooltip.Trigger>
      <Tooltip.Content aria-label="Policy">
        Interactive tips allow links. <a href="/tooltip">Read the policy</a>
      </Tooltip.Content>
    </Tooltip>
  );
}
