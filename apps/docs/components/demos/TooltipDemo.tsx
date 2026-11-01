'use client';

import { Button, Chip, Stack, Tooltip, useStrings, useTooltip, VisuallyHidden } from '@tounsoo/todae';
import { Archive } from 'lucide-react';
import { LocalizedLink } from '../LocalizedLink';

export function TooltipArchive() {
  return (
    <Button.Root aria-label="Archive">
      <Button.Icon>
        <Archive />
      </Button.Icon>
    </Button.Root>
  );
}

export function TooltipOverflow() {
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

function WarmButton({ label, tip, skipDelay }: { label: string; tip: string; skipDelay?: number }) {
  const tooltip = useTooltip({ showDelay: 300, hideDelay: 0, skipDelay });
  return (
    <>
      <Button.Root tooltip={false} {...tooltip.getTriggerProps()}>
        {label}
      </Button.Root>
      <Tooltip.Root {...tooltip.getTooltipProps()}>{tip}</Tooltip.Root>
    </>
  );
}

export function TooltipWarmup() {
  return (
    <Stack.Root direction="row" gap="none">
      <WarmButton label="One" tip="Opens after a pause" />
      <WarmButton label="Two" tip="Opens at once" />
      <WarmButton label="Three" tip="Opens at once" />
      <WarmButton label="Waits" tip="Waits again" skipDelay={0} />
    </Stack.Root>
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
        Interactive tips allow links. <LocalizedLink href="/tooltip">Read the policy</LocalizedLink>
      </Tooltip.Root>
    </>
  );
}
