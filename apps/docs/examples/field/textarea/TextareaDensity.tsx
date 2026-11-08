'use client';

import { DensityProvider, Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function TextareaDensity() {
  const [value, setValue] = useState('Density');
  return (
    <>
      {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
        <DensityProvider key={density} density={density}>
          <Field.Root aria-label="Note">
            <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={3} />
          </Field.Root>
        </DensityProvider>
      ))}
    </>
  );
}
