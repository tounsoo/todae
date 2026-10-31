'use client';

import {
  Button,
  Field,
  Message,
  OptionList,
  Popover,
  Stack,
  useMentions,
  type MentionDraft,
  type MentionTrigger,
} from '@tounsoo/todae';
import { useState, type FormEvent } from 'react';

const people = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'alan', label: 'Alan Turing' },
  { value: 'grace', label: 'Grace Hopper' },
  { value: 'katherine', label: 'Katherine Johnson' },
];

const commands = [
  { value: 'summarize', label: 'summarize' },
  { value: 'translate', label: 'translate' },
  { value: 'explain', label: 'explain' },
];

const triggers: MentionTrigger[] = [
  { char: '@', options: people, label: 'People' },
  { char: '/', options: commands, label: 'Commands' },
];

type Sent = MentionDraft & { id: number };
const EMPTY: MentionDraft = { text: '', tokens: [] };

export function MentionsExample() {
  const [draft, setDraft] = useState(EMPTY);
  const [sent, setSent] = useState<Sent[]>([]);
  const mentions = useMentions({ triggers, value: draft, onValueChange: setDraft });

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent((all) => [...all, { id: all.length, ...mentions.value }]);
    setDraft(EMPTY);
  };

  return (
    <Stack.Root gap="normal" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      {sent.map((message) => (
        <Message.Root key={message.id} from="user" aria-label="You">
          <Message.Content>
            {message.text}
            {message.tokens.length > 0 ? ` (${message.tokens.map((token) => token.value).join(', ')})` : null}
          </Message.Content>
        </Message.Root>
      ))}
      <form
        onSubmit={send}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return;
          if (!(event.target instanceof HTMLTextAreaElement)) return;
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }}
      >
        <Field.Root aria-label="Message">
          <Field.Textarea {...mentions.getTextareaProps()} autoGrow maxRows={6} placeholder="Type @ or /" />
          <Field.Row>
            <Button.Root type="submit" variant="primary" disabled={draft.text.trim() === ''} aria-label="Send">
              Send
            </Button.Root>
          </Field.Row>
        </Field.Root>
      </form>
      <Popover.Root {...mentions.getPopoverProps()}>
        <OptionList.Root {...mentions.getListboxProps()}>
          {mentions.items.map((item) => (
            <OptionList.Option key={item.id} {...mentions.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </Stack.Root>
  );
}
