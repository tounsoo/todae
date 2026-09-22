'use client';

import { search } from '@tounsoo/todae/catalog';
import { useId, useMemo, useState } from 'react';

function entryId(entry: { id?: string; name: string }): string {
  return 'id' in entry && typeof entry.id === 'string' && 'tree' in entry ? entry.id : entry.name;
}

export function CatalogSearchDemo() {
  const searchId = useId();
  const [query, setQuery] = useState('modal');
  const hits = useMemo(() => search(query, { limit: 8 }), [query]);

  return (
    <div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div>
          <label htmlFor={searchId}>Search catalog</label>
          <input id={searchId} type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </form>
      <ul aria-label="Search results">
        {hits.map((hit) => (
          <li key={entryId(hit.entry)}>
            {entryId(hit.entry)} ({hit.score}) — {hit.matched.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}
