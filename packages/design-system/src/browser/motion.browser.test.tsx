import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { server } from 'vitest/browser';
import { afterEach, describe, expect, it } from 'vitest';
import { BottomSheet } from '../components/BottomSheet.js';
import { Button } from '../components/Button.js';
import { Dialog } from '../components/Dialog.js';
import { Drawer, type DrawerSide } from '../components/Drawer.js';
import { Popover } from '../components/Popover.js';
import { Tooltip } from '../components/Tooltip.js';
import { usePopover } from '../hooks/usePopover.js';
import { useTooltip } from '../hooks/useTooltip.js';
import { HeldTip } from '../test/heldTip.js';
import { tipFor } from '../test/tipFor.js';
import { emulateMedia } from '../test/media.js';

afterEach(cleanup);

function Themed({ children, dir, style }: { children: ReactNode; dir?: 'ltr' | 'rtl'; style?: CSSProperties }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir} style={style}>
      {children}
    </div>
  );
}

function tipOf(trigger: HTMLElement): HTMLElement | null {
  const tip = tipFor(trigger);
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

/**
 * Every frame's offset, from now until no transition is left running. An
 * overlay's enter starts two frames after it shows, and then only once React
 * renders data-entered, which a busy runner can put off by another frame. So
 * the frames before any motion runs don't count as quiet: they would end the
 * sampling before the motion starts. Pass `waitForStart: false` where the
 * motion is already over.
 */
async function sampleMotion(trigger: () => HTMLElement | null, { waitForStart = true } = {}): Promise<Frame[]> {
  const frames: Frame[] = [];
  const start = performance.now();
  let started = !waitForStart;
  let quiet = 0;
  while (performance.now() - start < 2000) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const el = trigger();
    const frame = el ? measure(el) : null;
    if (frame) frames.push(frame);
    const running = document.getAnimations().length > 0;
    started ||= running;
    quiet = started && !running ? quiet + 1 : 0;
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
  // Motion only has to work in Chrome (ARCHITECTURE "Motion"); elsewhere the tip may sit a fraction of a
  // pixel further off a trigger that is scaling.
  const slack = server.browser === 'chromium' ? 1 : 1.5;
  for (const [i, f] of frames.entries()) {
    expect(Math.abs(f.dx), `frame ${i} across`).toBeLessThanOrEqual(slack);
    expect(Math.abs(f.gap - frames[0]!.gap), `frame ${i} gap`).toBeLessThanOrEqual(slack);
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
  ['--_todae-dialog-motion-duration-enter' as string]: '1s',
  ['--_todae-drawer-motion-duration-enter' as string]: '1s',
  ['--_todae-sheet-motion-duration-enter' as string]: '1s',
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
    const frames = await sampleMotion(pin);
    expectTipFollowed(frames, { minTravel: 40 });
  });

  it('stays by its trigger while a Dialog rises and fades in', async () => {
    render(
      <Themed style={slowEnter}>
        <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit">
          <IconButton />
        </Dialog.Root>
      </Themed>,
    );
    expect(document.activeElement).toBe(pin());
    // The panel rises by layout, so the tip moves with it.
    expectTipFollowed(await sampleMotion(pin), { minTravel: 3 });
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

describe('A tip in a popover that grows open', () => {
  function Grow() {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popover = usePopover({ defaultOpen: true, initialFocusRef: buttonRef });
    return (
      <Themed style={{ ['--_todae-popover-motion-duration-enter' as string]: '1s' }}>
        <Button.Root {...popover.getTriggerProps()}>Open</Button.Root>
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Grow">
          <IconButton buttonRef={buttonRef} />
        </Popover.Root>
      </Themed>
    );
  }

  const scaling = (el: Element) =>
    el.getAnimations().some((animation) => (animation as CSSTransition).transitionProperty === 'scale');

  it('waits for the scale to settle, then sits by its trigger', async () => {
    render(<Grow />);
    const content = screen.getByRole('dialog', { name: 'Grow' });
    await waitFor(() => expect(document.activeElement).toBe(pin()));
    // Focus would open the tip at once, but the popover is about to grow or
    // still grows.
    expect(content.hasAttribute('data-todae-entering') || scaling(content)).toBe(true);
    expect(tipOf(pin()!)).toBeNull();
    await waitFor(() => expect(tipOf(pin()!)).not.toBeNull(), { timeout: 3000 });
    expect(scaling(content)).toBe(false);
    expect(getComputedStyle(content).scale).toBe('none');
    const frames = await sampleMotion(pin, { waitForStart: false });
    expect(frames.length).toBeGreaterThanOrEqual(1);
    for (const f of frames) expect(Math.abs(f.dx)).toBeLessThanOrEqual(1);
  });

  it('grows from the side of its trigger it sits on', async () => {
    render(<Grow />);
    const content = screen.getByRole('dialog', { name: 'Grow' });
    // Below its trigger, lined up with its start edge.
    expect(content.style.getPropertyValue('--_origin')).toBe('left top');
  });
});

describe('A popover about as wide as its trigger, in right-to-left text', () => {
  // One pixel wider than its trigger and lined up with its right edge. Scaled
  // toward its default left top as it starts to grow, its left edge would
  // measure closer to the trigger's than its right.
  function Wide() {
    const popover = usePopover({ defaultOpen: true });
    const props = popover.getPopoverProps();
    const triggerProps = popover.getTriggerProps();
    return (
      <Themed dir="rtl" style={{ ['--_todae-popover-motion-duration-enter' as string]: '1s', paddingBlockStart: 64, paddingInline: 48 }}>
        <Button.Root {...triggerProps} style={{ ...triggerProps.style, inlineSize: 100 }}>
          Open
        </Button.Root>
        <Popover.Root {...props} style={{ ...props.style, inlineSize: 101 }} role="dialog" aria-label="Wide">
          Body
        </Popover.Root>
      </Themed>
    );
  }

  it('grows from the right corner it lines up with', async () => {
    render(<Wide />);
    const content = screen.getByRole('dialog', { name: 'Wide' });
    const trigger = screen.getByRole('button', { name: 'Open' });
    await waitFor(() => expect(content.matches(':popover-open')).toBe(true));
    expect(content.style.getPropertyValue('--_origin')).toBe('right top');
    // So its right edge stays on the trigger's while it grows.
    expect(Math.abs(content.getBoundingClientRect().right - trigger.getBoundingClientRect().right)).toBeLessThan(1);
  });
});

describe('A popover that has opened', () => {
  function Opened() {
    const popover = usePopover({ defaultOpen: true });
    return (
      <Themed style={{ paddingBlockStart: 64, paddingInline: 48 }}>
        <Button.Root {...popover.getTriggerProps()}>Open</Button.Root>
        <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Opened">
          <div style={{ inlineSize: 240, blockSize: 160 }}>Body</div>
        </Popover.Root>
      </Themed>
    );
  }

  // Safari re-resolves the position fallbacks right after the opening
  // transition ends and ran it again, now and then from halfway.
  it('fades in once, then holds still with no transition', async () => {
    const runs: string[] = [];
    const listen = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.getAttribute('aria-label') === 'Opened') {
        runs.push((event as TransitionEvent).propertyName);
      }
    };
    document.addEventListener('transitionrun', listen, true);
    try {
      render(<Opened />);
      const content = screen.getByRole('dialog', { name: 'Opened' });
      await waitFor(() => expect(content.hasAttribute('data-todae-settled')).toBe(true), { timeout: 2000 });
      // Room for a run that would start again after the first ends.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(runs.filter((name) => name === 'opacity')).toEqual(['opacity']);
      expect(getComputedStyle(content).transitionProperty).toBe('none');
      expect(getComputedStyle(content).opacity).toBe('1');
    } finally {
      document.removeEventListener('transitionrun', listen, true);
    }
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

describe('A tooltip as it opens', () => {
  function opacityRuns(name: string): { runs: string[]; stop: () => void } {
    const runs: string[] = [];
    const listen = (event: Event) => {
      if (event.target instanceof HTMLElement && event.target.textContent === name) {
        runs.push((event as TransitionEvent).propertyName);
      }
    };
    document.addEventListener('transitionrun', listen, true);
    return { runs, stop: () => document.removeEventListener('transitionrun', listen, true) };
  }

  function Pair() {
    const a = useTooltip();
    const b = useTooltip();
    return (
      <Themed style={{ paddingBlockStart: 64, paddingInline: 48, display: 'flex', gap: 8 }}>
        <Button.Root tooltip={false} {...a.getTriggerProps()}>
          A
        </Button.Root>
        <Tooltip.Root {...a.getTooltipProps()}>Tip A</Tooltip.Root>
        <Button.Root tooltip={false} {...b.getTriggerProps()}>
          B
        </Button.Root>
        <Tooltip.Root {...b.getTooltipProps()}>Tip B</Tooltip.Root>
      </Themed>
    );
  }

  it('fades in once when it opens cold, then holds still with no transition', async () => {
    const watch = opacityRuns('Tip A');
    try {
      render(<Pair />);
      fireEvent.pointerEnter(screen.getByRole('button', { name: 'A' }));
      const tip = await screen.findByRole('tooltip', { name: 'Tip A' }, { timeout: 2000 });
      expect(tip.hasAttribute('data-todae-warm')).toBe(false);
      await waitFor(() => expect(tip.hasAttribute('data-todae-settled')).toBe(true), { timeout: 2000 });
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(watch.runs.filter((name) => name === 'opacity')).toEqual(['opacity']);
      expect(getComputedStyle(tip).transitionProperty).toBe('none');
      expect(getComputedStyle(tip).opacity).toBe('1');
    } finally {
      watch.stop();
    }
  });

  it('shows at once when it opens warm, as the pointer sweeps on from another tip', async () => {
    const watch = opacityRuns('Tip B');
    try {
      render(<Pair />);
      const a = screen.getByRole('button', { name: 'A' });
      fireEvent.pointerEnter(a);
      await screen.findByRole('tooltip', { name: 'Tip A' }, { timeout: 2000 });
      fireEvent.pointerLeave(a);
      fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
      const tip = await screen.findByRole('tooltip', { name: 'Tip B' }, { timeout: 100 });
      expect(tip.hasAttribute('data-todae-warm')).toBe(true);
      expect(getComputedStyle(tip).opacity).toBe('1');
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(watch.runs).toEqual([]);
    } finally {
      watch.stop();
    }
  });
});

describe('A Drawer or BottomSheet under reduced motion', () => {
  function Panel({ kind, open }: { kind: 'Drawer' | 'BottomSheet'; open: boolean }) {
    const Parts = kind === 'Drawer' ? Drawer : BottomSheet;
    return (
      <Themed>
        <Parts.Root open={open} onOpenChange={() => undefined}>
          <Parts.Title>Panel</Parts.Title>
          <Parts.Body data-testid="body">Body</Parts.Body>
        </Parts.Root>
      </Themed>
    );
  }

  // The panel never moves, and the overlay stays open through the scrim's
  // fade out, rather than closing at once.
  it.each(['Drawer', 'BottomSheet'] as const)('%s holds its panel still while its scrim fades in and out', async (kind) => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    try {
      const { rerender } = render(<Panel kind={kind} open />);
      const overlay = screen.getByRole('dialog', { name: 'Panel' });
      const body = screen.getByTestId('body');
      const place = () => {
        const box = body.getBoundingClientRect();
        return { left: Math.round(box.left), top: Math.round(box.top) };
      };
      const first = place();
      await waitFor(() => expect(overlay.hasAttribute('data-entered')).toBe(true));
      expect(place()).toEqual(first);
      rerender(<Panel kind={kind} open={false} />);
      expect(overlay.hasAttribute('data-todae-exiting')).toBe(true);
      expect(place()).toEqual(first);
      await waitFor(() => expect(overlay.isConnected && overlay.hasAttribute('open')).toBe(false));
    } finally {
      await emulateMedia([]);
    }
  });
});
