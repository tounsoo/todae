'use client';

import { Field, Label, Progress, Stack } from '@tounsoo/todae';
import { useId } from 'react';

export default function ProgressStates() {
  const done = useId();
  const loading = useId();
  return (
    <Stack.Root>
      <Field.Group>
        <Label.Root htmlFor={done}>Uploading report.pdf</Label.Root>
        <Progress.Root id={done} value={64} max={100}>
          64%
        </Progress.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={loading}>Loading results</Label.Root>
        <Progress.Root id={loading} />
      </Field.Group>
    </Stack.Root>
  );
}
