import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Pagination } from './Pagination';

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
    expect(gap.textContent).toBe('…');
  });

  it('keeps the focus ring on the current page and greys out a disabled step in forced colors', () => {
    const css = readFileSync(join(import.meta.dirname, 'Pagination.module.css'), 'utf8');
    const forced = css.slice(css.indexOf('@media (forced-colors: active)'));
    expect(forced).toContain(":not([aria-current='false' i], [aria-current='']):not(:focus-visible) {");
    expect(forced).toMatch(/\[aria-disabled='true'\] \{\s*color: GrayText;/);
  });
});
