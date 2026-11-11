import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Pagination } from './Pagination.js';

afterEach(cleanup);

describe('Pagination', () => {
  it('is a nav named Pagination around an ordered list', () => {
    render(
      <Pagination.Root>
        <Pagination.Item>
          <a href="?page=1">1</a>
        </Pagination.Item>
      </Pagination.Root>,
    );
    const nav = screen.getByRole('navigation', { name: 'Pagination' });
    expect(nav.querySelector('ol')?.getAttribute('role')).toBe('list');
    expect(screen.getByRole('link', { name: '1' }).closest('li')).toBeTruthy();
  });

  it('takes its own name', () => {
    render(<Pagination.Root aria-label="Search results pages" />);
    expect(screen.getByRole('navigation', { name: 'Search results pages' })).toBeTruthy();
    cleanup();
    render(
      <>
        <h2 id="h">Pages</h2>
        <Pagination.Root aria-labelledby="h" />
      </>,
    );
    const nav = screen.getByRole('navigation', { name: 'Pages' });
    expect(nav.hasAttribute('aria-label')).toBe(false);
  });

  it('hides the gap from assistive technology', () => {
    render(
      <Pagination.Root>
        <Pagination.Ellipsis data-testid="gap" />
      </Pagination.Root>,
    );
    const gap = screen.getByTestId('gap');
    expect(gap.getAttribute('aria-hidden')).toBe('true');
    cleanup();
    render(
      <Pagination.Root>
        <Pagination.Ellipsis aria-hidden={false} data-testid="gap" />
      </Pagination.Root>,
    );
    expect(screen.getByTestId('gap').getAttribute('aria-hidden')).toBe('true');
    cleanup();
    render(
      <Pagination.Root>
        <Pagination.Ellipsis data-testid="gap" />
      </Pagination.Root>,
    );
    expect(screen.getByTestId('gap').textContent).toBe('…');
  });

  it('keeps the focus ring on the current page and greys out a disabled step in forced colors', () => {
    const css = readFileSync(join(import.meta.dirname, 'Pagination.module.css'), 'utf8');
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    expect(forced).toContain(':not(:focus-visible)');
    // Every muted state outside forced colors is greyed inside them too.
    const muted = (block: string) => block.slice(0, block.indexOf('{')).replace(/\s+/g, ' ').trim();
    const normal = css.slice(css.indexOf(".item > :is([aria-disabled='true']"));
    const grey = forced.slice(forced.indexOf(".item > :is([aria-disabled='true']"));
    expect(muted(grey)).toBe(muted(normal));
    expect(grey.slice(0, grey.indexOf('}'))).toContain('color: GrayText;');
    // A transparent border, which forced colors paints, outlines each control there.
    const controls = css.slice(css.indexOf('.item > :is(a, button) {'));
    expect(controls.slice(0, controls.indexOf('}'))).toContain('border: var(--todae-pagination-border-width) solid transparent;');
  });
});
