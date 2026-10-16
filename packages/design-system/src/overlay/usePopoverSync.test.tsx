import { cleanup, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { reshowHeldInside, usePopoverSync } from './usePopoverSync.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Held({ name, open, children }: { name: string; open: boolean; children?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  usePopoverSync(ref, open);
  return (
    <div ref={ref} popover="manual" data-name={name}>
      {children}
    </div>
  );
}

function trackCalls() {
  const calls: string[] = [];
  const show = HTMLElement.prototype.showPopover;
  const hide = HTMLElement.prototype.hidePopover;
  vi.spyOn(HTMLElement.prototype, 'showPopover').mockImplementation(function (this: HTMLElement) {
    calls.push(`show ${this.dataset.name ?? '?'}`);
    show.call(this);
  });
  vi.spyOn(HTMLElement.prototype, 'hidePopover').mockImplementation(function (this: HTMLElement) {
    calls.push(`hide ${this.dataset.name ?? '?'}`);
    hide.call(this);
  });
  return calls;
}

describe('reshowHeldInside', () => {
  it('hides and shows again each popover React holds open inside the layer, in DOM order', () => {
    const { getByTestId } = render(
      <div data-testid="layer">
        <Held name="a" open>
          <Held name="b" open />
        </Held>
        <Held name="closed" open={false} />
        <div popover="manual" data-name="foreign" data-popover-open="" />
        <Held name="c" open />
      </div>,
    );
    const calls = trackCalls();
    reshowHeldInside(getByTestId('layer'));
    expect(calls).toEqual(['hide a', 'show a', 'hide b', 'show b', 'hide c', 'show c']);
  });

  it('shows again one that a move hid, and leaves those outside the layer alone', () => {
    const { getByTestId } = render(
      <>
        <div data-testid="layer">
          <Held name="inside" open />
        </div>
        <Held name="outside" open />
      </>,
    );
    const inside = document.querySelector<HTMLElement>('[data-name="inside"]')!;
    // A move hides it with no toggle event, so React still holds it open.
    inside.removeAttribute('data-popover-open');
    const calls = trackCalls();
    reshowHeldInside(getByTestId('layer'));
    expect(calls).toEqual(['show inside']);
    expect(inside.hasAttribute('data-popover-open')).toBe(true);
  });

  it('stops holding a popover once it closes', () => {
    const { getByTestId, rerender } = render(
      <div data-testid="layer">
        <Held name="a" open />
      </div>,
    );
    rerender(
      <div data-testid="layer">
        <Held name="a" open={false} />
      </div>,
    );
    const calls = trackCalls();
    reshowHeldInside(getByTestId('layer'));
    expect(calls).toEqual([]);
  });
});
