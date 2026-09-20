'use client';

import { Button, Chip, Stack, Tooltip, useTooltip } from '@tounsoo/todae';

export function TooltipArchive() {
  const tooltip = useTooltip();
  return (
    <>
      <Button.Root aria-label="Archive" {...tooltip.getTriggerProps()}>
        <Button.Icon>
          <span>+</span>
        </Button.Icon>
      </Button.Root>
      <Tooltip {...tooltip.getTooltipProps()}>Archive</Tooltip>
    </>
  );
}

export function TooltipOverflow() {
  const tooltip = useTooltip();
  return (
    <Stack direction="row">
      <Chip>Design</Chip>
      <Chip>Tokens</Chip>
      <span {...tooltip.getTriggerProps({ tabIndex: 0 })}>
        <Chip.Overflow overflowCount={2} />
      </span>
      <Tooltip {...tooltip.getTooltipProps()}>Schema, Docs</Tooltip>
    </Stack>
  );
}

export function TooltipPolicy() {
  const tooltip = useTooltip({ interactive: true });
  return (
    <>
      <Button.Root variant="ghost" {...tooltip.getTriggerProps()}>
        Policy
      </Button.Root>
      <Tooltip {...tooltip.getTooltipProps()} aria-label="Policy">
        Interactive tips allow links. <a href="/tooltip">Read the policy</a>
      </Tooltip>
    </>
  );
}
