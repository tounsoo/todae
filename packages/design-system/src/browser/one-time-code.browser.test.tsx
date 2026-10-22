/// <reference types="@vitest/browser/providers/playwright" />
import { cleanup, render, screen } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { useState, type CSSProperties } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage, Field, Form, Label } from '../index.js';

afterEach(cleanup);

function Code({ initial = '', onValueChange, style }: { initial?: string; onValueChange?: (value: string) => void; style?: CSSProperties }) {
  const [value, setValue] = useState(initial);
  return (
    <main data-appearance="light" data-density="comfortable" style={style}>
      <Field.Group>
        <Label.Root htmlFor="code">Verification code</Label.Root>
        <Field.Root id="code" name="code">
          <Field.OneTimeCode
            value={value}
            onValueChange={(next) => {
              setValue(next);
              onValueChange?.(next);
            }}
          />
        </Field.Root>
      </Field.Group>
    </main>
  );
}

const input = () => screen.getByLabelText<HTMLInputElement>('Verification code');
const boxes = () => [...input().nextElementSibling!.children] as HTMLElement[];
const session = () => cdp() as unknown as { send(method: string, params: object): Promise<unknown> };
const boxPosition = (i: number) => {
  const rect = boxes()[i]!.getBoundingClientRect();
  return { x: rect.left + rect.width / 2 - input().getBoundingClientRect().left, y: rect.height / 2 };
};
// The default theme draws the hover border as the resting one, so the tests give it a color to see.
const hoverBorder = { '--todae-field-border-hover': 'rgb(255, 0, 0)' } as CSSProperties;
const active = () => boxes().flatMap((box, i) => (box.hasAttribute('data-active') ? [i] : []));

// Copies from a scratch field and pastes with the keyboard, so the browser sends a real paste.
async function paste(text: string) {
  const scratch = document.createElement('input');
  scratch.value = text;
  document.body.append(scratch);
  const target = document.activeElement as HTMLElement;
  scratch.focus();
  scratch.select();
  await userEvent.keyboard('{Control>}c{/Control}');
  scratch.remove();
  target.focus();
  await userEvent.keyboard('{Control>}v{/Control}');
}

describe('Field.OneTimeCode in a browser', () => {
  it('keeps digits as they are typed and drops anything else', async () => {
    render(<Code />);
    await userEvent.click(input());
    await userEvent.keyboard('12a-3 4');
    expect(input().value).toBe('1234');
    await userEvent.keyboard('{Backspace}');
    expect(input().value).toBe('123');
  });

  it('stops at its length, typing the rest over the last box', async () => {
    render(<Code />);
    await userEvent.click(input());
    await userEvent.keyboard('12345678');
    expect(input().value).toBe('123458');
  });

  it('keeps the digits of a pasted message', async () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    await userEvent.click(input());
    await paste('Your code: 482-913');
    expect(input().value).toBe('482913');
    expect(onValueChange).toHaveBeenLastCalledWith('482913');
  });

  it('replaces what is typed with a pasted full code', async () => {
    render(<Code initial="12" />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await paste('123 456');
    expect(input().value).toBe('123456');
  });

  it('marks the box at the caret, and the empty box that waits for the next character', async () => {
    render(<Code initial="123" />);
    expect(active()).toEqual([]);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    expect(active()).toEqual([3]);
    expect(boxes()[3]?.hasAttribute('data-caret')).toBe(true);
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toEqual([2]);
    expect(boxes()[2]?.hasAttribute('data-caret')).toBe(false);
  });

  it('selects the character of the box that is pressed, so typing replaces it', async () => {
    render(<Code initial="123456" />);
    const box = boxes()[2]!.getBoundingClientRect();
    await userEvent.click(input(), { position: { x: box.left + box.width / 2 - input().getBoundingClientRect().left, y: box.height / 2 } });
    expect(active()).toEqual([2]);
    await userEvent.keyboard('9');
    expect(input().value).toBe('129456');
  });

  it('puts the caret after the code when a box past it is pressed', async () => {
    render(<Code initial="12" />);
    const box = boxes()[5]!.getBoundingClientRect();
    await userEvent.click(input(), { position: { x: box.left + box.width / 2 - input().getBoundingClientRect().left, y: box.height / 2 } });
    expect(active()).toEqual([2]);
    await userEvent.keyboard('3');
    expect(input().value).toBe('123');
  });

  it('draws the focus ring on the active box alone, not around the field', async () => {
    render(<Code initial="12" />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    const shell = input().closest('div')!;
    expect(getComputedStyle(shell).outlineStyle).toBe('none');
    expect(boxes().map((box) => getComputedStyle(box).outlineStyle !== 'none')).toEqual([false, false, true, false, false, false]);
  });

  it('draws every box at its full size, side by side', () => {
    render(<Code />);
    const rects = boxes().map((box) => box.getBoundingClientRect());
    expect(rects.every((rect) => rect.width > 20 && rect.height > 20)).toBe(true);
    expect(rects[1]!.left).toBeGreaterThan(rects[0]!.right);
  });

  it('shrinks its boxes to fit a narrow container', () => {
    render(
      <div style={{ inlineSize: '200px' }}>
        <Code />
      </div>,
    );
    const last = boxes()[5]!.getBoundingClientRect();
    const container = input().closest('main')!.parentElement!.getBoundingClientRect();
    expect(last.right).toBeLessThanOrEqual(container.right + 0.5);
    expect(last.width).toBeGreaterThan(10);
  });

  it('draws a box for every character the code has', () => {
    render(<Code initial="12" />);
    expect(boxes().map((box) => box.textContent)).toEqual(['1', '2', '', '', '', '']);
  });

  it('treats a keyboard\'s multi-character insert as a paste', async () => {
    render(<Code initial="12" />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await session().send('Input.insertText', { text: '123456' });
    expect(input().value).toBe('123456');
    await userEvent.keyboard('{Control>}a{/Control}');
    await session().send('Input.insertText', { text: '482-913' });
    expect(input().value).toBe('482913');
  });

  it('keeps the selection when a paste has no character the code allows', async () => {
    render(<Code initial="1234" />);
    await userEvent.click(input());
    input().setSelectionRange(1, 3);
    await paste('abc');
    expect(input().value).toBe('1234');
    expect(input().selectionStart).toBe(1);
    expect(input().selectionEnd).toBe(3);
  });

  it('replaces the box at the caret when a character is typed into a full code', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}9');
    expect(input().value).toBe('129456');
    expect(active()).toEqual([3]);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(input().value).toBe('123456');
  });

  it('replaces the last box when a digit is typed with the caret after a full code', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    expect(active()).toEqual([5]);
    await userEvent.keyboard('9');
    expect(input().value).toBe('123459');
  });

  it('replaces the characters from the caret with a short paste on a full code', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await paste('78');
    expect(input().value).toBe('178456');
  });

  it('treats a dropped text as a paste, whatever surrounds the code', async () => {
    render(<Code />);
    const rect = input().getBoundingClientRect();
    const data = { items: [{ mimeType: 'text/plain', data: 'Your code: 482-913' }], dragOperationsMask: 1 };
    const at = { x: rect.left + 5, y: rect.top + rect.height / 2 };
    for (const type of ['dragEnter', 'dragOver', 'drop']) await session().send('Input.dispatchDragEvent', { type, ...at, data });
    await vi.waitFor(() => expect(input().value).toBe('482913'));
  });

  it('warns of nothing when it takes focus as it mounts', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(
        <main data-appearance="light" data-density="comfortable">
          <Field.Root aria-label="Verification code">
            <Field.OneTimeCode autoFocus value="12" onValueChange={() => undefined} />
          </Field.Root>
        </main>,
      );
      expect(document.activeElement).toBe(input());
      expect(errors).not.toHaveBeenCalled();
    } finally {
      errors.mockRestore();
    }
  });

  it('marks the active box inside a shadow root', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = host.attachShadow({ mode: 'open' });
    const mount = document.createElement('div');
    root.append(mount);
    const view = render(
      <main data-appearance="light" data-density="comfortable">
        <Field.Root aria-label="Verification code">
          <Field.OneTimeCode value="123456" onValueChange={() => undefined} />
        </Field.Root>
      </main>,
      { container: mount },
    );
    const inner = mount.querySelector('input')!;
    inner.focus();
    inner.setSelectionRange(2, 2);
    document.dispatchEvent(new Event('selectionchange'));
    await vi.waitFor(() => expect(inner.nextElementSibling!.querySelectorAll('[data-active]')).toHaveLength(1));
    view.unmount();
    host.remove();
  });

  it('leaves a selection a Shift+click made', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input(), { position: boxPosition(1) });
    await userEvent.click(input(), { position: boxPosition(4), modifiers: ['Shift'] });
    expect(input().selectionStart).toBe(1);
    expect(input().selectionEnd).toBeGreaterThan(2);
    expect(active().length).toBeGreaterThan(1);
  });

  it('leaves the caret where it is when its label is clicked', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input());
    input().setSelectionRange(1, 1);
    await userEvent.click(screen.getByText('Verification code'));
    expect([input().selectionStart, input().selectionEnd]).toEqual([1, 1]);
  });

  it('shows no caret and no hover border on a read-only code', async () => {
    render(
      <main data-appearance="light" data-density="comfortable" style={hoverBorder}>
        <Field.Root aria-label="Verification code">
          <Field.OneTimeCode value="12" readOnly />
        </Field.Root>
      </main>,
    );
    const first = boxes()[0]!;
    const resting = getComputedStyle(first).borderColor;
    await userEvent.hover(input());
    expect(getComputedStyle(first).borderColor).toBe(resting);
    input().focus();
    input().setSelectionRange(2, 2);
    await userEvent.keyboard('{End}');
    expect(getComputedStyle(boxes()[2]!, '::after').display).toBe('none');
  });

  it('changes the border of the boxes while the pointer is over an editable code', async () => {
    render(<Code style={hoverBorder} />);
    const first = boxes()[0]!;
    const resting = getComputedStyle(first).borderColor;
    await userEvent.hover(input());
    expect(getComputedStyle(first).borderColor).not.toBe(resting);
  });

  it('blocks a submit of a short code that a cleaned paste left, and words it', async () => {
    function Recovery() {
      const [value, setValue] = useState('');
      return (
        <main data-appearance="light" data-density="comfortable">
          <Form.Root onSubmit={(event) => event.preventDefault()}>
            <Field.Group>
              <Label.Root htmlFor="code">Verification code</Label.Root>
              <Field.Root id="code" name="code">
                <Field.OneTimeCode value={value} onValueChange={setValue} />
              </Field.Root>
              <ErrorMessage.Root />
            </Field.Group>
            <button type="submit">Verify</button>
          </Form.Root>
        </main>
      );
    }
    render(<Recovery />);
    await userEvent.click(input());
    await paste('12 3');
    expect(input().value).toBe('123');
    await userEvent.click(screen.getByRole('button', { name: 'Verify' }));
    expect(await screen.findByText('Use at least 6 characters')).toBeTruthy();
  });

  it('keeps the caret and fires onChange where the browser inserts nothing', async () => {
    const onChange = vi.fn();
    function Plain() {
      const [value, setValue] = useState('19');
      return (
        <Field.Root aria-label="Verification code">
          <Field.OneTimeCode
            value={value}
            onChange={(event) => {
              onChange();
              setValue(event.target.value);
            }}
          />
        </Field.Root>
      );
    }
    render(<Plain />);
    input().focus();
    input().setSelectionRange(1, 1);
    const execCommand = vi.spyOn(document, 'execCommand').mockReturnValue(false);
    await paste('2 3');
    execCommand.mockRestore();
    expect(input().value).toBe('1239');
    expect(onChange).toHaveBeenCalled();
    expect(input().selectionStart).toBe(3);
  });
});
