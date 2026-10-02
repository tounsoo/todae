import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEscapeKey } from './useEscapeKey';

afterEach(cleanup);

function Layer({
  active = true,
  enabled = true,
  onEscape,
}: {
  active?: boolean;
  enabled?: boolean;
  onEscape: () => void;
}) {
  useEscapeKey(active, enabled, onEscape);
  return null;
}

describe('useEscapeKey', () => {
  it('only the most recently activated layer handles Escape', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(
      <>
        <Layer onEscape={outer} />
        <Layer active={false} onEscape={inner} />
      </>,
    );
    rerender(
      <>
        <Layer onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    rerender(
      <>
        <Layer onEscape={outer} />
        <Layer active={false} onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('calls the latest handler without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Layer onEscape={first} />);
    rerender(<Layer onEscape={second} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys and stops listening after unmount', () => {
    const onEscape = vi.fn();
    const { unmount } = render(<Layer onEscape={onEscape} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('keeps stack position when enabled toggles and skips disabled layers', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(
      <>
        <Layer onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    rerender(
      <>
        <Layer enabled={false} onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    rerender(
      <>
        <Layer enabled onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    rerender(
      <>
        <Layer onEscape={outer} />
        <Layer enabled={false} onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
  });
});
