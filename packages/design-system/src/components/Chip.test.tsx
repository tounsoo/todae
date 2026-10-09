import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chip } from './Chip';

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

  it('renders display-only overflow', () => {
    const { container } = render(<Chip.Overflow overflowCount={4} />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[tabindex]')).toBeNull();
    expect(container.querySelector('[data-overflow]')).not.toBeNull();
    expect(screen.getByText('4 more')).toBeTruthy();
    expect(screen.getByText('+4').getAttribute('aria-hidden')).not.toBeNull();
  });
});
