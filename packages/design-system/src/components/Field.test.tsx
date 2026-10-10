import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { createRef, Profiler, StrictMode, useState } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Button } from './Button';
import {
  Field,
  type FieldAffixProps,
  type FieldChipInputProps,
  type FieldIconProps,
  type FieldRootProps,
  type FieldTextInputProps,
} from './Field';
import { useChipField } from '../hooks/useChipField';
import * as api from '../index';
import { StringsProvider } from '../providers/StringsProvider';

afterEach(cleanup);

describe('Field exports', () => {
  it("keeps a text input's own aria-invalid value unless the Root is invalid", () => {
    const { rerender } = render(
      <Field.Root aria-label="Note">
        <Field.TextInput value="" onChange={() => {}} aria-invalid="spelling" />
      </Field.Root>,
    );
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('spelling');
    rerender(
      <Field.Root aria-label="Note" invalid>
        <Field.TextInput value="" onChange={() => {}} aria-invalid="spelling" />
      </Field.Root>,
    );
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });

  it('hard-cuts old names and is not callable', () => {
    expect(api).not.toHaveProperty('TextField');
    expect(api).not.toHaveProperty('ChipField');
    expect(api).not.toHaveProperty('FieldShell');
    expect(api).not.toHaveProperty('IconStart');
    expect(api).not.toHaveProperty('IconEnd');
    expect(api).not.toHaveProperty('Prefix');
    expect(api).not.toHaveProperty('Suffix');
    expect(api).not.toHaveProperty('FieldLabelProps');
    expect(api.Field).toEqual({
      Root: Field.Root,
      TextInput: Field.TextInput,
      Textarea: Field.Textarea,
      ChipInput: Field.ChipInput,
      Select: Field.Select,
      Icon: Field.Icon,
      Affix: Field.Affix,
      Counter: Field.Counter,
      Row: Field.Row,
    });
    expect(api.Field).not.toHaveProperty('Label');
    expectTypeOf<typeof Field>().not.toHaveProperty('Label');
    expect(typeof api.Field).toBe('object');
    expectTypeOf<typeof Field extends (...args: never[]) => unknown ? true : false>().toEqualTypeOf<false>();
    expectTypeOf<FieldRootProps>().not.toHaveProperty('value');
    expectTypeOf<FieldIconProps>().not.toHaveProperty('side');
    expectTypeOf<FieldAffixProps>().not.toHaveProperty('side');
  });
});

describe('Field.TextInput', () => {
  it('exposes the shell through ref', () => {
    const ref = createRef<HTMLDivElement>();
    const { container } = render(
      <Field.Root ref={ref} id="name">
        <Field.TextInput value="" onChange={() => undefined} />
      </Field.Root>,
    );
    expect(ref.current).toBe(container.querySelector('[class]') ?? container.firstElementChild);
    expect(ref.current?.contains(container.querySelector('input'))).toBe(true);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('wires id, disabled, and invalid onto one input and the shell', () => {
    const { container } = render(
      <Field.Root id="name" disabled invalid>
        <Field.TextInput value="" onChange={() => undefined} />
      </Field.Root>,
    );
    const input = container.querySelector('input');
    expect(input).toHaveProperty('id', 'name');
    expect(input).toHaveProperty('disabled', true);
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[data-disabled]')).not.toBeNull();
    expect(container.querySelector('[data-invalid]')).not.toBeNull();
    expect(container.querySelectorAll('input')).toHaveLength(1);
  });

  it('keeps source order for leading and trailing adornments', () => {
    const { container } = render(
      <Field.Root>
        <Field.Affix>USD</Field.Affix>
        <Field.TextInput value="1" onChange={() => undefined} />
        <Field.Icon>
          <span>go</span>
        </Field.Icon>
      </Field.Root>,
    );
    const shell = container.querySelector('input')?.parentElement;
    const kids = [...(shell?.children ?? [])];
    expect(kids[0]?.textContent).toBe('USD');
    expect(kids[1]?.tagName).toBe('INPUT');
    expect(kids[2]?.textContent).toBe('go');
  });

  it('renders affixes as text, not HTML', () => {
    const { container } = render(
      <Field.Root>
        <Field.Affix>{'<img onerror>'}</Field.Affix>
        <Field.TextInput value="1" onChange={() => undefined} />
        <Field.Affix>.00</Field.Affix>
      </Field.Root>,
    );
    expect(screen.getByText('<img onerror>')).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('.00')).toBeTruthy();
  });

  it('hides decorative icons and leaves interactive ones named', () => {
    render(
      <Field.Root>
        <Field.Icon>
          <span>search</span>
        </Field.Icon>
        <Field.TextInput value="" onChange={() => undefined} />
        <Field.Icon interactive>
          <button type="button">Clear</button>
        </Field.Icon>
      </Field.Root>,
    );
    expect(screen.getByText('search').parentElement?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByRole('button', { name: 'Clear' }).parentElement?.getAttribute('aria-hidden')).toBeNull();
  });

  it('focuses the input from chrome, not from adornment buttons', () => {
    render(
      <Field.Root>
        <Field.Affix>USD</Field.Affix>
        <Field.TextInput value="" onChange={() => undefined} />
        <Field.Icon interactive>
          <button type="button">Clear</button>
        </Field.Icon>
      </Field.Root>,
    );
    const input = screen.getByRole('textbox');
    fireEvent.mouseDown(screen.getByText('USD'));
    expect(document.activeElement).toBe(input);
    screen.getByRole('button', { name: 'Clear' }).focus();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Clear' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Clear' }));
  });

  it('rejects file at the type level', () => {
    expectTypeOf<FieldTextInputProps['type']>().extract<'file'>().toBeNever();
    expectTypeOf<NonNullable<FieldTextInputProps['type']>>().toEqualTypeOf<
      'text' | 'search' | 'email' | 'url' | 'tel' | 'password' | 'number' | 'date' | 'time' | 'datetime-local'
    >();
  });

  it.each([['number', '42', '7']] as const)('renders a native %s input with a string value', (type, value, next) => {
    const onValueChange = vi.fn();
    const { container } = render(
      <Field.Root aria-label="When">
        <Field.TextInput type={type} value={value} onChange={() => undefined} onValueChange={onValueChange} />
      </Field.Root>,
    );
    const input = container.querySelector('input')!;
    expect(input.type).toBe(type);
    expect(input.value).toBe(value);
    expect(input.getAttribute('aria-label')).toBe('When');
    fireEvent.change(input, { target: { value: next } });
    expect(onValueChange).toHaveBeenCalledWith(next);
  });
});

const fieldDir = dirname(fileURLToPath(import.meta.url));
const fieldCss = readFileSync(join(fieldDir, 'Field.module.css'), 'utf8');
const chipCss = readFileSync(join(fieldDir, 'Chip.module.css'), 'utf8');
const tokensCss = readFileSync(join(fieldDir, '../styles/tokens.generated.css'), 'utf8');

describe('Field.Textarea', () => {
  it('sets native rows, css vars, and data attributes from coerced integers', () => {
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="note" onChange={() => undefined} rows={4} maxRows={6} autoGrow />
      </Field.Root>,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).toHaveProperty('rows', 4);
    expect(textarea?.style.getPropertyValue('--todae-field-rows')).toBe('4');
    expect(textarea?.style.getPropertyValue('--todae-field-max-rows')).toBe('6');
    expect(textarea?.hasAttribute('data-auto-grow')).toBe(true);
    expect(textarea?.getAttribute('data-max-rows')).toBe('6');
    expect(textarea?.hasAttribute('maxRows')).toBe(false);
    expect(textarea?.hasAttribute('autoGrow')).toBe(false);
    expect(textarea?.outerHTML).not.toContain('autoGrow');
    expect(textarea?.outerHTML).not.toContain('maxRows');
  });

  it('omits the cap attributes when autoGrow and maxRows are off', () => {
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="" onChange={() => undefined} />
      </Field.Root>,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).toHaveProperty('rows', 3);
    expect(textarea?.style.getPropertyValue('--todae-field-rows')).toBe('3');
    expect(textarea?.style.getPropertyValue('--todae-field-max-rows')).toBe('');
    expect(textarea?.hasAttribute('data-auto-grow')).toBe(false);
    expect(textarea?.hasAttribute('data-max-rows')).toBe(false);
  });

  it('rejects a hostile rows value instead of injecting css', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="" onChange={() => undefined} rows={'3); color: red' as never} />
      </Field.Root>,
    );
    const textarea = container.querySelector('textarea');
    expect(textarea).toHaveProperty('rows', 3);
    expect(textarea?.getAttribute('style')).toBe('--todae-field-rows: 3;');
    expect(textarea?.getAttribute('style')).not.toContain('color');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('wires label, description, invalid, disabled, name, and native props', () => {
    const onBlur = vi.fn();
    const onValueChange = vi.fn();
    const ref = createRef<HTMLTextAreaElement>();
    render(
      <>
        <label htmlFor="note">Note</label>
        <Field.Root id="note" name="bio" disabled invalid aria-describedby="hint">
          <Field.Textarea
            ref={ref}
            value="kept"
            maxLength={20}
            onBlur={onBlur}
            onValueChange={onValueChange}
            onChange={() => undefined}
          />
        </Field.Root>
      </>,
    );
    const textarea = screen.getByLabelText('Note');
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.getAttribute('aria-describedby')).toBe('hint');
    expect(textarea.getAttribute('aria-invalid')).toBe('true');
    expect(textarea).toHaveProperty('disabled', true);
    expect(textarea).toHaveProperty('name', 'bio');
    expect(textarea).toHaveProperty('maxLength', 20);
    expect(textarea).toHaveProperty('value', 'kept');
    expect(ref.current).toBe(textarea);
    const shell = textarea.parentElement;
    expect(shell?.hasAttribute('data-invalid')).toBe(true);
    expect(shell?.hasAttribute('data-disabled')).toBe(true);
    fireEvent.blur(textarea);
    expect(onBlur).toHaveBeenCalled();
    fireEvent.change(textarea, { target: { value: 'next' } });
    expect(onValueChange).toHaveBeenCalledWith('next');
    expect(textarea).toHaveProperty('value', 'kept');
  });

  it('focuses the textarea from the shell', () => {
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="" onChange={() => undefined} />
      </Field.Root>,
    );
    const shell = container.firstElementChild as HTMLElement;
    fireEvent.mouseDown(shell);
    expect(document.activeElement).toBe(container.querySelector('textarea'));
  });

  it('does not size with listeners', () => {
    const observe = vi.fn();
    class ResizeObserver {
      observe = observe;
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserver);
    const add = vi.spyOn(HTMLTextAreaElement.prototype, 'addEventListener');
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="hi" onChange={() => undefined} autoGrow maxRows={4} />
      </Field.Root>,
    );
    expect(observe).not.toHaveBeenCalled();
    const types = add.mock.calls.map(([type]) => type);
    expect(types).not.toContain('input');
    expect(container.querySelector('textarea')?.oninput).toBeNull();
    add.mockRestore();
    vi.unstubAllGlobals();
  });

  it('sizes with css only and floors resize at rows', () => {
    const supports = fieldCss.indexOf('@supports (field-sizing: content)');
    expect(supports).toBeGreaterThan(-1);
    expect(fieldCss.slice(0, supports)).not.toContain('field-sizing');
    expect(fieldCss.slice(supports)).toContain('field-sizing: content');
    expect(fieldCss).toMatch(/\.textarea\[data-auto-grow\]\s*\{[^}]*resize:\s*none/);
    expect(fieldCss).toContain('.shell:has(:is(input, textarea, [data-todae-field-control], [data-todae-field-control] *):focus-visible)');
    expect(fieldCss).toMatch(/\.textarea\s*\{[^}]*outline:\s*none/);
    expect(fieldCss).toContain('min-height: calc(var(--todae-field-rows) * 1lh + var(--_pad-block))');
    expect(fieldCss).not.toContain('min-height: calc(1lh');
    expect(fieldCss).not.toContain('min-height: calc(var(--todae-field-leading) * 1em');
  });
});

describe('Field.Root', () => {
  it('puts className and style on the shell', () => {
    const { container } = render(
      <Field.Root className="wide" style={{ maxWidth: '18rem' }}>
        <Field.TextInput value="" onChange={() => undefined} />
      </Field.Root>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.className).toContain('shell');
    expect(shell.className).toContain('wide');
    expect(shell.style.maxWidth).toBe('18rem');
    expect(shell.children).toHaveLength(1);
    expect(container.querySelector('label')).toBeNull();
  });

  it('marks disabled and invalid on the shell only', () => {
    const { container } = render(
      <Field.Root disabled invalid>
        <Field.TextInput value="" onChange={() => undefined} />
      </Field.Root>,
    );
    const shell = container.firstElementChild;
    expect(shell?.className).toContain('shell');
    expect(shell?.hasAttribute('data-disabled')).toBe(true);
    expect(shell?.hasAttribute('data-invalid')).toBe(true);
    expect(container.querySelectorAll('[data-disabled]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-invalid]')).toHaveLength(1);
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });
});

function renderField(
  props: Partial<ComponentProps<typeof Field.ChipInput>> & {
    chips?: string[];
    inputValue?: string;
    disabled?: boolean;
    invalid?: boolean;
  } = {},
) {
  const onInputValueChange = props.onInputValueChange ?? vi.fn();
  const onCommit = props.onCommit ?? vi.fn();
  const onChipRemove = props.onChipRemove ?? vi.fn();
  const { disabled, invalid, ...chip } = props;
  const result = render(
    <Field.Root disabled={disabled} invalid={invalid}>
      <Field.ChipInput
        chips={chip.chips ?? ['Alpha', 'Beta', 'Gamma']}
        inputValue={chip.inputValue ?? ''}
        onInputValueChange={onInputValueChange}
        onCommit={onCommit}
        onChipRemove={onChipRemove}
        {...chip}
      />
    </Field.Root>,
  );
  return { ...result, onInputValueChange, onCommit, onChipRemove };
}

describe('Field.ChipInput', () => {
  it('puts chipRemoveIcon in every chip remove button', () => {
    renderField({ chips: ['Alpha', 'Beta'], chipRemoveIcon: <svg data-testid="x" aria-hidden="true" /> });
    for (const name of ['Remove Alpha', 'Remove Beta']) {
      expect(screen.getByRole('button', { name }).querySelector('[data-testid="x"]')).toBeTruthy();
    }
  });

  it('forwards typing and commits a trimmed value without mutating chips', () => {
    const { onInputValueChange, onCommit } = renderField({
      chips: ['Alpha'],
      inputValue: '  foo ',
    });
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'z' } });
    expect(onInputValueChange).toHaveBeenCalledWith('z');
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('foo');
    expect(screen.getAllByRole('button', { name: /Remove / })).toHaveLength(1);
    expect(screen.getByRole('textbox')).toHaveProperty('value', '  foo ');
  });

  it('disables the chips and Backspace when the input itself is disabled', () => {
    const onChipRemove = vi.fn();
    render(
      <Field.Root>
        <Field.ChipInput
          // The type leaves disabled to the Root, but a spread such as
          // useCombobox's getChipInputProps() still carries one.
          {...({ disabled: true } as object)}
          chips={['Alpha', 'Beta']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={onChipRemove}
        />
      </Field.Root>,
    );
    expect(screen.getByRole('textbox')).toHaveProperty('disabled', true);
    for (const button of screen.getAllByRole('button', { name: /Remove / })) {
      expect(button).toHaveProperty('disabled', true);
    }
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).not.toHaveBeenCalled();
  });

  it('composes a caller ref onto the input', () => {
    const ref = { current: null as HTMLInputElement | null };
    renderField({ ref });
    expect(ref.current).toBe(screen.getByRole('textbox'));
  });

  it('lets a caller onKeyDown run before commit and honors preventDefault', () => {
    const onKeyDown = vi.fn((event: { key: string; preventDefault: () => void }) => {
      if (event.key === 'Enter') event.preventDefault();
    });
    const { onCommit } = renderField({ inputValue: 'tag', onKeyDown });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('does not commit or prevent default on empty Enter', () => {
    const { onCommit } = renderField({ inputValue: '   ' });
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    screen.getByRole('textbox').dispatchEvent(event);
    expect(onCommit).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it('honors commitKeys and drops unknown keys', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const comma = vi.fn();
    const { rerender, onCommit } = renderField({
      inputValue: 'tag',
      commitKeys: [','],
      onCommit: comma,
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(comma).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('textbox'), { key: ',' });
    expect(comma).toHaveBeenCalledWith('tag');

    rerender(
      <Field.Root>
        <Field.ChipInput
          chips={['Alpha']}
          inputValue="tag"
          onInputValueChange={() => undefined}
          onCommit={onCommit}
          onChipRemove={() => undefined}
          commitKeys={['Escape' as 'Enter']}
        />
      </Field.Root>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('tag');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('ignores composing keydowns', () => {
    const { onCommit } = renderField({ inputValue: 'tag' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', isComposing: true });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Process' });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('removes the last chip on empty Backspace', () => {
    const { onChipRemove, rerender } = renderField({
      chips: ['Alpha', 'Beta', 'Gamma'],
      inputValue: '',
    });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledWith(2, 'Gamma');

    rerender(
      <Field.Root>
        <Field.ChipInput
          chips={['Alpha', 'Beta', 'Gamma']}
          inputValue="x"
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={onChipRemove}
        />
      </Field.Root>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledTimes(1);

    rerender(
      <Field.Root>
        <Field.ChipInput
          chips={['Alpha']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={onChipRemove}
          removeOnBackspace={false}
        />
      </Field.Root>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the input after dismiss', () => {
    const { onChipRemove } = renderField({ chips: ['Alpha'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
    expect(onChipRemove).toHaveBeenCalledWith(0, 'Alpha');
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('disables input and dismiss, and marks invalid', () => {
    const { onChipRemove, onCommit } = renderField({ disabled: true, invalid: true, inputValue: 'x' });
    const input = screen.getByRole('textbox');
    expect(input).toHaveProperty('disabled', true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('button', { name: 'Remove Alpha' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Alpha' }));
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Backspace' });
    expect(onChipRemove).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('leaves the no-maxRows flow unmarked', () => {
    const { container } = renderField({ chips: ['Alpha', 'Beta'] });
    expect(container.querySelector('[data-max-rows]')).toBeNull();
    expect(container.querySelector('[data-measured]')).toBeNull();
    expect(screen.getByRole('button', { name: 'Remove Alpha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Beta' })).toBeTruthy();
  });

  it('keeps ChipInput icons outside .flow', () => {
    const { container } = render(
      <Field.Root>
        <Field.Icon>
          <span>chevron</span>
        </Field.Icon>
        <Field.ChipInput
          chips={['Alpha']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
        <Field.Affix>tag</Field.Affix>
      </Field.Root>,
    );
    const flow = container.querySelector('input')?.parentElement;
    expect(flow?.className).toContain('flow');
    expect(flow?.contains(screen.getByText('chevron'))).toBe(false);
    expect(flow?.contains(screen.getByText('tag'))).toBe(false);
    expect(flow?.parentElement?.contains(screen.getByText('chevron'))).toBe(true);
    expect(screen.getByText('chevron')).toBeTruthy();
  });
});

describe('Field.ChipInput overflow', () => {
  const observers: Array<{ cb: ResizeObserverCallback }> = [];

  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        cb: ResizeObserverCallback;
        constructor(cb: ResizeObserverCallback) {
          this.cb = cb;
          observers.push(this);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const minWidth = el instanceof HTMLInputElement ? '80px' : '0px';
      return {
        columnGap: '8px',
        gap: '8px',
        minWidth,
        getPropertyValue(name: string) {
          if (name === 'min-width') return minWidth;
          if (name === 'column-gap' || name === 'gap') return '8px';
          return '';
        },
      } as CSSStyleDeclaration;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 50, height: 24, top: 0, left: 0, bottom: 24, right: 50, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 400, height: 32, top: 0, left: 0, bottom: 32, right: 400, x: 0, y: 0, toJSON() {} };
      }
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function liveNodes(container: HTMLElement) {
    const flow = container.querySelector('input')?.parentElement;
    return [...(flow?.children ?? [])].filter((el) => !el.hasAttribute('inert'));
  }

  it('folds newest chips into +N and keeps hidden dismiss out of the a11y tree', () => {
    const { container, onChipRemove } = renderField({
      chips: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      maxRows: 1,
    });
    const live = liveNodes(container);
    const html = live.map((el) => el.outerHTML).join('');
    expect(container.querySelector('[data-max-rows]')).not.toBeNull();
    expect(container.querySelector('[data-measured]')).not.toBeNull();
    expect(html).toContain('2 more');
    expect(html).toContain('Remove Alpha');
    expect(html).toContain('Remove Beta');
    expect(html).not.toContain('Remove Gamma');
    expect(html).not.toContain('Remove Delta');
    expect(container.querySelector('[inert][aria-hidden] [aria-label="Remove Delta"]')).not.toBeNull();

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Backspace' });
    expect(onChipRemove).toHaveBeenCalledWith(3, 'Delta');
    expect(container.querySelector('[data-ellipsis]')).toBeNull();
  });

  it('remeasures when ResizeObserver fires and does not loop', () => {
    const { container } = renderField({
      chips: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      maxRows: 1,
    });
    expect(observers.length).toBeGreaterThan(0);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 50, height: 24, top: 0, left: 0, bottom: 24, right: 50, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 800, height: 32, top: 0, left: 0, bottom: 32, right: 800, x: 0, y: 0, toJSON() {} };
      }
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });
    act(() => {
      const ro = observers.at(-1);
      ro?.cb([] as unknown as ResizeObserverEntry[], ro as unknown as ResizeObserver);
    });
    const live = liveNodes(container).map((el) => el.outerHTML).join('');
    expect(live).not.toContain('data-overflow');
    expect(live).toContain('Remove Alpha');
    expect(container.querySelector('[data-ellipsis]')).toBeNull();
  });

  it('folds one fewer chip in a row because the input width is not reserved', () => {
    const { container } = renderField({
      chipLayout: 'row',
      chips: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      maxRows: 1,
    });
    const flow = container.querySelector('input')?.parentElement as HTMLElement;
    const row = flow.querySelector(':scope > [class*="row"]') as HTMLElement;
    expect(row.outerHTML).toContain('1 more');
    expect(row.outerHTML).not.toContain('2 more');
    expect(flow.hasAttribute('data-max-rows')).toBe(false);
    expect(row.getAttribute('data-max-rows')).toBe('1');
    expect(container.querySelector('[inert][aria-hidden] [aria-label="Remove Delta"]')).not.toBeNull();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 50, height: 24, top: 0, left: 0, bottom: 24, right: 50, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 800, height: 32, top: 0, left: 0, bottom: 32, right: 800, x: 0, y: 0, toJSON() {} };
      }
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });
    const before = observers.length;
    act(() => {
      const ro = observers.at(-1);
      ro?.cb([] as unknown as ResizeObserverEntry[], ro as unknown as ResizeObserver);
    });
    expect(observers.length).toBe(before);
    expect(row.outerHTML).not.toContain('data-overflow');
  });

  it('folds a chip that does not fit at full width instead of shrinking it', () => {
    vi.spyOn(window, 'getComputedStyle').mockImplementation((el) => {
      const minWidth = el instanceof HTMLInputElement ? '40px' : '0px';
      return {
        columnGap: '8px',
        gap: '8px',
        minWidth,
        getPropertyValue(name: string) {
          if (name === 'min-width') return minWidth;
          if (name === 'column-gap' || name === 'gap') return '8px';
          return '';
        },
      } as CSSStyleDeclaration;
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 40, height: 24, top: 0, left: 0, bottom: 24, right: 40, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 300, height: 32, top: 0, left: 0, bottom: 32, right: 300, x: 0, y: 0, toJSON() {} };
      }
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.startsWith('Beta') ? 150 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width, height: 24, top: 0, left: 0, bottom: 24, right: width, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });

    const { container } = renderField({ chips: ['Alpha', 'Beta', 'Gamma'], maxRows: 1 });
    const live = liveNodes(container);
    const overflow = live.find((el) => el.hasAttribute('data-overflow'));
    expect(container.querySelector('[data-ellipsis]')).toBeNull();
    expect(live.some((el) => el.textContent?.includes('Alpha'))).toBe(true);
    expect(live.some((el) => el.textContent?.includes('Beta'))).toBe(false);
    expect(overflow?.textContent).toContain('2 more');
    expect((overflow as HTMLElement | undefined)?.style.maxWidth).toBe('');
    expect(live.map((el) => el.outerHTML).join('')).not.toContain('Remove Gamma');
  });

  it('truncates a chip wider than the row and names its dismiss with the full label', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 40, height: 24, top: 0, left: 0, bottom: 24, right: 40, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 200, height: 32, top: 0, left: 0, bottom: 32, right: 200, x: 0, y: 0, toJSON() {} };
      }
      const text = this.textContent ?? '';
      const width = text.startsWith('…') ? 60 : text.includes('a-very-long-tag-that-stays-put') ? 400 : 80;
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width, height: 24, top: 0, left: 0, bottom: 24, right: width, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });
    const full = 'a-very-long-tag-that-stays-put';
    const { container } = renderField({ chips: [full, 'react'], maxRows: 1 });
    const truncated = liveNodes(container).find((el) => el.hasAttribute('data-ellipsis')) as HTMLElement;
    expect(truncated.style.maxWidth).toBe('64px');
    expect(truncated.textContent).toContain(full);
    expect(truncated.querySelector('button')?.getAttribute('aria-label')).toBe(`Remove ${full}`);
    expect(truncated.getAttribute('title')).toBeNull();
  });

  it('keeps the folded input on the +N row at the field min width and lets an open row stretch', () => {
    const folded = renderField({ chips: ['Alpha', 'Beta', 'Gamma', 'Delta'], maxRows: 1 });
    const foldedLive = liveNodes(folded.container);
    const foldedInput = folded.container.querySelector('input') as HTMLInputElement;
    expect(foldedLive.some((el) => el.hasAttribute('data-overflow'))).toBe(true);
    expect(foldedInput.parentElement).toBe(foldedLive[0]?.parentElement);
    expect(foldedInput.style.minWidth).toBe('');
    expect(foldedInput.style.flexBasis).toBe('');
    expect(foldedInput.style.width).toBe('');
    folded.unmount();

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.getAttribute('data-overflow') != null) {
        return { width: 50, height: 24, top: 0, left: 0, bottom: 24, right: 50, x: 0, y: 0, toJSON() {} };
      }
      if (this.querySelector?.(':scope > input')) {
        return { width: 800, height: 32, top: 0, left: 0, bottom: 32, right: 800, x: 0, y: 0, toJSON() {} };
      }
      if (this.tagName === 'SPAN' && this.querySelector?.('button, [aria-hidden]')) {
        return { width: 100, height: 24, top: 0, left: 0, bottom: 24, right: 100, x: 0, y: 0, toJSON() {} };
      }
      return { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0, toJSON() {} };
    });
    const open = renderField({ chips: ['Alpha', 'Beta'], maxRows: 1 });
    const openInput = open.container.querySelector('input') as HTMLInputElement;
    expect(liveNodes(open.container).some((el) => el.hasAttribute('data-overflow'))).toBe(false);
    expect(openInput.style.minWidth).toBe('');
    expect(openInput.style.flexBasis).toBe('');
    expect(openInput.style.width).toBe('');
  });
});

describe('Field.ChipInput maxRows SSR', () => {
  const shared: FieldChipInputProps = {
    chips: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    inputValue: '',
    onInputValueChange: () => undefined,
    onCommit: () => undefined,
    onChipRemove: () => undefined,
  };

  it('SSR maxRows has data-max-rows and no data-measured', () => {
    const html = renderToString(
      <Field.Root>
        <Field.ChipInput {...shared} maxRows={1} />
      </Field.Root>,
    );
    expect(html).toContain('data-max-rows');
    expect(html).not.toContain('data-measured');
    expect(html).toContain('--todae-field-chip-rows');
    expect(html).not.toContain('6ch');
  });

  it('SSR without maxRows stays unmarked', () => {
    const html = renderToString(
      <Field.Root>
        <Field.ChipInput {...shared} />
      </Field.Root>,
    );
    expect(html).not.toContain('data-max-rows');
    expect(html).not.toContain('data-measured');
    expect(html).not.toContain('--todae-field-chip-rows');
  });
});

describe('Field.Counter', () => {
  const bareInput =
    '<div class="_shell_61a677"><input id="_R_0_" data-todae-field-control="" type="text" class="_input_61a677" value=""/></div>';
  const bareArea =
    '<div class="_shell_61a677"><textarea id="_R_0_" data-todae-field-control="" rows="3" class="_textarea_61a677" style="--todae-field-rows:3"></textarea></div>';

  it('keeps bare server markup and scopes new layout rules under :has', () => {
    expect(
      renderToString(
        <Field.Root>
          <Field.TextInput value="" onChange={() => undefined} />
        </Field.Root>,
      ),
    ).toBe(bareInput);
    expect(
      renderToString(
        <Field.Root>
          <Field.Textarea value="" onChange={() => undefined} />
        </Field.Root>,
      ),
    ).toBe(bareArea);
    expect(fieldCss).not.toContain('display: grid');
    expect(fieldCss).not.toContain('grid-template');
    expect(fieldCss).not.toContain('Field.Footer');
    const layout = fieldCss.slice(fieldCss.indexOf('.shell:has(> [data-todae-counter])'));
    expect(layout).toContain('flex-wrap: wrap');
    expect(fieldCss.slice(0, fieldCss.indexOf('.shell:has(> [data-todae-counter])'))).not.toContain(
      '.shell:has(> [data-todae-counter])',
    );
    expect(fieldCss).toContain('flex: 0 0 100%');
    expect(fieldCss).toContain('order: 1');
    expect(fieldCss).not.toContain('flex-basis: auto');
    expect(fieldCss).toContain('row-gap: var(--todae-field-messages-gap)');
    expect(fieldCss).toContain('row-gap: 0');
    expect(fieldCss).toContain('border-end-end-radius: calc(var(--todae-field-radius) - var(--todae-field-border-width))');
    expect(fieldCss).not.toMatch(/scrollbar|::?-webkit-resizer|grip/);
    expect(fieldCss).toContain('.shell:has(> .textarea) > .adornment');
    expect(fieldCss).toContain('height: 1lh');
    expect(fieldCss).toContain('padding-left: var(--todae-field-gap)');
    expect(fieldCss).toContain('padding-right: var(--todae-field-gap)');
  });

  it('shows no limit for number and date inputs, which browsers do not cap', () => {
    const { container } = render(
      <Field.Root>
        <Field.TextInput type="number" value="12345" maxLength={4} onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    expect(container.textContent).not.toContain('/ 4');
    expect(container.textContent).not.toContain('Up to 4 characters');
    expect(screen.getByRole('spinbutton').hasAttribute('aria-describedby')).toBe(false);
  });

  it('keeps the hint hidden when the counter is not a shell child', () => {
    const { container } = render(
      <Field.Root>
        <div>
          <Field.TextInput value="hello" maxLength={10} onChange={() => undefined} />
          <Field.Counter />
        </div>
      </Field.Root>,
    );
    const hidden = [...container.querySelectorAll('[class*="srOnly"]')];
    expect(hidden.some((node) => node.textContent === 'Up to 10 characters')).toBe(true);
    expect(hidden.some((node) => node.getAttribute('aria-live') === 'polite')).toBe(true);
    for (const line of fieldCss.split('\n')) {
      if (!line.includes('{')) continue;
      if (line.includes('.srOnly') || line.includes('.counter')) expect(line).not.toContain(':has');
    }
  });

  it('server-renders the count and hydrates', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const trees = [
      () => (
        <Field.Root>
          <Field.TextInput value="hello" onChange={() => undefined} maxLength={10} />
          <Field.Counter />
        </Field.Root>
      ),
      () => (
        <Field.Root>
          <Field.Textarea value="hello" onChange={() => undefined} maxLength={10} />
          <Field.Counter />
        </Field.Root>
      ),
    ];
    for (const tree of trees) {
      const html = renderToString(tree());
      expect(html).toContain('5 / 10');
      const host = document.createElement('div');
      document.body.appendChild(host);
      host.innerHTML = html;
      await act(async () => {
        hydrateRoot(host, tree());
      });
      host.remove();
    }
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('types under StrictMode with the counter before or after the input', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Harness({ first }: { first: boolean }) {
      const [value, setValue] = useState('a');
      const counter = <Field.Counter />;
      const input = (
        <Field.TextInput value={value} maxLength={10} onChange={(event) => setValue(event.target.value)} />
      );
      return <Field.Root>{first ? <>{counter}{input}</> : <>{input}{counter}</>}</Field.Root>;
    }
    for (const first of [true, false]) {
      const view = render(
        <StrictMode>
          <Harness first={first} />
        </StrictMode>,
      );
      fireEvent.change(view.container.querySelector('input') as HTMLInputElement, { target: { value: 'ab' } });
      expect(view.container.textContent).toContain('2 / 10');
      view.unmount();
    }
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('re-renders only the counter while typing', () => {
    const counts = { root: 0, icon: 0, affix: 0, counter: 0 };
    function Value() {
      const [value, setValue] = useState('a');
      return <Field.TextInput value={value} maxLength={10} onChange={(event) => setValue(event.target.value)} />;
    }
    function Probe({ name }: { name: 'root' | 'icon' | 'affix' }) {
      counts[name] += 1;
      return null;
    }
    const view = render(
      <Field.Root>
        <Probe name="root" />
        <Probe name="icon" />
        <Field.Icon>i</Field.Icon>
        <Probe name="affix" />
        <Field.Affix>$</Field.Affix>
        <Value />
        <Profiler id="counter" onRender={() => (counts.counter += 1)}>
          <Field.Counter />
        </Profiler>
      </Field.Root>,
    );
    const before = { ...counts };
    fireEvent.change(view.container.querySelector('input') as HTMLInputElement, { target: { value: 'ab' } });
    expect(counts.root).toBe(before.root);
    expect(counts.icon).toBe(before.icon);
    expect(counts.affix).toBe(before.affix);
    expect(counts.counter).toBeGreaterThan(before.counter);
  });

  it('does not listen on the input when a counter is present', () => {
    const add = vi.spyOn(HTMLInputElement.prototype, 'addEventListener');
    const addArea = vi.spyOn(HTMLTextAreaElement.prototype, 'addEventListener');
    const view = render(
      <Field.Root>
        <Field.TextInput value="a" onChange={() => undefined} maxLength={10} />
        <Field.Counter />
      </Field.Root>,
    );
    expect(add.mock.calls.map(([type]) => type)).not.toContain('input');
    view.unmount();
    render(
      <Field.Root>
        <Field.Textarea value="a" onChange={() => undefined} maxLength={10} />
        <Field.Counter />
      </Field.Root>,
    );
    expect(addArea.mock.calls.map(([type]) => type)).not.toContain('input');
    add.mockRestore();
    addArea.mockRestore();
  });

  it('merges describedby on both inputs', () => {
    for (const input of ['input', 'textarea'] as const) {
      const view = render(
        <Field.Root aria-describedby="desc err">
          {input === 'input' ? (
            <Field.TextInput value="hi" maxLength={10} aria-describedby="own" onChange={() => undefined} />
          ) : (
            <Field.Textarea value="hi" maxLength={10} aria-describedby="own" onChange={() => undefined} />
          )}
          <Field.Counter />
        </Field.Root>,
      );
      const hint = view.container.querySelector('[id]') as HTMLElement;
      const described = view.container.querySelector(input)?.getAttribute('aria-describedby');
      const hintId = view.container.querySelector('.srOnly, [class*="srOnly"]')?.id;
      expect(hintId).toBeTruthy();
      expect(described).toBe(`desc err own ${hintId}`);
      expect(hint).toBeTruthy();
      view.unmount();
    }
  });

  it('announces the limit from the first paint and hides the number', () => {
    const view = render(
      <Field.Root>
        <Field.TextInput value="hello!!!!!" maxLength={12} onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    const live = view.container.querySelector('[aria-live="polite"]');
    expect(live).toBeTruthy();
    expect(live?.textContent).toBe('2 characters left');
    expect(view.container.querySelector('[aria-hidden="true"]')?.textContent).toBe('10 / 12');
    view.unmount();
    const one = render(
      <Field.Root>
        <Field.Textarea value="123456789" maxLength={10} onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    expect(one.container.querySelector('[aria-live="polite"]')?.textContent).toBe('1 character left');
    one.unmount();
    const none = render(
      <Field.Root>
        <Field.TextInput value="1234567890" maxLength={10} onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    expect(none.container.querySelector('[aria-live="polite"]')?.textContent).toBe('Character limit reached');
    none.unmount();
    const room = render(
      <Field.Root>
        <Field.TextInput value="a" maxLength={40} onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    expect(room.container.querySelector('[aria-live="polite"]')?.textContent).toBe('');
    expect(room.container.textContent).toContain('Up to 40 characters');
  });

  it('takes its screen reader text from StringsProvider', () => {
    const strings = {
      characterLimit: (max: number) => `${max} caractères maximum`,
      charactersLeft: (remaining: number) => `${remaining} restants`,
      characterLimitReached: 'Limite atteinte',
    };
    function Counted({ value }: { value: string }) {
      return (
        <StringsProvider strings={strings}>
          <Field.Root>
            <Field.TextInput value={value} maxLength={10} onChange={() => undefined} />
            <Field.Counter />
          </Field.Root>
        </StringsProvider>
      );
    }
    const view = render(<Counted value="12345678" />);
    const live = () => view.container.querySelector('[aria-live="polite"]')?.textContent;
    expect(live()).toBe('2 restants');
    const hint = view.container.querySelector(`[id="${screen.getByRole('textbox').getAttribute('aria-describedby')}"]`);
    expect(hint?.textContent).toBe('10 caractères maximum');
    view.rerender(<Counted value="1234567890" />);
    expect(live()).toBe('Limite atteinte');
    expect(view.container.textContent).not.toMatch(/Up to|characters|Character limit/);
  });

  it('shows a plain count without a hint when maxLength is omitted', () => {
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="abcd" onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    expect(container.textContent).toContain('4');
    expect(container.textContent).not.toContain('/');
    expect(container.querySelector('[aria-live]')).toBeNull();
    expect(container.textContent).not.toContain('Up to');
  });

  it('uses different hint ids on two fields', () => {
    const { container } = render(
      <>
        <Field.Root>
          <Field.TextInput value="a" maxLength={5} onChange={() => undefined} />
          <Field.Counter />
        </Field.Root>
        <Field.Root>
          <Field.Textarea value="b" maxLength={5} onChange={() => undefined} />
          <Field.Counter />
        </Field.Root>
      </>,
    );
    const ids = [...container.querySelectorAll('[id]')].map((node) => node.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => container.querySelector(`input, textarea`) && id).length).toBeGreaterThan(1);
  });

  it('warns once outside Root and once with no input', async () => {
    vi.resetModules();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const mod = await import('./Field');
    const { render: renderFresh } = await import('@testing-library/react');
    renderFresh(<mod.Field.Counter />);
    renderFresh(<mod.Field.Counter />);
    expect(console.warn).toHaveBeenCalledTimes(1);
    cleanup();
    vi.resetModules();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const again = await import('./Field');
    renderFresh(
      <again.Field.Root>
        <again.Field.Counter />
      </again.Field.Root>,
    );
    renderFresh(
      <again.Field.Root>
        <again.Field.Counter />
      </again.Field.Root>,
    );
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('sets limit, over, invalid, and disabled without marking the shell for a long value', () => {
    const over = render(
      <Field.Root>
        <Field.TextInput value="abcdef" maxLength={3} onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    const counter = over.container.querySelector('[data-todae-counter]');
    expect(counter?.hasAttribute('data-over')).toBe(true);
    expect(counter?.hasAttribute('data-limit')).toBe(false);
    expect(over.container.firstElementChild?.hasAttribute('data-invalid')).toBe(false);
    over.unmount();
    const limit = render(
      <Field.Root invalid disabled>
        <Field.Textarea value="abc" maxLength={3} onChange={() => undefined} />
        <Field.Counter />
      </Field.Root>,
    );
    const node = limit.container.querySelector('[data-todae-counter]');
    expect(node?.hasAttribute('data-limit')).toBe(true);
    expect(node?.hasAttribute('data-invalid')).toBe(true);
    expect(node?.hasAttribute('data-disabled')).toBe(true);
  });

  it('orders a leading counter to the end and does not announce the number twice', () => {
    const { container } = render(
      <Field.Root>
        <Field.Counter />
        <Field.TextInput value="hello" maxLength={40} onChange={() => undefined} />
      </Field.Root>,
    );
    expect(fieldCss).toMatch(/\[data-todae-counter\]\s*\{[^}]*order:\s*1/);
    const counter = container.querySelector('[data-todae-counter]');
    expect(counter?.querySelector('[aria-hidden="true"]')?.textContent).toBe('5 / 40');
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('');
  });

  it('warns once for a bad rows value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    function Box() {
      const [value, setValue] = useState('a');
      return (
        <Field.Root>
          <Field.Textarea value={value} rows={0} onChange={(event) => setValue(event.target.value)} />
        </Field.Root>
      );
    }
    const view = render(<Box />);
    const calls = warn.mock.calls.length;
    fireEvent.change(view.container.querySelector('textarea') as HTMLTextAreaElement, { target: { value: 'ab' } });
    expect(warn.mock.calls.length).toBe(calls);
    expect(calls).toBeGreaterThan(0);
    warn.mockRestore();
  });
});

function cssBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
}

describe('Field alignment', () => {
  it('matches the Gate C5 declaration list', () => {
    expect(cssBlock(fieldCss, '.shell {')).toContain('align-items: flex-start');
    expect(cssBlock(fieldCss, '.shell {')).not.toContain('align-items: center');
    const textareaShell = cssBlock(fieldCss, '.shell:has(> .textarea) {');
    expect(textareaShell).toContain('padding: 0');
    expect(textareaShell).not.toContain('align-items');
    const input = cssBlock(fieldCss, '.input {');
    expect(input.indexOf('line-height: var(--todae-field-leading)')).toBeGreaterThan(input.indexOf('font: inherit'));
    const adornment = cssBlock(fieldCss, '.adornment {');
    expect(adornment).toContain('font-size: var(--todae-field-font-size)');
    expect(adornment).toContain('line-height: var(--todae-field-leading)');
    expect(adornment).toContain('height: 1lh');
    expect(cssBlock(fieldCss, '.flow {')).toContain(
      '--todae-field-chip-row-h: calc(var(--todae-field-font-size) * var(--todae-field-leading))',
    );
    expect(fieldCss).not.toContain('--todae-chip-font-size) * 1.25');
    const span = cssBlock(fieldCss, '.flow > span {');
    const rowSpan = cssBlock(fieldCss, '.flow > .row > span {');
    for (const block of [span, rowSpan]) {
      expect(block).toContain('box-sizing: border-box');
      expect(block).toContain('height: var(--todae-field-chip-row-h)');
      expect(block).toContain('padding-block: 0');
    }
    const body = (block: string) => block.slice(block.indexOf('{')).replace(/\s+/g, '');
    expect(body(span)).toBe(body(rowSpan));
    expect(body(cssBlock(fieldCss, '.flow[data-max-rows] {'))).toBe(body(cssBlock(fieldCss, '.flow > .row[data-max-rows] {')));
    expect(cssBlock(chipCss, '.root {')).not.toMatch(/(^|\n)\s*height\s*:/);
    expect(cssBlock(fieldCss, '.shell:has(> .textarea) > .adornment {')).toContain(
      'margin-top: var(--todae-field-padding-y)',
    );
    expect(fieldCss).not.toMatch(/\.adornment[^{]*\.(row|data-chip-layout)/);
    expect(fieldCss).not.toContain('flex-end');
    for (const density of ['compact', 'comfortable', 'spacious']) {
      const block = cssBlock(tokensCss, `[data-density="${density}"]`);
      expect(block).not.toContain('--todae-field-font-size');
      expect(block).not.toContain('--todae-font-leading-default');
    }
    expect(tokensCss).toContain('--todae-field-leading: var(--_todae-field-leading, var(--todae-font-leading-default))');
  });
});

describe('Field.Row', () => {
  function Null() {
    return null;
  }

  it('renders one div in source order with no role', () => {
    const { container } = render(
      <Field.Root>
        <Field.Row className="extra">
          <span>A</span>
          <span>B</span>
        </Field.Row>
      </Field.Root>,
    );
    const row = container.querySelector('[class*="row"]') as HTMLElement;
    expect(row.tagName).toBe('DIV');
    expect(row.className).toContain('extra');
    expect(row.getAttribute('role')).toBeNull();
    expect([...row.childNodes].map((node) => node.textContent)).toEqual(['A', 'B']);
    expect(cssBlock(fieldCss, '.row {')).not.toMatch(/[^a-z-]order\s*:/);
    expect(cssBlock(fieldCss, '.row:empty {')).toContain('display: none');
  });

  it('collapses when it has no element children', () => {
    const show = false;
    const html = renderToString(
      <Field.Root>
        <Field.Row>
          {show && <span>x</span>}
          {[].map(() => null)}
          <Null />
        </Field.Row>
      </Field.Root>,
    );
    expect(html).toContain('row');
    expect(html).not.toContain('<!--');
    const { container, rerender } = render(
      <Field.Root>
        <Field.Row>
          {show && <span>x</span>}
          <Null />
        </Field.Row>
      </Field.Root>,
    );
    const row = container.querySelector('[class*="row"]') as HTMLElement;
    expect(row.childNodes.length).toBe(0);
    expect(row.matches(':empty')).toBe(true);
    rerender(
      <Field.Root>
        <Field.Row>
          <span>x</span>
        </Field.Row>
      </Field.Root>,
    );
    expect(container.querySelector('[class*="row"]')?.matches(':empty')).toBe(false);
  });

  it('places the row where it is written and keeps the counter hint', () => {
    const { container } = render(
      <Field.Root aria-describedby="desc">
        <Field.Textarea value="hello" maxLength={40} onChange={() => undefined} />
        <Field.Row>
          <span>bottom</span>
          <Field.Counter />
        </Field.Row>
      </Field.Root>,
    );
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.lastElementChild?.textContent).toContain('bottom');
    expect(shell.querySelector(':scope > [data-todae-counter]')).toBeNull();
    const hint = container.querySelector('[class*="srOnly"]');
    expect(shell.querySelector('textarea')?.getAttribute('aria-describedby')).toBe(`desc ${hint?.id}`);
    expect(container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    const row = cssBlock(fieldCss, '.row {');
    expect(row).toContain('flex: 0 0 100%');
    expect(row).toContain('flex-wrap: wrap');
    expect(row).not.toMatch(/padding|margin|height|min-height/);
    expect(cssBlock(fieldCss, '.shell > .textarea ~ .row {')).toContain(
      'padding: 0 var(--todae-field-padding-x) var(--todae-field-padding-y)',
    );
    expect(cssBlock(fieldCss, '.shell > .row:has(~ .textarea) {')).toContain(
      'padding: var(--todae-field-padding-y) var(--todae-field-padding-x) 0',
    );
    expect(fieldCss).toContain('.shell:has(> .row:not(:empty))');
    expect(cssBlock(fieldCss, '.shell:has(> .row:not(:empty)) > :is(.input, .textarea, .flow) {')).toContain('flex: 1 1 0');
    const size = tokensCss.match(/--todae-field-row-control-size:\s*var\(--_todae-field-row-control-size,\s*([0-9.]+)rem/)?.[1];
    expect(Number(size)).toBeGreaterThanOrEqual(1.5);
    for (const density of ['compact', 'comfortable', 'spacious']) {
      expect(cssBlock(tokensCss, `[data-density="${density}"]`)).not.toContain('--todae-field-row-control-size');
    }
  });

  it('does not size a growing textarea when a row is present', () => {
    const observe = vi.fn();
    class ResizeObserver {
      observe = observe;
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
    vi.stubGlobal('ResizeObserver', ResizeObserver);
    const add = vi.spyOn(HTMLTextAreaElement.prototype, 'addEventListener');
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="hi" onChange={() => undefined} autoGrow maxRows={4} />
        <Field.Row>
          <span>send</span>
        </Field.Row>
      </Field.Root>,
    );
    expect(observe).not.toHaveBeenCalled();
    expect(add.mock.calls.map(([type]) => type)).not.toContain('input');
    const shell = container.firstElementChild as HTMLElement;
    expect(shell.lastElementChild?.textContent).toBe('send');
    add.mockRestore();
    vi.unstubAllGlobals();
  });

  it('toggles Send with the value and keeps ids unique', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Composer({ initial }: { initial: string }) {
      const [value, setValue] = useState(initial);
      return (
        <Field.Root>
          <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} autoGrow maxRows={6} />
          <Field.Row>
            <Button.Root aria-label="Attach file" variant="ghost">
              <Button.Icon>
                <svg />
              </Button.Icon>
            </Button.Root>
            <Button.Root aria-label="Send" disabled={value.trim() === ''} style={{ marginInlineStart: 'auto' }}>
              <Button.Icon>
                <svg />
              </Button.Icon>
            </Button.Root>
          </Field.Row>
        </Field.Root>
      );
    }
    const view = render(
      <StrictMode>
        <Composer initial="" />
        <Composer initial="hi" />
      </StrictMode>,
    );
    const sends = screen.getAllByRole('button', { name: 'Send' });
    expect(sends[0]).toHaveProperty('disabled', true);
    expect(sends[1]).toHaveProperty('disabled', false);
    fireEvent.change(view.container.querySelectorAll('textarea')[0] as HTMLTextAreaElement, { target: { value: 'ok' } });
    expect(screen.getAllByRole('button', { name: 'Send' })[0]).toHaveProperty('disabled', false);
    const ids = [...view.container.querySelectorAll('textarea')].map((node) => node.id);
    expect(new Set(ids).size).toBe(2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('does not move focus from a row button', () => {
    const { container } = render(
      <Field.Root>
        <Field.Textarea value="" onChange={() => undefined} />
        <Field.Row>
          <Button.Root aria-label="Attach file" variant="ghost">
            <Button.Icon>
              <svg />
            </Button.Icon>
          </Button.Root>
          <Button.Root aria-label="Send" disabled>
            <Button.Icon>
              <svg />
            </Button.Icon>
          </Button.Root>
        </Field.Row>
      </Field.Root>,
    );
    const attach = screen.getByRole('button', { name: 'Attach file' });
    const send = screen.getByRole('button', { name: 'Send' });
    expect(send).toHaveProperty('disabled', true);
    expect(send.getAttribute('aria-disabled')).toBeNull();
    for (const target of [attach, attach.querySelector('svg') as Element, send]) {
      const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(document.activeElement).not.toBe(container.querySelector('textarea'));
    const row = container.querySelector('[class*="row"]') as HTMLElement;
    fireEvent.mouseDown(row);
    expect(document.activeElement).toBe(container.querySelector('textarea'));
    expect(cssBlock(fieldCss, '.row > [data-icon-only]')).toContain('var(--todae-field-row-control-size)');
    expect(cssBlock(fieldCss, '.row > [data-icon-only]')).toContain('box-sizing: border-box');
  });
});

describe('Field.ChipInput row', () => {
  it('puts chips in a row above the input and omits the attribute inline', () => {
    const inline = renderToString(
      <Field.Root>
        <Field.ChipInput
          chips={[]}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>,
    );
    const row = renderToString(
      <Field.Root>
        <Field.ChipInput
          chipLayout="row"
          chips={[]}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>,
    );
    expect(inline).not.toContain('data-chip-layout');
    expect(row.replace(' data-chip-layout="row"', '')).toBe(inline);
    const { container } = render(
      <Field.Root>
        <Field.Icon>
          <span>chevron</span>
        </Field.Icon>
        <Field.ChipInput
          chipLayout="row"
          chips={['Alpha', 'Beta']}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
        <Field.Affix>tag</Field.Affix>
      </Field.Root>,
    );
    const shell = container.firstElementChild as HTMLElement;
    const flow = shell.querySelector('[class*="flow"]') as HTMLElement;
    expect([...shell.children].map((node) => node.className.includes('flow'))).toEqual([false, true, false]);
    expect(flow.getAttribute('data-chip-layout')).toBe('row');
    expect(flow.firstElementChild?.className).toContain('row');
    expect(flow.querySelector(':scope > input')).toBeTruthy();
    expect(shell.querySelector(':scope > input, :scope > [class*="row"]')).toBeNull();
    expect(flow.getAttribute('role')).toBeNull();
    expect(flow.querySelector('[class*="row"]')?.getAttribute('role')).toBeNull();
  });

  it('clamps chip lines on the row, not the flow', () => {
    const { container } = render(
      <Field.Root>
        <Field.ChipInput
          chipLayout="row"
          chips={['Alpha', 'Beta', 'Gamma', 'Delta']}
          inputValue=""
          maxRows={1}
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>,
    );
    const flow = container.querySelector('[class*="flow"]') as HTMLElement;
    const row = flow.querySelector(':scope > [class*="row"]') as HTMLElement;
    expect(flow.hasAttribute('data-max-rows')).toBe(false);
    expect(row.getAttribute('data-max-rows')).toBe('1');
    expect(row.style.getPropertyValue('--todae-field-chip-rows')).toBe('1');
    expect(flow.querySelector('input')?.parentElement).toBe(flow);
    expect(row.contains(flow.querySelector('input'))).toBe(false);
  });

  it('keeps label, description, and backspace on the input', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Box() {
      const field = useChipField({ initialChips: ['Alpha', 'Beta', 'Gamma'] });
      return (
        <Field.Root id="tags" aria-describedby="hint err" invalid>
          <Field.ChipInput {...field.getChipInputProps()} chipLayout="row" />
        </Field.Root>
      );
    }
    const { container } = render(
      <>
        <label htmlFor="tags">Tags</label>
        <Box />
      </>,
    );
    const input = screen.getByRole('textbox', { name: 'Tags' });
    expect(screen.getByLabelText('Tags')).toBe(input);
    expect(input.id).toBe('tags');
    expect(container.querySelectorAll('#tags')).toHaveLength(1);
    expect(input.getAttribute('aria-describedby')).toBe('hint err');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const flow = input.parentElement as HTMLElement;
    const row = flow.querySelector(':scope > [class*="row"]') as HTMLElement;
    for (const node of [flow, row]) {
      for (const name of node.getAttributeNames()) {
        expect(name === 'class' || name === 'style' || name.startsWith('data-')).toBe(true);
      }
    }
    input.focus();
    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    document.activeElement?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('returns focus to the input when the last chip leaves the row', () => {
    function Box() {
      const [chips, setChips] = useState(['Only']);
      return (
        <Field.Root>
          <Field.ChipInput
            chipLayout="row"
            chips={chips}
            inputValue=""
            onInputValueChange={() => undefined}
            onCommit={() => undefined}
            onChipRemove={() => setChips([])}
          />
        </Field.Root>
      );
    }
    const { container } = render(<Box />);
    const input = screen.getByRole('textbox');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Only' }));
    expect(document.activeElement).toBe(input);
    const flow = container.querySelector('[class*="flow"]') as HTMLElement;
    expect(flow.querySelector('[class*="row"]')).toBeNull();
    expect(flow.getAttribute('data-chip-layout')).toBe('row');
    expect([...flow.children]).toEqual([input]);
  });

  it('measures an empty row without clamping the input line', () => {
    const html = renderToString(
      <Field.Root>
        <Field.ChipInput
          chipLayout="row"
          chips={[]}
          inputValue=""
          maxRows={2}
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>,
    );
    expect(html).not.toContain('class="_row_');
    expect(html).toContain('data-chip-layout="row"');
    expect(html).not.toContain('data-max-rows');
    const { container } = render(
      <Field.Root>
        <Field.ChipInput
          chipLayout="row"
          chips={[]}
          inputValue=""
          maxRows={2}
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>,
    );
    const flow = container.querySelector('[class*="flow"]') as HTMLElement;
    const input = flow.querySelector('input');
    const measure = flow.querySelector('[inert][aria-hidden]');
    expect(flow.querySelector('[class*="row"]')).toBeNull();
    expect([...flow.children]).toEqual([input, measure]);
    expect(flow.querySelector('.measure, [class*="measure"] span')?.parentElement).not.toBe(flow);
  });

  it('merges Field.Root and own aria-describedby on Field.ChipInput', () => {
    render(
      <Field.Root aria-describedby="root-hint">
        <Field.ChipInput
          chips={['a']}
          inputValue=""
          aria-describedby="own-hint"
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
        />
      </Field.Root>,
    );
    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe('root-hint own-hint');
  });
});

describe('Field input labels', () => {
  const noop = () => undefined;
  type LabelProps = { 'aria-label'?: string; 'aria-labelledby'?: string };
  const parts: Record<string, (p: LabelProps) => ReactNode> = {
    TextInput: (p) => <Field.TextInput value="" onChange={noop} {...p} />,
    Textarea: (p) => <Field.Textarea value="" onChange={noop} {...p} />,
    ChipInput: (p) => (
      <Field.ChipInput chips={[]} inputValue="" onInputValueChange={noop} onCommit={noop} onChipRemove={noop} {...p} />
    ),
  };

  for (const [name, Part] of Object.entries(parts)) {
    it(`${name} keeps its own aria-label and aria-labelledby`, () => {
      render(
        <Field.Root aria-label="Root name" aria-labelledby="root-label">
          <Part aria-label="Own name" aria-labelledby="own-label" />
        </Field.Root>,
      );
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-label')).toBe('Own name');
      expect(input.getAttribute('aria-labelledby')).toBe('own-label');
    });

    it(`${name} takes neither Root label when it names itself`, () => {
      const { unmount } = render(
        <Field.Root aria-label="Root name" aria-labelledby="root-label">
          <Part aria-label="Own name" />
        </Field.Root>,
      );
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-label')).toBe('Own name');
      expect(input.hasAttribute('aria-labelledby')).toBe(false);
      unmount();
      render(
        <Field.Root aria-label="Root name" aria-labelledby="root-label">
          <Part aria-labelledby="own-label" />
        </Field.Root>,
      );
      const second = screen.getByRole('textbox');
      expect(second.getAttribute('aria-labelledby')).toBe('own-label');
      expect(second.hasAttribute('aria-label')).toBe(false);
    });

    it(`${name} falls back to the Root's labels`, () => {
      render(
        <Field.Root aria-label="Root name" aria-labelledby="root-label">
          <Part />
        </Field.Root>,
      );
      const input = screen.getByRole('textbox');
      expect(input.getAttribute('aria-label')).toBe('Root name');
      expect(input.getAttribute('aria-labelledby')).toBe('root-label');
    });
  }
});
