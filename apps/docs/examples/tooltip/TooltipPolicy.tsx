'use client';

import { Button, Link, Tooltip, useTooltip } from '@tounsoo/todae';

export default function TooltipPolicy() {
  const tooltip = useTooltip({ interactive: true });
  return (
    <>
      <Button.Root variant="ghost" tooltip={false} {...tooltip.getTriggerProps()}>
        Policy
      </Button.Root>
      <Tooltip.Root {...tooltip.getTooltipProps()} aria-label="Policy">
        Interactive tips allow links. <Link.Root href="#tooltip">Read the policy</Link.Root>
      </Tooltip.Root>
    </>
  );
}
