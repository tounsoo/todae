'use client';

import { Alert, Button, Stack } from '@tounsoo/todae';
import { CircleCheck, CircleX, Info, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';

// Todae ships no icons. These come from Lucide; any icon library works.

export function AlertTones() {
  return (
    <Stack.Root>
      <Alert.Root tone="info" role="none">
        <Alert.Icon>
          <Info />
        </Alert.Icon>
        <Alert.Title>Scheduled maintenance</Alert.Title>
        <Alert.Description>Sign-in pauses for ten minutes on Sunday at 02:00 UTC.</Alert.Description>
      </Alert.Root>
      <Alert.Root tone="success" role="none">
        <Alert.Icon>
          <CircleCheck />
        </Alert.Icon>
        <Alert.Title>Invoice paid</Alert.Title>
      </Alert.Root>
      <Alert.Root tone="warning" role="none">
        <Alert.Icon>
          <TriangleAlert />
        </Alert.Icon>
        <Alert.Title>Storage almost full</Alert.Title>
        <Alert.Description>You have used 92% of your plan.</Alert.Description>
      </Alert.Root>
      <Alert.Root tone="critical" role="none">
        <Alert.Icon>
          <CircleX />
        </Alert.Icon>
        <Alert.Title>Payment failed</Alert.Title>
        <Alert.Description>Update your card to keep your plan.</Alert.Description>
        <Alert.Actions>
          <Button.Root variant="secondary">Update card</Button.Root>
        </Alert.Actions>
      </Alert.Root>
    </Stack.Root>
  );
}

export function AlertDismissible() {
  const [shown, setShown] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  return (
    <Stack.Root>
      <Button.Root ref={saveRef} variant="secondary" onClick={() => setShown(true)}>
        Save changes
      </Button.Root>
      {/* The status region stays on the page; only its content changes, so it is announced. */}
      <div role="status">
        {shown ? (
          <Alert.Root tone="success" role="none">
            <Alert.Title>Changes saved</Alert.Title>
            <Alert.Close
              onClick={() => {
                // The button is about to go away: give focus somewhere first.
                saveRef.current?.focus();
                setShown(false);
              }}
            />
          </Alert.Root>
        ) : null}
      </div>
    </Stack.Root>
  );
}
