'use client';

import { Description, Field, Switch } from '@omsoo.design/todae';
import { useId, useState } from 'react';

export function SwitchStates() {
  const hintId = useId();
  const [digest, setDigest] = useState(true);
  return (
    <>
      <Switch.Root defaultChecked>Play a sound on mention</Switch.Root>
      <Field.Group>
        <Switch.Root checked={digest} onCheckedChange={setDigest} aria-describedby={hintId}>
          Send a weekly digest
        </Switch.Root>
        <Description.Root id={hintId}>One email on Monday. No ads.</Description.Root>
      </Field.Group>
      <Switch.Root disabled>Beta channel</Switch.Root>
    </>
  );
}
