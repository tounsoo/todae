'use client';

import { DensityProvider, Field, useChipField } from '@tounsoo/todae';

const MANY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

function MaxRowsDemo({ density, maxRows }: { density: 'compact' | 'comfortable'; maxRows: 1 | 2 }) {
  const field = useChipField({ initialChips: MANY });
  return (
    <DensityProvider density={density}>
      <Field.Root aria-label="Tags" style={{ maxWidth: '18rem' }}>
        <Field.ChipInput {...field.getChipInputProps()} maxRows={maxRows} placeholder={`${density} maxRows=${maxRows}`} />
      </Field.Root>
    </DensityProvider>
  );
}

export default function ChipInputMaxRows() {
  return (
    <>
      <MaxRowsDemo density="compact" maxRows={1} />
      <MaxRowsDemo density="compact" maxRows={2} />
      <MaxRowsDemo density="comfortable" maxRows={1} />
      <MaxRowsDemo density="comfortable" maxRows={2} />
    </>
  );
}
