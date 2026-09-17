'use client';

import { DensityProvider, Field, useChipField } from '@tounsoo/todae';
import { useState } from 'react';

const MANY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

export function FieldStates() {
  const [value, setValue] = useState('');
  return (
    <>
      <Field.Root>
        <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} placeholder="Idle" />
      </Field.Root>
      <Field.Root disabled>
        <Field.TextInput value="Disabled" onChange={() => undefined} />
      </Field.Root>
      <Field.Root invalid>
        <Field.TextInput value="Invalid" onChange={() => undefined} />
      </Field.Root>
    </>
  );
}

export function FieldAdornments() {
  const [amount, setAmount] = useState('12');
  const [search, setSearch] = useState('query');
  return (
    <>
      <Field.Root>
        <Field.Affix>$</Field.Affix>
        <Field.TextInput value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Field.Affix>.00</Field.Affix>
      </Field.Root>
      <Field.Root>
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

export function ChipInputControlled() {
  const [chips, setChips] = useState(['alpha', 'beta']);
  const [inputValue, setInputValue] = useState('');
  return (
    <Field.Root>
      <Field.ChipInput
        chips={chips}
        inputValue={inputValue}
        onInputValueChange={setInputValue}
        onCommit={(value) => {
          setChips((prev) => (prev.includes(value) ? prev : [...prev, value]));
          setInputValue('');
        }}
        onChipRemove={(index) => setChips((prev) => prev.filter((_, i) => i !== index))}
        placeholder="Type and press Enter"
      />
    </Field.Root>
  );
}

export function ChipInputHook() {
  const field = useChipField({ initialChips: ['react'] });
  return (
    <Field.Root>
      <Field.ChipInput {...field} placeholder="useChipField" />
    </Field.Root>
  );
}

export function ChipInputCommitKeys() {
  const field = useChipField({ initialChips: ['one'] });
  return (
    <Field.Root>
      <Field.ChipInput {...field} commitKeys={['Enter', ',']} placeholder="Enter or comma" />
    </Field.Root>
  );
}

function MaxRowsDemo({ density, maxRows }: { density: 'compact' | 'comfortable'; maxRows: 1 | 2 }) {
  const field = useChipField({ initialChips: MANY });
  return (
    <DensityProvider density={density}>
      <Field.Root style={{ maxWidth: '18rem' }}>
        <Field.ChipInput {...field} maxRows={maxRows} placeholder={`${density} maxRows=${maxRows}`} />
      </Field.Root>
    </DensityProvider>
  );
}

export function ChipInputMaxRows() {
  return (
    <>
      <MaxRowsDemo density="compact" maxRows={1} />
      <MaxRowsDemo density="compact" maxRows={2} />
      <MaxRowsDemo density="comfortable" maxRows={1} />
      <MaxRowsDemo density="comfortable" maxRows={2} />
    </>
  );
}

export function ChipInputStates() {
  return (
    <>
      <Field.Root disabled>
        <Field.ChipInput
          chips={['locked']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>
      <Field.Root invalid>
        <Field.ChipInput
          chips={['bad']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>
    </>
  );
}
