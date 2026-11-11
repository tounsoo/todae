'use client';

import { Badge, categoryTone, DataList } from '@tounsoo/todae';

const TAGS = ['design', 'bug', 'docs', 'research', 'billing'];

// The same key gives the same tone on every render, on the server and in the browser.
export default function CategoryToneTags() {
  return (
    <DataList.Root aria-label="Tag tones" style={{ maxInlineSize: '20rem' }}>
      {TAGS.map((tag) => (
        <DataList.Item key={tag}>
          <DataList.Term>
            <Badge.Root tone={categoryTone(tag)}>{tag}</Badge.Root>
          </DataList.Term>
          <DataList.Details>{categoryTone(tag)}</DataList.Details>
        </DataList.Item>
      ))}
    </DataList.Root>
  );
}
