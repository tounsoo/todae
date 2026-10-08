import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipList } from './ChipList';

afterEach(cleanup);

describe('ChipList', () => {
  it('names the list and wraps every chip without maxRows', () => {
    render(<ChipList.Root aria-label="Tags" chips={['a', 'b', 'c']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    expect(list.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    expect(list.parentElement?.hasAttribute('data-rows')).toBe(false);
    expect(screen.queryByRole('button', { name: /more/ })).toBeNull();
  });

  it('is read-only without onRemove', () => {
    render(<ChipList.Root aria-label="Tags" chips={['a', 'b']} />);
    expect(screen.getByRole('list', { name: 'Tags' }).querySelector('button')).toBeNull();
  });

  it('reports the index and value removed, with custom button names', () => {
    const onRemove = vi.fn();
    render(
      <ChipList.Root
        aria-label="Tags"
        chips={['a', 'b']}
        onRemove={onRemove}
        dismissLabel={(value) => `Delete ${value}`}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete b' }));
    expect(onRemove).toHaveBeenCalledWith(1, 'b');
  });

  it('passes the row limit to the clip as a custom property', () => {
    render(<ChipList.Root aria-label="Tags" chips={['a']} maxRows={2} />);
    const clip = screen.getByRole('list', { name: 'Tags' }).parentElement!;
    expect(clip.hasAttribute('data-rows')).toBe(true);
    expect(clip.style.getPropertyValue('--_rows')).toBe('2');
  });

  it('puts native props on the root and keeps the measure row out of the tree', () => {
    const { container } = render(<ChipList.Root aria-label="Tags" chips={['a']} maxRows={1} data-testid="root" />);
    expect(screen.getByTestId('root')).toBe(container.firstElementChild);
    const measure = container.querySelector('[inert]');
    expect(measure?.getAttribute('aria-hidden')).toBe('true');
  });

  it('treats a row limit below one as no limit, as useChipList does', () => {
    for (const maxRows of [0, -1, Number.NaN]) {
      render(<ChipList.Root aria-label="Tags" chips={['a', 'b']} maxRows={maxRows} />);
      expect(screen.getByRole('list', { name: 'Tags' }).parentElement?.hasAttribute('data-rows')).toBe(false);
      cleanup();
    }
    render(<ChipList.Root aria-label="Tags" chips={['a']} maxRows={2.5} />);
    expect(screen.getByRole('list', { name: 'Tags' }).parentElement?.style.getPropertyValue('--_rows')).toBe('2');
  });

  it('describes the list itself', () => {
    render(<ChipList.Root aria-label="Tags" aria-describedby="hint" chips={['a']} />);
    expect(screen.getByRole('list', { name: 'Tags' }).getAttribute('aria-describedby')).toBe('hint');
  });

  it('renders the measure row only with a row limit', () => {
    const { container, rerender } = render(<ChipList.Root aria-label="Tags" chips={['a']} />);
    expect(container.querySelector('[inert]')).toBeNull();
    rerender(<ChipList.Root aria-label="Tags" chips={['a']} maxRows={1} />);
    expect(container.querySelector('[inert]')).not.toBeNull();
  });
});
