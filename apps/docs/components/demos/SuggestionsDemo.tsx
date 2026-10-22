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

// Each turn is a node. A message's replies are its children, so regenerating
// adds a sibling, and `shown` picks the child the conversation follows.
type Turn = {
  id: number;
  from: 'user' | 'assistant';
  text: string;
  parent: number | null;
  children: number[];
  shown: number;
  // While the reply streams: the reply its question showed before, put back if it stops.
  streaming?: { before: number };
};

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

function start(): Record<number, Turn> {
  return {
    1: { id: 1, from: 'user', text: FIRST, parent: null, children: [2, 3], shown: 1 },
    2: { id: 2, from: 'assistant', text: ANSWERS[FIRST]!.versions[0]!, parent: 1, children: [], shown: 0 },
    3: { id: 3, from: 'assistant', text: ANSWERS[FIRST]!.versions[1]!, parent: 1, children: [], shown: 0 },
  };
}

// The turns the conversation follows now, from the first message.
function pathOf(turns: Record<number, Turn>): Turn[] {
  const path: Turn[] = [];
  let turn: Turn | undefined = turns[1];
  while (turn) {
    path.push(turn);
    const next = turn.children[turn.shown];
    turn = next === undefined ? undefined : turns[next];
  }
  return path;
}

function VersionSwitcher({ index, count, onShow }: { index: number; count: number; onShow: (index: number) => void }) {
  const announce = useAnnouncer();
  const position = useId();

  const show = (to: number) => {
    onShow(to);
    announce(`Reply ${to + 1} of ${count}`);
  };

  // The toolbar moves focus to the other button when the focused one turns disabled at an end.
  return (
    <>
      <Button.Root
        variant="ghost"
        aria-label="Previous reply"
        aria-describedby={position}
        disabled={index === 0}
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
        disabled={index === count - 1}
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
  const [turns, setTurns] = useState(start);
  const [value, setValue] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const field = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(4);
  const path = pathOf(turns);
  const last = path.at(-1)!;
  // Any reply in flight, shown or not: switching to another version doesn't stop it.
  const busy = Object.values(turns).some((turn) => turn.streaming);
  const suggestions = last.from === 'assistant' && !busy && value === '' ? answerTo(turns[last.parent!]!.text).suggestions : [];

  useEffect(() => () => clearTimeout(timer.current), []);

  // Adds a reply to the question with id `to` that streams for a moment, then
  // shows its text. Stands in for the product's request. A new one cancels the
  // one in flight.
  const ask = (all: Record<number, Turn>, to: number) => {
    clearTimeout(timer.current);
    const base = dropStreaming(all);
    const question = base[to]!;
    const id = nextId.current++;
    const versions = answerTo(question.text).versions;
    const text = versions[question.children.length % versions.length]!;
    setTurns({
      ...base,
      [to]: { ...question, children: [...question.children, id], shown: question.children.length },
      [id]: { id, from: 'assistant', text: '', parent: to, children: [], shown: 0, streaming: { before: question.shown } },
    });
    timer.current = setTimeout(() => {
      setTurns((now) => ({ ...now, [id]: { ...now[id]!, text, streaming: undefined } }));
    }, 1200);
  };

  const regenerate = (answer: Turn) => ask(turns, answer.parent!);

  const show = (answer: Turn, index: number) =>
    setTurns((all) => ({ ...all, [answer.parent!]: { ...all[answer.parent!]!, shown: index } }));

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const id = nextId.current++;
    const question: Turn = { id, from: 'user', text: value.trim(), parent: last.id, children: [], shown: 0 };
    setValue('');
    ask({ ...turns, [last.id]: { ...last, children: [...last.children, id], shown: last.children.length }, [id]: question }, id);
  };

  const stop = () => {
    clearTimeout(timer.current);
    const streaming = Object.values(turns).find((turn) => turn.streaming);
    const question = streaming && turns[streaming.parent!];
    // A question stopped before any reply goes back to the field, so it can be sent again.
    if (question && question.children.length === 1 && question.parent !== null) {
      const { [question.id]: _, [streaming.id]: __, ...rest } = turns;
      const before = rest[question.parent]!;
      setTurns({ ...rest, [before.id]: { ...before, children: before.children.filter((id) => id !== question.id) } });
      setValue(question.text);
      field.current?.focus();
      return;
    }
    setTurns(dropStreaming);
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
          <Message.Root key={`reply-${turn.parent}`} streaming={Boolean(turn.streaming)} aria-label="Assistant">
            <Message.Content>
              <Prose.Root>
                <p>{turn.text}</p>
              </Prose.Root>
            </Message.Content>
            <Message.Actions>
              <Toolbar.Root aria-label="Reply">
                {turns[turn.parent!]!.children.length > 1 && (
                  <VersionSwitcher
                    index={turns[turn.parent!]!.shown}
                    count={turns[turn.parent!]!.children.length}
                    onShow={(index) => show(turn, index)}
                  />
                )}
                <Button.Root variant="ghost" aria-label="Regenerate" onClick={() => regenerate(turn)}>
                  <Button.Icon>
                    <RotateCcw />
                  </Button.Icon>
                </Button.Root>
              </Toolbar.Root>
              {turn.streaming && <Loader.Root variant="dots" aria-label="Writing" />}
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

// A stopped or replaced reply goes away. If its question still showed it, the
// question shows the reply it showed before.
function dropStreaming(all: Record<number, Turn>): Record<number, Turn> {
  const streaming = Object.values(all).find((turn) => turn.streaming);
  if (!streaming?.streaming) return all;
  const { [streaming.id]: _, ...rest } = all;
  const question = rest[streaming.parent!]!;
  const at = question.children.indexOf(streaming.id);
  const children = question.children.filter((id) => id !== streaming.id);
  const shown = question.shown === at ? streaming.streaming.before : question.shown > at ? question.shown - 1 : question.shown;
  return { ...rest, [question.id]: { ...question, children, shown } };
}
