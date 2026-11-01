import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { tokenAtCaret, useMentions, type MentionDraft } from '../hooks/useMentions.js';
import { useMentionPeek } from '../hooks/useMentionPeek.js';
import { OptionList } from './OptionList.js';
import { Popover } from './Popover.js';
import { defineMentionSource, type MentionSource } from '../mentions/source.js';
import { Field } from './Field.js';
import { Mention } from './Mention.js';
import { MentionText } from './MentionText.js';

afterEach(cleanup);

type Person = { name: string };

const mina = { value: 'mina', label: 'Mina Park' };
const minjun = { value: 'minjun', label: 'Min-jun Choi' };

function peopleSource(extra: Partial<MentionSource<Person>> = {}): MentionSource<Person> {
  return defineMentionSource<Person>({
    char: '@',
    label: 'People',
    options: [mina, minjun],
    resolve: (id) => (id === 'mina' ? { name: 'Mina Park' } : id === 'minjun' ? { name: 'Min-jun Choi' } : undefined),
    renderPeek: (person, peek) => <span data-mode={peek.mode}>{person.name}</span>,
    peekLabel: (person) => person.name,
    ...extra,
  });
}

function type(el: HTMLTextAreaElement, text: string) {
  fireEvent.change(el, { target: { value: text, selectionStart: text.length, selectionEnd: text.length } });
}

describe('Mention.Root', () => {
  it('is a button without href and a link with one', () => {
    const source = peopleSource();
    const { rerender } = render(<Mention.Root source={source} id="mina">@Mina Park</Mention.Root>);
    expect(screen.getByRole('button', { name: '@Mina Park' })).toBeTruthy();
    rerender(
      <Mention.Root source={peopleSource({ href: (id) => `/people/${id}` })} id="mina">
        @Mina Park
      </Mention.Root>,
    );
    expect(screen.getByRole('link', { name: '@Mina Park' }).getAttribute('href')).toBe('/people/mina');
  });

  it('opens a described peek on focus after the show delay, and Escape leaves focus on the mention', async () => {
    vi.useFakeTimers();
    render(
      <Mention.Root source={peopleSource({ renderPeek: (person) => <p>{person.name}</p> })} id="mina">
        @Mina Park
      </Mention.Root>,
    );
    const button = screen.getByRole('button', { name: '@Mina Park' });
    fireEvent.focus(button);
    expect(button.getAttribute('aria-describedby')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    const described = button.getAttribute('aria-describedby');
    expect(described).toBeTruthy();
    expect(document.getElementById(described!)?.textContent).toBe('Mina Park');
    expect(document.getElementById(described!)?.getAttribute('role')).toBeNull();
    fireEvent.keyDown(button, { key: 'Escape' });
    expect(button.getAttribute('aria-describedby')).toBeNull();
    await act(async () => {});
    expect(document.activeElement).toBe(button);
    vi.useRealTimers();
  });

  it('uses a named dialog when the peek has a focusable, moves focus in on click, and restores it on close', async () => {
    render(
      <Mention.Root
        source={peopleSource({
          renderPeek: (person, peek) => (
            <button type="button" onClick={peek.close}>
              {person.name}
            </button>
          ),
        })}
        id="mina"
      >
        @Mina Park
      </Mention.Root>,
    );
    const mention = screen.getByRole('button', { name: '@Mina Park' });
    fireEvent.click(mention);
    const dialog = screen.getByRole('dialog', { name: 'Mina Park' });
    const inner = screen.getByRole('button', { name: 'Mina Park' });
    expect(dialog.contains(inner)).toBe(true);
    expect(document.activeElement).toBe(inner);
    expect(mention.getAttribute('aria-haspopup')).toBe('dialog');
    expect(mention.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(inner);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(mention);
  });

  it('puts only renderPeek output in the popover, and close() restores focus', async () => {
    render(
      <Mention.Root
        source={peopleSource({
          renderPeek: (person, peek) => (
            <button type="button" onClick={() => peek.close()}>
              {person.name}
            </button>
          ),
        })}
        id="mina"
      >
        @Mina Park
      </Mention.Root>,
    );
    fireEvent.click(screen.getByRole('button', { name: '@Mina Park' }));
    const dialog = screen.getByRole('dialog', { name: 'Mina Park' });
    expect(dialog.textContent).toBe('Mina Park');
    expect(dialog.querySelectorAll('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Mina Park' }));
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '@Mina Park' }));
  });

  it('passes mode caret to the caret peek', () => {
    const source = peopleSource({ renderPeek: (_person, peek) => <span>{peek.mode}</span> });
    function Harness() {
      const [draft, setDraft] = useState<MentionDraft>({
        text: '@Mina Park',
        tokens: [{ start: 0, end: 10, char: '@', value: 'mina', text: '@Mina Park' }],
      });
      const api = useMentions({ triggers: [source], value: draft, onValueChange: setDraft });
      const token = tokenAtCaret(api.value.tokens, 2);
      const peek = useMentionPeek({
        source,
        id: token?.value ?? null,
        mode: 'caret',
        active: token !== null,
        text: token?.text ?? '',
        focusRef: api.textareaRef,
        anchorName: api.caretPeekAnchorName,
      });
      return (
        <>
          <Field.Root aria-label="Message">
            <Field.Textarea {...api.getTextareaProps()} />
          </Field.Root>
          <Popover.Root {...api.getPopoverProps()}>
            <OptionList.Root {...api.getListboxProps()}>{null}</OptionList.Root>
          </Popover.Root>
          {peek.entity !== undefined ? source.renderPeek?.(peek.entity, peek.context) : null}
        </>
      );
    }
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    fireEvent.focus(field);
    field.setSelectionRange(2, 2);
    fireEvent.select(field);
    expect(document.body.textContent).toContain('caret');
  });
});

describe('resolve', () => {
  it('shows a loading state, then the entity', async () => {
    let release: (value: Person | undefined) => void = () => {};
    const source = peopleSource({
      resolve: () =>
        new Promise((done) => {
          release = done;
        }),
    });
    render(<Mention.Root source={source} id="mina">@Mina Park</Mention.Root>);
    fireEvent.click(screen.getByRole('button', { name: '@Mina Park' }));
    expect(document.querySelector('[data-loading]')).toBeTruthy();
    expect(document.querySelector('[data-loading]')?.getAttribute('aria-hidden')).toBe('true');
    await act(async () => {
      release({ name: 'Mina Park' });
    });
    expect(document.querySelector('[data-loading]')).toBeNull();
    expect(document.querySelector('[popover][data-popover-open]')?.textContent).toBe('Mina Park');
  });

  it('aborts the previous resolve when the id changes', async () => {
    const signals: AbortSignal[] = [];
    const source = peopleSource({
      resolve: (_id, signal) => {
        signals.push(signal);
        return new Promise(() => {});
      },
    });
    const { rerender } = render(<Mention.Root source={source} id="mina">@Mina</Mention.Root>);
    fireEvent.click(screen.getByRole('button', { name: '@Mina' }));
    rerender(<Mention.Root source={source} id="minjun">@Min-jun</Mention.Root>);
    expect(signals[0]?.aborted).toBe(true);
  });

  it('renders the mention and no card when resolve returns undefined', () => {
    const source = peopleSource({ resolve: () => undefined, renderPeek: () => <p>Nope</p> });
    render(<Mention.Root source={source} id="missing">@Missing</Mention.Root>);
    expect(screen.getByRole('button', { name: '@Missing' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '@Missing' }));
    expect(screen.queryByText('Nope')).toBeNull();
  });
});

describe('MentionText', () => {
  const source = peopleSource();

  it('splits adjacent tokens, leaves an unknown character as text, and ignores an out-of-range token', () => {
    const value: MentionDraft = {
      text: 'Hi @Mina Park@Min-jun Choi!',
      tokens: [
        { start: 3, end: 13, char: '@', value: 'mina', text: '@Mina Park' },
        { start: 13, end: 26, char: '@', value: 'minjun', text: '@Min-jun Choi' },
        { start: 80, end: 90, char: '@', value: 'nope', text: '@nope' },
        { start: 0, end: 2, char: '#', value: 'hash', text: 'Hi' },
      ],
    };
    render(<MentionText value={value} sources={[source]} />);
    expect(screen.getByRole('button', { name: '@Mina Park' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '@Min-jun Choi' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Hi' })).toBeNull();
    expect(document.body.textContent).toContain('Hi ');
    expect(document.body.textContent).toContain('!');
  });

  it('renders text with no tokens as-is', () => {
    render(<MentionText value={{ text: 'Hello', tokens: [] }} sources={[source]} />);
    expect(document.body.textContent).toContain('Hello');
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('caret anchor', () => {
  it('sits on the token the caret is in, moves with the caret, and is absent while the list is open', () => {
    const source = peopleSource();
    function Harness() {
      const [draft, setDraft] = useState<MentionDraft>({
        text: '@Mina Park @Min-jun Choi',
        tokens: [
          { start: 0, end: 10, char: '@', value: 'mina', text: '@Mina Park' },
          { start: 11, end: 24, char: '@', value: 'minjun', text: '@Min-jun Choi' },
        ],
      });
      const api = useMentions({ triggers: [source], value: draft, onValueChange: setDraft });
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...api.getTextareaProps()} />
        </Field.Root>
      );
    }
    render(<Harness />);
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    fireEvent.focus(field);
    field.setSelectionRange(4, 4);
    fireEvent.select(field);
    const named = () =>
      [...document.querySelectorAll('span')].filter((span) => (span.getAttribute('style') ?? '').includes('--todae-mention-peek-'));
    expect(named()).toHaveLength(1);
    expect(named()[0]?.textContent).toBe('@Mina Park');
    expect(tokenAtCaret(
      [
        { start: 0, end: 10, char: '@', value: 'mina', text: '@Mina Park' },
        { start: 11, end: 24, char: '@', value: 'minjun', text: '@Min-jun Choi' },
      ],
      4,
    )?.value).toBe('mina');
    field.setSelectionRange(14, 14);
    fireEvent.select(field);
    expect(named()).toHaveLength(1);
    expect(named()[0]?.textContent).toBe('@Min-jun Choi');
    field.setSelectionRange(field.value.length, field.value.length);
    type(field, `${field.value} @mi`);
    expect(named()).toHaveLength(0);
  });
});

describe('server render', () => {
  it('renders MentionText without touching window', () => {
    const source = peopleSource();
    const html = renderToString(
      <MentionText
        value={{ text: 'Hi @Mina Park', tokens: [{ start: 3, end: 13, char: '@', value: 'mina', text: '@Mina Park' }] }}
        sources={[source]}
      />,
    );
    expect(html).toContain('@Mina Park');
  });
});
