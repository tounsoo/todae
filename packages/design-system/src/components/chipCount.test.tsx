import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ChipCount } from './chipCount.js';
import vhStyles from './VisuallyHidden.module.css';

afterEach(cleanup);

describe('ChipCount', () => {
  it('hides the visible +N and reads its name instead', () => {
    const { container } = render(<ChipCount count={4} />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(container.querySelector('[data-overflow]')).not.toBeNull();
    // VisuallyHidden.Root's rules, which hold over a class a product adds.
    expect(screen.getByText('4 more').className).toBe(vhStyles.root);
    expect(screen.getByText('+4').closest('[aria-hidden]')).not.toBeNull();
  });
});
