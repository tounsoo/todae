'use client';

import { DataList, formatRelativeTime } from '@tounsoo/todae';
import { useLocale } from '../../lib/i18n/useLocale';

export function RelativeTimeFile() {
  const locale = useLocale();
  // A fixed clock, so the demo reads the same on every visit; a product passes its own.
  const now = Temporal.ZonedDateTime.from('2026-10-22T09:30:00+09:00[Asia/Seoul]');
  const file = [
    { term: 'Edited', at: now.subtract({ minutes: 3 }) },
    { term: 'Shared', at: now.subtract({ hours: 5 }) },
    { term: 'Uploaded', at: now.subtract({ days: 1, hours: 2 }) },
    { term: 'Created', at: now.subtract({ months: 2, days: 4 }) },
    { term: 'Expires', at: now.add({ weeks: 2 }) },
  ];
  return (
    <DataList.Root aria-label="File activity" style={{ maxInlineSize: '24rem' }}>
      {file.map(({ term, at }) => (
        <DataList.Item key={term}>
          <DataList.Term>{term}</DataList.Term>
          <DataList.Details>
            <time dateTime={at.toInstant().toString()}>{formatRelativeTime(at, now, { locale })}</time>
          </DataList.Details>
        </DataList.Item>
      ))}
    </DataList.Root>
  );
}
