import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../components/Field';
import { useMentions, type MentionToken, type MentionTrigger, type UseMentionsResult } from './useMentions';

afterEach(cleanup);

const people = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'alan', label: 'Alan Turing' },
];

function Harness({
  triggers = [{ char: '@', options: people }],
  initial = '',
  tokens,
  maxLength,
  onTokens,
  expose,
}: {
  triggers?: MentionTrigger[];
  initial?: string;
  tokens?: MentionToken[];
  maxLength?: number;
  onTokens?: (tokens: MentionToken[]) => void;
  expose?: (result: UseMentionsResult) => void;
}) {
  const [value, setValue] = useState(initial);
  const mentions = useMentions({
    triggers,
    value,
    onValueChange: setValue,
    defaultTokens: tokens,
    onTokensChange: onTokens,
    maxLength,
  });
  expose?.(mentions);
  return (
    <>
      <Field.Root aria-label="Message">
        <Field.Textarea {...mentions.getTextareaProps()} maxLength={maxLength} />
      </Field.Root>
      <button type="button" onClick={() => setValue('')}>
        Clear
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
    const onTokens = vi.fn();
    render(<Harness expose={(r) => (result = r)} onTokens={onTokens} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, 'hi @al');
    act(() => result.select('alan'));
    expect(el.value).toBe('hi @Alan Turing ');
    expect(onTokens).toHaveBeenLastCalledWith([{ start: 3, end: 15, char: '@', value: 'alan', text: '@Alan Turing' }]);
    expect(result.open).toBe(false);
  });

  it('drops tokens when the product clears the text', () => {
    let result!: UseMentionsResult;
    const onTokens = vi.fn();
    const token = { start: 0, end: 4, char: '@', value: 'ada', text: '@Ada' };
    render(<Harness initial="@Ada hi" tokens={[token]} onTokens={onTokens} expose={(r) => (result = r)} />);
    expect(result.tokens).toEqual([token]);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(result.tokens).toEqual([]);
    expect(onTokens).toHaveBeenLastCalledWith([]);
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

  it('loads a draft passed as value and tokens together', () => {
    let result!: UseMentionsResult;
    const ada = { start: 3, end: 7, char: '@', value: 'ada', text: '@Ada' };
    const bob = { start: 3, end: 7, char: '@', value: 'bob', text: '@Bob' };
    function Drafts() {
      const [draft, setDraft] = useState<{ value: string; tokens: MentionToken[] }>({ value: 'hi @Ada', tokens: [ada] });
      const mentions = useMentions({
        triggers: [{ char: '@', options: people }],
        value: draft.value,
        onValueChange: (value) => setDraft((current) => ({ ...current, value })),
        tokens: draft.tokens,
        onTokensChange: (tokens) => setDraft((current) => ({ ...current, tokens })),
      });
      result = mentions;
      return (
        <button type="button" onClick={() => setDraft({ value: 'yo @Bob', tokens: [bob] })}>
          Load
        </button>
      );
    }
    render(<Drafts />);
    expect(result.tokens).toEqual([ada]);
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));
    expect(result.tokens).toEqual([bob]);
  });

  it('moves no tokens for an edit the product rejects', () => {
    let result!: UseMentionsResult;
    const onTokens = vi.fn();
    const ada = { start: 0, end: 4, char: '@', value: 'ada', text: '@Ada' };
    function Fixed() {
      const mentions = useMentions({ triggers: [{ char: '@', options: people }], value: '@Ada hi', defaultTokens: [ada], onTokensChange: onTokens });
      result = mentions;
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...mentions.getTextareaProps()} />
        </Field.Root>
      );
    }
    render(<Fixed />);
    type(screen.getByRole('textbox') as HTMLTextAreaElement, 'Z@Ada hi');
    expect(result.tokens).toEqual([ada]);
    expect(onTokens).not.toHaveBeenCalled();
  });

  it('drops starting tokens that do not match the text, and typing their text does not bring them back', () => {
    let result!: UseMentionsResult;
    const onTokens = vi.fn();
    render(<Harness tokens={[{ start: 0, end: 4, char: '@', value: 'ada', text: '@Ada' }]} onTokens={onTokens} expose={(r) => (result = r)} />);
    expect(result.tokens).toEqual([]);
    expect(onTokens).toHaveBeenCalledWith([]);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    type(el, '@Ada');
    expect(result.tokens).toEqual([]);
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
      const mentions = useMentions({ triggers: [{ char: '@', options: people }], defaultValue: '@a' });
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

  it('leaves Enter alone during an IME composition', () => {
    render(<Harness />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    expect(fireEvent.keyDown(el, { key: 'Enter', keyCode: 229 })).toBe(true);
  });
});
