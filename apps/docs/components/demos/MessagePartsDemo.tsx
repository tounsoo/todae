'use client';

import { Attachment, Badge, Code, CodeBlock, DataList, Disclosure, Message, Prose, Text, type BadgeTone } from '@tounsoo/todae';
import { FileText } from 'lucide-react';

type Part =
  | { type: 'text'; id: string; text: string }
  | { type: 'reasoning'; id: string; text: string; thinking: boolean; seconds: number }
  | {
      type: 'tool-call';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: 'done';
      output: unknown;
    }
  | {
      type: 'tool-call';
      id: string;
      name: string;
      input: Record<string, unknown>;
      status: 'error';
      error: string;
    }
  | { type: 'attachment'; id: string; name: string; size: string };

const duration = new Intl.NumberFormat('en', { style: 'unit', unit: 'second', unitDisplay: 'long' });

const FINISHED: Record<'done' | 'error', { label: string; tone: BadgeTone }> = {
  done: { label: 'Done', tone: 'success' },
  error: { label: 'Failed', tone: 'critical' },
};

const PARTS: Part[] = [
  {
    type: 'reasoning',
    id: 'reason',
    thinking: false,
    seconds: 4,
    text: 'The focus ring color is a token. Search the docs for the page that sets it, and keep that page with the reply.',
  },
  {
    type: 'text',
    id: 'intro',
    text: "I'll find the page that sets the focus ring color and attach it here.",
  },
  {
    type: 'tool-call',
    id: 'search',
    name: 'search_docs',
    status: 'done',
    input: { query: 'focus ring color token' },
    output: { page: '/tokens', heading: 'Focus ring' },
  },
  {
    type: 'attachment',
    id: 'file',
    name: 'tokens.md',
    size: '18 KB',
  },
];

function PartView({ part }: { part: Part }) {
  switch (part.type) {
    case 'text':
      return (
        <Message.Content>
          <Prose.Root>
            <p>{part.text}</p>
          </Prose.Root>
        </Message.Content>
      );
    case 'reasoning':
      return (
        <Disclosure.Root open={part.thinking}>
          <Disclosure.Summary>{part.thinking ? 'Thinking' : `Thought for ${duration.format(part.seconds)}`}</Disclosure.Summary>
          <Text.Root size="s" tone="muted">
            {part.text}
          </Text.Root>
        </Disclosure.Root>
      );
    case 'tool-call': {
      const status = FINISHED[part.status];
      return (
        <Disclosure.Root>
          <Disclosure.Summary>
            <Code.Root>{part.name}</Code.Root> <Badge.Root tone={status.tone}>{status.label}</Badge.Root>
          </Disclosure.Summary>
          <DataList.Root orientation="vertical">
            <DataList.Item>
              <DataList.Term>Input</DataList.Term>
              <DataList.Details>
                <CodeBlock.Root tabIndex={0} role="region" aria-label={`${part.name} input`}>
                  {JSON.stringify(part.input, null, 2)}
                </CodeBlock.Root>
              </DataList.Details>
            </DataList.Item>
            {part.status === 'done' && (
              <DataList.Item>
                <DataList.Term>Output</DataList.Term>
                <DataList.Details>
                  <CodeBlock.Root tabIndex={0} role="region" aria-label={`${part.name} output`} style={{ maxBlockSize: '16rem' }}>
                    {JSON.stringify(part.output, null, 2)}
                  </CodeBlock.Root>
                </DataList.Details>
              </DataList.Item>
            )}
            {part.status === 'error' && (
              <DataList.Item>
                <DataList.Term>Error</DataList.Term>
                <DataList.Details>{part.error}</DataList.Details>
              </DataList.Item>
            )}
          </DataList.Root>
        </Disclosure.Root>
      );
    }
    case 'attachment':
      return (
        <Attachment.Root status="ready">
          <Attachment.Preview>
            <FileText aria-hidden />
          </Attachment.Preview>
          <Attachment.Name>{part.name}</Attachment.Name>
          <Attachment.Meta>{part.size}</Attachment.Meta>
        </Attachment.Root>
      );
    default: {
      const _exhaustive: never = part;
      void _exhaustive;
      return null;
    }
  }
}

export function MessagePartsExample() {
  return (
    <Message.Root aria-label="Assistant" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      {PARTS.map((part) => (
        <PartView key={part.id} part={part} />
      ))}
    </Message.Root>
  );
}
