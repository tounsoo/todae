'use client';

import { Button, Disclosure, Loader, Message, Prose, Stack, Text } from '@tounsoo/todae';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const QUESTION = 'Should a chat show the model’s reasoning?';

const REASONING =
  'They are asking whether to show it at all. Showing it explains a slow reply, but it is long and most people only want the answer. So keep it, closed by default, and open it only while it is arriving.';

const ANSWER =
  'Show it, but keep it out of the way. Open the block while the model thinks, so the wait has something to watch, then close it when the answer starts. Anyone who wants to check the reasoning can open it again.';

const duration = new Intl.NumberFormat('en', { style: 'unit', unit: 'second', unitDisplay: 'long' });

type Phase = 'thinking' | 'answering' | 'done';

function Reasoning({ thinking, seconds, children }: { thinking: boolean; seconds: number; children: ReactNode }) {
  return (
    <Disclosure.Root open={thinking}>
      <Disclosure.Summary>
        {thinking ? 'Thinking' : `Thought for ${duration.format(seconds)}`}
        {thinking && (
          <>
            {' '}
            <Loader.Root variant="dots" aria-hidden="true" />
          </>
        )}
      </Disclosure.Summary>
      {children}
    </Disclosure.Root>
  );
}

export function ReasoningExample() {
  const [phase, setPhase] = useState<Phase>('done');
  const [reasoning, setReasoning] = useState(REASONING);
  const [answer, setAnswer] = useState(ANSWER);
  const [seconds, setSeconds] = useState(6);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  // Stands in for the product's stream: reasoning words first, then the answer's.
  // Button.Root ignores clicks while it is aria-disabled, so this never runs mid-reply.
  function ask() {
    const thoughts = REASONING.split(' ');
    const words = ANSWER.split(' ');
    const started = Date.now();
    let shown = 0;
    setReasoning('');
    setAnswer('');
    setPhase('thinking');
    timer.current = setInterval(() => {
      shown += 1;
      if (shown <= thoughts.length) {
        setReasoning(thoughts.slice(0, shown).join(' '));
        if (shown === thoughts.length) {
          setSeconds(Math.max(1, Math.round((Date.now() - started) / 1000)));
          setPhase('answering');
        }
        return;
      }
      const count = shown - thoughts.length;
      setAnswer(words.slice(0, count).join(' '));
      if (count >= words.length) {
        clearInterval(timer.current);
        setPhase('done');
      }
    }, 120);
  }

  return (
    <Stack.Root style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Message.Root from="user" aria-label="You">
        <Message.Content>{QUESTION}</Message.Content>
      </Message.Root>
      <Message.Root streaming={phase !== 'done'} aria-label="Assistant">
        <Reasoning thinking={phase === 'thinking'} seconds={seconds}>
          <Text.Root size="s" tone="muted">
            {reasoning}
          </Text.Root>
        </Reasoning>
        {answer && (
          <Message.Content>
            <Prose.Root>
              <p>{answer}</p>
            </Prose.Root>
          </Message.Content>
        )}
        {phase === 'answering' && (
          <Message.Actions>
            <Loader.Root variant="dots" aria-label="Writing" />
          </Message.Actions>
        )}
      </Message.Root>
      <Button.Root
        variant="secondary"
        onClick={ask}
        aria-disabled={phase !== 'done' || undefined}
        style={{ alignSelf: 'start' }}
      >
        Ask again
      </Button.Root>
    </Stack.Root>
  );
}
