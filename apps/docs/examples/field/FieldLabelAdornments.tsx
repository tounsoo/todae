'use client';

import { Field, Label } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldLabelAdornments() {
  const searchId = useId();
  const amountId = useId();
  const [search, setSearch] = useState('query');
  const [amount, setAmount] = useState('12');
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={searchId}>Search</Label.Root>
        <Field.Root id={searchId}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.TextInput value={search} onChange={(event) => setSearch(event.target.value)} />
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={amountId}>Amount</Label.Root>
        <Field.Root id={amountId}>
          <Field.Affix>$</Field.Affix>
          <Field.TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
          <Field.Affix>USD</Field.Affix>
        </Field.Root>
      </Field.Group>
    </>
  );
}
