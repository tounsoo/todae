import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Text as ClientText } from './Text.client.js';
import { Text, type TextAs } from './Text.js';
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
    expect(classesOf(el)).toEqual([styles.root, styles.m]);
  });

  it.each<[TextAs, string]>([
    ['h1', 'xxl'],
    ['h2', 'xl'],
    ['h3', 'l'],
    ['h4', 'm'],
    ['h5', 'm'],
    ['h6', 's'],
  ])('renders %s as a heading at its default size', (tag, size) => {
    render(<Text.Root as={tag}>Title</Text.Root>);
    const el = screen.getByRole('heading', { level: Number(tag.slice(1)) });
    expect(el.tagName).toBe(tag.toUpperCase());
    expect(classesOf(el)).toEqual([styles.root, styles.heading, styles[size]]);
  });

  it('lets a heading take another size and weight', () => {
    render(
      <Text.Root as="h2" size="s" weight="medium">
        Small
      </Text.Root>,
    );
    const el = screen.getByRole('heading', { level: 2 });
    expect(el.classList.contains(styles.s!)).toBe(true);
    expect(el.classList.contains(styles.xl!)).toBe(false);
    expect(el.classList.contains(styles.medium!)).toBe(true);
    expect(el.classList.contains(styles.bold!)).toBe(false);
  });

  it('maps 2xl to a class that CSS can select', () => {
    render(
      <Text.Root size="2xl" data-testid="t">
        Big
      </Text.Root>,
    );
    expect(screen.getByTestId('t').classList.contains(styles.xxl!)).toBe(true);
  });

  it('gives the label role its own class, and adds a tone or weight only when given', () => {
    render(
      <>
        <Text.Root size="label" data-testid="plain">
          Eyebrow
        </Text.Root>
        <Text.Root size="label" tone="accent" weight="bold" data-testid="set">
          Eyebrow
        </Text.Root>
      </>,
    );
    expect(classesOf(screen.getByTestId('plain'))).toEqual([styles.root, styles.label]);
    expect(classesOf(screen.getByTestId('set'))).toEqual([styles.root, styles.label, styles.accent, styles.bold]);
  });

  // Every class has one selector of the same weight, so source order decides which color and weight apply.
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

  it('clamps to lines through a class and --_lines, keeping the given style', () => {
    render(
      <Text.Root lines={2} style={{ color: 'red' }} data-testid="t">
        Long
      </Text.Root>,
    );
    const el = screen.getByTestId('t');
    expect(classesOf(el)).toEqual([styles.root, styles.m, styles.clamp]);
    expect(el.style.getPropertyValue('--_lines')).toBe('2');
    expect(el.style.color).toBe('red');
  });

  it.each([0, -1, 1.5, Number.NaN])('clamps nothing for lines={%s}', (lines) => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <Text.Root lines={lines} data-testid="t">
        Long
      </Text.Root>,
    );
    const el = screen.getByTestId('t');
    expect(el.classList.contains(styles.clamp!)).toBe(false);
    expect(el.style.getPropertyValue('--_lines')).toBe('');
    vi.restoreAllMocks();
  });

  it('logs a development error for lines that are not a whole number of 1 or more', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      render(<Text.Root lines={0}>Long</Text.Root>);
      expect(error).toHaveBeenCalledWith('Text.Root lines must be a whole number of 1 or more; got 0');
    } finally {
      error.mockRestore();
    }
  });
});

describe('Text from the main entry', () => {
  it('renders the same element, with an anchor for its tip only while it clamps with one', () => {
    const { rerender } = render(<ClientText.Root data-testid="t">Long</ClientText.Root>);
    const el = screen.getByTestId('t');
    expect(classesOf(el)).toEqual([styles.root, styles.m]);
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
