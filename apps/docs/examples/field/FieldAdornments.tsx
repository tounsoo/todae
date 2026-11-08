'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function FieldAdornments() {
  const [amount, setAmount] = useState('12');
  const [search, setSearch] = useState('query');
  return (
    <>
      <Field.Root aria-label="Amount">
        <Field.Affix>$</Field.Affix>
        <Field.TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Field.Affix>.00</Field.Affix>
      </Field.Root>
      <Field.Root aria-label="Search">
        <Field.Icon>
          <span>⌕</span>
        </Field.Icon>
        <Field.TextInput value={search} onChange={(event) => setSearch(event.target.value)} />
        <Field.Icon interactive>
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
            Clear
          </button>
        </Field.Icon>
      </Field.Root>
    </>
  );
}
