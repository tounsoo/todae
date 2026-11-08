'use client';

import { ChipList } from '@tounsoo/todae';
import { useState } from 'react';

const TAGS = ['design', 'tokens', 'accessibility', 'a-very-long-tag-that-stays-put', 'react', 'density', 'dark mode', 'docs'];

export default function ChipListOneRow() {
  const [chips, setChips] = useState(TAGS);
  return (
    <div style={{ width: '100%', maxWidth: '18rem', minWidth: 0 }}>
      <ChipList.Root
        aria-label="Tags"
        chips={chips}
        maxRows={1}
        overflowLabel={(n) => `+${n} more`}
        panelLabel={(n) => `${n} more ${n === 1 ? 'tag' : 'tags'}`}
        onRemove={(index) => setChips((current) => current.filter((_, i) => i !== index))}
      />
    </div>
  );
}
