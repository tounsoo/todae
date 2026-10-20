import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChipList } from '../components/ChipList.js';
import { Dialog } from '../components/Dialog.js';
import { ScrollArea } from '../components/ScrollArea.js';
import { Tooltip } from '../components/Tooltip.js';
import { useTooltip } from '../hooks/useTooltip.js';
import { getTabbables } from '../overlay/tabbables.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

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
    expect(document.activeElement).toBe(screen.getByText('More'));
  });

  it('gives a ScrollArea its own Tab stop when everything inside is hidden', async () => {
    render(
      <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40 }}>
        <style>{'.gone { display: none }'}</style>
        <button type="button" className="gone">
          Gone
        </button>
        <div style={{ height: 400 }} />
      </ScrollArea.Root>,
    );
    await waitFor(() => expect(screen.getByTestId('area').tabIndex).toBe(0));
  });

  it('gives a ScrollArea its own Tab stop once a class hides the only control inside', async () => {
    render(
      <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40 }}>
        <style>{'.unseen { visibility: hidden }'}</style>
        <button type="button">Edit</button>
        <div style={{ height: 400 }} />
      </ScrollArea.Root>,
    );
    // Two frames, so the ResizeObserver's first report has come and gone.
    await nextFrame();
    await nextFrame();
    expect(screen.getByTestId('area').tabIndex).not.toBe(0);
    // visibility: hidden keeps the layout, so nothing resizes.
    screen.getByText('Edit').classList.add('unseen');
    await waitFor(() => expect(screen.getByTestId('area').tabIndex).toBe(0));
  });

  it('gives a ScrollArea its own Tab stop once a data attribute hides the only control inside', async () => {
    render(
      <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40 }}>
        <style>{'[data-folded] { visibility: hidden }'}</style>
        <button type="button">Edit</button>
        <div style={{ height: 400 }} />
      </ScrollArea.Root>,
    );
    await nextFrame();
    await nextFrame();
    expect(screen.getByTestId('area').tabIndex).not.toBe(0);
    // ChipList's data-measuring and a closed Tooltip's missing data-open hide
    // controls the same way.
    screen.getByText('Edit').setAttribute('data-folded', '');
    await waitFor(() => expect(screen.getByTestId('area').tabIndex).toBe(0));
  });

  it('gives a ScrollArea its own Tab stop when its only summary is outside a details', async () => {
    render(
      <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40 }}>
        <div>
          <summary>Stray</summary>
        </div>
        <div style={{ height: 400 }} />
      </ScrollArea.Root>,
    );
    await waitFor(() => expect(screen.getByTestId('area').tabIndex).toBe(0));
  });

  it('skips the controls of a disabled fieldset but counts one in its legend', async () => {
    render(
      <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40 }}>
        <fieldset disabled>
          <legend>
            <button type="button">Unlock</button>
          </legend>
          <input aria-label="Name" />
        </fieldset>
        <div style={{ height: 400 }} />
      </ScrollArea.Root>,
    );
    const area = screen.getByTestId('area');
    expect(getTabbables(area)).toEqual([screen.getByRole('button', { name: 'Unlock' })]);
    await nextFrame();
    expect(area.tabIndex).not.toBe(0);
  });

  it('gives a ScrollArea its own Tab stop while a details holding its only control is closed', async () => {
    function Notes({ open }: { open: boolean }) {
      return (
        <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40 }}>
          {/* A fixed height, so opening and closing resizes nothing. */}
          <details open={open} style={{ height: 30 }}>
            <summary tabIndex={-1}>More</summary>
            <button type="button">Edit</button>
          </details>
          <div style={{ height: 400 }} />
        </ScrollArea.Root>
      );
    }
    const { rerender } = render(<Notes open />);
    await nextFrame();
    await nextFrame();
    const area = screen.getByTestId('area');
    expect(area.tabIndex).not.toBe(0);
    rerender(<Notes open={false} />);
    await waitFor(() => expect(area.tabIndex).toBe(0));
    rerender(<Notes open />);
    await waitFor(() => expect(area.tabIndex).not.toBe(0));
  });

  it('gives a ScrollArea no Tab stop of its own while a modal is open over it', async () => {
    function Page({ open, lines }: { open: boolean; lines: number }) {
      return (
        <div data-appearance="light" data-density="comfortable">
          {/* A fixed size, so the page's scroll lock resizes nothing in it. */}
          <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40, width: 200 }}>
            <button type="button">Edit</button>
            {Array.from({ length: lines }, (_, i) => (
              <p key={i}>Line {i}</p>
            ))}
            <div style={{ height: 400 }} />
          </ScrollArea.Root>
          <Dialog.Root open={open} onOpenChange={() => undefined}>
            <Dialog.Title>Rename</Dialog.Title>
            <button type="button">Inside</button>
          </Dialog.Root>
        </div>
      );
    }
    const { rerender } = render(<Page open lines={0} />);
    await waitFor(() => expect(document.querySelector('dialog')?.matches(':modal')).toBe(true));
    // Content arrives behind the modal, so the area is measured while the
    // modal makes it inert.
    rerender(<Page open lines={3} />);
    await nextFrame();
    await nextFrame();
    const area = screen.getByTestId('area');
    expect(area.tabIndex).not.toBe(0);
    expect(area.getAttribute('role')).toBeNull();
    rerender(<Page open={false} lines={3} />);
    await waitFor(() => expect(document.querySelector('dialog')?.open).toBe(false));
    await nextFrame();
    await nextFrame();
    expect(area.tabIndex).not.toBe(0);
  });

  it('gives a ScrollArea no Tab stop of its own once a ChipList inside has measured its rows', async () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40, width: 320 }}>
          <ChipList.Root aria-label="Tags" chips={['aa', 'bb']} maxRows={1} onRemove={() => undefined} />
          <div style={{ height: 400 }} />
        </ScrollArea.Root>
      </div>,
    );
    const list = screen.getByRole('list', { name: 'Tags' });
    await waitFor(() => expect(list.hasAttribute('data-measuring')).toBe(false));
    await nextFrame();
    await nextFrame();
    expect(screen.getByTestId('area').tabIndex).not.toBe(0);
  });

  it('takes a Tab stop by what it holds once an ancestor that hid it with visibility is shown', async () => {
    function Page({ shown, control }: { shown: boolean; control: boolean }) {
      return (
        <div style={{ visibility: shown ? 'visible' : 'hidden' }}>
          <ScrollArea.Root data-testid="area" aria-label="Notes" style={{ height: 40 }}>
            {control && <button type="button">Edit</button>}
            <div style={{ height: 400 }} />
          </ScrollArea.Root>
        </div>
      );
    }
    const { rerender } = render(<Page shown={false} control />);
    await nextFrame();
    await nextFrame();
    rerender(<Page shown control />);
    await nextFrame();
    await nextFrame();
    expect(screen.getByTestId('area').tabIndex).not.toBe(0);
    cleanup();
    // With nothing focusable inside, it keeps its stop once shown.
    const second = render(<Page shown={false} control={false} />);
    await nextFrame();
    await nextFrame();
    second.rerender(<Page shown control={false} />);
    await waitFor(() => expect(screen.getByTestId('area').tabIndex).toBe(0));
  });

  it('flags a button in an interactive Tooltip that mounts closed', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Hint() {
      const tooltip = useTooltip({ interactive: true });
      return (
        <>
          <button type="button" {...tooltip.getTriggerProps()}>
            Hint
          </button>
          <Tooltip.Root {...tooltip.getTooltipProps()} aria-label="Policy">
            <button type="button">Accept</button>
          </Tooltip.Root>
        </>
      );
    }
    render(<Hint />);
    expect(error).toHaveBeenCalledWith('Interactive Tooltip allows links only. Use Popover.');
  });
});
