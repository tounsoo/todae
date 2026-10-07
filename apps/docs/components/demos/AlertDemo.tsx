'use client';

import { Alert, Button, Stack } from '@tounsoo/todae';
import { useRef, useState } from 'react';

// Todae ships no icons. These stand in for your own icon set.
function Mark({ children }: { children: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">
        {children}
      </text>
    </svg>
  );
}

export function AlertTones() {
  return (
    <Stack>
      <Alert.Root tone="info" role="none">
        <Alert.Icon>
          <Mark>i</Mark>
        </Alert.Icon>
        <Alert.Title>Scheduled maintenance</Alert.Title>
        <Alert.Description>Sign-in pauses for ten minutes on Sunday at 02:00 UTC.</Alert.Description>
      </Alert.Root>
      <Alert.Root tone="success" role="none">
        <Alert.Icon>
          <Mark>✓</Mark>
        </Alert.Icon>
        <Alert.Title>Invoice paid</Alert.Title>
      </Alert.Root>
      <Alert.Root tone="warning" role="none">
        <Alert.Icon>
          <Mark>!</Mark>
        </Alert.Icon>
        <Alert.Title>Storage almost full</Alert.Title>
        <Alert.Description>You have used 92% of your plan.</Alert.Description>
      </Alert.Root>
      <Alert.Root tone="critical" role="none">
        <Alert.Icon>
          <Mark>×</Mark>
        </Alert.Icon>
        <Alert.Title>Payment failed</Alert.Title>
        <Alert.Description>Update your card to keep your plan.</Alert.Description>
        <Alert.Actions>
          <Button.Root variant="secondary">Update card</Button.Root>
        </Alert.Actions>
      </Alert.Root>
    </Stack>
  );
}

export function AlertDismissible() {
  const [shown, setShown] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  return (
    <Stack>
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
            >
              ×
            </Alert.Close>
          </Alert.Root>
        ) : null}
      </div>
    </Stack>
  );
}
