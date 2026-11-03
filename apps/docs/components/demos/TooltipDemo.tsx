'use client';

import { Button, Stack, Tooltip, useTooltip } from '@tounsoo/todae';
import { LocalizedLink } from '../LocalizedLink';

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
