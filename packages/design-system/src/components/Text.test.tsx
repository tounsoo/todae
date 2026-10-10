import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Text, type TextAs } from './Text';
import styles from './Text.module.css';

afterEach(cleanup);

function classesOf(el: Element) {
  return [...el.classList];
}

describe('Text', () => {
  it('renders a paragraph at the medium size and regular weight by default', () => {
    render(<Text.Root data-testid="t">Hi</Text.Root>);
    const el = screen.getByTestId('t');
    expect(el.tagName).toBe('P');
    expect(classesOf(el)).toEqual(expect.arrayContaining([styles.root, styles.m, styles.default, styles.regular]));
    expect(el.classList.contains(styles.heading!)).toBe(false);
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
    expect(classesOf(el)).toEqual(expect.arrayContaining([styles.heading, styles[size], styles.bold]));
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
});
