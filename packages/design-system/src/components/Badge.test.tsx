import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Badge } from './Badge';

afterEach(cleanup);

describe('Badge', () => {
  it('renders a span with no role, in the neutral tone by default', () => {
    render(<Badge.Root data-testid="b">3</Badge.Root>);
    const badge = screen.getByTestId('b');
    expect(badge.tagName).toBe('SPAN');
    expect(badge.getAttribute('role')).toBeNull();
    expect(badge.getAttribute('data-tone')).toBe('neutral');
  });

  it('takes a tone', () => {
    render(
      <Badge.Root tone="critical" data-testid="b">
        Overdue
      </Badge.Root>,
    );
    expect(screen.getByTestId('b').getAttribute('data-tone')).toBe('critical');
  });

  it('takes a category tone', () => {
    render(
      <Badge.Root tone="category-3" data-testid="b">
        Design
      </Badge.Root>,
    );
    expect(screen.getByTestId('b').getAttribute('data-tone')).toBe('category-3');
  });
});
