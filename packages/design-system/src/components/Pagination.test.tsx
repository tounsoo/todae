import { cleanup, render, screen } from '@testing-library/react';
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

  it('marks the current page, and hides the gap from assistive technology', () => {
    render(
      <Pagination.Root>
        <Pagination.Item current>3</Pagination.Item>
        <Pagination.Ellipsis data-testid="gap" />
      </Pagination.Root>,
    );
    expect(screen.getByText('3').getAttribute('aria-current')).toBe('page');
    const gap = screen.getByTestId('gap');
    expect(gap.getAttribute('aria-hidden')).toBe('true');
    expect(gap.textContent).toBe('…');
  });
});
