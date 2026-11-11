'use client';

import { DensityProvider, Field, Label, useChipField } from '@tounsoo/todae';
import { useId, useState } from 'react';

const MANY = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta'];

function ChipRow({ density, chips }: { density: 'compact' | 'comfortable' | 'spacious'; chips: string[] }) {
  const id = useId();
  const field = useChipField({ initialChips: chips });
  return (
    <DensityProvider density={density}>
      <Field.Group>
        <Label.Root htmlFor={id}>Tags</Label.Root>
        <Field.Root id={id} style={{ maxWidth: '18rem' }}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.ChipInput {...field.getChipInputProps()} chipLayout="row" maxRows={2} placeholder="Tags" />
          <Field.Affix>tag</Field.Affix>
        </Field.Root>
      </Field.Group>
    </DensityProvider>
  );
}

export default function RowChipInput() {
  const emptyId = useId();
  const textId = useId();
  const empty = useChipField({ initialChips: [] });
  const [text, setText] = useState('');
  return (
    <>
      {(['compact', 'comfortable', 'spacious'] as const).map((density) => (
        <ChipRow key={density} density={density} chips={MANY} />
      ))}
      <Field.Group>
        <Label.Root htmlFor={emptyId}>Tags</Label.Root>
        <Field.Root id={emptyId}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.ChipInput {...empty.getChipInputProps()} chipLayout="row" placeholder="No chips" />
          <Field.Affix>tag</Field.Affix>
        </Field.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={textId}>Tags</Label.Root>
        <Field.Root id={textId}>
          <Field.Icon>
            <span>⌕</span>
          </Field.Icon>
          <Field.TextInput
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Same adornments"
          />
          <Field.Affix>tag</Field.Affix>
        </Field.Root>
      </Field.Group>
    </>
  );
}
