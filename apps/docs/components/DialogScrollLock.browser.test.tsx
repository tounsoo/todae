import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Dialog } from '@tounsoo/todae';
import '@tounsoo/todae/todae.css';

afterEach(cleanup);

async function sized(width: number, height: number, run: () => Promise<void> | void): Promise<void> {
  const frame = window.frameElement as HTMLIFrameElement | null;
  if (!frame) throw new Error('the browser test has no frame to size');
  const previous = {
    width: frame.style.width,
    height: frame.style.height,
    boxSizing: frame.style.boxSizing,
    border: frame.style.border,
    margin: document.body.style.margin,
  };
  frame.style.boxSizing = 'content-box';
  frame.style.border = '0';
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  document.body.style.margin = '0';
  await new Promise(requestAnimationFrame);
  try {
    await run();
  } finally {
    frame.style.width = previous.width;
    frame.style.height = previous.height;
    frame.style.boxSizing = previous.boxSizing;
    frame.style.border = previous.border;
    document.body.style.margin = previous.margin;
  }
}

function pageWidth(): number {
  const probe = document.querySelector('[data-testid="page-width"]');
  if (!(probe instanceof HTMLElement)) throw new Error('missing page width probe');
  return Math.round(probe.getBoundingClientRect().width);
}

function Page({ open, tall }: { open: boolean; tall: boolean }) {
  return (
    <>
      <div data-testid="page-width" style={{ width: '100%', height: tall ? '4000px' : '1px' }} />
      <Dialog.Root open={open} onOpenChange={() => undefined} aria-label="Panel">
        <p>Body</p>
      </Dialog.Root>
    </>
  );
}

it('keeps a short page 390px wide when a dialog opens', async () => {
  await sized(390, 700, () => {
    expect(window.innerWidth).toBe(390);
    const { rerender } = render(<Page open={false} tall={false} />);
    expect(pageWidth()).toBe(390);
    rerender(<Page open tall={false} />);
    expect(pageWidth()).toBe(390);
  });
});

it('keeps a scrolling page the same width when a dialog opens', async () => {
  await sized(390, 400, () => {
    const { rerender } = render(<Page open={false} tall />);
    expect(document.documentElement.scrollHeight).toBeGreaterThan(document.documentElement.clientHeight);
    const before = pageWidth();
    const gap = window.innerWidth - document.documentElement.clientWidth;
    rerender(<Page open tall />);
    expect(pageWidth()).toBe(before);
    if (gap > 0) expect(pageWidth()).toBeLessThan(window.innerWidth);
  });
});
