import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { createPortal } from 'react-dom';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Text as ClientText } from './Text.client.js';
import { Text, type TextAs, type TextRootProps } from './Text.js';
import styles from './Text.module.css';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

  it('measures a clamped text again when a weight change cuts it without changing its box', () => {
    const { rerender } = render(
      <ClientText.Root lines={1} data-testid="t">
        Quarterly revenue report
      </ClientText.Root>,
    );
    const el = screen.getByTestId('t');
    expect(el.hasAttribute('data-todae-cut')).toBe(false);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 120 });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    rerender(
      <ClientText.Root lines={1} weight="bold" data-testid="t">
        Quarterly revenue report
      </ClientText.Root>,
    );
    expect(el.hasAttribute('data-todae-cut')).toBe(true);
  });

  it('measures a clamped text again when an attribute around it, such as a selected row, cuts it', async () => {
    const row = (selected: boolean) => (
      <div className={selected ? 'selected' : undefined} aria-selected={selected}>
        <ClientText.Root lines={1} data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
      </div>
    );
    const { rerender } = render(row(false));
    const el = screen.getByTestId('t');
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (el.closest('.selected') ? 120 : 40) });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    rerender(row(true));
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(true));
    rerender(row(false));
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(false));
  });

  it('measures a clamped text again when an inline style around it, such as a font size, cuts it', async () => {
    const { rerender } = render(
      <div style={{ fontSize: 14 }}>
        <ClientText.Root lines={1} data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
      </div>,
    );
    const el = screen.getByTestId('t');
    const wrap = el.parentElement!;
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (wrap.style.fontSize === '20px' ? 120 : 40) });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    rerender(
      <div style={{ fontSize: 20 }}>
        <ClientText.Root lines={1} data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
      </div>,
    );
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(true));
  });

  it('measures a clamped text in a shadow root again when its host is restyled', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const container = document.createElement('div');
    host.attachShadow({ mode: 'open' }).append(container);
    render(
      <ClientText.Root lines={1} data-testid="t">
        Quarterly revenue report
      </ClientText.Root>,
      { container },
    );
    const el = container.querySelector('[data-testid="t"]') as HTMLElement;
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (host.classList.contains('selected') ? 120 : 40) });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    host.classList.add('selected');
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(true));
    host.remove();
  });

  it('reads no layout when a list around a clamped text moves its active option', async () => {
    const list = (active: string) => (
      <div role="listbox" aria-activedescendant={active}>
        <ClientText.Root lines={1} data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
        <div id="a" />
        <div id="b" />
      </div>
    );
    const { rerender } = render(list('a'));
    const el = screen.getByTestId('t');
    const reads = vi.fn(() => 40);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: reads });
    rerender(list('b'));
    el.parentElement!.setAttribute('data-probe', '1');
    await waitFor(() => expect(reads).toHaveBeenCalled());
    reads.mockClear();
    rerender(list('a'));
    await new Promise((done) => setTimeout(done, 50));
    expect(reads).not.toHaveBeenCalled();
  });

  it('stops measuring when product CSS keyed on the cut marker would uncut the text', async () => {
    render(
      <div className="row">
        <ClientText.Root lines={1} data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
      </div>,
    );
    const el = screen.getByTestId('t');
    // Like `.row:has([data-todae-cut]) .meta { display: none }`, which frees the room the text needs.
    const reads = vi.fn(() => (el.hasAttribute('data-todae-cut') ? 40 : 120));
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: reads });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    el.parentElement!.className = 'row wide';
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(true));
    await new Promise((done) => setTimeout(done, 20));
    expect(reads.mock.calls.length).toBeLessThan(5);
  });

  it('measures a clamped text again when a commit shows a hidden part of it', () => {
    const line = (more: boolean) => (
      <ClientText.Root lines={1} data-testid="t">
        Report <span hidden={!more}>with a much longer tail</span>
      </ClientText.Root>
    );
    const { rerender } = render(line(false));
    const el = screen.getByTestId('t');
    const tail = el.querySelector('span')!;
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (tail.hidden ? 40 : 120) });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    rerender(line(true));
    expect(el.hasAttribute('data-todae-cut')).toBe(true);
  });

  it('measures a clamped text once when its own class changes', async () => {
    render(
      <ClientText.Root lines={1} data-testid="t">
        Quarterly revenue report
      </ClientText.Root>,
    );
    const el = screen.getByTestId('t');
    const reads = vi.fn(() => 40);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: reads });
    el.classList.add('changed');
    await waitFor(() => expect(reads).toHaveBeenCalled());
    await new Promise((done) => setTimeout(done, 50));
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('measures once, when it ends, for an animation that writes an inline style around a clamped text each frame', async () => {
    render(
      <div>
        <ClientText.Root lines={1} data-testid="t">
          Quarterly revenue report
        </ClientText.Root>
      </div>,
    );
    const el = screen.getByTestId('t');
    const reads = vi.fn(() => 40);
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: reads });
    const panel = el.parentElement!;
    for (let frame = 0; frame < 10; frame++) {
      panel.style.transform = `translateX(${frame}px)`;
      await new Promise((done) => requestAnimationFrame(done));
    }
    expect(reads).not.toHaveBeenCalled();
    await waitFor(() => expect(reads).toHaveBeenCalled());
    await new Promise((done) => setTimeout(done, 50));
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('measures a clamped text portaled into an iframe again when a class around it cuts it', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const body = frame.contentDocument!.body;
    const row = (selected: boolean) =>
      createPortal(
        <div className={selected ? 'selected' : undefined}>
          <ClientText.Root lines={1} data-testid="t">
            Quarterly revenue report
          </ClientText.Root>
        </div>,
        body,
      );
    const { rerender, unmount } = render(row(false));
    const el = body.querySelector('[data-testid="t"]') as HTMLElement;
    Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => (el.parentElement!.className ? 120 : 40) });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 40 });
    rerender(row(true));
    await waitFor(() => expect(el.hasAttribute('data-todae-cut')).toBe(true));
    unmount();
    frame.remove();
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
