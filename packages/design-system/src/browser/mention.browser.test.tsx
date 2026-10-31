import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import axe from 'axe-core';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Field, Mention, MentionText, OptionList, Popover, defineMentionSource, useMentions, type MentionDraft, type MentionSource } from '../index.js';
import { useMentionPeek } from '../hooks/useMentionPeek.js';
import { tokenAtCaret } from '../hooks/useMentions.js';

afterEach(cleanup);

type Person = { name: string };

const people = defineMentionSource<Person>({
  char: '@',
  label: 'People',
  options: [
    { value: 'mina', label: 'Mina Park' },
    { value: 'minjun', label: 'Min-jun Choi' },
  ],
  resolve: (id) => (id === 'mina' ? { name: 'Mina Park' } : { name: 'Min-jun Choi' }),
  peekLabel: (person) => person.name,
  renderPeek: (person) => <span>{person.name}</span>,
});

const interactive = defineMentionSource<Person>({
  ...people,
  renderPeek: (person, peek) => (
    <button type="button" onClick={peek.close}>
      {person.name}
    </button>
  ),
});

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function MentionField({
  mentions,
  value,
  onValueChange,
  onSubmit,
}: {
  mentions: readonly MentionSource<Person>[];
  value?: MentionDraft;
  onValueChange?: (next: MentionDraft) => void;
  onSubmit?: () => void;
}) {
  const api = useMentions({ triggers: mentions, value, onValueChange });
  const el = api.textareaRef.current;
  const caret = el && el.selectionStart === el.selectionEnd ? el.selectionStart : null;
  const token = !api.open && caret !== null ? tokenAtCaret(api.value.tokens, caret) : null;
  const source = token ? (mentions.find((item) => item.char === token.char) ?? null) : null;
  const peek = useMentionPeek({
    source,
    id: token?.value ?? null,
    mode: 'caret',
    active: token !== null && !api.open,
    text: token?.text ?? '',
    focusRef: api.textareaRef,
    anchorName: api.caretPeekAnchorName,
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return;
        if (!(event.target instanceof HTMLTextAreaElement)) return;
        event.preventDefault();
        event.currentTarget.requestSubmit();
      }}
    >
      <Field.Root aria-label="Message">
        <Field.Textarea
          {...api.getTextareaProps({
            'aria-describedby': peek.open ? peek.triggerProps['aria-describedby'] : undefined,
          })}
        />
      </Field.Root>
      <Popover.Root {...api.getPopoverProps()}>
        <OptionList.Root {...api.getListboxProps()}>
          {api.items.map((item) => (
            <OptionList.Option key={item.id} {...api.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
      {source?.renderPeek ? (
        <Popover.Root {...peek.peekProps} inert={peek.inert ? true : undefined}>
          {peek.entity !== undefined ? source.renderPeek(peek.entity, peek.context) : null}
        </Popover.Root>
      ) : null}
      <button type="submit">Send</button>
    </form>
  );
}

function openPopover() {
  const el = document.querySelector<HTMLElement>('[popover][data-popover-open], [popover]:popover-open');
  if (!el) throw new Error('no open popover');
  return el;
}

function anchorOf(popover: HTMLElement) {
  const name = popover.style.getPropertyValue('position-anchor').trim() || popover.style.getPropertyValue('--todae-popover-anchor').trim();
  const found = [...document.querySelectorAll<HTMLElement>('*')].find((el) => (el.style.anchorName || '').includes(name));
  if (!found) throw new Error(`no anchor for ${name}`);
  return found;
}

function expectBeside(popover: HTMLElement, anchor: HTMLElement) {
  const pop = popover.getBoundingClientRect();
  const box = anchor.getBoundingClientRect();
  const below = pop.top - box.bottom;
  const above = box.top - pop.bottom;
  const gap = below >= -1 ? below : above;
  expect(Math.abs(gap - 4)).toBeLessThanOrEqual(1);
  expect(Math.abs(pop.left - box.left)).toBeLessThanOrEqual(1);
}

describe('mention peek in a browser', () => {
  it('picks from MentionField with the keyboard and does not send', async () => {
    const sent: string[] = [];
    function Chat() {
      const [draft, setDraft] = useState<MentionDraft>({ text: '', tokens: [] });
      const send = () => {
        sent.push(draft.text);
        setDraft({ text: '', tokens: [] });
      };
      return <MentionField mentions={[people]} value={draft} onValueChange={setDraft} onSubmit={send} />;
    }
    render(<Chat />);
    const field = screen.getByRole('textbox', { name: 'Message' });
    await userEvent.click(field);
    await userEvent.keyboard('@mi{ArrowDown}{Enter}');
    expect(sent).toEqual([]);
    expect((field as HTMLTextAreaElement).value).toContain('@');
    await userEvent.keyboard('{Enter}');
    expect(sent).toHaveLength(1);
  });

  it('keeps a hover peek open while the pointer is on the card, then closes after leave', async () => {
    render(<Mention.Root source={people} id="mina">@Mina Park</Mention.Root>);
    const mention = screen.getByRole('button', { name: '@Mina Park' });
    await userEvent.hover(mention);
    await wait(400);
    const peek = openPopover();
    expect(peek.textContent).toContain('Mina Park');
    await userEvent.hover(peek);
    await wait(200);
    expect(peek.hasAttribute('data-popover-open') || peek.matches(':popover-open')).toBe(true);
    mention.blur();
    fireEvent.pointerLeave(mention, { relatedTarget: document.body });
    fireEvent.pointerLeave(peek, { relatedTarget: document.body });
    await wait(400);
    expect(document.querySelector('[popover][data-popover-open], [popover]:popover-open')).toBeNull();
  });

  it('toggles the peek on click', async () => {
    render(<Mention.Root source={interactive} id="mina">@Mina Park</Mention.Root>);
    const mention = screen.getByRole('button', { name: '@Mina Park' });
    await userEvent.click(mention);
    expect(screen.getByRole('dialog', { name: 'Mina Park' })).toBeTruthy();
    await userEvent.click(mention);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('anchors the list, the caret peek, and the sent peek to the mention', async () => {
    function Stage({ drop }: { drop?: boolean }) {
      const [draft, setDraft] = useState<MentionDraft>({ text: '', tokens: [] });
      return (
        <div style={drop ? { paddingTop: '80vh' } : undefined}>
          <MentionField mentions={[people]} value={draft} onValueChange={setDraft} />
          <Mention.Root source={people} id="mina">
            @Mina Park
          </Mention.Root>
        </div>
      );
    }
    render(<Stage />);
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await userEvent.click(field);
    await userEvent.keyboard('@mi');
    const list = openPopover();
    expectBeside(list, anchorOf(list));
    await userEvent.keyboard('{Enter}');
    field.setSelectionRange(2, 2);
    field.dispatchEvent(new Event('select', { bubbles: true }));
    await wait(50);
    const caretPeek = openPopover();
    expectBeside(caretPeek, anchorOf(caretPeek));
    await userEvent.hover(screen.getByRole('button', { name: '@Mina Park' }));
    await wait(400);
    const sent = [...document.querySelectorAll<HTMLElement>('[popover]')].filter(
      (el) => el.hasAttribute('data-popover-open') || el.matches(':popover-open'),
    );
    const card = sent.find((el) => el !== caretPeek) ?? sent[0];
    if (!card) throw new Error('no sent peek');
    expectBeside(card, anchorOf(card));

    cleanup();
    const tall = defineMentionSource<Person>({
      ...people,
      renderPeek: () => <div style={{ height: 160 }}>Tall peek</div>,
    });
    render(
      <div style={{ position: 'fixed', bottom: 8, left: 40 }}>
        <Mention.Root source={tall} id="mina">
          @Mina Park
        </Mention.Root>
      </div>,
    );
    await userEvent.hover(screen.getByRole('button', { name: '@Mina Park' }));
    await wait(400);
    const low = openPopover();
    const lowAnchor = anchorOf(low);
    expect(low.getBoundingClientRect().bottom).toBeLessThanOrEqual(lowAnchor.getBoundingClientRect().top + 1);
    cleanup();
    const many = defineMentionSource<Person>({
      ...tall,
      options: Array.from({ length: 12 }, (_, index) => ({ value: `p${index}`, label: `Person ${index} with a long label` })),
      resolve: () => ({ name: 'Mina Park' }),
    });
    function LowComposer() {
      const [draft, setDraft] = useState<MentionDraft>({ text: '', tokens: [] });
      return (
        <div style={{ position: 'fixed', bottom: 8, left: 40, inlineSize: '24rem' }}>
          <MentionField mentions={[many]} value={draft} onValueChange={setDraft} />
        </div>
      );
    }
    render(<LowComposer />);
    const lowField = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await userEvent.click(lowField);
    await userEvent.keyboard('@P');
    const lowList = openPopover();
    expect(lowList.getBoundingClientRect().bottom).toBeLessThanOrEqual(anchorOf(lowList).getBoundingClientRect().top + 1);
    await userEvent.keyboard('{Enter}');
    lowField.setSelectionRange(2, 2);
    lowField.dispatchEvent(new Event('select', { bubbles: true }));
    await wait(50);
    const lowCaret = openPopover();
    expect(lowCaret.getBoundingClientRect().bottom).toBeLessThanOrEqual(anchorOf(lowCaret).getBoundingClientRect().top + 1);
  });

  it('has no axe violations on the composer example', async () => {
    const value: MentionDraft = {
      text: 'Hi @Mina Park',
      tokens: [{ start: 3, end: 13, char: '@', value: 'mina', text: '@Mina Park' }],
    };
    render(
      <main>
        <MentionText value={value} sources={[people]} />
        <MentionField mentions={[people]} />
      </main>,
    );
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
