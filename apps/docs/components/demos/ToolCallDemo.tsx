'use client';

import {
  Badge,
  Button,
  Code,
  CodeBlock,
  DataList,
  Disclosure,
  Message,
  Prose,
  Stack,
  type BadgeTone,
} from '@tounsoo/todae';
import { useEffect, useId, useRef, useState } from 'react';

type ToolCallStatus = 'pending' | 'running' | 'done' | 'error' | 'denied';

type ToolCallData = {
  id: string;
  name: string;
  status: ToolCallStatus;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
};

const STATUS: Record<ToolCallStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Needs approval', tone: 'warning' },
  running: { label: 'Running', tone: 'info' },
  done: { label: 'Done', tone: 'success' },
  error: { label: 'Failed', tone: 'critical' },
  denied: { label: 'Denied', tone: 'neutral' },
};

const CALLS: ToolCallData[] = [
  {
    id: 'call_1',
    name: 'search_docs',
    status: 'done',
    input: { query: 'focus ring color token' },
    output: [
      { page: '/tokens', heading: 'Focus ring' },
      { page: '/guides/build-on-todae', heading: 'Change the focus ring' },
    ],
  },
  {
    id: 'call_2',
    name: 'fetch_page',
    status: 'error',
    input: { url: 'https://example.com/old-tokens' },
    error: 'The page returned 404 Not Found.',
  },
  {
    id: 'call_3',
    name: 'create_branch',
    status: 'pending',
    input: { name: 'focus-ring-brand', from: 'main' },
  },
];

const RESULT = { branch: 'focus-ring-brand', commit: '4f2a9c1' };

const json = (value: unknown) => JSON.stringify(value, null, 2);

function ToolCall({ call, onDecide }: { call: ToolCallData; onDecide: (approved: boolean) => void }) {
  const nameId = useId();
  const summary = useRef<HTMLElement>(null);
  const status = STATUS[call.status];

  // The buttons unmount once the call is decided, so focus moves to the summary first.
  const decide = (approved: boolean) => {
    summary.current?.focus();
    onDecide(approved);
  };

  return (
    <Stack.Root gap="condensed">
      {/* Open while it waits for approval, so the input can be read before running it. */}
      <Disclosure.Root open={call.status === 'pending'}>
        <Disclosure.Summary ref={summary}>
          <Code.Root id={nameId}>{call.name}</Code.Root> <Badge.Root tone={status.tone}>{status.label}</Badge.Root>
        </Disclosure.Summary>
        <DataList.Root orientation="vertical">
          <DataList.Item>
            <DataList.Term>Input</DataList.Term>
            <DataList.Details>
              <CodeBlock.Root tabIndex={0} role="region" aria-label={`${call.name} input`}>
                {json(call.input)}
              </CodeBlock.Root>
            </DataList.Details>
          </DataList.Item>
          {call.status === 'done' && call.output !== undefined && (
            <DataList.Item>
              <DataList.Term>Output</DataList.Term>
              <DataList.Details>
                <CodeBlock.Root
                  tabIndex={0}
                  role="region"
                  aria-label={`${call.name} output`}
                  style={{ maxBlockSize: '16rem' }}
                >
                  {json(call.output)}
                </CodeBlock.Root>
              </DataList.Details>
            </DataList.Item>
          )}
          {call.status === 'error' && (
            <DataList.Item>
              <DataList.Term>Error</DataList.Term>
              <DataList.Details>{call.error}</DataList.Details>
            </DataList.Item>
          )}
        </DataList.Root>
      </Disclosure.Root>
      {call.status === 'pending' && (
        <Stack.Root direction="row" gap="condensed" role="group" aria-labelledby={nameId}>
          <Button.Root onClick={() => decide(true)}>Approve</Button.Root>
          <Button.Root variant="secondary" onClick={() => decide(false)}>
            Deny
          </Button.Root>
        </Stack.Root>
      )}
    </Stack.Root>
  );
}

export function ToolCallExample() {
  const [calls, setCalls] = useState(CALLS);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const update = (id: string, change: Partial<ToolCallData>) =>
    setCalls((current) => current.map((call) => (call.id === id ? { ...call, ...change } : call)));

  // Stands in for the product's agent: an approved call runs, then reports its output.
  const decide = (id: string, approved: boolean) => {
    if (!approved) {
      update(id, { status: 'denied' });
      return;
    }
    update(id, { status: 'running' });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => update(id, { status: 'done', output: RESULT }), 1500);
  };

  const last = calls[calls.length - 1]!;
  // Stands in for the stream's own flag: the agent writes while the approved call runs,
  // and its turn is paused while a call waits.
  const streaming = calls.some((call) => call.status === 'running');

  return (
    <Message.Root streaming={streaming} aria-label="Assistant" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Message.Content>
        <Prose.Root>
          <p>I'll find where the focus ring color is set, then make a branch for the change.</p>
        </Prose.Root>
      </Message.Content>
      {calls.map((call) => (
        <ToolCall key={call.id} call={call} onDecide={(approved) => decide(call.id, approved)} />
      ))}
      {(last.status === 'done' || last.status === 'denied') && (
        <Message.Content>
          <Prose.Root>
            <p>
              {last.status === 'done'
                ? 'Made the branch focus-ring-brand. Set focus.ring.color in your token package there.'
                : "I didn't make the branch. Set focus.ring.color in your token package when you're ready."}
            </p>
          </Prose.Root>
        </Message.Content>
      )}
    </Message.Root>
  );
}
