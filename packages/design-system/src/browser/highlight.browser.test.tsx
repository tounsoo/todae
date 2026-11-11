import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useHighlight } from '../index.js';

function Search({ query }: { query: string }) {
  const highlight = useHighlight({ name: 'browser-search', query, priority: 2 });
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
  it('registers a native Highlight with the matches and removes it on unmount', () => {
    const { unmount } = render(<Search query="tea" />);
    const highlight = CSS.highlights.get('browser-search');
    expect(highlight).toBeInstanceOf(Highlight);
    expect(highlight!.priority).toBe(2);
    expect([...highlight!].map((range) => range.toString())).toEqual(['Tea', 'tea', 'tea', 'tea', 'tea']);
    expect(screen.getByRole('status').textContent).toBe('5');
    unmount();
    expect(CSS.highlights.has('browser-search')).toBe(false);
  });
});
