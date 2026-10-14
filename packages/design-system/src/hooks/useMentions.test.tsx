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

  it('leaves Enter alone during an IME composition', () => {
    render(<Harness />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.focus(el);
    type(el, '@a');
    expect(fireEvent.keyDown(el, { key: 'Enter', keyCode: 229 })).toBe(true);
  });
});
