import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { StrictMode, startTransition, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../components/Field.js';
import { useMentions, type MentionDraft, type MentionToken, type MentionTrigger, type UseMentionsResult } from './useMentions.js';

afterEach(cleanup);

const people = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'alan', label: 'Alan Turing' },
];

const ada = { start: 0, end: 4, char: '@', value: 'ada', text: '@Ada' };
const short = [{ value: 'ada', label: 'Ada' }];
type Commit = 'sync' | 'timeout' | 'transition';
const tick = (ms = 20) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

/** A product that holds the draft, and may reject or delay an edit. */
function Harness({
  triggers = [{ char: '@', options: people }],
  initial = '',
  tokens = [],
  maxLength,
  accept = () => true,
  commit = 'sync',
  onChange,
  expose,
}: {
  triggers?: MentionTrigger[];
  initial?: string;
  tokens?: MentionToken[];
  maxLength?: number;
  accept?: (draft: MentionDraft) => boolean;
  commit?: Commit;
  onChange?: (draft: MentionDraft) => void;
  expose?: (result: UseMentionsResult, held: MentionDraft) => void;
}) {
  const [draft, setDraft] = useState<MentionDraft>({ text: initial, tokens });
  const mentions = useMentions({
    triggers,
    value: draft,
    onValueChange: (next) => {
      onChange?.(next);
      if (!accept(next)) return;
      const set = () => setDraft(next);
      if (commit === 'sync') set();
      else if (commit === 'timeout') setTimeout(set, 10);
      else startTransition(set);
    },
    maxLength,
  });
  expose?.(mentions, draft);
  return (
    <>
      <Field.Root aria-label="Message">
        <Field.Textarea {...mentions.getTextareaProps()} maxLength={maxLength} />
      </Field.Root>
      <button type="button" onClick={() => setDraft((current) => ({ ...current, text: '' }))}>
        Clear text
      </button>
      <button type="button" onClick={() => setDraft({ text: 'yo @Bob', tokens: [{ start: 3, end: 7, char: '@', value: 'bob', text: '@Bob' }] })}>
        Load
      </button>
      <button type="button" onClick={() => setDraft({ text: 'yo @bo', tokens: [] })}>
        Replace
      </button>
    </>
  );
}

function type(el: HTMLTextAreaElement, text: string) {
  fireEvent.change(el, { target: { value: text, selectionStart: text.length, selectionEnd: text.length } });
}

describe('useMentions', () => {
  it('opens for the word after a trigger and wires the textarea to the list', () => {
    let result!: UseMentionsResult;
    render(<Harness expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, 'hi @a');
    expect(result.open).toBe(true);
    expect(result.query).toBe('a');
    expect(result.items.map((item) => item.option.value)).toEqual(['ada', 'alan']);
    expect(el.getAttribute('aria-autocomplete')).toBe('list');
    expect(el.getAttribute('aria-haspopup')).toBe('listbox');
    expect(el.getAttribute('aria-controls')).toBe(result.ids.listbox);
    expect(el.getAttribute('aria-activedescendant')).toBe(result.activeId);
    expect(el.hasAttribute('aria-expanded')).toBe(false);
  });

  it('inserts a pick and tracks it as a token when the textarea cannot edit natively', () => {
    let result!: UseMentionsResult;
    const onChange = vi.fn();
    render(<Harness expose={(r) => (result = r)} onChange={onChange} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, 'hi @al');
    act(() => result.select('alan'));
    expect(el.value).toBe('hi @Alan Turing ');
    expect(onChange).toHaveBeenLastCalledWith({
      text: 'hi @Alan Turing ',
      tokens: [{ start: 3, end: 15, char: '@', value: 'alan', text: '@Alan Turing' }],
    });
    expect(result.open).toBe(false);
  });

  it('leaves out tokens that no longer hold their text when the product changes only the text', () => {
    let result!: UseMentionsResult;
    let held!: MentionDraft;
    const onChange = vi.fn();
    render(<Harness initial="@Ada hi" tokens={[ada]} onChange={onChange} expose={(r, h) => ((result = r), (held = h))} />);
    expect(result.value.tokens).toEqual([ada]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear text' }));
    expect(result.value).toEqual({ text: '', tokens: [] });
    expect(onChange).not.toHaveBeenCalled();
    type(screen.getByRole('textbox') as HTMLTextAreaElement, 'hi');
    expect(held).toEqual({ text: 'hi', tokens: [] });
  });

  it('disables a pick whose text would pass maxLength', () => {
    let result!: UseMentionsResult;
    render(<Harness maxLength={10} expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    const [ada, alan] = result.items;
    expect(result.getOptionProps(ada!).disabled).toBe(true);
    expect(result.getOptionProps(alan!).disabled).toBe(true);
    expect(result.activeValue).toBeNull();
    act(() => result.select('ada'));
    expect(el.value).toBe('@a');
  });

  it('picks nothing and keeps Enter from going through while the word is still loading', async () => {
    let result!: UseMentionsResult;
    let finish!: (options: typeof people) => void;
    const loadOptions = vi.fn(() => new Promise<typeof people>((resolve) => (finish = resolve)));
    render(<Harness triggers={[{ char: '@', loadOptions }]} expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    expect(result.loading).toBe(true);
    const enter = fireEvent.keyDown(el, { key: 'Enter' });
    expect(enter).toBe(false);
    await act(async () => finish(people));
    expect(result.loading).toBe(false);
    expect(result.activeValue).toBe('ada');
    expect(loadOptions).toHaveBeenCalledWith('a', expect.any(AbortSignal));
  });

  it('closes on Escape for that word only', () => {
    let result!: UseMentionsResult;
    render(<Harness expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(result.open).toBe(false);
    type(el, '@ad');
    expect(result.open).toBe(false);
    type(el, '@ad @a');
    expect(result.open).toBe(true);
  });

  it('loads a draft set as text and tokens together', () => {
    let result!: UseMentionsResult;
    render(<Harness initial="hi @Ada" tokens={[{ ...ada, start: 3, end: 7 }]} expose={(r) => (result = r)} />);
    expect(result.value.tokens).toEqual([{ ...ada, start: 3, end: 7 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(result.value).toEqual({ text: 'yo @Bob', tokens: [{ start: 3, end: 7, char: '@', value: 'bob', text: '@Bob' }] });
  });

  it('keeps the draft as it was for an edit the product rejects', () => {
    let result!: UseMentionsResult;
    let held!: MentionDraft;
    render(<Harness initial="@Ada hi" tokens={[ada]} accept={() => false} expose={(r, h) => ((result = r), (held = h))} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(el, { target: { value: 'Z@Ada hi', selectionStart: 1, selectionEnd: 1 } });
    expect(el.value).toBe('@Ada hi');
    expect(result.value).toEqual({ text: '@Ada hi', tokens: [ada] });
    expect(held).toEqual({ text: '@Ada hi', tokens: [ada] });
  });

  for (const commit of ['timeout', 'transition'] as const) {
    it(`keeps the text and its tokens together when the product commits them later (${commit})`, async () => {
      let held!: MentionDraft;
      render(<Harness initial="@Ada hi" tokens={[ada]} commit={commit} expose={(_, h) => (held = h)} />);
      const el = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(el, { target: { value: 'Z@Ada hi', selectionStart: 1, selectionEnd: 1 } });
      await tick();
      expect(held).toEqual({ text: 'Z@Ada hi', tokens: [{ ...ada, start: 1, end: 5 }] });
    });
  }

  it('drops starting tokens that do not match the text, and typing their text does not bring them back', () => {
    let result!: UseMentionsResult;
    let held!: MentionDraft;
    render(<Harness tokens={[ada]} expose={(r, h) => ((result = r), (held = h))} />);
    expect(result.value.tokens).toEqual([]);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    type(el, '@Ada');
    expect(result.value.tokens).toEqual([]);
    expect(held.tokens).toEqual([]);
  });

  it('puts the caret right after the token when whitespace already follows it', () => {
    let result!: UseMentionsResult;
    render(<Harness initial={'@ad\nnext'} expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(3, 3);
    fireEvent.select(el);
    expect(result.open).toBe(true);
    act(() => result.select('ada'));
    expect(el.value).toBe('@Ada Lovelace\nnext');
    expect(el.selectionStart).toBe(13);
  });

  it('sets the text itself where execCommand is missing, with the textarea focused', () => {
    let result!: UseMentionsResult;
    render(<Harness expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    expect(document.activeElement).toBe(el);
    type(el, '@a');
    expect(() => act(() => result.select('ada'))).not.toThrow();
    expect(el.value).toBe('@Ada Lovelace ');
  });

  it('opens no list and inserts nothing in a read-only textarea', () => {
    let result!: UseMentionsResult;
    function ReadOnly() {
      const mentions = useMentions({ triggers: [{ char: '@', options: people }], defaultValue: { text: '@a', tokens: [] } });
      result = mentions;
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...mentions.getTextareaProps()} readOnly />
        </Field.Root>
      );
    }
    render(<ReadOnly />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(2, 2);
    fireEvent.select(el);
    expect(result.open).toBe(false);
    act(() => result.select('ada'));
    expect(el.value).toBe('@a');
  });

  it('leaves the arrow keys to the caret when the list has nothing to pick', () => {
    render(<Harness />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, 'first\n@zzz');
    expect(fireEvent.keyDown(el, { key: 'ArrowUp' })).toBe(true);
    type(el, 'first\n@a');
    expect(fireEvent.keyDown(el, { key: 'ArrowDown' })).toBe(false);
  });

  it("keeps one trigger's load error off another trigger's list", async () => {
    let result!: UseMentionsResult;
    const failure = new Error('offline');
    render(
      <Harness
        triggers={[
          { char: '@', loadOptions: () => Promise.reject(failure) },
          { char: '#', options: [{ value: 'general', label: 'general' }] },
        ]}
        expose={(r) => (result = r)}
      />,
    );
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    await act(async () => {});
    expect(result.error).toBe(failure);
    expect(result.isEmpty).toBe(false);
    type(el, '@a #g');
    expect(result.error).toBeNull();
    expect(result.items.map((item) => item.option.value)).toEqual(['general']);
  });

  it('builds the popover anchor from a CSS-safe id even when the id option is not one', () => {
    let result!: UseMentionsResult;
    function Named() {
      result = useMentions({ triggers: [{ char: '@', options: people }], id: 'chat box' });
      return null;
    }
    render(<Named />);
    const anchor = String((result.getPopoverProps().style as Record<string, unknown>).positionAnchor);
    expect(anchor).toMatch(/^--[A-Za-z0-9_-]+$/);
  });

  it('settles when the product passes a new draft object or tokens array on each render', () => {
    let result!: UseMentionsResult;
    function Copying() {
      const [draft, setDraft] = useState<MentionDraft>({ text: '', tokens: [] });
      const mentions = useMentions({
        triggers: [{ char: '@', options: people }],
        value: { text: draft.text, tokens: draft.tokens.map((token) => ({ ...token })) },
        onValueChange: setDraft,
      });
      result = mentions;
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...mentions.getTextareaProps()} />
        </Field.Root>
      );
    }
    render(<Copying />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    act(() => result.select('ada'));
    expect(result.value.tokens).toEqual([{ start: 0, end: 13, char: '@', value: 'ada', text: '@Ada Lovelace' }]);
    fireEvent.change(el, { target: { value: 'Hi @Ada Lovelace ', selectionStart: 3, selectionEnd: 3 } });
    expect(result.value.tokens).toEqual([{ start: 3, end: 16, char: '@', value: 'ada', text: '@Ada Lovelace' }]);
  });

  it('leaves Enter alone during an IME composition', () => {
    render(<Harness />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    expect(fireEvent.keyDown(el, { key: 'Enter', keyCode: 229 })).toBe(true);
    expect(fireEvent.keyDown(el, { key: 'Enter', isComposing: true })).toBe(true);
    expect(fireEvent.keyDown(el, { key: 'Enter' })).toBe(false);
  });
});

describe('useMentions edge cases', () => {
  it('lands a fallback pick and its caret when the product commits the draft later', async () => {
    let result!: UseMentionsResult;
    let held!: MentionDraft;
    render(<Harness commit="timeout" expose={(r, h) => ((result = r), (held = h))} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    fireEvent.change(el, { target: { value: '@a', selectionStart: 2, selectionEnd: 2 } });
    await tick();
    expect(result.open).toBe(true);
    act(() => result.select('ada'));
    await tick();
    expect(el.value).toBe('@Ada Lovelace ');
    expect(el.selectionStart).toBe(14);
    expect(held.tokens).toEqual([{ start: 0, end: 13, char: '@', value: 'ada', text: '@Ada Lovelace' }]);
  });

  it('hands out one draft per edit in StrictMode', () => {
    const onChange = vi.fn();
    let result!: UseMentionsResult;
    render(
      <StrictMode>
        <Harness onChange={onChange} expose={(r) => (result = r)} />
      </StrictMode>,
    );
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    act(() => result.select('ada'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('keeps the list closed for a dismissed word through an edit before it', () => {
    let result!: UseMentionsResult;
    render(<Harness expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, 'x @a');
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(result.open).toBe(false);
    fireEvent.change(el, { target: { value: 'xy @a', selectionStart: 2, selectionEnd: 2 } });
    el.setSelectionRange(5, 5);
    fireEvent.select(el);
    expect(result.open).toBe(false);
    type(el, 'xy @a @g');
    expect(result.open).toBe(true);
  });

  it('keeps Escape when the product commits the edit later', async () => {
    let result!: UseMentionsResult;
    render(<Harness initial="@abc" commit="timeout" expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(4, 4);
    fireEvent.select(el);
    fireEvent.change(el, { target: { value: '@ab', selectionStart: 3, selectionEnd: 3 } });
    fireEvent.keyDown(el, { key: 'Escape' });
    await tick();
    expect(result.value.text).toBe('@ab');
    expect(result.open).toBe(false);
  });

  it('does not reopen the list or reload after a pick of a one-word option before whitespace', async () => {
    const loadOptions = vi.fn(async () => short);
    let result!: UseMentionsResult;
    let held!: MentionDraft;
    render(<Harness initial={'@Ad\nnext'} triggers={[{ char: '@', loadOptions }]} expose={(r, h) => ((result = r), (held = h))} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(3, 3);
    fireEvent.select(el);
    await act(async () => {});
    expect(result.open).toBe(true);
    act(() => result.select('ada'));
    await act(async () => {});
    expect(held.tokens).toEqual([ada]);
    expect(result.open).toBe(false);
    expect(loadOptions).toHaveBeenCalledTimes(1);
  });

  it('commits the token of a pick that leaves the text as it is', () => {
    let result!: UseMentionsResult;
    let held!: MentionDraft;
    const onChange = vi.fn();
    render(<Harness initial="@Ada hi" triggers={[{ char: '@', options: short }]} onChange={onChange} expose={(r, h) => ((result = r), (held = h))} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(4, 4);
    fireEvent.select(el);
    act(() => result.select('ada'));
    expect(held).toEqual({ text: '@Ada hi', tokens: [ada] });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(result.open).toBe(false);
  });

  it('commits the token of a pick that leaves the text as it is, uncontrolled', () => {
    let result!: UseMentionsResult;
    const onChange = vi.fn();
    function Uncontrolled() {
      result = useMentions({ triggers: [{ char: '@', options: short }], defaultValue: { text: '@Ada hi', tokens: [] }, onValueChange: onChange });
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...result.getTextareaProps()} />
        </Field.Root>
      );
    }
    render(<Uncontrolled />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(4, 4);
    fireEvent.select(el);
    act(() => result.select('ada'));
    expect(result.value.tokens).toEqual([ada]);
    expect(onChange).toHaveBeenCalledWith({ text: '@Ada hi', tokens: [ada] });
  });

  it('opens a new draft from outside without the last draft\'s dismissal', () => {
    let result!: UseMentionsResult;
    render(<Harness initial="yo @a" expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(5, 5);
    fireEvent.select(el);
    fireEvent.keyDown(el, { key: 'Escape' });
    expect(result.open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    el.focus();
    el.setSelectionRange(6, 6);
    fireEvent.select(el);
    expect(result.open).toBe(true);
  });

  it('opens again for a trigger typed over a selection that held the dismissed one', () => {
    let result!: UseMentionsResult;
    render(<Harness expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    fireEvent.keyDown(el, { key: 'Escape' });
    el.setSelectionRange(0, 2);
    el.dispatchEvent(new Event('beforeinput'));
    type(el, '@');
    expect(result.open).toBe(true);
  });

  it('opens for a textarea focused before the page hydrates', () => {
    let result!: UseMentionsResult;
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = renderToString(<Harness />);
    const el = container.querySelector('textarea')!;
    el.focus();
    let root!: ReturnType<typeof hydrateRoot>;
    act(() => {
      root = hydrateRoot(container, <Harness expose={(r) => (result = r)} />);
    });
    try {
      fireEvent.change(el, { target: { value: '@a', selectionStart: 2, selectionEnd: 2 } });
      expect(result.open).toBe(true);
    } finally {
      act(() => root.unmount());
      container.remove();
    }
  });

  it('keeps a dismissal through a later pick after a beforeinput that changed nothing', () => {
    let result!: UseMentionsResult;
    render(<Harness initial="@a @l" expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(2, 2);
    fireEvent.select(el);
    fireEvent.keyDown(el, { key: 'Escape' });
    el.setSelectionRange(0, 2);
    el.dispatchEvent(new Event('beforeinput'));
    el.setSelectionRange(5, 5);
    fireEvent.select(el);
    act(() => result.select('ada'));
    el.setSelectionRange(2, 2);
    fireEvent.select(el);
    expect(result.open).toBe(false);
  });

  it('opens no list while a rejected pick waits, and again after a key', () => {
    let result!: UseMentionsResult;
    render(<Harness initial="@al @gr" accept={() => false} expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(3, 3);
    fireEvent.select(el);
    act(() => result.select('alan'));
    el.setSelectionRange(7, 7);
    fireEvent.select(el);
    expect(result.open).toBe(false);
    fireEvent.keyDown(el, { key: 'ArrowRight' });
    fireEvent.select(el);
    expect(result.open).toBe(true);
  });

  it('keeps waiting for a later commit through a key that moves nothing, then places the caret', async () => {
    let result!: UseMentionsResult;
    render(<Harness initial="@ad hi @zz" commit="timeout" expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(3, 3);
    fireEvent.select(el);
    act(() => result.select('ada'));
    fireEvent.keyDown(el, { key: 'Shift', shiftKey: true });
    await tick();
    expect(el.value).toBe('@Ada Lovelace hi @zz');
    expect(el.selectionStart).toBe(13);
    expect(result.open).toBe(false);
  });

  it('ends the wait for a rejected pick when the product puts in another text', () => {
    let result!: UseMentionsResult;
    render(<Harness initial="@al" accept={() => false} expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(3, 3);
    fireEvent.select(el);
    act(() => result.select('alan'));
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    el.focus();
    el.setSelectionRange(6, 6);
    fireEvent.select(el);
    expect(result.open).toBe(true);
  });

  it('ends the wait for a rejected pick on a primary press, not another button', () => {
    let result!: UseMentionsResult;
    render(<Harness initial="@al @gr" accept={() => false} expose={(r) => (result = r)} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    el.focus();
    el.setSelectionRange(3, 3);
    fireEvent.select(el);
    act(() => result.select('alan'));
    el.setSelectionRange(7, 7);
    fireEvent.pointerDown(el, { button: 2 });
    fireEvent.select(el);
    expect(result.open).toBe(false);
    fireEvent.pointerDown(el, { button: 0 });
    fireEvent.select(el);
    expect(result.open).toBe(true);
  });

  it('does not count a focused textarea in a window without focus', () => {
    const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    let result!: UseMentionsResult;
    const container = document.createElement('div');
    document.body.append(container);
    container.innerHTML = renderToString(<Harness />);
    const el = container.querySelector('textarea')!;
    el.focus();
    let root!: ReturnType<typeof hydrateRoot>;
    act(() => {
      root = hydrateRoot(container, <Harness expose={(r) => (result = r)} />);
    });
    try {
      fireEvent.change(el, { target: { value: '@a', selectionStart: 2, selectionEnd: 2 } });
      expect(result.open).toBe(false);
    } finally {
      act(() => root.unmount());
      container.remove();
      hasFocus.mockRestore();
    }
  });
});
