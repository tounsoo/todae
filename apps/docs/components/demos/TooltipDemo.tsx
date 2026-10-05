'use client';

import { Button, Chip, Stack, Tooltip, useTooltip } from '@tounsoo/todae';

export function TooltipArchive() {
  return (
    <Button.Root aria-label="Archive">
      <Button.Icon>
        <span>+</span>
      </Button.Icon>
    </Button.Root>
  );
}

export function TooltipOverflow() {
  const tooltip = useTooltip();
  return (
    <Stack direction="row">
      <Chip.Root>Design</Chip.Root>
      <Chip.Root>Tokens</Chip.Root>
      <span {...tooltip.getTriggerProps({ tabIndex: 0 })}>
        <Chip.Overflow overflowCount={2} />
      </span>
      <Tooltip.Root {...tooltip.getTooltipProps()}>Schema, Docs</Tooltip.Root>
    </Stack>
  );
}

export function TooltipPolicy() {
  const tooltip = useTooltip({ interactive: true });
  return (
    <>
      <Button.Root variant="ghost" tooltip={false} {...tooltip.getTriggerProps()}>
        Policy
      </Button.Root>
      <Tooltip.Root {...tooltip.getTooltipProps()} aria-label="Policy">
        Interactive tips allow links. <a href="/tooltip">Read the policy</a>
      </Tooltip.Root>
    </>
  );
}
