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
// `shown` maps each message to the id of the reply the thread follows.
// A reply stopped before it had any text keeps `stopped`, so it can be asked again.
type Turn = { id: number; from: 'user' | 'assistant'; text: string; parent: number | null; stopped?: true };

// The one reply in flight, and the reply its question showed before it, if any.
type Pending = { reply: number; before: number | undefined };

// The reply in flight lives in the thread, so each change is one update.
type Thread = { turns: Record<number, Turn>; shown: Record<number, number>; pending: Pending | null };

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

function start(): Thread {
  return {
    turns: {
      1: { id: 1, from: 'user', text: FIRST, parent: null },
      2: { id: 2, from: 'assistant', text: ANSWERS[FIRST]!.versions[0]!, parent: 1 },
      3: { id: 3, from: 'assistant', text: ANSWERS[FIRST]!.versions[1]!, parent: 1 },
    },
    shown: { 1: 3 },
    pending: null,
  };
}

// The replies to a message, oldest first. Ids only grow, so their order is the order of arrival.
const repliesTo = ({ turns }: Thread, id: number) =>
  Object.values(turns)
    .filter((turn) => turn.parent === id)
    .sort((a, b) => a.id - b.id);

// The turns the thread follows now, from the first message.
function pathOf(thread: Thread): Turn[] {
  const path: Turn[] = [];
  let turn: Turn | undefined = thread.turns[1];
  while (turn) {
    path.push(turn);
    const next = thread.shown[turn.id];
    turn = next === undefined ? undefined : thread.turns[next];
  }
  return path;
}

// Takes a turn out, and points its parent back at `before`.
function without(thread: Thread, id: number, before: number | undefined): Thread {
  const { [id]: _, ...turns } = thread.turns;
  const parent = thread.turns[id]!.parent!;
  const { [parent]: __, ...shown } = thread.shown;
  return { ...thread, turns, shown: before === undefined ? shown : { ...shown, [parent]: before } };
}

// The thread with the reply in flight taken out, and its question showing what it showed before.
const cancelled = (thread: Thread): Thread =>
  thread.pending ? { ...without(thread, thread.pending.reply, thread.pending.before), pending: null } : thread;

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

  const held = (to: number) => locked || to < 0 || to >= count;
  // A click on an aria-disabled Button.Root runs no onClick, so show only sees steps that can happen.
  const show = (to: number) => {
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
        aria-disabled={held(index - 1) || undefined}
        onClick={() => show(index - 1)}
      >
        <Button.Icon>
          <ChevronLeft />
        </Button.Icon>
      </Button.Root>
      <Text.Root as="span" id={position} tone="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {index + 1} of {count}
      </Text.Root>
      <Button.Root
        variant="ghost"
        aria-label="Next reply"
        aria-describedby={position}
        aria-disabled={held(index + 1) || undefined}
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
  const [thread, setThread] = useState(start);
  const [value, setValue] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const field = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(4);
  const { turns, pending } = thread;
  const path = pathOf(thread);
  const last = path.at(-1)!;
  const busy = pending !== null;
  const hasDraft = value.trim() !== '';
  const suggestions = last.from === 'assistant' && !busy && !hasDraft ? answerTo(turns[last.parent!]!.text).suggestions : [];

  useEffect(() => () => clearTimeout(timer.current), []);

  // Adds a reply to `question` that streams for a moment, then shows its
  // text. Stands in for the product's request.
  const ask = (base: Thread, question: Turn) => {
    const id = nextId.current++;
    const versions = answerTo(question.text).versions;
    const text = versions[repliesTo(base, question.id).length % versions.length]!;
    setThread({
      turns: { ...base.turns, [id]: { id, from: 'assistant', text: '', parent: question.id } },
      shown: { ...base.shown, [question.id]: id },
      pending: { reply: id, before: base.shown[question.id] },
    });
    timer.current = setTimeout(() => {
      setThread((now) => ({ ...now, turns: { ...now.turns, [id]: { ...now.turns[id]!, text } }, pending: null }));
    }, 1200);
  };

  // While a reply runs, only that reply can be asked for again, and asking
  // again cancels the one in flight. A stopped reply is replaced, not kept as a version.
  const regenerateHeld = (answer: Turn) => pending !== null && pending.reply !== answer.id;
  const regenerate = (answer: Turn) => {
    clearTimeout(timer.current);
    const base = cancelled(thread);
    ask(answer.stopped ? without(base, answer.id, undefined) : base, turns[answer.parent!]!);
  };

  const show = (answer: Turn, reply: number) =>
    setThread((now) => ({ ...now, shown: { ...now.shown, [answer.parent!]: reply } }));

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = nextId.current++;
    const question: Turn = { id, from: 'user', text: value.trim(), parent: last.id };
    setValue('');
    ask({ ...thread, turns: { ...turns, [id]: question }, shown: { ...thread.shown, [last.id]: id } }, question);
  };

  const stop = () => {
    if (!pending) return;
    clearTimeout(timer.current);
    const stopped = cancelled(thread);
    const question = turns[turns[pending.reply]!.parent!]!;
    if (repliesTo(stopped, question.id).length > 0) {
      setThread(stopped);
      return;
    }
    // A question stopped before any reply goes back to the field to be sent
    // again. If the person has started another draft there, the reply stays
    // as stopped instead, so Regenerate can ask again.
    if (hasDraft) {
      const reply = turns[pending.reply]!;
      setThread({ ...thread, turns: { ...turns, [reply.id]: { ...reply, stopped: true } }, pending: null });
      return;
    }
    setThread(without(stopped, question.id, undefined));
    setValue(question.text);
    field.current?.focus();
  };

  // A suggestion fills the field, so the person can change it before sending.
  const pick = (text: string) => {
    setValue(text);
    field.current?.focus();
  };

  return (
    <Stack.Root gap="normal" style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      {path.map((turn) => {
        if (turn.from === 'user') {
          return (
            <Message.Root key={turn.id} from="user" aria-label="You">
              <Message.Content>{turn.text}</Message.Content>
            </Message.Root>
          );
        }
        const versions = repliesTo(thread, turn.parent!);
        return (
          // Keyed by the question, so switching or regenerating keeps the message and the focused button.
          <Message.Root key={`reply-${turn.parent}`} streaming={pending?.reply === turn.id} aria-label="Assistant">
            <Message.Content>
              {turn.stopped ? (
                <Text.Root tone="muted">Stopped before a reply.</Text.Root>
              ) : (
                <Prose.Root>
                  <p>{turn.text}</p>
                </Prose.Root>
              )}
            </Message.Content>
            <Message.Actions>
              <Toolbar.Root aria-label="Reply">
                {versions.length > 1 && (
                  <VersionSwitcher
                    index={versions.indexOf(turn)}
                    count={versions.length}
                    // While a reply streams it is the one shown, so its later turns stay in view.
                    locked={busy}
                    onShow={(index) => show(turn, versions[index]!.id)}
                  />
                )}
                <Button.Root
                  variant="ghost"
                  aria-label="Regenerate"
                  aria-disabled={regenerateHeld(turn) || undefined}
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
        );
      })}
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
            <Composer.Submit disabled={!hasDraft} onStop={stop} />
          </Field.Row>
        </Field.Root>
      </Composer.Root>
    </Stack.Root>
  );
}
