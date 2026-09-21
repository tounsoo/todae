'use client';

import { listForIntent, search, type Intent } from '@tounsoo/todae/catalog';
import { useId, useMemo, useState } from 'react';

const INTENTS: Intent[] = [
  'choose-one',
  'choose-many',
  'search-select',
  'confirm',
  'contextual-overlay',
  'transient-hint',
];

function entryId(entry: { id?: string; name: string }): string {
  return 'id' in entry && typeof entry.id === 'string' && 'tree' in entry ? entry.id : entry.name;
}

export function CatalogSearchDemo() {
  const searchId = useId();
  const intentId = useId();
  const [query, setQuery] = useState('modal');
  const [intent, setIntent] = useState<Intent>('choose-one');
  const hits = useMemo(() => search(query, { limit: 8 }), [query]);
  const intentHits = useMemo(() => listForIntent(intent), [intent]);

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
      <div>
        <label htmlFor={intentId}>Intent</label>
        <select
          id={intentId}
          value={intent}
          onChange={(event) => {
            setIntent(event.target.value as Intent);
          }}
        >
          {INTENTS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <ul aria-label={`Entries for ${intent}`}>
        {intentHits.map((entry) => (
          <li key={entryId(entry)}>{entryId(entry)}</li>
        ))}
      </ul>
    </div>
  );
}
