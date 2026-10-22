'use client';

import {
  Button,
  Composer,
  Field,
  Loader,
  Message,
  Prose,
  Stack,
  Text,
  Toolbar,
  useAnnouncer,
} from '@tounsoo/todae';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

// Each turn links to the message it answers or follows. A message's replies
// are the turns whose parent it is, so regenerating adds a sibling, and
// `shown` maps each message to the id of the reply the conversation follows.
type Turn = { id: number; from: 'user' | 'assistant'; text: string; parent: number | null };
type Conversation = { turns: Record<number, Turn>; shown: Record<number, number> };

// The one reply in flight, and the reply its question showed before it, if any.
type Pending = { reply: number; before: number | undefined };

type Answer = { versions: readonly string[]; suggestions: readonly string[] };

const FIRST = 'How do I name an icon-only button?';

const ANSWERS: Record<string, Answer> = {
  [FIRST]: {
    versions: [
      'Give it aria-label. Todae shows that name as a tooltip on an icon-only Button.Root.',
      'Put the name in aria-label, or in a visually hidden label inside it. The icon itself stays hidden from screen readers.',
      'Name it with aria-label. The tooltip that shows the name comes with Button.Root, so there is nothing else to wire.',
    ],
    suggestions: ['Does the tooltip show on focus?', 'Can I use a visually hidden label?', 'What about a toggle button?'],
  },
  'Does the tooltip show on focus?': {
    versions: [
      'Yes. It shows on keyboard focus as well as on hover, and Escape hides it.',
      'It does: focus from the keyboard shows it, and Escape closes it without moving focus.',
    ],
    suggestions: ['Can I use a visually hidden label?', 'What about a toggle button?'],
  },
  'Can I use a visually hidden label?': {
    versions: [
      'Yes. Put VisuallyHidden.Root inside the button with the name. It is read out, but no tooltip shows.',
      'You can. A VisuallyHidden.Root inside the button names it, and then the button shows no tooltip.',
    ],
    suggestions: ['Does the tooltip show on focus?', 'What about a toggle button?'],
  },
  'What about a toggle button?': {
    versions: [
      'Give it a name that stays the same and set aria-pressed, as a ToggleGroup item does, so the state is read out with it.',
      'Keep the name fixed, such as "Bold", and let aria-pressed carry whether it is on.',
    ],
    suggestions: ['Does the tooltip show on focus?', 'Can I use a visually hidden label?'],
  },
};

const UNKNOWN: Answer = {
  versions: ['This example only answers its suggestions. In your product, your backend writes the reply.'],
  suggestions: ANSWERS[FIRST]!.suggestions,
};

const answerTo = (question: string): Answer => ANSWERS[question] ?? UNKNOWN;

function start(): Conversation {
  return {
    turns: {
      1: { id: 1, from: 'user', text: FIRST, parent: null },
      2: { id: 2, from: 'assistant', text: ANSWERS[FIRST]!.versions[0]!, parent: 1 },
      3: { id: 3, from: 'assistant', text: ANSWERS[FIRST]!.versions[1]!, parent: 1 },
    },
    shown: { 1: 3 },
  };
}

// The replies to a message, oldest first. Ids only grow, so their order is the order of arrival.
const repliesTo = ({ turns }: Conversation, id: number) =>
  Object.values(turns)
    .filter((turn) => turn.parent === id)
    .sort((a, b) => a.id - b.id);

// The turns the conversation follows now, from the first message.
function pathOf(conversation: Conversation): Turn[] {
  const path: Turn[] = [];
  let turn: Turn | undefined = conversation.turns[1];
  while (turn) {
    path.push(turn);
    const next = conversation.shown[turn.id];
    turn = next === undefined ? undefined : conversation.turns[next];
  }
  return path;
}

// Takes a turn out, and points its parent back at `before`.
function without(conversation: Conversation, id: number, before: number | undefined): Conversation {
  const { [id]: _, ...turns } = conversation.turns;
  const parent = conversation.turns[id]!.parent!;
  const { [parent]: __, ...shown } = conversation.shown;
  return { turns, shown: before === undefined ? shown : { ...shown, [parent]: before } };
}

function VersionSwitcher({
  index,
  count,
  locked,
  onShow,
}: {
  index: number;
  count: number;
  locked: boolean;
  onShow: (index: number) => void;
}) {
  const announce = useAnnouncer();
  const position = useId();

  const show = (to: number) => {
    if (locked || to < 0 || to >= count) return;
    onShow(to);
    announce(`Reply ${to + 1} of ${count}`);
  };

  // aria-disabled, not disabled, so a button keeps focus when it reaches an end.
  return (
    <>
      <Button.Root
        variant="ghost"
        aria-label="Previous reply"
        aria-describedby={position}
        aria-disabled={locked || index === 0 || undefined}
        onClick={() => show(index - 1)}
      >
        <Button.Icon>
          <ChevronLeft />
        </Button.Icon>
      </Button.Root>
      <Text.Root as="span" id={position} size="s" tone="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {index + 1} of {count}
      </Text.Root>
      <Button.Root
        variant="ghost"
        aria-label="Next reply"
        aria-describedby={position}
        aria-disabled={locked || index === count - 1 || undefined}
        onClick={() => show(index + 1)}
      >
        <Button.Icon>
          <ChevronRight />
        </Button.Icon>
      </Button.Root>
      <Toolbar.Separator />
    </>
  );
}

export function SuggestionsExample() {
  const [conversation, setConversation] = useState(start);
  const [pending, setPending] = useState<Pending | null>(null);
  const [value, setValue] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const field = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(4);
  const { turns } = conversation;
  const path = pathOf(conversation);
  const last = path.at(-1)!;
  const busy = pending !== null;
  const suggestions = last.from === 'assistant' && !busy && value === '' ? answerTo(turns[last.parent!]!.text).suggestions : [];

  useEffect(() => () => clearTimeout(timer.current), []);

  // Adds a reply to `question` that streams for a moment, then shows its
  // text. Stands in for the product's request.
  const ask = (base: Conversation, question: Turn) => {
    const id = nextId.current++;
    const versions = answerTo(question.text).versions;
    const text = versions[repliesTo(base, question.id).length % versions.length]!;
    setConversation({
      turns: { ...base.turns, [id]: { id, from: 'assistant', text: '', parent: question.id } },
      shown: { ...base.shown, [question.id]: id },
    });
    setPending({ reply: id, before: base.shown[question.id] });
    timer.current = setTimeout(() => {
      setConversation((now) => ({ ...now, turns: { ...now.turns, [id]: { ...now.turns[id]!, text } } }));
      setPending(null);
    }, 1200);
  };

  // While a reply runs, only that reply can be asked for again, and asking
  // again cancels the one in flight.
  const regenerate = (answer: Turn) => {
    if (pending && pending.reply !== answer.id) return;
    clearTimeout(timer.current);
    const base = pending ? without(conversation, pending.reply, pending.before) : conversation;
    ask(base, turns[answer.parent!]!);
  };

  const show = (answer: Turn, reply: number) =>
    setConversation((now) => ({ ...now, shown: { ...now.shown, [answer.parent!]: reply } }));

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = nextId.current++;
    const question: Turn = { id, from: 'user', text: value.trim(), parent: last.id };
    setValue('');
    ask({ turns: { ...turns, [id]: question }, shown: { ...conversation.shown, [last.id]: id } }, question);
  };

  const stop = () => {
    if (!pending) return;
    clearTimeout(timer.current);
    setPending(null);
    const stopped = without(conversation, pending.reply, pending.before);
    const question = turns[turns[pending.reply]!.parent!]!;
    // A question stopped before any reply goes back to the field to be sent
    // again, unless the person has started another draft there.
    if (repliesTo(stopped, question.id).length === 0 && value.trim() === '') {
      setConversation(without(stopped, question.id, undefined));
      setValue(question.text);
      field.current?.focus();
      return;
    }
    setConversation(stopped);
  };

  // A suggestion fills the field, so the person can change it before sending.
  const pick = (text: string) => {
    setValue(text);
    field.current?.focus();
  };

  return (
    <Stack.Root gap="normal" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      {path.map((turn) =>
        turn.from === 'user' ? (
          <Message.Root key={turn.id} from="user" aria-label="You">
            <Message.Content>{turn.text}</Message.Content>
          </Message.Root>
        ) : (
          // Keyed by the question, so switching or regenerating keeps the message and the focused button.
          <Message.Root key={`reply-${turn.parent}`} streaming={pending?.reply === turn.id} aria-label="Assistant">
            <Message.Content>
              <Prose.Root>
                <p>{turn.text}</p>
              </Prose.Root>
            </Message.Content>
            <Message.Actions>
              <Toolbar.Root aria-label="Reply">
                {repliesTo(conversation, turn.parent!).length > 1 && (
                  <VersionSwitcher
                    index={repliesTo(conversation, turn.parent!).indexOf(turn)}
                    count={repliesTo(conversation, turn.parent!).length}
                    // While a reply streams it is the one shown, so its later turns stay in view.
                    locked={busy}
                    onShow={(index) => show(turn, repliesTo(conversation, turn.parent!)[index]!.id)}
                  />
                )}
                <Button.Root
                  variant="ghost"
                  aria-label="Regenerate"
                  aria-disabled={(pending && pending.reply !== turn.id) || undefined}
                  onClick={() => regenerate(turn)}
                >
                  <Button.Icon>
                    <RotateCcw />
                  </Button.Icon>
                </Button.Root>
              </Toolbar.Root>
              {pending?.reply === turn.id && <Loader.Root variant="dots" aria-label="Writing" />}
            </Message.Actions>
          </Message.Root>
        ),
      )}
      {suggestions.length > 0 && (
        <Stack.Root as="ul" direction="row" gap="condensed" wrap aria-label="Suggestions">
          {suggestions.map((text) => (
            <li key={text} style={{ maxInlineSize: '100%' }}>
              <Button.Root variant="secondary" onClick={() => pick(text)}>
                {text}
              </Button.Root>
            </li>
          ))}
        </Stack.Root>
      )}
      <Composer.Root busy={busy} onSubmit={send}>
        <Field.Root aria-label="Message">
          <Field.Textarea
            ref={field}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Ask a follow-up"
            autoGrow
            maxRows={6}
          />
          <Field.Row>
            <Composer.Submit disabled={value.trim() === ''} onStop={stop} />
          </Field.Row>
        </Field.Root>
      </Composer.Root>
    </Stack.Root>
  );
}
