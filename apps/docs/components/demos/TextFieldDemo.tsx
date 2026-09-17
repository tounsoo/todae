'use client';

import { TextField } from '@tounsoo/todae';
import { useState } from 'react';

export function TextFieldStates() {
  const [value, setValue] = useState('');
  return (
    <>
      <TextField>
        <TextField.Input value={value} onChange={(event) => setValue(event.target.value)} placeholder="Idle" />
      </TextField>
      <TextField disabled>
        <TextField.Input value="Disabled" onChange={() => undefined} />
      </TextField>
      <TextField invalid>
        <TextField.Input value="Invalid" onChange={() => undefined} />
      </TextField>
    </>
  );
}

export function TextFieldAdornments() {
  const [amount, setAmount] = useState('12');
  const [search, setSearch] = useState('query');
  return (
    <>
      <TextField>
        <TextField.Prefix>$</TextField.Prefix>
        <TextField.Input value={amount} onChange={(event) => setAmount(event.target.value)} />
        <TextField.Suffix>.00</TextField.Suffix>
      </TextField>
      <TextField>
        <TextField.IconStart>
          <span>⌕</span>
        </TextField.IconStart>
        <TextField.Input value={search} onChange={(event) => setSearch(event.target.value)} />
        <TextField.IconEnd interactive>
          <button type="button" aria-label="Clear search" onClick={() => setSearch('')}>
            Clear
          </button>
        </TextField.IconEnd>
      </TextField>
    </>
  );
}
