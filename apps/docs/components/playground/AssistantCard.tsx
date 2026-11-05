'use client';

import {
  Attachment,
  Avatar,
  Button,
  Card,
  categoryTone,
  defineMentionSource,
  Field,
  Message,
  MentionText,
  OptionList,
  Popover,
  Prose,
  Stack,
  Text,
  ToggleGroup,
  Toolbar,
  useClipboard,
  useMentions,
  type MentionDraft,
} from '@tounsoo/todae';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import type { IconLibrary } from '../iconLibraries';
import type { Kit } from './kit';
import type { Person, PreviewCopy } from './previewCopy';

const SENT = '2026-10-14T09:41:00+09:00[Asia/Seoul]';

function CopyButton({ label, icon, copiedIcon, text }: { label: string; icon: ReactNode; copiedIcon: ReactNode; text: string }) {
  const clipboard = useClipboard();
  const copied = clipboard.status === 'copied' && clipboard.text === text;
  return (
    <Button.Root variant="ghost" aria-label={label} onClick={() => clipboard.copy(text)}>
      <Button.Icon>{copied ? copiedIcon : icon}</Button.Icon>
    </Button.Root>
  );
}

/** A message already sent that names Mina, as a composer would have left it. */
function mentionOfMina(copy: PreviewCopy): MentionDraft {
  const text = `@${copy.directory.mina.name}`;
  return { text: `${text}${copy.mentionTail}`, tokens: [{ char: '@', value: 'mina', text, start: 0, end: text.length }] };
}

/**
 * A chat with the billing assistant: a question, a reply with its actions, and
 * a composer where @ suggests people. A sent message shows its mentions.
 */
export function AssistantCard({ kit, actionLibrary, className }: { kit: Kit; actionLibrary: IconLibrary; className?: string }) {
  const { copy, locale } = kit;
  const actionIcons = actionLibrary.icons;
  const sent = Temporal.ZonedDateTime.from(SENT);
  const [reply, setReply] = useState<0 | 1>(0);
  const [rating, setRating] = useState<string | null>(null);
  const [asked, setAsked] = useState<MentionDraft[]>(() => [mentionOfMina(copy)]);
  const [draft, setDraft] = useState<MentionDraft>({ text: '', tokens: [] });
  const people = useMemo(
    () =>
      defineMentionSource<Person>({
        char: '@',
        label: copy.people,
        options: Object.entries(copy.directory).map(([value, person]) => ({ value, label: person.name })),
        resolve: (id) => copy.directory[id as keyof PreviewCopy['directory']],
        peekLabel: (person) => person.name,
        renderPeek: (person) => (
          <Stack.Root gap="condensed">
            <Text.Root weight="bold">{person.name}</Text.Root>
            <Text.Root tone="muted">{person.role}</Text.Root>
          </Stack.Root>
        ),
      }),
    [copy],
  );
  const sources = useMemo(() => [people], [people]);
  const mentions = useMentions({ triggers: sources, value: draft, onValueChange: setDraft });

  const ask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mentions.value.text.trim() === '') return;
    setAsked((all) => [...all, mentions.value]);
    setDraft({ text: '', tokens: [] });
    // Sending disables the Send button, so focus stays in the field.
    mentions.textareaRef.current?.focus();
  };

  return (
    <Card.Root className={className}>
      <Card.Header>
        <Text.Root as="h3">{copy.assistant}</Text.Root>
      </Card.Header>
      <Card.Body>
        <div className="preview-stack">
          <Message.Root from="user" aria-label={copy.you}>
            <Message.Content>{copy.question}</Message.Content>
            <Message.Actions reveal="hover">
              <Message.Time value={sent} locale={locale} />
              <Toolbar.Root aria-label={copy.yourMessageActions}>
                <CopyButton label={copy.copy} icon={actionIcons.copy} copiedIcon={actionLibrary.glyphs.check} text={copy.question} />
              </Toolbar.Root>
            </Message.Actions>
          </Message.Root>
          <Message.Root aria-label={copy.assistant}>
            <Message.Avatar>
              <Avatar.Root tone={categoryTone('assistant')}>
                <Avatar.Fallback>A</Avatar.Fallback>
              </Avatar.Root>
            </Message.Avatar>
            <Message.Header>
              <strong>{copy.assistant}</strong>
              <Message.Time value={sent.add({ seconds: 4 })} locale={locale} />
            </Message.Header>
            <Message.Content>
              <Prose.Root>
                <p>{copy.answers[reply].content}</p>
              </Prose.Root>
            </Message.Content>
            <Message.Actions>
              <Toolbar.Root aria-label={copy.replyActions}>
                <CopyButton label={copy.copy} icon={actionIcons.copy} copiedIcon={actionLibrary.glyphs.check} text={copy.answers[reply].source} />
                <Button.Root
                  variant="ghost"
                  aria-label={copy.regenerate}
                  onClick={() => {
                    setReply((index) => (index === 0 ? 1 : 0));
                    setRating(null);
                  }}
                >
                  <Button.Icon>{actionIcons.regenerate}</Button.Icon>
                </Button.Root>
                <ToggleGroup.Root aria-label={copy.rateReply} value={rating} onValueChange={setRating}>
                  <ToggleGroup.Item value="good" variant="ghost" aria-label={copy.goodReply}>
                    <Button.Icon>{actionIcons.thumbsUp}</Button.Icon>
                  </ToggleGroup.Item>
                  <ToggleGroup.Item value="bad" variant="ghost" aria-label={copy.badReply}>
                    <Button.Icon>{actionIcons.thumbsDown}</Button.Icon>
                  </ToggleGroup.Item>
                </ToggleGroup.Root>
              </Toolbar.Root>
            </Message.Actions>
          </Message.Root>
          <Attachment.Root>
            <Attachment.Name>invoices-q3.csv</Attachment.Name>
            <Attachment.Meta>48 KB</Attachment.Meta>
          </Attachment.Root>
          {asked.map((message, index) => (
            <Message.Root key={index} from="user" aria-label={copy.you}>
              <Message.Content>
                <MentionText value={message} sources={sources} />
              </Message.Content>
            </Message.Root>
          ))}
          <form onSubmit={ask}>
            <Field.Root aria-label={copy.messageLabel}>
              <Field.Textarea
                {...mentions.getTextareaProps({ spellCheck: false })}
                placeholder={copy.askPlaceholder}
                autoGrow
                maxRows={4}
              />
              <Field.Row>
                <Button.Root type="submit" variant="primary" disabled={draft.text.trim() === ''}>
                  {copy.send}
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
              {mentions.isEmpty ? copy.noOneMatches : ''}
            </Text.Root>
          </Popover.Root>
        </div>
      </Card.Body>
    </Card.Root>
  );
}
