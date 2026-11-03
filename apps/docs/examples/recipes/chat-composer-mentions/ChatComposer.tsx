'use client';

import {
  Attachment,
  Avatar,
  Button,
  Field,
  Message,
  MentionText,
  OptionList,
  Popover,
  Stack,
  Text,
  VisuallyHidden,
  defineMentionSource,
  useMentions,
  usePopover,
  type MentionDraft,
  type MentionToken,
  type UseMentionsResult,
} from '@tounsoo/todae';
import { ArrowUp, FileText, Image } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent, type KeyboardEvent } from 'react';

type Person = { name: string; initials: string; role: string; place: string };

// Stands in for the product's directory. A real `resolve` fetches, and passes the signal on.
const DIRECTORY: Record<string, Person> = {
  mina: { name: 'Mina Park', initials: 'MP', role: 'Design systems', place: 'Seoul' },
  minjun: { name: 'Min-jun Choi', initials: 'MC', role: 'Engineering', place: 'Seoul' },
  mira: { name: 'Mira Seo', initials: 'MS', role: 'Design', place: 'Busan' },
};

// One source feeds the suggestions, the caret peek in the composer and the mention in a sent message.
const people = defineMentionSource<Person>({
  char: '@',
  label: 'People',
  options: Object.entries(DIRECTORY).map(([value, person]) => ({ value, label: person.name })),
  resolve: (id) => DIRECTORY[id],
  peekLabel: (person) => person.name,
  renderPeek: (person, peek) => (
    <Stack.Root gap="condensed">
      <Stack.Root direction="row" align="center">
        <Avatar.Root>
          <Avatar.Fallback>{person.initials}</Avatar.Fallback>
        </Avatar.Root>
        <div>
          <Text.Root weight="medium">{person.name}</Text.Root>
          <Text.Root tone="muted">
            {person.role} · {peek.mode === 'caret' ? 'Active now' : person.place}
          </Text.Root>
        </div>
      </Stack.Root>
      {peek.mode === 'interactive' ? (
        <Button.Root variant="secondary" onClick={peek.close}>
          Close
        </Button.Root>
      ) : null}
    </Stack.Root>
  ),
});

const SOURCES = [people];

/** The token the caret rests in. A boundary belongs to the token that ends there. */
function tokenAt(tokens: readonly MentionToken[], caret: number | null): MentionToken | null {
  return caret === null ? null : (tokens.find((token) => caret > token.start && caret <= token.end) ?? null);
}

/**
 * The peek while the caret rests in a mention. `useMentions` puts `caretPeekAnchorName` on that
 * token; this finds who it names, looks them up, and opens a peek that never takes focus.
 */
function useCaretPeek(mentions: UseMentionsResult) {
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [found, setFound] = useState<{ id: string; person: Person | undefined } | null>(null);
  const descriptionId = useId();

  const token = mentions.open ? null : tokenAt(mentions.value.tokens, caret);
  const key = token ? `${token.start}:${token.value}` : null;
  // A peek closed with Escape or an outside press stays closed until the caret moves to another mention.
  if (dismissed !== null && dismissed !== key) setDismissed(null);
  const id = token?.value ?? null;
  const person = found && found.id === id ? found.person : undefined;

  const { textareaRef } = mentions;
  useEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    const sync = () => setCaret(field.selectionStart === field.selectionEnd ? field.selectionStart : null);
    sync();
    const events = ['selectionchange', 'keyup', 'pointerup'] as const;
    for (const type of events) field.addEventListener(type, sync);
    return () => {
      for (const type of events) field.removeEventListener(type, sync);
    };
  }, [textareaRef]);

  useEffect(() => {
    if (id === null) return;
    const controller = new AbortController();
    // A promise around the call also catches a `resolve` that throws before it returns.
    new Promise<Person | undefined>((done) => done(people.resolve?.(id, controller.signal))).then(
      (person) => {
        if (!controller.signal.aborted) setFound({ id, person });
      },
      () => {
        if (!controller.signal.aborted) setFound({ id, person: undefined });
      },
    );
    return () => controller.abort();
  }, [id]);

  const open = focused && key !== null && person !== undefined && dismissed !== key;
  const popover = usePopover({
    open,
    anchorName: mentions.caretPeekAnchorName,
    onOpenChange: (next) => {
      if (!next) setDismissed(key);
    },
  });
  const wire = popover.getPopoverProps();

  return {
    textareaProps: {
      // The peek is inert, and browsers leave inert text out of a description, so the field
      // is described by a visually hidden copy of what the peek says.
      'aria-describedby': open ? descriptionId : undefined,
      onFocus: () => setFocused(true),
      onBlur: () => setFocused(false),
      onPointerDown: () => setDismissed(null),
    },
    peek: (
      <>
        <Popover.Root {...wire} inert>
          {token && person && people.renderPeek
            ? people.renderPeek(person, { id: token.value, mode: 'caret', close: () => setDismissed(key) })
            : null}
        </Popover.Root>
        {open && person ? (
          <VisuallyHidden.Root id={descriptionId}>
            {person.name}, {person.role}, active now
          </VisuallyHidden.Root>
        ) : null}
      </>
    ),
  };
}

const SHIP = 'Shipping the Acid fix. @Mina Park can you sanity check the dark track?';
const AT = SHIP.indexOf('@Mina Park');
const START: MentionDraft = {
  text: SHIP,
  tokens: [{ char: '@', value: 'mina', text: '@Mina Park', start: AT, end: AT + '@Mina Park'.length }],
};
const EMPTY: MentionDraft = { text: '', tokens: [] };

type Upload = { name: string; size: string; kind: 'image' | 'document' };
type Sent = MentionDraft & { id: number };

// Enter sends and Shift+Enter starts a new line. Enter that ends an IME composition only commits it.
function sendOnEnter(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return;
  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
  if (!(event.target instanceof HTMLTextAreaElement)) return;
  event.preventDefault();
  event.currentTarget.requestSubmit();
}

export default function ChatComposer() {
  const [draft, setDraft] = useState(START);
  const [files, setFiles] = useState<Upload[]>([
    { name: 'peek-card.png', size: '248 KB', kind: 'image' },
    { name: 'm8-contrast.pdf', size: '1.2 MB', kind: 'document' },
  ]);
  const [sent, setSent] = useState<Sent[]>([]);
  const mentions = useMentions({ triggers: SOURCES, value: draft, onValueChange: setDraft });
  const caretPeek = useCaretPeek(mentions);

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mentions.value.text.trim() === '') return;
    setSent((all) => [...all, { id: all.length, ...mentions.value }]);
    setDraft(EMPTY);
    setFiles([]);
    // Sending from the Send button disables it, so keep focus in the field.
    mentions.textareaRef.current?.focus();
  };

  const remove = (file: Upload) => {
    // The list goes with its last file, so focus moves to the field.
    if (files.length === 1) mentions.textareaRef.current?.focus();
    setFiles((all) => all.filter((other) => other !== file));
  };

  return (
    <Stack.Root gap="normal" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      {sent.map((message) => (
        <Message.Root key={message.id} from="user" aria-label="You">
          <Message.Content>
            <MentionText value={message} sources={SOURCES} />
          </Message.Content>
        </Message.Root>
      ))}
      <form onSubmit={send} onKeyDown={sendOnEnter}>
        <Field.Root aria-label="Message">
          {files.length > 0 ? (
            <Field.Row>
              <Stack.Root as="ul" direction="row" gap="condensed" wrap aria-label="Attached files">
                {files.map((file) => (
                  <li key={file.name}>
                    <Attachment.Root>
                      <Attachment.Preview>{file.kind === 'image' ? <Image aria-hidden /> : <FileText aria-hidden />}</Attachment.Preview>
                      <Attachment.Name>{file.name}</Attachment.Name>
                      <Attachment.Meta>{file.size}</Attachment.Meta>
                      <Attachment.Remove onClick={() => remove(file)} />
                    </Attachment.Root>
                  </li>
                ))}
              </Stack.Root>
            </Field.Row>
          ) : null}
          <Field.Textarea
            {...mentions.getTextareaProps({ ...caretPeek.textareaProps, spellCheck: false })}
            autoGrow
            maxRows={6}
            placeholder="Message, or type @ to mention"
          />
          <Field.Row>
            <Field.Affix style={{ marginInlineStart: 'auto' }}>Enter to send</Field.Affix>
            <Button.Root type="submit" variant="primary" aria-label="Send" disabled={draft.text.trim() === ''}>
              <Button.Icon>
                <ArrowUp />
              </Button.Icon>
            </Button.Root>
          </Field.Row>
        </Field.Root>
      </form>
      <Popover.Root {...mentions.getPopoverProps()}>
        {/* Hidden, not unmounted, when nothing matches, so the field's aria-controls still points at it. */}
        <OptionList.Root {...mentions.getListboxProps()} hidden={mentions.isEmpty}>
          {mentions.items.map((item) => (
            <OptionList.Option key={item.id} {...mentions.getOptionProps(item)} />
          ))}
        </OptionList.Root>
        <Text.Root as="span" role="status" tone="muted">
          {mentions.isEmpty ? 'No one matches' : ''}
        </Text.Root>
      </Popover.Root>
      {caretPeek.peek}
    </Stack.Root>
  );
}
