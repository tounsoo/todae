'use client';

import { Button, Conversation, Message, Prose, Spinner, Stack } from '@omsoo.design/todae';
import { useEffect, useRef, useState } from 'react';

type Turn = { id: number; from: 'user' | 'assistant'; text: string; streaming?: boolean };

const REPLY =
  'A conversation keeps the newest message in view while it grows. Scroll up while this reply is still arriving, and it stops following, so you can read in peace. The button at the bottom brings you back to the end, and it follows again from there.';

const START: Turn[] = [
  { id: 1, from: 'user', text: 'What does Conversation do?' },
  { id: 2, from: 'assistant', text: 'It holds the messages of a chat and scrolls with them.' },
  { id: 3, from: 'user', text: 'What happens when a reply is long?' },
  { id: 4, from: 'assistant', text: 'Ask for one below and watch.' },
];

export function ConversationExample() {
  const [turns, setTurns] = useState<Turn[]>(START);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  const streaming = turns.some((turn) => turn.streaming);

  useEffect(() => () => clearInterval(timer.current), []);

  function ask() {
    const words = REPLY.split(' ');
    const id = turns.length + 1;
    let shown = 0;
    setTurns((all) => [
      ...all,
      { id, from: 'user', text: 'Show me a long reply.' },
      { id: id + 1, from: 'assistant', text: '', streaming: true },
    ]);
    timer.current = setInterval(() => {
      shown += 1;
      const done = shown >= words.length;
      setTurns((all) =>
        all.map((turn) => (turn.id === id + 1 ? { ...turn, text: words.slice(0, shown).join(' '), streaming: !done } : turn)),
      );
      if (done) clearInterval(timer.current);
    }, 120);
  }

  return (
    <Stack.Root style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Conversation.Root style={{ blockSize: '18rem' }}>
        <Conversation.Viewport>
          <Conversation.Content>
            {turns.map((turn) => (
              <Message.Root
                key={turn.id}
                from={turn.from}
                streaming={turn.streaming}
                aria-label={turn.from === 'user' ? 'You' : 'Assistant'}
              >
                <Message.Content>
                  {turn.from === 'user' ? (
                    turn.text
                  ) : (
                    <Prose.Root>
                      <p>{turn.text}</p>
                    </Prose.Root>
                  )}
                </Message.Content>
                {turn.streaming && (
                  <Message.Actions>
                    <Spinner.Root variant="dots" aria-label="Writing" />
                  </Message.Actions>
                )}
              </Message.Root>
            ))}
          </Conversation.Content>
        </Conversation.Viewport>
        <Conversation.ScrollButton />
      </Conversation.Root>
      <Button.Root variant="secondary" onClick={ask} disabled={streaming} style={{ alignSelf: 'start' }}>
        Ask for a long reply
      </Button.Root>
    </Stack.Root>
  );
}
