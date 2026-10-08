'use client';

import { Button, Field, Label, Stack, useHighlight } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function HighlightSearch() {
  const inputId = useId();
  const [query, setQuery] = useState('token');
  const [index, setIndex] = useState(0);
  const found = useHighlight({ name: 'docs-search', query: query.trim() });
  const total = found.matches.length;
  // The matches can shrink under a kept index, so wrap it on read.
  const at = total === 0 ? 0 : index % total;
  const current = found.matches[at];
  useHighlight({ name: 'docs-search-current', ranges: current ? [current] : undefined, priority: 1 });
  const step = (by: number) => setIndex((at + by + total) % total);
  return (
    <Stack>
      <div className="labelled-field">
        <Label htmlFor={inputId}>Find</Label>
        <Field.Root id={inputId}>
          <Field.TextInput
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
          />
        </Field.Root>
      </div>
      <Stack direction="row">
        <Button.Root variant="ghost" disabled={total === 0} onClick={() => step(-1)}>
          Previous
        </Button.Root>
        <Button.Root variant="ghost" disabled={total === 0} onClick={() => step(1)}>
          Next
        </Button.Root>
        <output>{total === 0 ? 'No matches' : `${at + 1} of ${total}`}</output>
      </Stack>
      <div ref={found.ref} className="demo-highlight-text">
        <p>
          Todae ships design tokens in the DTCG format. A company adds its own tokens on top, and every
          component reads them, so a token change reaches buttons, fields and dialogs at once.
        </p>
      </div>
    </Stack>
  );
}
