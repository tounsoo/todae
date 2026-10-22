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
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    expect(beforeInput('insertText', 'a').defaultPrevented).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    beforeInput('insertText', '7');
    expect(onValueChange).toHaveBeenLastCalledWith('7');
  });

  it('accepts letters in an alphanumeric code but not a symbol', () => {
    const onValueChange = vi.fn();
    render(<Code characters="alphanumeric" onValueChange={onValueChange} />);
    beforeInput('insertText', 'k');
    expect(onValueChange).toHaveBeenLastCalledWith('k');
    beforeInput('insertText', '-');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('takes full-width digits as the digits they are, typed or pasted', () => {
    const onValueChange = vi.fn();
    render(<Code initial="12" onValueChange={onValueChange} />);
    input().setSelectionRange(2, 2);
    beforeInput('insertText', '３');
    expect(onValueChange).toHaveBeenLastCalledWith('123');
    beforeInput('insertFromPaste', '４８２９１３');
    expect(onValueChange).toHaveBeenLastCalledWith('482913');
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

  it('puts a clean partial paste in itself, where it chose', () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    expect(beforeInput('insertFromPaste', '123').defaultPrevented).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith('123');
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

  it('treats a drop that left no box as a paste at the caret', () => {
    const onValueChange = vi.fn();
    render(<Code initial="19" onValueChange={onValueChange} />);
    input().setSelectionRange(1, 1);
    expect(beforeInput('insertFromDrop', 'Your 2-3').defaultPrevented).toBe(true);
    expect(onValueChange).toHaveBeenLastCalledWith('1239');
  });

  it('replaces the value with a dropped full code, whatever surrounds it', () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    beforeInput('insertFromDrop', 'Your code: 482-913');
    expect(onValueChange).toHaveBeenLastCalledWith('482913');
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

  it('refuses a character typed with the caret after a full code', () => {
    const onValueChange = vi.fn();
    render(<Code initial="123456" onValueChange={onValueChange} />);
    input().focus();
    input().setSelectionRange(6, 6);
    expect(beforeInput('insertText', '9').defaultPrevented).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('replaces the characters from the caret when a short paste lands on a full code', () => {
    const onValueChange = vi.fn();
    render(<Code initial="123456" onValueChange={onValueChange} />);
    input().focus();
    input().setSelectionRange(2, 2);
    beforeInput('insertFromPaste', '78');
    expect(onValueChange).toHaveBeenLastCalledWith('127856');
  });

  it('refuses a short paste with the caret after a full code, but a whole code still replaces it', () => {
    const onValueChange = vi.fn();
    render(<Code initial="123456" onValueChange={onValueChange} />);
    input().focus();
    input().setSelectionRange(6, 6);
    expect(beforeInput('insertFromPaste', '78').defaultPrevented).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    beforeInput('insertFromPaste', '654321');
    expect(onValueChange).toHaveBeenLastCalledWith('654321');
  });

  it('shows the focus on the row of boxes, and in no box, while the caret is after a full code', () => {
    const { container } = render(<Code initial="123456" />);
    const row = container.querySelector('[aria-hidden="true"]')!;
    const active = () => [...row.children].filter((box) => box.hasAttribute('data-active')).length;
    expect(row.hasAttribute('data-active')).toBe(false);
    input().focus();
    input().setSelectionRange(3, 3);
    fireEvent.focus(input());
    expect([row.hasAttribute('data-active'), active()]).toEqual([false, 1]);
    input().setSelectionRange(6, 6);
    fireEvent.focus(input());
    expect([row.hasAttribute('data-active'), active()]).toEqual([true, 0]);
  });

  it('does not loop when the browser fires beforeinput for its own insert command', () => {
    const onValueChange = vi.fn();
    render(<Code initial="12" onValueChange={onValueChange} />);
    const execCommand = vi.fn((_command: string, _ui: boolean, text?: string) => {
      beforeInput('insertText', text ?? '');
      return true;
    });
    Object.assign(document, { execCommand });
    try {
      input().focus();
      beforeInput('insertFromPaste', '123456');
      expect(execCommand).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(document, 'execCommand');
    }
  });

  it('puts style and className on the element that draws the boxes, not on the input', () => {
    render(<Code className="mine" style={{ color: 'rgb(1, 2, 3)' }} />);
    const wrapper = input().parentElement!;
    expect(wrapper.classList.contains('mine')).toBe(true);
    expect(wrapper.style.color).toBe('rgb(1, 2, 3)');
    expect(input().classList.contains('mine')).toBe(false);
    expect(input().style.color).toBe('');
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

  it('writes a paste that needs room over what follows, and moves nothing out, where the browser has no insert command', () => {
    const onValueChange = vi.fn();
    render(<Code initial="12345" onValueChange={onValueChange} />);
    input().setSelectionRange(1, 1);
    beforeInput('insertFromPaste', '7 8');
    expect(onValueChange).toHaveBeenLastCalledWith('178345');
  });

  it('cuts a short paste at the end of a partial code to the room left', () => {
    const onValueChange = vi.fn();
    render(<Code initial="12345" onValueChange={onValueChange} />);
    input().setSelectionRange(5, 5);
    beforeInput('insertFromPaste', '78');
    expect(onValueChange).toHaveBeenLastCalledWith('123457');
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
