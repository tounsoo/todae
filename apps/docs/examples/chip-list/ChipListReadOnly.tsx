'use client';

import { ChipList } from '@tounsoo/todae';

const TAGS = ['design', 'tokens', 'accessibility', 'a-very-long-tag-that-stays-put', 'react', 'density', 'dark mode', 'docs'];

export default function ChipListReadOnly() {
  return (
    <div style={{ width: '100%', maxWidth: '18rem', minWidth: 0 }}>
      <ChipList.Root
        aria-label="Tags"
        chips={TAGS}
        maxRows={1}
        overflowLabel={(n) => `+${n} more`}
        panelLabel={(n) => `${n} more ${n === 1 ? 'tag' : 'tags'}`}
      />
    </div>
  );
}
