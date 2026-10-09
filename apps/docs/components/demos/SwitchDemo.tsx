'use client';

import { Description, Switch } from '@omsoo/todae';
import { useId, useState } from 'react';

export function SwitchStates() {
  const hintId = useId();
  const [digest, setDigest] = useState(true);
  return (
    <>
      <Switch defaultChecked>Play a sound on mention</Switch>
      <div className="labelled-field">
        <Switch checked={digest} onCheckedChange={setDigest} aria-describedby={hintId}>
          Send a weekly digest
        </Switch>
        <Description id={hintId}>One email on Monday. No ads.</Description>
      </div>
      <Switch disabled>Beta channel</Switch>
    </>
  );
}
