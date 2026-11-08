'use client';

import { formatRelativeTime, Tooltip, useTooltip } from '@tounsoo/todae';

export default function TooltipTime({ locale }: { locale: string }) {
  const tooltip = useTooltip();
  // A fixed clock, so the demo reads the same on every visit; a product passes its own.
  const now = Temporal.ZonedDateTime.from('2026-10-22T09:30:00+09:00[Asia/Seoul]');
  const edited = now.subtract({ hours: 5 });
  return (
    <p>
      Edited{' '}
      <time {...tooltip.getTriggerProps({ tabIndex: 0 })} lang={locale} dateTime={edited.toInstant().toString()}>
        {formatRelativeTime(edited, now, { locale })}
      </time>
      {/* The exact time names its zone, since it is the clock's, not the reader's. */}
      <Tooltip.Root {...tooltip.getTooltipProps()} lang={locale}>
        {new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: edited.timeZoneId,
          timeZoneName: 'short',
        }).format(edited.epochMilliseconds)}
      </Tooltip.Root>
    </p>
  );
}
