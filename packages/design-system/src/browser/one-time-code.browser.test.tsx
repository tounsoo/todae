/// <reference types="@vitest/browser/providers/playwright" />
import { act, cleanup, render, screen } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { useEffect, useState, type ClipboardEvent, type CSSProperties, type DragEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage, Field, Form, Label } from '../index.js';

afterEach(cleanup);

function Code({
  initial = '',
  onValueChange,
  style,
  characters,
  dir,
  onDrop,
  onPaste,
}: {
  initial?: string;
  onValueChange?: (value: string) => void;
  style?: CSSProperties;
  characters?: 'digits' | 'alphanumeric';
  dir?: 'ltr' | 'rtl';
  onDrop?: (event: DragEvent<HTMLInputElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <main data-appearance="light" data-density="comfortable" style={style} dir={dir}>
      <Field.Group>
        <Label.Root htmlFor="code">Verification code</Label.Root>
        <Field.Root id="code" name="code">
          <Field.OneTimeCode
            value={value}
            characters={characters}
            onDrop={onDrop}
            onPaste={onPaste}
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

// An IME composition through the browser's own IME path: each step's text, then the commit, or a cancel without one.
async function compose(steps: string[], commit: string | null = steps.at(-1)!) {
  for (const text of steps) await session().send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
  if (commit === null) await session().send('Input.imeSetComposition', { text: '', selectionStart: 0, selectionEnd: 0 });
  else await session().send('Input.insertText', { text: commit });
}

function ShadowCode() {
  const [value, setValue] = useState('123456');
  return <Field.OneTimeCode value={value} onValueChange={setValue} />;
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

  it('stops at its length, and nothing typed after a full code lands', async () => {
    const onValueChange = vi.fn();
    render(<Code onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('12345678');
    expect(input().value).toBe('123456');
    expect(onValueChange).toHaveBeenCalledTimes(6);
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

  it('selects the whole code on a double click', async () => {
    render(<Code initial="123456" />);
    await userEvent.dblClick(input(), { position: boxPosition(2) });
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 6]);
    expect(active()).toEqual([0, 1, 2, 3, 4, 5]);
    await paste('654321');
    expect(input().value).toBe('654321');
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

  it('spaces its boxes by the density, as the field spaces its parts', () => {
    const gap = (density: string) => {
      cleanup();
      render(
        <main data-appearance="light" data-density={density}>
          <Field.Root aria-label="Verification code">
            <Field.OneTimeCode value="" onValueChange={() => undefined} />
          </Field.Root>
        </main>,
      );
      return boxes()[1]!.getBoundingClientRect().left - boxes()[0]!.getBoundingClientRect().right;
    };
    expect(gap('compact')).toBeLessThan(gap('comfortable'));
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

  it('shows the focus on the row of boxes, in no box, with the caret after a full code', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    expect(active()).toEqual([]);
    const row = input().nextElementSibling!;
    expect(getComputedStyle(row).outlineStyle).not.toBe('none');
    expect(getComputedStyle(row).outlineColor).not.toBe('rgba(0, 0, 0, 0)');
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toEqual([5]);
    expect(getComputedStyle(row).outlineColor).toBe('rgba(0, 0, 0, 0)');
  });

  it('replaces the characters from the caret with a short paste on a full code', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await paste('78');
    expect(input().value).toBe('178456');
  });

  it('lands nothing when the product cancels the paste, in its onPaste or before it', async () => {
    const onValueChange = vi.fn();
    const cancel = (event: ClipboardEvent) => event.preventDefault();
    for (const view of [<Code initial="1234" onValueChange={onValueChange} onPaste={cancel} />, <div onPasteCapture={cancel}><Code initial="1234" onValueChange={onValueChange} /></div>]) {
      cleanup();
      render(view);
      await userEvent.click(input());
      await paste('56');
      expect(input().value).toBe('1234');
    }
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('treats a dropped text as a paste, whatever surrounds the code', async () => {
    render(<Code />);
    const rect = input().getBoundingClientRect();
    const data = { items: [{ mimeType: 'text/plain', data: 'Your code: 482-913' }], dragOperationsMask: 1 };
    const at = { x: rect.left + 5, y: rect.top + rect.height / 2 };
    for (const type of ['dragEnter', 'dragOver', 'drop']) await session().send('Input.dispatchDragEvent', { type, ...at, data });
    await vi.waitFor(() => expect(input().value).toBe('482913'));
  });

  // Drops a "9" on the middle of box `box`, or `x` pixels into the input, with the browser's own drag events.
  async function dropAt(box: number | { x: number }) {
    const rect = input().getBoundingClientRect();
    const data = { items: [{ mimeType: 'text/plain', data: '9' }], dragOperationsMask: 1 };
    // The test page sits in a scaled frame, and the drag events take the top page's coordinates.
    const frame = window.frameElement?.getBoundingClientRect();
    const scale = frame ? frame.width / window.innerWidth : 1;
    const at = {
      x: (frame?.left ?? 0) + (rect.left + (typeof box === 'number' ? boxPosition(box).x : box.x)) * scale,
      y: (frame?.top ?? 0) + (rect.top + rect.height / 2) * scale,
    };
    for (const type of ['dragEnter', 'dragOver', 'drop']) await session().send('Input.dispatchDragEvent', { type, ...at, data });
  }

  it('lands a drop at the box it is dropped on', async () => {
    const drop = dropAt;
    render(<Code initial="1234" />);
    await userEvent.click(input());
    await drop(1);
    await vi.waitFor(() => expect(input().value).toBe('19234'));
  });

  it('lands a drop past the code after its last character', async () => {
    render(<Code initial="1234" />);
    await dropAt(5);
    await vi.waitFor(() => expect(input().value).toBe('12349'));
  });

  it('lands nothing when the product cancels the drop, in its onDrop or before it', async () => {
    const onValueChange = vi.fn();
    const cancel = (event: DragEvent) => event.preventDefault();
    for (const view of [<Code initial="1234" onValueChange={onValueChange} onDrop={cancel} />, <div onDropCapture={cancel}><Code initial="1234" onValueChange={onValueChange} /></div>]) {
      cleanup();
      render(view);
      await dropAt(1);
      // A drop that landed would have reached onValueChange by the next frame.
      await new Promise(requestAnimationFrame);
      expect(input().value).toBe('1234');
    }
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('lands a drop on a full code over the box it is dropped on', async () => {
    render(<Code initial="123456" />);
    await dropAt(2);
    await vi.waitFor(() => expect(input().value).toBe('129456'));
  });

  it('applies a composition on a full code over the box at the caret when it ends, as one edit, and lands none after the code', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="ABC123" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await compose(['x']);
    await vi.waitFor(() => expect(input().value).toBe('AxC123'));
    expect(onValueChange.mock.calls).toEqual([['AxC123']]);
    expect(active()).toEqual([2]);
    await userEvent.keyboard('{End}');
    await compose(['y']);
    expect(input().value).toBe('AxC123');
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  it('shows a composition in the boxes, by the rule, while it is composed', async () => {
    render(<Code initial="ABC123" characters="alphanumeric" />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await session().send('Input.imeSetComposition', { text: 'x', selectionStart: 1, selectionEnd: 1 });
    await vi.waitFor(() => expect(boxes().map((box) => box.textContent).join('')).toBe('AxC123'));
    await session().send('Input.insertText', { text: 'x' });
    await vi.waitFor(() => expect(input().value).toBe('AxC123'));
  });

  it('leaves a full code as it was when a composition brings no character it allows', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="ABC123" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await compose(['ㅎ']);
    await vi.waitFor(() => expect([input().selectionStart, input().selectionEnd]).toEqual([1, 1]));
    expect(input().value).toBe('ABC123');
    expect(onValueChange).not.toHaveBeenCalled();
    await userEvent.keyboard('x');
    expect(input().value).toBe('AxC123');
  });

  it('leaves a partial code as it was when a composition brings no character it allows, and keeps the IME working while it composes', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="AB" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['ㅎ', '하']);
    await vi.waitFor(() => expect(input().value).toBe('AB'));
    expect(onValueChange).not.toHaveBeenCalled();
    await compose(['c', 'cd']);
    await vi.waitFor(() => expect(input().value).toBe('ABcd'));
    expect(onValueChange.mock.calls).toEqual([['ABc'], ['ABcd']]);
  });

  it('reports a composed text that is already a code as it is typed, as a phone keyboard composes a whole word', async () => {
    const onValueChange = vi.fn();
    render(<Code characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    for (const text of ['a', 'ab', 'abc', 'abcd', 'abcde', 'abcdef']) await session().send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
    // The full code too, before the composition ends, since it began on an empty code.
    await vi.waitFor(() => expect(onValueChange.mock.calls).toEqual([['a'], ['ab'], ['abc'], ['abcd'], ['abcde'], ['abcdef']]));
    await session().send('Input.insertText', { text: 'abcdef' });
    await vi.waitFor(() => expect(input().value).toBe('abcdef'));
    expect(onValueChange).toHaveBeenCalledTimes(6);
  });

  // A product that listens through onChange alone, through both, or that answers each report with an uppercased code.
  function Listening({ initial, mode, events }: { initial: string; mode: 'change' | 'both' | 'upper'; events: string[] }) {
    const [value, setValue] = useState(initial);
    return (
      <Field.Root aria-label="Verification code">
        <Field.OneTimeCode
          characters="alphanumeric"
          value={value}
          onChange={mode === 'upper' ? undefined : (event) => {
            events.push(`change:${event.target.value}`);
            if (mode === 'change') setValue(event.target.value);
          }}
          onValueChange={mode === 'change' ? undefined : (next) => {
            events.push(`value:${next}`);
            setValue(mode === 'upper' ? next.toUpperCase() : next);
          }}
        />
      </Field.Root>
    );
  }

  it.each(['change', 'both'] as const)('reports a full code a composition makes on a code that was not empty, to a product with %s', async (mode) => {
    const events: string[] = [];
    render(<Listening initial="ABC12" mode={mode} events={events} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['x']);
    await vi.waitFor(() => expect(input().value).toBe('ABC12x'));
    expect(events.at(-1)).toBe(mode === 'change' ? 'change:ABC12x' : 'value:ABC12x');
    if (mode === 'both') expect(events).toContain('change:ABC12x');
  });

  it.each(['change', 'both'] as const)('reports a composition that overwrites a box of a full code, to a product with %s', async (mode) => {
    const events: string[] = [];
    render(<Listening initial="ABC123" mode={mode} events={events} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await compose(['x']);
    await vi.waitFor(() => expect(input().value).toBe('AxC123'));
    expect(events).toContain('change:AxC123');
    if (mode === 'both') expect(events).toContain('value:AxC123');
  });

  it('calls onChange when it reports back the code before a composition that went from a code to a text the code refuses and was cancelled', async () => {
    const events: string[] = [];
    render(<Listening initial="AB" mode="both" events={events} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    // A romaji step `k` is a code, so it is reported; `か` is not, so the composition is cancelled on the code the person saw last.
    await compose(['k', 'か'], null);
    await vi.waitFor(() => expect(events.at(-1)).toBe('value:AB'));
    expect(events.at(-2)).toBe('change:AB');
    expect(input().value).toBe('AB');
  });

  it('keeps the whole code of a composition for a product that uppercases what it is told', async () => {
    const events: string[] = [];
    render(<Listening initial="AB" mode="upper" events={events} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['c', 'cd', 'cde', 'cdef']);
    await vi.waitFor(() => expect(input().value).toBe('ABCDEF'));
    expect(boxes().map((box) => box.textContent).join('')).toBe('ABCDEF');
  });

  it('reports the code before a cancelled composition back to a product that uppercases what it is told', async () => {
    const events: string[] = [];
    render(<Listening initial="AB" mode="upper" events={events} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['c', 'cd'], null);
    await vi.waitFor(() => expect(input().value).toBe('AB'));
  });

  it.each([['AB'], ['ABC12']])('takes a composition back to %s for a product that uppercases what it is told, and tells it', async (initial) => {
    const events: string[] = [];
    render(<Listening initial={initial} mode="upper" events={events} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    // `k` is a code, reported and answered in capitals; `か` is not, so the composition is cancelled on the code before it.
    await compose(['k', 'か']);
    await vi.waitFor(() => expect(input().value).toBe(initial));
    expect(boxes().map((box) => box.textContent).join('')).toBe(initial);
    expect(events.at(-1)).toBe(`value:${initial}`);
  });

  // Products that answer a report late or by clearing, which the composition's end tells from an override by the content of `value`.
  function Answering({ initial, mode, calls }: { initial: string; mode: 'clear' | 'effect' | 'timer'; calls: string[] }) {
    const [value, setValue] = useState(initial);
    useEffect(() => {
      if (mode === 'effect') setValue((v) => v.toUpperCase());
    }, [value, mode]);
    return (
      <Field.Root aria-label="Verification code">
        <Field.OneTimeCode
          characters="alphanumeric"
          value={value}
          onValueChange={(next) => {
            calls.push(next);
            if (mode === 'clear') setValue(next.length === 6 ? '' : next);
            else if (mode === 'timer') setTimeout(() => setValue(next.toUpperCase()), 50);
            else setValue(next);
          }}
        />
      </Field.Root>
    );
  }

  it('leaves a product that clears a full code cleared when a composition ends', async () => {
    const calls: string[] = [];
    render(<Answering initial="ABC12" mode="clear" calls={calls} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['k', 'か']);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(input().value).toBe('');
    expect(calls).toEqual(['ABC12k']);
  });

  it.each([['effect'], ['timer']] as const)('takes a composition back for a product that normalizes in %s', async (mode) => {
    for (const initial of ['AB', 'ABC12']) {
      const calls: string[] = [];
      const view = render(<Answering initial={initial} mode={mode} calls={calls} />);
      await userEvent.click(input());
      await userEvent.keyboard('{End}');
      await compose(['k', 'か']);
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(input().value).toBe(initial);
      expect(calls.at(-1)).toBe(initial);
      view.unmount();
    }
  });

  it('reports the code before a cancelled composition to a product whose value stays fixed', async () => {
    const heard: string[] = [];
    render(
      <Field.Root aria-label="Verification code">
        <Field.OneTimeCode characters="alphanumeric" value="AB" onValueChange={(next) => heard.push(next)} />
      </Field.Root>,
    );
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['k', 'か'], null);
    await vi.waitFor(() => expect(heard).toEqual(['ABk', 'AB']));
    expect(input().value).toBe('AB');
  });

  it('gives onChange an input event with an inputType for the code a composition is taken back to', async () => {
    const types: Array<string | undefined> = [];
    const data: Array<string | null> = [];
    render(
      <Field.Root aria-label="Verification code">
        <Field.OneTimeCode
          characters="alphanumeric"
          value="AB"
          onChange={(event) => {
            types.push((event.nativeEvent as InputEvent).inputType);
            data.push((event.nativeEvent as InputEvent).data);
          }}
        />
      </Field.Root>,
    );
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['k', 'か'], null);
    await vi.waitFor(() => expect(types.length).toBeGreaterThan(1));
    expect(types.at(-1)).toBe('insertReplacementText');
    expect(data.at(-1)).toBe('AB');
  });

  it('does not place a change that has no beforeinput by the selection of a deletion that was cancelled', async () => {
    render(<Code initial="AAB123" characters="alphanumeric" />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}');
    // A product cancels the deletion, so no change event consumes the selection it began from.
    input().addEventListener('beforeinput', (event) => event.preventDefault());
    await userEvent.keyboard('{Delete}');
    expect(input().value).toBe('AAB123');
    // Autofill sends no beforeinput; the insert is read from the texts alone.
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(input(), 'AAAB123');
      input().dispatchEvent(new Event('input', { bubbles: true }));
    });
    await vi.waitFor(() => expect(input().value).toBe('AAA123'));
  });

  it('takes a composition that rewrites the text before the caret', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="AB" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    // A keyboard that recomposes the word before the caret replaces it.
    await session().send('Input.imeSetComposition', { text: 'X', selectionStart: 1, selectionEnd: 1, replacementStart: 1, replacementEnd: 2 });
    await session().send('Input.insertText', { text: 'X' });
    await vi.waitFor(() => expect(input().value).toBe('AX'));
    expect(onValueChange).toHaveBeenLastCalledWith('AX');
  });

  it('leaves a full code as it was when a composition is cancelled', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="ABC123" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await compose(['x'], null);
    await vi.waitFor(() => expect([input().selectionStart, input().selectionEnd]).toEqual([1, 1]));
    expect(input().value).toBe('ABC123');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('reports the code before a cancelled composition back when its steps were reported', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="AB" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['c', 'cd'], null);
    await vi.waitFor(() => expect(onValueChange.mock.calls).toEqual([['ABc'], ['ABcd'], ['AB']]));
    expect(input().value).toBe('AB');
  });

  it('calls onChange for the code before a cancelled composition that it reports back', async () => {
    const events: string[] = [];
    render(<Listening initial="AB" mode="both" events={events} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await compose(['c', 'cd'], null);
    await vi.waitFor(() => expect(events.at(-1)).toBe('value:AB'));
    expect(events.at(-2)).toBe('change:AB');
  });

  const undo = () => userEvent.keyboard('{Control>}z{/Control}');

  const redo = () => userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

  it('undoes a finished composition back to the code before it, or leaves the code, and reports no code the person did not see', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="ABC123" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await compose(['x']);
    await vi.waitFor(() => expect(input().value).toBe('AxC123'));
    for (const step of [undo, undo, redo]) {
      await step();
      expect(['ABC123', 'AxC123']).toContain(input().value);
      expect(boxes().map((box) => box.textContent).join('')).toBe(input().value);
    }
    for (const [code] of onValueChange.mock.calls) expect(['ABC123', 'AxC123']).toContain(code);
  });

  it('leaves the code as it was when a composition the code refuses is undone', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="AB" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}C');
    onValueChange.mockClear();
    await compose(['ㅎ', '하']);
    await vi.waitFor(() => expect(input().value).toBe('ABC'));
    await undo();
    expect(input().value).toBe('ABC');
    expect(boxes().map((box) => box.textContent).join('')).toBe('ABC');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('keeps the undo history through a cancelled composition', async () => {
    render(<Code initial="AB" characters="alphanumeric" />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}C');
    await compose(['x'], null);
    await vi.waitFor(() => expect(input().value).toBe('ABC'));
    await undo();
    expect(input().value).toBe('AB');
  });

  it('keeps a value the product sets while a composition runs, and drops the composition, which undo does not bring back', async () => {
    let reset = (_value: string) => {};
    const onValueChange = vi.fn();
    function Resettable() {
      const [value, setValue] = useState('AB');
      reset = setValue;
      return (
        <Field.Root aria-label="Verification code">
          <Field.OneTimeCode
            characters="alphanumeric"
            value={value}
            onValueChange={(next) => {
              onValueChange(next);
              setValue(next);
            }}
          />
        </Field.Root>
      );
    }
    render(<Resettable />);
    await userEvent.click(input());
    await userEvent.keyboard('{End}');
    await session().send('Input.imeSetComposition', { text: 'c', selectionStart: 1, selectionEnd: 1 });
    await vi.waitFor(() => expect(input().value).toBe('ABc'));
    act(() => reset(''));
    onValueChange.mockClear();
    await session().send('Input.insertText', { text: 'c' });
    await vi.waitFor(() => expect(input().value).toBe(''));
    expect(boxes().map((box) => box.textContent).join('')).toBe('');
    await undo();
    expect(input().value).toBe('');
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('lands a composed character next to the same one at the box it was typed at', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="AB1123" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}');
    await compose(['1']);
    await vi.waitFor(() => expect(input().value).toBe('AB1123'));
    expect(onValueChange).not.toHaveBeenCalled();
    expect(active()).toEqual([3]);
    cleanup();
    render(<Code initial="ABAB12" characters="alphanumeric" onValueChange={onValueChange} />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}');
    await compose(['A', 'AB']);
    await vi.waitFor(() => expect(input().value).toBe('ABAB12'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('takes a composed full-width digit as its ASCII one', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await compose(['１']);
    await vi.waitFor(() => expect(input().value).toBe('113456'));
  });

  it('writes a composition of several steps over the boxes after the caret, and moves nothing out', async () => {
    render(<Code initial="ABC123" characters="alphanumeric" />);
    await userEvent.click(input());
    await userEvent.keyboard('{Home}{ArrowRight}');
    await compose(['a', 'ab']);
    await vi.waitFor(() => expect(input().value).toBe('Aab123'));
  });

  it('takes full-width digits typed or pasted as their ASCII ones', async () => {
    render(<Code />);
    await userEvent.click(input());
    await session().send('Input.insertText', { text: '１' });
    expect(input().value).toBe('1');
    await paste('２３４５６');
    expect(input().value).toBe('123456');
  });

  it('writes a short paste over a selected box of a full code, and moves nothing out', async () => {
    render(<Code initial="123456" />);
    await userEvent.click(input(), { position: boxPosition(2) });
    expect([input().selectionStart, input().selectionEnd]).toEqual([2, 3]);
    await paste('78');
    expect(input().value).toBe('127856');
  });

  it('copies text dragged inside the field to the box it is dropped on', async () => {
    const onValueChange = vi.fn();
    render(<Code initial="123456" onValueChange={onValueChange} />);
    input().focus();
    input().setSelectionRange(0, 2);
    // The transparent input's own glyphs sit at its start, which is where a drag of its selection starts.
    const y = input().getBoundingClientRect().height / 2;
    await userEvent.dragAndDrop(input(), input(), { sourcePosition: { x: 4, y }, targetPosition: { x: boxPosition(4).x, y } });
    await vi.waitFor(() => expect(input().value).toBe('123412'));
    expect(onValueChange.mock.calls).toEqual([['123412']]);
  });

  it('refuses a drop past a full code, and lands one past a partial code after it', async () => {
    render(<Code initial="123456" />);
    const past = input().getBoundingClientRect().width - 4;
    await dropAt({ x: past });
    expect(input().value).toBe('123456');
    cleanup();
    render(<Code initial="12" />);
    await dropAt({ x: past });
    await vi.waitFor(() => expect(input().value).toBe('129'));
  });

  it('puts the caret after a full code when the press is past the last box', async () => {
    render(<Code initial="123456" />);
    const y = input().getBoundingClientRect().height / 2;
    await userEvent.click(input(), { position: { x: input().getBoundingClientRect().width - 4, y } });
    expect([input().selectionStart, input().selectionEnd]).toEqual([6, 6]);
    expect(active()).toEqual([]);
  });

  it('keeps the boxes left to right in a right-to-left page, with the room after the code past the last box', async () => {
    render(<Code initial="12" dir="rtl" />);
    const field = input().getBoundingClientRect();
    const last = boxes()[5]!.getBoundingClientRect();
    expect(boxes()[0]!.getBoundingClientRect().left).toBeCloseTo(field.left, 0);
    // The middle of the room between the last box and the end of the row.
    const past = (last.right + field.right) / 2 - field.left;
    expect(past).toBeGreaterThan(last.right - field.left + 10);
    const y = field.height / 2;
    await userEvent.click(input(), { position: { x: past, y } });
    expect([input().selectionStart, input().selectionEnd]).toEqual([2, 2]);
    await dropAt({ x: past });
    await vi.waitFor(() => expect(input().value).toBe('129'));
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
          <ShadowCode />
        </Field.Root>
      </main>,
      { container: mount },
    );
    const inner = mount.querySelector('input')!;
    const marked = () => [...inner.nextElementSibling!.children].flatMap((box, i) => (box.hasAttribute('data-active') ? [i] : []));
    await userEvent.click(inner);
    await userEvent.keyboard('{Home}{ArrowRight}{ArrowRight}');
    await vi.waitFor(() => expect(marked()).toEqual([2]));
    await userEvent.keyboard('{Home}');
    await vi.waitFor(() => expect(marked()).toEqual([0]));
    await userEvent.keyboard('9');
    expect(inner.value).toBe('923456');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(inner.value).toBe('123456');
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

  it.each([
    ['AB1123', 'AB11123', 2, '1'],
    ['ABAB12', 'ABABAB12', 0, 'AB'],
  ])('places a non-cancelable insert at the caret it was typed at: %s', async (initial, text, caret, data) => {
    const onValueChange = vi.fn();
    render(<Code initial={initial} characters="alphanumeric" onValueChange={onValueChange} />);
    input().focus();
    input().setSelectionRange(caret, caret);
    // A browser that won't let the insert be cancelled still sends beforeinput first.
    input().dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: false, inputType: 'insertText', data }));
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input(), text);
    input().setSelectionRange(caret + data.length, caret + data.length);
    input().dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data }));
    await vi.waitFor(() => expect(input().value).toBe(initial));
  });
});
