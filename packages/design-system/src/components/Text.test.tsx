import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Text as ClientText } from './Text.client.js';
import { Text, type TextAs, type TextRootProps } from './Text.js';
import styles from './Text.module.css';

afterEach(cleanup);

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
});
