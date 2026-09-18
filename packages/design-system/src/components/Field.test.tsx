import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  Field,
  type FieldAffixProps,
  type FieldChipInputProps,
  type FieldIconProps,
  type FieldRootProps,
  type FieldTextInputProps,
} from './Field';
import * as api from '../index';

afterEach(cleanup);

describe('Field exports', () => {
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
      ChipInput: Field.ChipInput,
      Icon: Field.Icon,
      Affix: Field.Affix,
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

  it('stays controlled', () => {
    const onChange = vi.fn();
    render(
      <Field.Root>
        <Field.TextInput value="kept" onChange={onChange} />
      </Field.Root>,
    );
    const input = screen.getByRole('textbox');
    expect(input).toHaveProperty('value', 'kept');
    fireEvent.change(input, { target: { value: 'next' } });
    expect(onChange).toHaveBeenCalled();
    expect(input).toHaveProperty('value', 'kept');
  });

  it('rejects file at the type level', () => {
    expectTypeOf<FieldTextInputProps['type']>().extract<'file'>().toBeNever();
    expectTypeOf<NonNullable<FieldTextInputProps['type']>>().toEqualTypeOf<
      'text' | 'search' | 'email' | 'url' | 'tel' | 'password'
    >();
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
  it('renders one chip per value plus a controlled input', () => {
    renderField({ chips: ['Alpha', 'Beta'], inputValue: 'x' });
    expect(screen.getByRole('button', { name: 'Remove Alpha' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove Beta' })).toBeTruthy();
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'x');
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

  it('ellipsizes the last live chip to soak leftover before +N', () => {
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
    const last = live.find((el) => el.hasAttribute('data-ellipsis'));
    const overflow = live.find((el) => el.hasAttribute('data-overflow'));
    expect(last?.textContent).toContain('Beta');
    expect((last as HTMLElement | undefined)?.style.maxWidth).toBe('116px');
    expect(live.some((el) => el.textContent?.includes('Alpha') && !el.hasAttribute('data-ellipsis'))).toBe(true);
    expect(overflow?.hasAttribute('data-ellipsis')).toBe(false);
    expect((overflow as HTMLElement | undefined)?.style.maxWidth).toBe('');
    expect(live.map((el) => el.outerHTML).join('')).not.toContain('Remove Gamma');
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
