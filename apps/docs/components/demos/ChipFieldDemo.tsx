'use client';

import { ChipField, DensityProvider, useChipField } from '@tounsoo/todae';
import { useState } from 'react';

const MANY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

export function ChipFieldControlled() {
  const [chips, setChips] = useState(['alpha', 'beta']);
  const [inputValue, setInputValue] = useState('');
  return (
    <ChipField
      chips={chips}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      onCommit={(value) => {
        setChips((prev) => (prev.includes(value) ? prev : [...prev, value]));
        setInputValue('');
      }}
      onChipRemove={(index) => setChips((prev) => prev.filter((_, i) => i !== index))}
    >
      <ChipField.Input placeholder="Type and press Enter" />
    </ChipField>
  );
}

export function ChipFieldHook() {
  const field = useChipField({ initialChips: ['react'] });
  return (
    <ChipField {...field}>
      <ChipField.Input placeholder="useChipField" />
    </ChipField>
  );
}

export function ChipFieldCommitKeys() {
  const field = useChipField({ initialChips: ['one'] });
  return (
    <ChipField {...field} commitKeys={['Enter', ',']}>
      <ChipField.Input placeholder="Enter or comma" />
    </ChipField>
  );
}

function MaxRowsDemo({ density, maxRows }: { density: 'compact' | 'comfortable'; maxRows: 1 | 2 }) {
  const field = useChipField({ initialChips: MANY });
  return (
    <DensityProvider density={density}>
      <ChipField {...field} maxRows={maxRows} style={{ maxWidth: '18rem' }}>
        <ChipField.Input placeholder={`${density} maxRows=${maxRows}`} />
      </ChipField>
    </DensityProvider>
  );
}

export function ChipFieldMaxRows() {
  return (
    <>
      <MaxRowsDemo density="compact" maxRows={1} />
      <MaxRowsDemo density="compact" maxRows={2} />
      <MaxRowsDemo density="comfortable" maxRows={1} />
      <MaxRowsDemo density="comfortable" maxRows={2} />
    </>
  );
}

export function ChipFieldStates() {
  return (
    <>
      <ChipField
        chips={['locked']}
        inputValue=""
        onInputValueChange={() => undefined}
        onCommit={() => undefined}
        onChipRemove={() => undefined}
        disabled
      />
      <ChipField
        chips={['bad']}
        inputValue=""
        onInputValueChange={() => undefined}
        onCommit={() => undefined}
        onChipRemove={() => undefined}
        invalid
      />
    </>
  );
}
