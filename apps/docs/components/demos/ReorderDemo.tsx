'use client';

import { Stack } from '@tounsoo/todae';
import { useState } from 'react';
import { PinnedChannels, type Channel } from './PinnedChannels';

const CHANNELS: Channel[] = [
  { id: 'design', name: 'Design' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'sales', name: 'Sales' },
  { id: 'support', name: 'Support' },
];

export function ReorderExample() {
  const [channels, setChannels] = useState(CHANNELS);
  return (
    <Stack.Root gap="condensed" style={{ inlineSize: '100%', maxInlineSize: '20rem' }}>
      <PinnedChannels channels={channels} onReorder={setChannels} />
    </Stack.Root>
  );
}
