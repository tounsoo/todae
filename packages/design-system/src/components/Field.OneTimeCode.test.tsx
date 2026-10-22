import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, Label } from '../index.js';
import type { FieldOneTimeCodeProps } from '../index.js';

afterEach(cleanup);

function Code({ initial = '', disabled, ...props }: { initial?: string; disabled?: boolean } & Partial<FieldOneTimeCodeProps>) {
  const [value, setValue] = useState(initial);
  return (
    <Field.Group>
      <Label.Root htmlFor="code">Verification code</Label.Root>
      <Field.Root id="code" name="code" disabled={disabled}>
        <Field.OneTimeCode value={value} onValueChange={setValue} {...props} />
      </Field.Root>
    </Field.Group>
  );
}

const input = () => screen.getByLabelText<HTMLInputElement>('Verification code');

function beforeInput(inputType: string, data: string) {
  const event = new InputEvent('beforeinput', { inputType, data, bubbles: true, cancelable: true });
  fireEvent(input(), event);
  return event;
}

describe('Field.OneTimeCode', () => {
  it('is one text input the phone can fill from a message, named by its label', () => {
    render(<Code />);
    expect(input().type).toBe('text');
    expect(input().autocomplete).toBe('one-time-code');
    expect(input().getAttribute('inputmode')).toBe('numeric');
    expect(input().maxLength).toBe(6);
    expect(input().minLength).toBe(6);
    expect(input().pattern).toBe('[0-9]*');
    expect(input().getAttribute('spellcheck')).toBe('false');
    expect(input().dir).toBe('ltr');
    expect(input().name).toBe('code');
  });

  it('takes its length and characters from props', () => {
    render(<Code length={4} characters="alphanumeric" />);
    expect(input().getAttribute('inputmode')).toBe('text');
    expect(input().maxLength).toBe(4);
    expect(input().minLength).toBe(4);
    expect(input().pattern).toBe('[A-Za-z0-9]*');
  });

  it('lets a product change the autocomplete hint', () => {
    render(<Code autoComplete="off" />);
    expect(input().autocomplete).toBe('off');
  });

  it('draws one box per character, hidden from assistive technology, and shows the code in them', () => {
    const { container } = render(<Code length={4} initial="12" />);
    const boxes = container.querySelector('[aria-hidden="true"]');
    expect([...boxes!.children].map((box) => box.textContent)).toEqual(['1', '2', '', '']);
  });

  it('shows the caret in the first empty box and the active box while it has focus', () => {
    const { container } = render(<Code length={4} initial="12" />);
    const boxes = () => [...container.querySelector('[aria-hidden="true"]')!.children];
    expect(boxes().some((box) => box.hasAttribute('data-active'))).toBe(false);
    input().focus();
    input().setSelectionRange(2, 2);
    fireEvent.focus(input());
    expect(boxes().map((box) => box.hasAttribute('data-caret'))).toEqual([false, false, true, false]);
    expect(boxes().map((box) => box.hasAttribute('data-active'))).toEqual([false, false, true, false]);
  });

  it('refuses a letter typed into a digits code and lets a digit in', () => {
    render(<Code />);
    expect(beforeInput('insertText', 'a').defaultPrevented).toBe(true);
    expect(beforeInput('insertText', '7').defaultPrevented).toBe(false);
  });

  it('accepts letters in an alphanumeric code but not a symbol', () => {
    render(<Code characters="alphanumeric" />);
    expect(beforeInput('insertText', 'k').defaultPrevented).toBe(false);
    expect(beforeInput('insertText', '-').defaultPrevented).toBe(true);
  });

  it('leaves a deletion and an IME composition alone', () => {
    render(<Code initial="12" />);
    expect(beforeInput('deleteContentBackward', '').defaultPrevented).toBe(false);
    expect(beforeInput('insertCompositionText', 'ㅎ').defaultPrevented).toBe(false);
  });

  it('keeps only the allowed characters of a paste', () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    expect(beforeInput('insertFromPaste', 'Your code: 482-913').defaultPrevented).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith('482913');
  });

  it('replaces the whole value with a pasted full code', () => {
    const onValueChange = vi.fn();
    render(<Code initial="12" onValueChange={onValueChange} />);
    input().setSelectionRange(2, 2);
    beforeInput('insertFromPaste', '123456');
    expect(onValueChange).toHaveBeenLastCalledWith('123456');
  });

  it('inserts a cleaned partial paste at the caret', () => {
    const onValueChange = vi.fn();
    render(<Code initial="19" onValueChange={onValueChange} />);
    input().setSelectionRange(1, 1);
    beforeInput('insertFromPaste', '2 3');
    expect(onValueChange).toHaveBeenLastCalledWith('1239');
  });

  it('leaves a clean partial paste to the browser', () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    expect(beforeInput('insertFromPaste', '123').defaultPrevented).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('cleans a value that arrives by change, such as autofill', () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    fireEvent.change(input(), { target: { value: '12 34-56 78' } });
    expect(onValueChange).toHaveBeenLastCalledWith('123456');
  });

  it('is read-only without a change handler', () => {
    render(
      <Field.Root aria-label="Code">
        <Field.OneTimeCode value="123" />
      </Field.Root>,
    );
    expect(screen.getByLabelText<HTMLInputElement>('Code').readOnly).toBe(true);
  });

  it('is disabled by its Field.Root', () => {
    render(<Code disabled />);
    expect(input().disabled).toBe(true);
  });
});
