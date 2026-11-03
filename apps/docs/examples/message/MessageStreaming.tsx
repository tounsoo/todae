'use client';

import { Button, Message, Prose, Loader, Stack } from '@tounsoo/todae';
import { useState } from 'react';

export default function MessageStreaming() {
  const [streaming, setStreaming] = useState(true);
  return (
    <Stack.Root style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Message.Root streaming={streaming} aria-label="Assistant">
        <Message.Content>
          <Prose.Root>
            <p>Two steps:</p>
            <ul>
              <li>Pick a variant</li>
              <li>Give it a name</li>
            </ul>
          </Prose.Root>
        </Message.Content>
        {streaming && (
          <Message.Actions>
            <Loader.Root variant="dots" aria-label="Writing" />
          </Message.Actions>
        )}
      </Message.Root>
      <Button.Root variant="secondary" pressed={streaming} onPressedChange={setStreaming} style={{ alignSelf: 'start' }}>
        Streaming
      </Button.Root>
    </Stack.Root>
  );
}
