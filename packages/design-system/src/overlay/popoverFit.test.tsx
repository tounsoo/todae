import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePopoverFit } from './popoverFit.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const box = (top: number, height: number) =>
  ({ top, left: 0, bottom: top + height, right: 100, height, width: 100, x: 0, y: top, toJSON() {} }) as DOMRect;

// The anchor sits at 300..330; the popover below it, or above it.
function stub(popoverTop: number) {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return this.hasAttribute('data-testid') && this.dataset.testid === 'popover' ? box(popoverTop, 200) : box(300, 30);
  });
}

const frame = () => act(() => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));

function Harness({ open, stretched }: { open: boolean; stretched: boolean }) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  usePopoverFit(popoverRef, anchorRef, open);
  return (
    <>
      <div ref={anchorRef}>anchor</div>
      <div ref={popoverRef} data-testid="popover" style={stretched ? { alignSelf: 'stretch' } : undefined}>
        <div data-testid="content">content</div>
      </div>
    </>
  );
}

describe('usePopoverFit', () => {
  it('pins a popover the fit try stretched below its anchor, on its first frame', async () => {
    stub(334);
    const { getByTestId } = render(<Harness open stretched />);
    expect(getByTestId('popover').hasAttribute('data-todae-fit')).toBe(false);
    await frame();
    expect(getByTestId('popover').getAttribute('data-todae-fit')).toBe('below');
  });

  it('pins one stretched above its anchor as above', async () => {
    stub(96);
    const { getByTestId } = render(<Harness open stretched />);
    await frame();
    expect(getByTestId('popover').getAttribute('data-todae-fit')).toBe('above');
  });

  it('leaves one placed whole, which no fit try stretched', async () => {
    stub(334);
    const { getByTestId } = render(<Harness open stretched={false} />);
    await frame();
    expect(getByTestId('popover').hasAttribute('data-todae-fit')).toBe(false);
  });

  it('places it again when the window resizes or the page scrolls, never for a scroll inside it', async () => {
    stub(334);
    const { getByTestId } = render(<Harness open stretched />);
    const popover = getByTestId('popover');
    await frame();
    popover.dispatchEvent(new Event('scroll'));
    getByTestId('content').dispatchEvent(new Event('scroll'));
    expect(popover.getAttribute('data-todae-fit')).toBe('below');
    window.dispatchEvent(new Event('resize'));
    expect(popover.hasAttribute('data-todae-fit')).toBe(false);
    await frame();
    expect(popover.getAttribute('data-todae-fit')).toBe('below');
    document.dispatchEvent(new Event('scroll'));
    expect(popover.hasAttribute('data-todae-fit')).toBe(false);
    await frame();
    expect(popover.getAttribute('data-todae-fit')).toBe('below');
  });

  it('places it again when a child is put in while it is open', async () => {
    stub(334);
    const { getByTestId } = render(<Harness open stretched />);
    const popover = getByTestId('popover');
    await frame();
    expect(popover.getAttribute('data-todae-fit')).toBe('below');
    await act(async () => {
      popover.append(document.createElement('div'));
      await Promise.resolve();
    });
    expect(popover.hasAttribute('data-todae-fit')).toBe(false);
    await frame();
    expect(popover.getAttribute('data-todae-fit')).toBe('below');
  });

  it('drops the pin when it closes', async () => {
    stub(334);
    const { getByTestId, rerender } = render(<Harness open stretched />);
    await frame();
    rerender(<Harness open={false} stretched />);
    expect(getByTestId('popover').hasAttribute('data-todae-fit')).toBe(false);
  });
});
