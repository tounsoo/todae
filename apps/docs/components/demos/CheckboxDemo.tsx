'use client';

import { Checkbox, ErrorMessage } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function CheckboxStates() {
  const [accepted, setAccepted] = useState(false);
  const errorId = useId();
  const invalid = !accepted;
  return (
    <>
      <Checkbox defaultChecked>Product updates</Checkbox>
      <Checkbox disabled>Archived list</Checkbox>
      <div className="labelled-field">
        <Checkbox
          checked={accepted}
          onCheckedChange={setAccepted}
          invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
        >
          I accept the terms
        </Checkbox>
        <div className="messages">
          {invalid ? <ErrorMessage id={errorId}>Accept the terms to continue.</ErrorMessage> : null}
        </div>
      </div>
    </>
  );
}
