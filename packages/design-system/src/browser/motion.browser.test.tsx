import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { BottomSheet } from '../components/BottomSheet.js';
import { Button } from '../components/Button.js';
import { Dialog } from '../components/Dialog.js';
import { Drawer, type DrawerSide } from '../components/Drawer.js';
import { HeldTip } from '../test/heldTip.js';

afterEach(cleanup);

function Themed({ children, dir, style }: { children: ReactNode; dir?: 'ltr' | 'rtl'; style?: CSSProperties }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir} style={style}>
      {children}
    </div>
  );
}

function tipOf(trigger: HTMLElement): HTMLElement | null {
  const tip = document.getElementById(trigger.getAttribute('aria-describedby') ?? '');
  return tip?.matches(':popover-open') ? tip : null;
}

type Frame = { dx: number; gap: number; x: number; y: number };

/** The tip's offset from its trigger: center to center across, edge to edge along. */
function measure(trigger: HTMLElement): Frame | null {
  const tip = tipOf(trigger);
  if (!tip) return null;
  const a = trigger.getBoundingClientRect();
  const t = tip.getBoundingClientRect();
  const w = window.innerWidth;
  const h = window.innerHeight;
  // Off-screen, the tip has nothing to be placed by; with no room to center
  // on its trigger, it is pushed in view on purpose. The edge allows for a
  // reserved scrollbar gutter.
  const edge = 16;
  const center = (a.left + a.right) / 2;
  if (a.left < 0 || a.right > w || a.top < 0 || a.bottom > h) return null;
  if (center - t.width / 2 < edge || center + t.width / 2 > w - edge) return null;
  const above = t.bottom <= a.top + 0.5;
  return { dx: (t.left + t.right) / 2 - (a.left + a.right) / 2, gap: above ? a.top - t.bottom : t.top - a.bottom, x: a.left, y: a.top };
}

/** Every frame's offset, from now until no transition is left running. */
async function sampleMotion(trigger: () => HTMLElement | null): Promise<Frame[]> {
  const frames: Frame[] = [];
  const start = performance.now();
  let quiet = 0;
  while (performance.now() - start < 2000) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const el = trigger();
    const frame = el ? measure(el) : null;
    if (frame) frames.push(frame);
    quiet = document.getAnimations().length === 0 ? quiet + 1 : 0;
    if (quiet > 2) break;
  }
  return frames;
}

const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

/**
 * Each sampled frame has the tip centered on its trigger, at one gap, and
 * the motion was caught: at least `minFrames` frames, the trigger moving at
 * least `minTravel` pixels across them.
 */
function expectTipFollowed(frames: Frame[], { minFrames = 4, minTravel = 0 } = {}) {
  expect(frames.length).toBeGreaterThanOrEqual(minFrames);
  expect(Math.max(spread(frames.map((f) => f.x)), spread(frames.map((f) => f.y)))).toBeGreaterThanOrEqual(minTravel);
  for (const [i, f] of frames.entries()) {
    expect(Math.abs(f.dx), `frame ${i} across`).toBeLessThanOrEqual(1);
    expect(Math.abs(f.gap - frames[0]!.gap), `frame ${i} gap`).toBeLessThanOrEqual(1);
  }
}

/** Opens the tip one frame after mount, as hover or focus does once the overlay shows. */
function useOpenNextFrame(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return open;
}

function IconButton({ buttonRef }: { buttonRef?: RefObject<HTMLButtonElement | null> }) {
  return (
    // Room above for the tip.
    <div style={{ paddingBlockStart: 64, paddingInline: 48 }}>
      <Button.Root ref={buttonRef} aria-label="Pin">
        <Button.Icon>*</Button.Icon>
      </Button.Root>
    </div>
  );
}

const pin = () => screen.queryByRole('button', { name: 'Pin' });

// A slow runner draws few frames in a 200-280ms enter, too few to show the
// tip following; a one-second enter gives it enough on any runner.
const slowEnter = {
  ['--_todae-dialog-motion-enter' as string]: '1s',
  ['--_todae-drawer-motion-enter' as string]: '1s',
  ['--_todae-sheet-motion-enter' as string]: '1s',
};

describe('A tip opened during an overlay enter motion', () => {
  it.each([
    ['end', 'ltr'],
    ['start', 'rtl'],
  ] as const)('stays by its trigger while a Drawer at %s slides in, %s', async (side: DrawerSide, dir) => {
    render(
      <Themed dir={dir} style={slowEnter}>
        <Drawer.Root open onOpenChange={() => undefined} side={side} aria-label="Filters">
          <IconButton />
        </Drawer.Root>
      </Themed>,
    );
    // Initial focus lands on the icon button, which opens its tip.
    expect(document.activeElement).toBe(pin());
    expectTipFollowed(await sampleMotion(pin), { minTravel: 40 });
  });

  it('stays by its trigger while a Dialog fades in', async () => {
    render(
      <Themed style={slowEnter}>
        <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit">
          <IconButton />
        </Dialog.Root>
      </Themed>,
    );
    expect(document.activeElement).toBe(pin());
    expectTipFollowed(await sampleMotion(pin));
  });

  it('stays by its trigger while a BottomSheet slides up', async () => {
    function Sheet() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <Themed style={slowEnter}>
          <BottomSheet.Root open onOpenChange={() => undefined} aria-label="Share" initialFocusRef={ref}>
            <BottomSheet.Body>
              <IconButton buttonRef={ref} />
            </BottomSheet.Body>
          </BottomSheet.Root>
        </Themed>
      );
    }
    render(<Sheet />);
    await waitFor(() => expect(document.activeElement).toBe(pin()));
    expectTipFollowed(await sampleMotion(pin), { minTravel: 40 });
  });
});

type Kind = 'Drawer' | 'Dialog' | 'BottomSheet';

function Overlay({ kind, open }: { kind: Kind; open: boolean }) {
  const tip = useOpenNextFrame();
  const inside = (
    <div style={{ paddingBlockStart: 64, paddingInline: 48 }}>
      <HeldTip label="Held" open={tip} />
    </div>
  );
  return (
    <Themed>
      {kind === 'BottomSheet' ? (
        <BottomSheet.Root open={open} onOpenChange={() => undefined} aria-label="Overlay">
          <BottomSheet.Body>{inside}</BottomSheet.Body>
        </BottomSheet.Root>
      ) : kind === 'Drawer' ? (
        <Drawer.Root open={open} onOpenChange={() => undefined} aria-label="Overlay">
          {inside}
        </Drawer.Root>
      ) : (
        <Dialog.Root open={open} onOpenChange={() => undefined} aria-label="Overlay">
          {inside}
        </Dialog.Root>
      )}
    </Themed>
  );
}

describe('A tip held open during an overlay exit motion', () => {
  it.each(['Drawer', 'Dialog', 'BottomSheet'] as const)('stays by its trigger while a %s leaves', async (kind) => {
    const { rerender } = render(<Overlay kind={kind} open />);
    const held = () => screen.queryByRole('button', { name: 'Held' });
    const overlay = screen.getByRole('dialog', { name: 'Overlay' });
    await waitFor(() => expect(overlay.hasAttribute('data-entered')).toBe(true));
    await waitFor(() => expect(tipOf(held()!)).not.toBeNull());
    await waitFor(() => expect(document.getAnimations()).toHaveLength(0));
    rerender(<Overlay kind={kind} open={false} />);
    expect(overlay.hasAttribute('data-todae-exiting')).toBe(true);
    expectTipFollowed(await sampleMotion(held), { minFrames: 2, minTravel: kind === 'Dialog' ? 0 : 40 });
  });
});
