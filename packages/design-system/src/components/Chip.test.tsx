import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip.js';
import vhStyles from './VisuallyHidden.module.css';

afterEach(cleanup);

describe('Chip', () => {
  it('renders text-only children and stringifies markup', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container, rerender } = render(<Chip.Root>Alpha</Chip.Root>);
    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(container.querySelector('b')).toBeNull();

    rerender(<Chip.Root>{'<b>x</b>'}</Chip.Root>);
    expect(screen.getByText('<b>x</b>')).toBeTruthy();
    expect(container.querySelector('b')).toBeNull();

    rerender(<Chip.Root>{['nope'] as unknown as string}</Chip.Root>);
    expect(error).toHaveBeenCalledWith('Chip.Root children must be a string');
    expect(screen.getByText('nope')).toBeTruthy();
    error.mockRestore();
  });

  it('is neutral by default and takes a status or category tone', () => {
    const { rerender } = render(<Chip.Root data-testid="c">Alpha</Chip.Root>);
    expect(screen.getByTestId('c').getAttribute('data-tone')).toBe('neutral');
    rerender(<Chip.Root data-testid="c" tone="warning">Alpha</Chip.Root>);
    expect(screen.getByTestId('c').getAttribute('data-tone')).toBe('warning');
    rerender(<Chip.Root data-testid="c" tone="category-8">Alpha</Chip.Root>);
    expect(screen.getByTestId('c').getAttribute('data-tone')).toBe('category-8');
  });

  it('names dismiss and ignores clicks when disabled', () => {
    const onRemove = vi.fn();
    const { rerender } = render(
      <Chip.Root onRemove={onRemove}>Alpha</Chip.Root>,
    );
    const button = screen.getByRole('button', { name: 'Remove Alpha' });
    fireEvent.click(button);
    expect(onRemove).toHaveBeenCalledTimes(1);

    rerender(
      <Chip.Root onRemove={onRemove} disabled>
        Alpha
      </Chip.Root>,
    );
    const disabled = screen.getByRole('button', { name: 'Remove Alpha' });
    expect(disabled).toHaveProperty('disabled', true);
    fireEvent.click(disabled);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('renders removeIcon as the remove button content, else Todae\'s cross glyph', () => {
    const { rerender } = render(<Chip.Root onRemove={() => undefined}>Alpha</Chip.Root>);
    const cross = screen.getByRole('button', { name: 'Remove Alpha' });
    expect(cross.children).toHaveLength(1);
    expect(cross.firstElementChild?.tagName.toLowerCase()).toBe('svg');
    expect(cross.firstElementChild?.getAttribute('aria-hidden')).toBe('true');
    expect(cross.textContent).toBe('');
    rerender(
      <Chip.Root onRemove={() => undefined} removeIcon={<svg data-testid="icon" aria-hidden="true" />}>
        Alpha
      </Chip.Root>,
    );
    const button = screen.getByRole('button', { name: 'Remove Alpha' });
    expect(button.contains(screen.getByTestId('icon'))).toBe(true);
    expect(button.textContent).toBe('');
    rerender(<Chip.Root removeIcon={<svg data-testid="icon" />}>Alpha</Chip.Root>);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByTestId('icon')).toBeNull();
  });

  it('renders display-only overflow', () => {
    const { container } = render(<Chip.Overflow overflowCount={4} />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(container.querySelector('[data-overflow]')).not.toBeNull();
    // VisuallyHidden.Root's rules, which hold over a class a product adds.
    expect(screen.getByText('4 more').className).toBe(vhStyles.root);
    expect(screen.getByText('+4').getAttribute('aria-hidden')).not.toBeNull();
  });
});
