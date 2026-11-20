import { render, waitFor } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useModalLayer } from './useModalLayer.js';

const MARK = 'data-todae-no-page-scrollbar';

function setWidths(innerWidth: number, clientWidth: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => innerWidth });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => clientWidth });
}

function OwnDialog({ open }: { open: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useModalLayer(ref, open);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);
  return <dialog ref={ref} aria-label="Own" />;
}

describe('useModalLayer page scrollbar', () => {
  afterEach(() => {
    document.documentElement.removeAttribute(MARK);
    setWidths(1024, 0);
  });

  it('marks a page whose scrollbar takes no width', () => {
    setWidths(390, 390);
    render(<OwnDialog open />);
    expect(document.documentElement.hasAttribute(MARK)).toBe(true);
  });

  it('leaves the gutter when the scrollbar takes width', () => {
    document.documentElement.setAttribute(MARK, '');
    setWidths(390, 375);
    render(<OwnDialog open />);
    expect(document.documentElement.hasAttribute(MARK)).toBe(false);
  });

  it('clears the marker after the dialog closes', async () => {
    setWidths(390, 390);
    const { rerender } = render(<OwnDialog open />);
    expect(document.documentElement.hasAttribute(MARK)).toBe(true);
    rerender(<OwnDialog open={false} />);
    await waitFor(() => expect(document.documentElement.hasAttribute(MARK)).toBe(false));
  });

  it('clears the marker when the dialog unmounts while open', async () => {
    setWidths(390, 390);
    const { unmount } = render(<OwnDialog open />);
    expect(document.documentElement.hasAttribute(MARK)).toBe(true);
    unmount();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(MARK)).toBe(false);
  });
});
