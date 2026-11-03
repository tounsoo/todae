'use client';

import { Field, Label, Meter, Stack } from '@tounsoo/todae';
import { useId } from 'react';

export default function MeterLevels() {
  const storage = useId();
  const battery = useId();
  return (
    <Stack.Root>
      <Field.Group>
        <Label.Root htmlFor={storage}>Storage used</Label.Root>
        <Meter.Root id={storage} min={0} max={100} low={70} high={90} optimum={0} value={92}>
          92%
        </Meter.Root>
      </Field.Group>
      <Field.Group>
        <Label.Root htmlFor={battery}>Battery</Label.Root>
        <Meter.Root id={battery} min={0} max={100} low={20} high={60} optimum={100} value={80}>
          80%
        </Meter.Root>
      </Field.Group>
    </Stack.Root>
  );
}
