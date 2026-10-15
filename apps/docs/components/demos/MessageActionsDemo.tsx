'use client';

import {
  Button,
  Field,
  Loader,
  Message,
  Prose,
  Stack,
  ToggleGroup,
  Toolbar,
  useClipboard,
} from '@omsoo.design/todae';
import { Check, Copy, Pencil, RotateCcw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocale } from '../../lib/i18n/useLocale';

const SENT = '2026-10-14T09:41:00+09:00[Asia/Seoul]';

const REPLIES = [
  'Give it aria-label, or put a visually hidden label inside it. The icon itself stays hidden from screen readers.',
  'Name it with aria-label. Todae shows that name as a tooltip on an icon-only Button.Root.',
] as const;

function CopyButton({ text }: { text: string }) {
  const clipboard = useClipboard();
  const copied = clipboard.status === 'copied' && clipboard.text === text;
  return (
    <Button.Root variant="ghost" aria-label="Copy" onClick={() => clipboard.copy(text)}>
      <Button.Icon>
        {copied ? <Check /> : <Copy />}
      </Button.Icon>
    </Button.Root>
  );
}

export function MessageActionsExample() {
  const locale = useLocale();
  const sent = Temporal.ZonedDateTime.from(SENT);
  const [question, setQuestion] = useState('How do I name an icon-only button?');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question);
  const [reply, setReply] = useState<0 | 1>(0);
  const [streaming, setStreaming] = useState(false);
  const [rating, setRating] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Stands in for the product's request for a new reply.
  const regenerate = () => {
    setRating(null);
    setStreaming(true);
    timer.current = setTimeout(() => {
      setReply((index) => (index === 0 ? 1 : 0));
      setStreaming(false);
    }, 1500);
  };

  const closeEditor = () => {
    setEditing(false);
    // The edit button unmounted with the actions row; put focus back on it.
    requestAnimationFrame(() => editButton.current?.focus());
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setQuestion(draft);
    closeEditor();
    regenerate();
  };

  return (
    <Stack.Root gap="normal" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      <Message.Root from="user" aria-label="You">
        {editing ? (
          <form onSubmit={save} style={{ inlineSize: '100%' }}>
            <Stack.Root gap="condensed">
              <Field.Root aria-label="Edit message">
                <Field.Textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') closeEditor();
                  }}
                  autoFocus
                  autoGrow
                  maxRows={6}
                />
              </Field.Root>
              <Stack.Root direction="row" gap="condensed" style={{ justifyContent: 'end' }}>
                <Button.Root type="button" variant="secondary" onClick={closeEditor}>
                  Cancel
                </Button.Root>
                <Button.Root type="submit" disabled={!draft.trim()}>
                  Send
                </Button.Root>
              </Stack.Root>
            </Stack.Root>
          </form>
        ) : (
          <>
            <Message.Content>{question}</Message.Content>
            <Message.Actions reveal="hover">
              <Message.Time value={sent} locale={locale} />
              <Toolbar.Root aria-label="Your message">
                <CopyButton text={question} />
                <Button.Root
                  ref={editButton}
                  variant="ghost"
                  aria-label="Edit"
                  disabled={streaming}
                  onClick={() => {
                    setDraft(question);
                    setEditing(true);
                  }}
                >
                  <Button.Icon>
                    <Pencil />
                  </Button.Icon>
                </Button.Root>
              </Toolbar.Root>
            </Message.Actions>
          </>
        )}
      </Message.Root>
      <Message.Root streaming={streaming} aria-label="Assistant">
        <Message.Header>
          <strong>Assistant</strong>
          <Message.Time value={sent.add({ seconds: 4 })} locale={locale} />
        </Message.Header>
        <Message.Content>
          <Prose.Root>
            <p>{streaming ? '' : REPLIES[reply]}</p>
          </Prose.Root>
        </Message.Content>
        <Message.Actions>
          {streaming ? (
            <Loader.Root variant="dots" aria-label="Writing" />
          ) : (
            <Toolbar.Root aria-label="Reply">
              <CopyButton text={REPLIES[reply]} />
              <Button.Root variant="ghost" aria-label="Regenerate" onClick={regenerate}>
                <Button.Icon>
                  <RotateCcw />
                </Button.Icon>
              </Button.Root>
              <ToggleGroup.Root aria-label="Rate this reply" value={rating} onValueChange={setRating}>
                <ToggleGroup.Item value="good" variant="ghost" aria-label="Good reply">
                  <Button.Icon>
                    <ThumbsUp />
                  </Button.Icon>
                </ToggleGroup.Item>
                <ToggleGroup.Item value="bad" variant="ghost" aria-label="Bad reply">
                  <Button.Icon>
                    <ThumbsDown />
                  </Button.Icon>
                </ToggleGroup.Item>
              </ToggleGroup.Root>
            </Toolbar.Root>
          )}
        </Message.Actions>
      </Message.Root>
    </Stack.Root>
  );
}
