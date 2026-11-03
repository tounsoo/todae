'use client';

import { Field } from '@tounsoo/todae';
import { useState } from 'react';

export default function ChipInputControlled() {
  const [chips, setChips] = useState(['alpha', 'beta']);
  const [inputValue, setInputValue] = useState('');
  return (
    <Field.Root aria-label="Tags">
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
