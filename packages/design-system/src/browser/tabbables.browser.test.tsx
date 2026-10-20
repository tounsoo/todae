import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog } from '../components/Dialog.js';
import { ScrollArea } from '../components/ScrollArea.js';
import { getTabbables } from '../overlay/tabbables.js';

afterEach(cleanup);

// Things Tab skips: a negative tabindex, a hidden input, and controls hidden
// by a stylesheet rather than an inline style.
function Skipped() {
  return (
    <>
      <style>{'.gone { display: none } .unseen { visibility: hidden }'}</style>
      <button type="button" tabIndex={-1}>
        Roving
      </button>
      <input type="hidden" name="token" />
      <button type="button" className="gone">
        Gone
      </button>
      <div className="unseen">
        <button type="button">Unseen</button>
      </div>
      <details>
        <summary>More</summary>
        <button type="button">Folded</button>
      </details>
    </>
  );
}

describe('getTabbables in a browser', () => {
  it('lists only what Tab stops on', () => {
    render(
      <div data-testid="box">
        <Skipped />
        <button type="button">Shown</button>
      </div>,
    );
    expect(getTabbables(screen.getByTestId('box')).map((el) => el.textContent || el.tagName)).toEqual([
      'More',
      'Shown',
    ]);
  });

  it('leaves a Dialog to focus its first control Tab stops on', async () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Dialog.Root open onOpenChange={() => undefined}>
          <Dialog.Title>Rename</Dialog.Title>
          <Skipped />
          <button type="button">Shown</button>
        </Dialog.Root>
      </div>,
    );
    await waitFor(() => expect(document.querySelector('dialog')?.matches(':modal')).toBe(true));
    const active = document.activeElement as HTMLElement;
    expect(['Roving', 'Gone', 'Unseen', 'Folded']).not.toContain(active.textContent);
    expect(active.checkVisibility({ visibilityProperty: true })).toBe(true);
  });

  it('gives a ScrollArea its own Tab stop when everything inside is hidden', async () => {
    render(
      <ScrollArea.Root data-testid="area" style={{ height: 40 }}>
        <style>{'.gone { display: none }'}</style>
        <button type="button" className="gone">
          Gone
        </button>
        <div style={{ height: 400 }} />
      </ScrollArea.Root>,
    );
    await waitFor(() => expect(screen.getByTestId('area').tabIndex).toBe(0));
  });
});
