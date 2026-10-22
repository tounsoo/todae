import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage, Field, Form, Label } from '../index.js';
import { mount, submit } from '../test/form.js';
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
    expect(input().minLength).toBe(-1);
    expect(input().pattern).toBe('[0-9]*');
    expect(input().getAttribute('spellcheck')).toBe('false');
    expect(input().dir).toBe('ltr');
    expect(input().name).toBe('code');
  });

  it('takes its length and characters from props', () => {
    render(<Code length={4} characters="alphanumeric" />);
    expect(input().getAttribute('inputmode')).toBe('text');
    expect(input().maxLength).toBe(4);
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

  it('treats a multi-character insert like a paste', () => {
    const onValueChange = vi.fn();
    render(<Code initial="12" onValueChange={onValueChange} />);
    input().setSelectionRange(2, 2);
    expect(beforeInput('insertText', '123456').defaultPrevented).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith('123456');
    expect(beforeInput('insertText', '482-913').defaultPrevented).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith('482913');
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

  it('does nothing for a paste with no allowed character, and keeps the selection', () => {
    const onValueChange = vi.fn();
    render(<Code initial="1234" onValueChange={onValueChange} />);
    input().setSelectionRange(1, 3);
    expect(beforeInput('insertFromPaste', 'abc').defaultPrevented).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(input().value).toBe('1234');
    expect(input().selectionStart).toBe(1);
    expect(input().selectionEnd).toBe(3);
  });

  it('leaves a drop to the browser', () => {
    render(<Code initial="12" />);
    expect(beforeInput('insertFromDrop', 'Your code: 482').defaultPrevented).toBe(false);
  });

  it('replaces the box at the caret when a character is typed into a full code', () => {
    render(<Code initial="123456" />);
    input().focus();
    input().setSelectionRange(2, 2);
    expect(beforeInput('insertText', '9').defaultPrevented).toBe(true);
    expect(input().value).toBe('129456');
    expect(input().selectionStart).toBe(3);
    expect(input().selectionEnd).toBe(3);
  });

  it('leaves a character typed at the end of a full code to the length limit', () => {
    render(<Code initial="123456" />);
    input().setSelectionRange(6, 6);
    expect(beforeInput('insertText', '9').defaultPrevented).toBe(false);
  });

  it('reaches onChange, and puts the caret after the paste, where the browser has no insert command', () => {
    const onChange = vi.fn();
    render(<Code initial="19" onChange={onChange} />);
    const code = input();
    code.setSelectionRange(1, 1);
    fireEvent(code, new InputEvent('beforeinput', { inputType: 'insertFromPaste', data: '2 3', bubbles: true, cancelable: true }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(code.value).toBe('1239');
    expect(code.selectionStart).toBe(3);
  });

  it('keeps what fits of a paste where the browser has no insert command', () => {
    const onValueChange = vi.fn();
    render(<Code initial="12345" onValueChange={onValueChange} />);
    input().setSelectionRange(1, 1);
    beforeInput('insertFromPaste', '7 8');
    expect(onValueChange).toHaveBeenLastCalledWith('172345');
  });

  it('cleans a value that arrives by change, such as autofill', () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    fireEvent.change(input(), { target: { value: '12 34-56 78' } });
    expect(onValueChange).toHaveBeenLastCalledWith('123456');
  });

  it('does not select a box for a click that is not a press', () => {
    render(<Code initial="123456" />);
    input().focus();
    input().setSelectionRange(6, 6);
    fireEvent.click(input(), { detail: 0 });
    expect(input().selectionStart).toBe(6);
    expect(input().selectionEnd).toBe(6);
  });

  it('keeps a range a drag or a Shift+click selected', () => {
    render(<Code initial="123456" />);
    input().focus();
    input().setSelectionRange(1, 4);
    fireEvent.click(input(), { detail: 1, clientX: 0 });
    expect(input().selectionStart).toBe(1);
    expect(input().selectionEnd).toBe(4);
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

  it('blocks a submit of a code that is too short, even when a script set it, and words it in the page\'s language', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Field.Group>
          <Label.Root htmlFor="code">Verification code</Label.Root>
          <Field.Root id="code" name="code">
            <Field.OneTimeCode value="48" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Use at least 6 characters')).toBeTruthy();
    expect(document.activeElement).toBe(input());
  });

  it('lets a complete code, and an empty optional one, submit', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    for (const value of ['482913', '']) {
      cleanup();
      await mount(
        <Form.Root data-testid="form" onSubmit={onSubmit}>
          <Field.Root id="code" name="code" aria-label="Verification code">
            <Field.OneTimeCode value={value} onValueChange={() => undefined} />
          </Field.Root>
        </Form.Root>,
      );
      await submit(screen.getByTestId('form'));
    }
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});
