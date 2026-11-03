'use client';

import { Avatar, Message, Prose, Stack } from '@tounsoo/todae';

export default function MessageTurns({ locale }: { locale: string }) {
  return (
    <Stack.Root style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Message.Root from="system" aria-label="System">
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
          <Message.Time value={Temporal.ZonedDateTime.from('2026-10-14T09:41:00+09:00[Asia/Seoul]')} locale={locale} />
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
