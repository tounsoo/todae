import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHighlight } from '../index';

function Search({ query }: { query: string }) {
  const highlight = useHighlight({ name: 'browser-search', query });
  return (
    <main data-appearance="light" data-density="comfortable">
      <div ref={highlight.ref} data-testid="body">
        <p>Tea, green tea and <b>tea</b>.</p>
        <p style={{ display: 'none' }}>tea</p>
        <p style={{ visibility: 'hidden' }}>tea</p>
      </div>
      <output>{highlight.matches.length}</output>
    </main>
  );
}

describe('useHighlight in a real browser', () => {
  it('registers a native Highlight with the visible matches and removes it on unmount', () => {
    const { unmount } = render(<Search query="tea" />);
    const highlight = CSS.highlights.get('browser-search');
    expect(highlight).toBeInstanceOf(Highlight);
    expect([...highlight!].map((range) => range.toString())).toEqual(['Tea', 'tea', 'tea']);
    expect(screen.getByRole('status').textContent).toBe('3');
    unmount();
    expect(CSS.highlights.has('browser-search')).toBe(false);
  });

  it('searches again when text is added or shown', async () => {
    render(<Search query="tea" />);
    const body = screen.getByTestId('body');
    await act(async () => {
      body.append('More tea.');
      (body.children[1] as HTMLElement).style.display = '';
    });
    expect(CSS.highlights.get('browser-search')?.size).toBe(5);
  });
});
