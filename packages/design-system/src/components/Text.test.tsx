import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement, StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Text as ClientText } from './Text.client.js';
import { Text, type TextAs, type TextRootProps } from './Text.js';
import styles from './Text.module.css';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function classesOf(el: Element) {
  return [...el.classList];
}

describe('Text', () => {
  it('renders a paragraph at the medium size, with color and weight left to the root class', () => {
    render(<Text.Root data-testid="t">Hi</Text.Root>);
    const el = screen.getByTestId('t');
    expect(el.tagName).toBe('P');
    expect(classesOf(el)).toEqual([styles.root]);
  });

  it.each<TextAs>(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])('renders %s as a heading with no scale class', (tag) => {
    render(<Text.Root as={tag}>Title</Text.Root>);
    const el = screen.getByRole('heading', { level: Number(tag.slice(1)) });
    expect(el.tagName).toBe(tag.toUpperCase());
    expect(classesOf(el)).toEqual([styles.root, styles.heading]);
  });

  it('lets a heading take another weight and keeps the heading class', () => {
    render(
      <Text.Root as="h2" weight="medium">
        Quiet
      </Text.Root>,
    );
    const el = screen.getByRole('heading', { level: 2 });
    expect(classesOf(el)).toEqual([styles.root, styles.heading, styles.medium]);
  });

  it('drops a leftover size instead of painting it on the element', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const legacy = { size: 'label', children: 'Eyebrow', 'data-testid': 't' };
    const view = render(createElement(Text.Root, legacy));
    const el = screen.getByTestId('t');
    expect(el.hasAttribute('size')).toBe(false);
    expect(el.classList.contains(styles.label!)).toBe(false);
    expect(classesOf(el)).toEqual([styles.root]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('no longer takes size'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('variant="label"'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('text.font.size'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('--todae-text-font-size'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('font.size.*'));
    view.rerender(createElement(Text.Root, legacy));
    expect(error).toHaveBeenCalledTimes(1);
    const small = { size: 's', children: 'Caption', 'data-testid': 's' };
    render(createElement(Text.Root, small));
    const smallEl = screen.getByTestId('s');
    expect(smallEl.hasAttribute('size')).toBe(false);
    expect(classesOf(smallEl)).toEqual([styles.root]);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  it('rejects size on TextRootProps', () => {
    expectTypeOf<TextRootProps>().not.toHaveProperty('size');
  });

  it('gives the label role its own class, and adds a tone or weight only when given', () => {
    render(
      <>
        <Text.Root variant="label" data-testid="plain">
          Eyebrow
        </Text.Root>
        <Text.Root variant="label" tone="accent" weight="bold" data-testid="set">
          Eyebrow
        </Text.Root>
        <Text.Root as="h2" variant="label" data-testid="heading">
          Eyebrow
        </Text.Root>
      </>,
    );
    expect(classesOf(screen.getByTestId('plain'))).toEqual([styles.root, styles.label]);
    expect(classesOf(screen.getByTestId('set'))).toEqual([styles.root, styles.label, styles.accent, styles.bold]);
    expect(classesOf(screen.getByTestId('heading'))).toEqual([styles.root, styles.heading, styles.label]);
  });

  it('orders the sheet so a role replaces the defaults and a given tone or weight wins', () => {
    const sheet = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Text.module.css'), 'utf8');
    const at = (cls: string) => {
      const rules = sheet.split(`.${cls} {`);
      expect(rules, `.${cls} has one rule`).toHaveLength(2);
      return rules[0]!.length;
    };
    expect(at('root')).toBeLessThan(at('heading'));
    expect(at('heading')).toBeLessThan(at('label'));
    for (const cls of ['default', 'muted', 'accent', 'regular', 'medium', 'bold']) expect(at('label')).toBeLessThan(at(cls));
  });

  it('sizes body and each heading element from a component token, with no scale class', () => {
    const sheet = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Text.module.css'), 'utf8');
    for (const cls of ['s', 'm', 'l', 'xl', 'xxl']) expect(sheet.includes(`.${cls} {`)).toBe(false);
    expect(sheet).not.toContain('var(--todae-font-size-');
    expect(sheet).toContain('font-size: var(--todae-text-font-size)');
    for (const level of [1, 2, 3, 4, 5, 6]) {
      expect(sheet).toContain(`.root:is(h${level})`);
      expect(sheet).toContain(`var(--todae-text-h${level}-font-size)`);
    }
    const labelRoot = sheet.indexOf('.root:is(.label)');
    const h1 = sheet.indexOf('.root:is(h1)');
    expect(labelRoot).toBeGreaterThan(h1);
  });

  it('clamps to lines through a class and --_lines, keeping the given style', () => {
    render(
      <Text.Root lines={2} style={{ color: 'red' }} data-testid="t">
        Long
      </Text.Root>,
    );
    const el = screen.getByTestId('t');
    expect(classesOf(el)).toEqual([styles.root, styles.clamp]);
    expect(el.style.getPropertyValue('--_lines')).toBe('2');
    expect(el.style.color).toBe('red');
  });

  it.each([0, -1, 1.5, Number.NaN])('clamps nothing for lines={%s}', (lines) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(
        <Text.Root lines={lines} data-testid="t">
          Long
        </Text.Root>,
      );
      const el = screen.getByTestId('t');
      expect(el.classList.contains(styles.clamp!)).toBe(false);
      expect(el.style.getPropertyValue('--_lines')).toBe('');
    } finally {
      error.mockRestore();
    }
  });

  it('logs a development error once for each value of lines that is not a whole number of 1 or more', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(<Text.Root lines={-2}>Long</Text.Root>);
      render(<Text.Root lines={-2}>Again</Text.Root>);
      expect(error).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith('Text.Root lines must be a whole number of 1 or more; got -2');
    } finally {
      error.mockRestore();
    }
  });
});

describe('Text from the main entry', () => {
  it('renders the same element, with an anchor for its tip only while it clamps with one', () => {
    const { rerender } = render(<ClientText.Root data-testid="t">Long</ClientText.Root>);
    const el = screen.getByTestId('t');
    expect(classesOf(el)).toEqual([styles.root]);
    expect(el.style.getPropertyValue('anchor-name')).toBe('');
    rerender(
      <ClientText.Root lines={1} data-testid="t">
        Long
      </ClientText.Root>,
    );
    expect(screen.getByTestId('t')).toBe(el);
    expect(el.classList.contains(styles.clamp!)).toBe(true);
    expect(el.style.getPropertyValue('anchor-name')).toMatch(/^--todae-text-/);
    rerender(
      <ClientText.Root lines={1} tooltip={false} data-testid="t">
        Long
      </ClientText.Root>,
    );
    expect(el.style.getPropertyValue('anchor-name')).toBe('');
  });

  function size(el: HTMLElement, scroll: number, client = 40) {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scroll });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: client });
  }

  function advance(ms: number) {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  }

  it('reads no layout on mount and tips only when a hover finds the text cut', () => {
    vi.useFakeTimers();
    render(
      <ClientText.Root lines={1} data-testid="t">
        Quarterly revenue report
      </ClientText.Root>,
    );
    const el = screen.getByTestId('t');
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    size(el, 120);
    // A cut that no one reaches stays unmeasured.
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    fireEvent.pointerEnter(el);
    expect(el.hasAttribute('data-todae-cut')).toBe(true);
    advance(300);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Quarterly revenue report');
    vi.useRealTimers();
  });

  it('shows no tip and sets no marker for a hover on text that fits', () => {
    vi.useFakeTimers();
    render(
      <ClientText.Root lines={1} data-testid="t">
        Quarterly revenue report
      </ClientText.Root>,
    );
    const el = screen.getByTestId('t');
    size(el, 40);
    fireEvent.pointerEnter(el);
    advance(300);
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    vi.useRealTimers();
  });

  it('tips at the next hover after a weight change cuts it', () => {
    vi.useFakeTimers();
    const view = (weight?: 'bold') => (
      <ClientText.Root lines={1} weight={weight} data-testid="t">
        Quarterly revenue report
      </ClientText.Root>
    );
    const { rerender } = render(view());
    const el = screen.getByTestId('t');
    size(el, 40);
    fireEvent.pointerEnter(el);
    fireEvent.pointerLeave(el);
    size(el, 120);
    rerender(view('bold'));
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    fireEvent.pointerEnter(el);
    advance(300);
    expect(el.hasAttribute('data-todae-cut')).toBe(true);
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Quarterly revenue report');
    vi.useRealTimers();
  });

  it('drops its tip and marker when a later hover finds the text fits', () => {
    vi.useFakeTimers();
    render(
      <ClientText.Root lines={1} data-testid="t">
        Quarterly revenue report
      </ClientText.Root>,
    );
    const el = screen.getByTestId('t');
    size(el, 120);
    fireEvent.pointerEnter(el);
    advance(300);
    expect(screen.getByRole('tooltip', { hidden: true })).toBeTruthy();
    fireEvent.pointerLeave(el);
    advance(300);
    size(el, 40);
    fireEvent.pointerEnter(el);
    advance(300);
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    vi.useRealTimers();
  });

  it('reads nothing when the consumer prevents the pointer enter', () => {
    render(
      <ClientText.Root lines={1} data-testid="t" onPointerEnter={(event) => event.preventDefault()}>
        Quarterly revenue report
      </ClientText.Root>,
    );
    const el = screen.getByTestId('t');
    const reads = vi.fn(() => 120);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: reads });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    fireEvent.pointerEnter(el);
    expect(reads).not.toHaveBeenCalled();
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
  });

  it('tips the first cut text when keys move focus to the row that holds it', () => {
    vi.useFakeTimers();
    render(
      <div tabIndex={0} data-testid="row">
        <ClientText.Root lines={1} data-testid="a">
          Fits
        </ClientText.Root>
        <ClientText.Root lines={1} data-testid="b">
          Quarterly revenue report
        </ClientText.Root>
        <ClientText.Root lines={1} data-testid="c">
          Annual revenue report
        </ClientText.Root>
      </div>,
    );
    size(screen.getByTestId('a'), 40);
    size(screen.getByTestId('b'), 120);
    size(screen.getByTestId('c'), 120);
    const row = screen.getByTestId('row');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => {
      row.focus();
    });
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Quarterly revenue report');
    expect(screen.getByTestId('c').hasAttribute('data-todae-cut')).toBe(false);
    act(() => {
      row.blur();
    });
    advance(300);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    vi.useRealTimers();
  });

  it('closes a tip that keyboard focus opened when that focus leaves, under StrictMode', () => {
    vi.useFakeTimers();
    render(
      <StrictMode>
        <div tabIndex={0} data-testid="row">
          <ClientText.Root lines={1} data-testid="t">
            Quarterly revenue report
          </ClientText.Root>
        </div>
      </StrictMode>,
    );
    size(screen.getByTestId('t'), 120);
    const row = screen.getByTestId('row');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => {
      row.focus();
    });
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Quarterly revenue report');
    act(() => {
      row.blur();
    });
    advance(300);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    vi.useRealTimers();
  });

  it('opens no tip when a tap focuses editable text, which shows the ring for any focus, and one when keys do', () => {
    vi.useFakeTimers();
    render(
      <>
        <ClientText.Root lines={1} contentEditable suppressContentEditableWarning data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
        <button type="button" data-testid="away">
          Away
        </button>
      </>,
    );
    const el = screen.getByTestId('t');
    size(el, 120);
    fireEvent.pointerDown(el, { pointerType: 'touch' });
    act(() => {
      el.focus();
    });
    expect(el.matches(':focus-visible')).toBe(true);
    advance(300);
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    expect(screen.queryByRole('tooltip', { hidden: true })).toBeNull();
    act(() => {
      screen.getByTestId('away').focus();
    });
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true });
    act(() => {
      el.focus();
    });
    expect(screen.getByRole('tooltip', { hidden: true }).textContent).toBe('Quarterly revenue report');
    vi.useRealTimers();
  });

  it('builds no observer for any clamped text on the page', () => {
    const made = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          made('resize');
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const RealMutationObserver = globalThis.MutationObserver;
    vi.stubGlobal(
      'MutationObserver',
      class extends RealMutationObserver {
        constructor(callback: MutationCallback) {
          super(callback);
          made('mutation');
        }
      },
    );
    render(
      <div>
        {Array.from({ length: 50 }, (_, i) => (
          <ClientText.Root key={i} lines={1}>
            Quarterly revenue report {i}
          </ClientText.Root>
        ))}
      </div>,
    );
    expect(made).not.toHaveBeenCalled();
  });

  it('builds no observer and reads no layout when a parent renders a clamped text again unchanged', () => {
    const made = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor() {
          made('resize');
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    const RealMutationObserver = globalThis.MutationObserver;
    vi.stubGlobal(
      'MutationObserver',
      class extends RealMutationObserver {
        constructor(callback: MutationCallback) {
          super(callback);
          made('mutation');
        }
      },
    );
    const page = () => (
      <div>
        <ClientText.Root lines={1} data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
      </div>
    );
    const { rerender } = render(page());
    const el = screen.getByTestId('t');
    const reads = vi.fn(() => 0);
    for (const prop of ['scrollWidth', 'clientWidth', 'scrollHeight', 'clientHeight']) {
      Object.defineProperty(el, prop, { configurable: true, get: reads });
    }
    made.mockClear();
    rerender(page());
    expect(made).not.toHaveBeenCalled();
    expect(reads).not.toHaveBeenCalled();
  });
});
