'use client';

import { useState } from 'react';
import { ChipList } from '@tounsoo/todae';

const TAGS = ['design', 'tokens', 'accessibility', 'a-very-long-tag-that-stays-put', 'react', 'density', 'dark mode', 'docs'];

export function ChipListDemo({
  maxRows,
  initialChips = TAGS,
  readOnly = false,
}: {
  maxRows: number;
  initialChips?: readonly string[];
  readOnly?: boolean;
}) {
  const [chips, setChips] = useState(initialChips);
  return (
    <div style={{ width: '100%', maxWidth: '18rem', minWidth: 0 }}>
      <ChipList.Root
        aria-label="Tags"
        chips={chips}
        maxRows={maxRows}
        overflowLabel={(n) => `+${n} more`}
        panelLabel={(n) => `${n} more ${n === 1 ? 'tag' : 'tags'}`}
        onRemove={readOnly ? undefined : (index) => setChips((current) => current.filter((_, i) => i !== index))}
      />
    </div>
  );
}
