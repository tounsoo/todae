'use client';

import { Checkbox, Fieldset, Stack, Switch } from '@tounsoo/todae';
import { useState } from 'react';

export function FieldsetDisabled() {
  const [paused, setPaused] = useState(true);
  return (
    <Stack.Root>
      <Switch.Root checked={paused} onCheckedChange={setPaused}>
        Pause notifications
      </Switch.Root>
      <Fieldset.Root disabled={paused}>
        <Fieldset.Legend>Channels</Fieldset.Legend>
        <Stack.Root direction="row">
          <Checkbox.Root defaultChecked>Email</Checkbox.Root>
          <Checkbox.Root>Push</Checkbox.Root>
          <Checkbox.Root>SMS</Checkbox.Root>
        </Stack.Root>
      </Fieldset.Root>
    </Stack.Root>
  );
}
