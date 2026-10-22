/// <reference types="@vitest/browser/providers/playwright" />
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, Label } from '../index.js';

afterEach(cleanup);

function Code({ initial = '', onValueChange }: { initial?: string; onValueChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <main data-appearance="light" data-density="comfortable">
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

  it('stops at its length', async () => {
    render(<Code />);
    await userEvent.click(input());
    await userEvent.keyboard('12345678');
    expect(input().value).toBe('123456');
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
});
