'use client';

import { Button, Stack, Text, useFocusHandoff } from '@tounsoo/todae';
import { useRef, useState } from 'react';

export function FocusHandoffRequest() {
  const [answer, setAnswer] = useState<'allowed' | 'denied' | null>(null);
  const allow = useRef<HTMLButtonElement>(null);
  const askAgain = useRef<HTMLButtonElement>(null);
  // Each set of buttons hands focus to the button that replaces it. The keys make React
  // replace the Stack rather than reuse it for the other branch.
  const choices = useFocusHandoff({ to: askAgain });
  const result = useFocusHandoff({ to: allow });

  return (
    <Stack.Root gap="condensed" align="start">
      <Text.Root>Delete 3 files from the shared folder?</Text.Root>
      {answer === null ? (
        <Stack.Root key="choices" ref={choices} direction="row" gap="condensed" role="group" aria-label="Delete 3 files">
          <Button.Root ref={allow} onClick={() => setAnswer('allowed')}>
            Allow
          </Button.Root>
          <Button.Root variant="secondary" onClick={() => setAnswer('denied')}>
            Deny
          </Button.Root>
        </Stack.Root>
      ) : (
        <Stack.Root key="result" ref={result} direction="row" gap="condensed" align="center">
          <Text.Root>{answer === 'allowed' ? 'Allowed.' : 'Denied.'}</Text.Root>
          <Button.Root ref={askAgain} variant="secondary" onClick={() => setAnswer(null)}>
            Ask again
          </Button.Root>
        </Stack.Root>
      )}
    </Stack.Root>
  );
}
