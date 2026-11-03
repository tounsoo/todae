'use client';

import { Chip, Stack, Tooltip, useStrings, useTooltip, VisuallyHidden } from '@tounsoo/todae';

export default function TooltipOverflow() {
  const tooltip = useTooltip();
  const { moreChips } = useStrings();
  return (
    <Stack.Root direction="row">
      <Chip.Root>Design</Chip.Root>
      <Chip.Root>Tokens</Chip.Root>
      <span {...tooltip.getTriggerProps({ tabIndex: 0 })}>
        <Chip.Root aria-hidden>+2</Chip.Root>
        <VisuallyHidden.Root>{moreChips(2)}</VisuallyHidden.Root>
      </span>
      <Tooltip.Root {...tooltip.getTooltipProps()}>Schema, Docs</Tooltip.Root>
    </Stack.Root>
  );
}
