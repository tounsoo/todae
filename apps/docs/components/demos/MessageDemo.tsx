'use client';

import { Avatar, Button, Message, Prose, Stack } from '@omsoo.design/todae';
import { useState } from 'react';

export function MessageTurns() {
  return (
    <Stack.Root style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Message.Root from="system">
        <Message.Content>Conversation started</Message.Content>
      </Message.Root>
      <Message.Root from="user" aria-label="You">
        <Message.Content>How do I name an icon-only button?</Message.Content>
      </Message.Root>
      <Message.Root aria-label="Assistant">
        <Message.Avatar>
          <Avatar.Root tone="category-3">
            <Avatar.Fallback>A</Avatar.Fallback>
          </Avatar.Root>
        </Message.Avatar>
        <Message.Header>
          <strong>Assistant</strong>
          <time dateTime="2026-10-14T09:41">9:41</time>
        </Message.Header>
        <Message.Content>
          <Prose.Root>
            <p>
              Give it <code>aria-label</code>, or put a visually hidden label inside it. The icon itself stays hidden from
              screen readers.
            </p>
          </Prose.Root>
        </Message.Content>
      </Message.Root>
    </Stack.Root>
  );
}

export function MessageStreaming() {
  const [streaming, setStreaming] = useState(true);
  return (
    <Stack.Root style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Message.Root streaming={streaming} aria-label="Assistant">
        <Message.Content>
          <Prose.Root>
            <p>Three steps:</p>
            <ul>
              <li>Pick a variant</li>
              <li>Give it a name</li>
            </ul>
          </Prose.Root>
        </Message.Content>
      </Message.Root>
      <Button.Root variant="secondary" pressed={streaming} onPressedChange={setStreaming} style={{ alignSelf: 'start' }}>
        Streaming
      </Button.Root>
    </Stack.Root>
  );
}
