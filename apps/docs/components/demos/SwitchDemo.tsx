'use client';

import { Description, Switch } from '@omsoo/todae';
import { useId, useState } from 'react';

export function SwitchStates() {
  const hintId = useId();
  const [digest, setDigest] = useState(true);
  return (
    <>
      <Switch.Root defaultChecked>Play a sound on mention</Switch.Root>
      <div className="labelled-field">
        <Switch.Root checked={digest} onCheckedChange={setDigest} aria-describedby={hintId}>
          Send a weekly digest
        </Switch.Root>
        <Description.Root id={hintId}>One email on Monday. No ads.</Description.Root>
      </div>
      <Switch.Root disabled>Beta channel</Switch.Root>
    </>
  );
}
