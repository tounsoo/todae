import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
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
    const at = (cls: string) => sheet.indexOf(`.${cls} {`);
    expect(at('root')).toBeLessThan(at('heading'));
    expect(at('heading')).toBeLessThan(at('label'));
    for (const cls of ['default', 'muted', 'accent', 'regular', 'medium', 'bold']) expect(at('label')).toBeLessThan(at(cls));
  });
});
