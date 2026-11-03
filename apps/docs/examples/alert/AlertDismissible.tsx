'use client';

import { Alert, Button, Stack } from '@tounsoo/todae';
import { useRef, useState } from 'react';

export default function AlertDismissible() {
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
