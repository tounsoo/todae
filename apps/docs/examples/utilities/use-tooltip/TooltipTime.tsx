'use client';

import { formatDateTime, formatRelativeTime, Tooltip, useTooltip } from '@tounsoo/todae';

export default function TooltipTime({ locale }: { locale: string }) {
  const tooltip = useTooltip();
  // A fixed clock, so the demo reads the same on every visit; a product passes its own.
  const now = Temporal.ZonedDateTime.from('2026-10-22T09:30:00+09:00[Asia/Seoul]');
  const edited = now.subtract({ hours: 5 });
  return (
    <p>
      Edited{' '}
      <time {...tooltip.getTriggerProps({ tabIndex: 0 })} dateTime={edited.toInstant().toString()}>
        {formatRelativeTime(edited, now, { locale })}
      </time>
      <Tooltip.Root {...tooltip.getTooltipProps()}>{formatDateTime(edited.toPlainDateTime(), { locale })}</Tooltip.Root>
    </p>
  );
}
