'use client';

import { Field } from '@tounsoo/todae';

export default function ChipInputStates() {
  return (
    <>
      <Field.Root aria-label="Locked tags" disabled>
        <Field.ChipInput
          chips={['locked']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>
      <Field.Root aria-label="Invalid tags" invalid>
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
