'use client';

import { Stack, Text } from '@tounsoo/todae';

// The main entry, not @tounsoo/todae/text, so the cut text shows its tooltip.
export function TextLines() {
  return (
    <Stack.Root gap="condensed" style={{ inlineSize: '100%', maxInlineSize: '16rem' }}>
      <Text.Root lines={1} weight="medium">
        quarterly-revenue-report-northern-region-final.pdf
      </Text.Root>
      <Text.Root lines={2} size="s" tone="muted">
        Every branch office&apos;s numbers for July through September, with notes from each regional lead and the
        forecast for the next quarter.
      </Text.Root>
    </Stack.Root>
  );
}
