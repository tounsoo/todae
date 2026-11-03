'use client';

import { Description, Field, Text, useField } from '@tounsoo/todae';
import { useId, useState } from 'react';

// A company control that is not a native input, joined to Field.Root with useField.
function Stars({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const field = useField();
  const { disabled } = field;
  const step = (delta: number) => onChange(Math.min(5, Math.max(0, value + delta)));
  return (
    <span
      {...field.getControlProps({}, { native: false })}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      aria-valuetext={`${value} of 5 stars`}
      // Field.Root's frame draws the focus ring, so the control draws none.
      style={{ letterSpacing: '0.1em', outline: 'none' }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') step(1);
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') step(-1);
        else return;
        event.preventDefault();
      }}
    >
      {'★'.repeat(value)}
      {'☆'.repeat(5 - value)}
    </span>
  );
}

// A span is not labelable, so the caption names it through aria-labelledby.
export default function FieldUseField() {
  const captionId = useId();
  const hintId = useId();
  const [stars, setStars] = useState(3);
  return (
    <Field.Group>
      <Text.Root as="span" id={captionId} weight="medium">
        Rating
      </Text.Root>
      <Field.Root aria-labelledby={captionId} aria-describedby={hintId}>
        <Stars value={stars} onChange={setStars} />
      </Field.Root>
      <Description.Root id={hintId}>Arrow keys change the rating.</Description.Root>
    </Field.Group>
  );
}
