import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { Activity, startTransition, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../components/Dialog.js';
import { Drilldown } from '../components/Drilldown.js';
import { cleanupAll, dialog, openDialog, settled, SettingsDialog, Surfaced, surfaceOpen, Themed, view } from '../test/drilldown.js';

describe('Drilldown focus and surface reset in a browser', () => {
  it('focuses the first tab stop of a pushed view, or the view itself, and returns focus to the trigger', async () => {
    await openDialog(<SettingsDialog />);
    const account = screen.getByRole('button', { name: 'Account' });
    await userEvent.click(account);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Display name' }));
    await settled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(document.activeElement).toBe(account);
    await settled();
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(document.activeElement).toBe(view('About'));
    expect(screen.getByRole('dialog', { name: 'About' })).toBe(dialog());
  });

  for (const kind of ['Dialog', 'BottomSheet', 'Popover'] as const) {
    it(`starts an uncontrolled stack over with reason reset once the ${kind} around it finishes closing`, async () => {
      const onValueChange = vi.fn();
      const ui = (open: boolean) => <Surfaced kind={kind} open={open} onValueChange={onValueChange} />;
      const { rerender } = render(ui(true));
      await waitFor(() => expect(surfaceOpen()).toBe(true));
      await userEvent.click(screen.getByRole('button', { name: 'Brand' }));
      await settled();
      rerender(ui(false));
      await waitFor(() => expect(surfaceOpen()).toBe(false));
      expect(onValueChange.mock.calls).toEqual([
        [['filters', 'brand'], 'push'],
        [['filters'], 'reset'],
      ]);
      rerender(ui(true));
      await waitFor(() => expect(surfaceOpen()).toBe(true));
      expect(view('Filters').hidden).toBe(false);
      expect(view('Brand')).toBeNull();
      cleanupAll();
    });
  }

  for (const kind of ['Dialog', 'BottomSheet'] as const) {
    it(`keeps the stack when the ${kind} around it opens again during its exit`, async () => {
      const onValueChange = vi.fn();
      const ui = (open: boolean) => <Surfaced kind={kind} open={open} onValueChange={onValueChange} />;
      const { rerender } = render(ui(true));
      await waitFor(() => expect(surfaceOpen()).toBe(true));
      await userEvent.click(screen.getByRole('button', { name: 'Brand' }));
      await settled();
      rerender(ui(false));
      rerender(ui(true));
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(surfaceOpen()).toBe(true);
      expect(view('Brand').hidden).toBe(false);
      expect(onValueChange.mock.calls).toEqual([[['filters', 'brand'], 'push']]);
      cleanupAll();
    });

    it(`reports no reset for a Drilldown the product unmounts or hides during the ${kind}'s exit`, async () => {
      for (const drilldown of ['gone', 'hidden'] as const) {
        const onValueChange = vi.fn();
        const { rerender } = render(<Surfaced kind={kind} open onValueChange={onValueChange} />);
        await waitFor(() => expect(surfaceOpen()).toBe(true));
        await userEvent.click(screen.getByRole('button', { name: 'Brand' }));
        await settled();
        rerender(<Surfaced kind={kind} open={false} onValueChange={onValueChange} />);
        rerender(<Surfaced kind={kind} open={false} drilldown={drilldown} onValueChange={onValueChange} />);
        await waitFor(() => expect(surfaceOpen()).toBe(false));
        expect(onValueChange.mock.calls).toEqual([[['filters', 'brand'], 'push']]);
        cleanupAll();
      }
    });
  }

  for (const [kind, gone] of [
    ['BottomSheet', 'removed'],
    ['Dialog', 'hidden'],
  ] as const) {
    it(`reports no reset when the whole ${kind} is ${gone} during its exit`, async () => {
      const onValueChange = vi.fn();
      const ui = (open: boolean, mode: 'visible' | 'hidden' = 'visible') => (
        <Activity mode={mode}>
          <Surfaced kind={kind} open={open} onValueChange={onValueChange} />
        </Activity>
      );
      const { rerender } = render(ui(true));
      await waitFor(() => expect(surfaceOpen()).toBe(true));
      await userEvent.click(screen.getByRole('button', { name: 'Brand' }));
      await settled();
      rerender(ui(false));
      rerender(gone === 'removed' ? null : ui(false, 'hidden'));
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(onValueChange.mock.calls).toEqual([[['filters', 'brand'], 'push']]);
      cleanupAll();
    });
  }

  it('reports the reset once a Dialog hidden during its exit shows again and finishes closing', async () => {
    const onValueChange = vi.fn();
    const ui = (open: boolean, mode: 'visible' | 'hidden' = 'visible') => (
      <Activity mode={mode}>
        <Surfaced kind="Dialog" open={open} onValueChange={onValueChange} />
      </Activity>
    );
    const { rerender } = render(ui(true));
    try {
      await waitFor(() => expect(surfaceOpen()).toBe(true));
      await userEvent.click(screen.getByRole('button', { name: 'Brand' }));
      await settled();
      rerender(ui(false));
      rerender(ui(false, 'hidden'));
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(onValueChange).toHaveBeenCalledTimes(1);
      rerender(ui(false));
      await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(2));
      expect(onValueChange).toHaveBeenLastCalledWith(['filters'], 'reset');
    } finally {
      cleanupAll();
    }
  });

  it('returns focus to the trigger when Escape goes back from focus on the dialog itself', async () => {
    await openDialog(<SettingsDialog />);
    const account = screen.getByRole('button', { name: 'Account' });
    await userEvent.click(account);
    await settled();
    dialog().focus();
    expect(document.activeElement).toBe(dialog());
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(account);
  });

  it("returns focus to the view below's initialFocusRef when the trigger is gone and the ref can take focus, else its first tab stop", async () => {
    function Gone({ initialFocus }: { initialFocus: 'none' | 'filter' | 'disabled' }) {
      const [shown, setShown] = useState(true);
      const filter = useRef<HTMLInputElement>(null);
      const disabled = useRef<HTMLButtonElement>(null);
      const ref = initialFocus === 'filter' ? filter : initialFocus === 'disabled' ? disabled : undefined;
      return (
        <Themed>
          <Dialog.Root open aria-label="Items" onOpenChange={() => undefined}>
            <Drilldown.Root defaultValue={['list']}>
              <Drilldown.Back />
              <Drilldown.Viewport data-testid="viewport">
                <Drilldown.View value="list" label="List" initialFocusRef={ref}>
                  <button type="button">Sort</button>
                  <input aria-label="Filter" ref={filter} />
                  <button type="button" disabled ref={disabled}>
                    Export
                  </button>
                  {shown ? <Drilldown.Trigger value="item">Item</Drilldown.Trigger> : null}
                </Drilldown.View>
                <Drilldown.View value="item" label="Item">
                  <button type="button" onClick={() => setShown(false)}>
                    Delete
                  </button>
                </Drilldown.View>
              </Drilldown.Viewport>
            </Drilldown.Root>
          </Dialog.Root>
        </Themed>
      );
    }
    const sort = () => screen.getByRole('button', { name: 'Sort' });
    const expected = { none: sort, filter: () => screen.getByRole('textbox', { name: 'Filter' }), disabled: sort };
    for (const initialFocus of ['none', 'filter', 'disabled'] as const) {
      await openDialog(<Gone initialFocus={initialFocus} />);
      await userEvent.click(screen.getByRole('button', { name: 'Item' }));
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await userEvent.click(screen.getByRole('button', { name: 'Back to List' }));
      expect(document.activeElement).toBe(expected[initialFocus]());
      cleanupAll();
    }
  });

  it('leaves focus on a control outside the views that set a controlled stack', async () => {
    function Wizard() {
      const [stack, setStack] = useState<readonly string[]>(['details']);
      return (
        <Themed>
          <Dialog.Root open aria-label="Wizard" onOpenChange={() => undefined}>
            <Drilldown.Root value={stack} onValueChange={setStack}>
              <Drilldown.Viewport data-testid="viewport">
                <Drilldown.View value="details" label="Details">
                  <input aria-label="Name" />
                </Drilldown.View>
                <Drilldown.View value="review" label="Review">
                  <input aria-label="Notes" />
                </Drilldown.View>
              </Drilldown.Viewport>
            </Drilldown.Root>
            <button type="button" onClick={() => setStack(['details', 'review'])}>
              Next
            </button>
          </Dialog.Root>
        </Themed>
      );
    }
    await openDialog(<Wizard />);
    const next = screen.getByRole('button', { name: 'Next' });
    await userEvent.click(next);
    expect(view('Review').hidden).toBe(false);
    expect(document.activeElement).toBe(next);
  });

  it('applies a change once, so an Activity that shows the views again moves neither focus nor the scroll', async () => {
    const ui = (mode: 'visible' | 'hidden') => (
      <Themed>
        <div data-testid="scroller" style={{ blockSize: 200, overflowY: 'auto', overflowAnchor: 'none' }}>
          <Activity mode={mode}>
            <Drilldown.Root defaultValue={['settings']}>
              <Drilldown.Back />
              <Drilldown.Viewport data-testid="viewport">
                <Drilldown.View value="settings" label="Settings">
                  <Drilldown.Trigger value="account">Account</Drilldown.Trigger>
                  <Drilldown.Trigger value="about">About</Drilldown.Trigger>
                </Drilldown.View>
                <Drilldown.View value="account" label="Account" />
                <Drilldown.View value="about" label="About">
                  <input aria-label="Version" />
                  <div style={{ blockSize: 600 }} />
                </Drilldown.View>
              </Drilldown.Viewport>
            </Drilldown.Root>
          </Activity>
          <div style={{ blockSize: 1000 }} />
        </div>
      </Themed>
    );
    const { rerender } = render(ui('visible'));
    try {
      await userEvent.click(screen.getByRole('button', { name: 'About' }));
      const version = screen.getByRole('textbox', { name: 'Version' });
      expect(document.activeElement).toBe(version);
      await settled();
      const scroller = screen.getByTestId('scroller');
      scroller.scrollTop = 150;
      rerender(ui('hidden'));
      await waitFor(() => expect(document.activeElement).toBe(document.body));
      rerender(ui('visible'));
      expect(document.activeElement).not.toBe(version);
      expect(scroller.scrollTop).toBe(150);
      await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'About' }));
    } finally {
      cleanupAll();
    }
  });

  it("focuses a view's initialFocusRef when a controlled change that shortens the stack shows it for the first time", async () => {
    function Jump() {
      const [stack, setStack] = useState<readonly string[]>(['settings', 'account', 'email']);
      const frequency = useRef<HTMLInputElement>(null);
      return (
        <Themed>
          <Drilldown.Root value={stack} onValueChange={setStack}>
            <Drilldown.Viewport data-testid="viewport">
              <Drilldown.View value="settings" label="Settings" />
              <Drilldown.View value="account" label="Account" />
              <Drilldown.View value="email" label="Email">
                <button type="button" onClick={() => setStack(['settings', 'notifications'])}>
                  Notification settings
                </button>
              </Drilldown.View>
              <Drilldown.View value="notifications" label="Notifications" initialFocusRef={frequency}>
                <input aria-label="Digest" />
                <input aria-label="Frequency" ref={frequency} />
              </Drilldown.View>
            </Drilldown.Viewport>
          </Drilldown.Root>
        </Themed>
      );
    }
    render(<Jump />);
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Notification settings' }));
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Frequency' }));
    } finally {
      cleanupAll();
    }
  });
});

function Deferred({ apply }: { apply: (update: () => void) => void }) {
  const [stack, setStack] = useState<readonly string[]>(['settings']);
  return (
    <Themed>
      <Drilldown.Root value={stack} onValueChange={(next, reason) => (reason === 'push' ? apply(() => setStack(next)) : setStack(next))}>
        <Drilldown.Back />
        <Drilldown.Viewport data-testid="viewport">
          <Drilldown.View value="settings" label="Settings">
            <input aria-label="Search" />
            <Drilldown.Trigger value="account">Account</Drilldown.Trigger>
            <Drilldown.Trigger value="about">About details</Drilldown.Trigger>
            <button type="button" onClick={() => setStack(['settings', 'about'])}>
              About
            </button>
            <button type="button" onClick={() => setStack(['settings', 'account'])}>
              Open account
            </button>
          </Drilldown.View>
          <Drilldown.View value="account" label="Account">
            <input aria-label="Display name" />
          </Drilldown.View>
          <Drilldown.View value="about" label="About">
            <input aria-label="Version" />
          </Drilldown.View>
        </Drilldown.Viewport>
      </Drilldown.Root>
    </Themed>
  );
}

describe('Drilldown focus with a stack the product sets later', () => {
  const later = {
    timeout: (update: () => void) => setTimeout(update, 50),
    transition: (update: () => void) => startTransition(update),
  };
  for (const [name, apply] of Object.entries(later)) {
    it(`returns focus to the trigger on Back when the product applies the push in a ${name}`, async () => {
      render(<Deferred apply={apply} />);
      try {
        const account = screen.getByRole('button', { name: 'Account' });
        await userEvent.click(account);
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Display name' })));
        await settled();
        await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
        expect(document.activeElement).toBe(account);
      } finally {
        cleanupAll();
      }
    });
  }

  it('gives a push the product rejected no say in where focus returns after a later change', async () => {
    render(<Deferred apply={() => undefined} />);
    try {
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      await userEvent.click(screen.getByRole('button', { name: 'About' }));
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Version' }));
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Open account' }));
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));
    } finally {
      cleanupAll();
    }
  });
  it('treats the next change that shows a pushed view as that push, however late it comes', async () => {
    render(<Deferred apply={() => undefined} />);
    try {
      const account = screen.getByRole('button', { name: 'Account' });
      await userEvent.click(account);
      await userEvent.click(screen.getByRole('button', { name: 'Open account' }));
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Display name' }));
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
      expect(document.activeElement).toBe(account);
    } finally {
      cleanupAll();
    }
  });

  it("never returns focus to an earlier push's trigger when the product applies two pushes one after the other", async () => {
    // The product holds both pushes, then applies them in separate commits.
    const held: (() => void)[] = [];
    render(<Deferred apply={(update) => held.push(update)} />);
    try {
      const account = screen.getByRole('button', { name: 'Account' });
      await userEvent.click(account);
      await userEvent.click(screen.getByRole('button', { name: 'About details' }));
      expect(held).toHaveLength(2);
      held[0]!();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Display name' })));
      held[1]!();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Version' })));
      await settled();
      await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Search' }));
    } finally {
      cleanupAll();
    }
  });
});
