import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index.js';
import { resetMatchMedia } from '../test/setup.js';
import { resetTooltipWarmth } from '../components/Tooltip.warmth.js';
import {
  useTooltip,
  useTooltipInternal,
  type TooltipTriggerUserProps,
  type TooltipWire,
  type UseTooltipOptions,
  type UseTooltipResult,
} from './useTooltip.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'useTooltip.ts'), 'utf8');

afterEach(() => {
  cleanup();
  resetTooltipWarmth();
  vi.useRealTimers();
  resetMatchMedia();
});

beforeEach(() => {
  vi.useFakeTimers();
});

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function TipHarness({
  label = 'Hint',
  tip = 'Archive',
  ...options
}: UseTooltipOptions & { label?: string; tip?: string }) {
  const tooltip = useTooltip(options);
  const wire = tooltip.getTooltipProps();
  return (
    <>
      <button type="button" {...tooltip.getTriggerProps()}>
        {label}
      </button>
      {tooltip.open ? (
        <div role="tooltip" id={wire.id} ref={wire.ref} style={wire.style}>
          {tip}
        </div>
      ) : null}
    </>
  );
}

function Pair(options: UseTooltipOptions) {
  const first = useTooltip(options);
  const second = useTooltip(options);
  const firstWire = first.getTooltipProps();
  const secondWire = second.getTooltipProps();
  return (
    <>
      <button type="button" {...first.getTriggerProps()}>
        A
      </button>
      {first.open ? (
        <div role="tooltip" id={firstWire.id} ref={firstWire.ref} style={firstWire.style}>
          Tip A
        </div>
      ) : null}
      <button type="button" {...second.getTriggerProps()}>
        B
      </button>
      {second.open ? (
        <div role="tooltip" id={secondWire.id} ref={secondWire.ref} style={secondWire.style}>
          Tip B
        </div>
      ) : null}
    </>
  );
}

function openHover(name: string, showDelay: number) {
  const trigger = screen.getByRole('button', { name });
  fireEvent.pointerEnter(trigger);
  advance(showDelay);
  expect(screen.getByRole('tooltip', { name: `Tip ${name}` })).toBeTruthy();
  return trigger;
}

function closeHover(trigger: HTMLElement, hideDelay: number) {
  fireEvent.pointerLeave(trigger);
  advance(hideDelay);
  expect(screen.queryByRole('tooltip', { name: `Tip ${trigger.textContent}` })).toBeNull();
}

function PanelHarness(options: UseTooltipOptions<true> = { interactive: true }) {
  const tooltip = useTooltip({ interactive: true, ...options });
  const wire = tooltip.getTooltipProps();
  return (
    <>
      <button type="button" {...tooltip.getTriggerProps()}>
        Hint
      </button>
      <div
        role="dialog"
        aria-label="Policy"
        id={wire.id}
        ref={wire.ref}
        style={wire.style}
        data-open={tooltip.open ? '' : undefined}
        onPointerEnter={wire.onPointerEnter}
        onPointerLeave={wire.onPointerLeave}
      >
        Short prose. <a href="/tooltip">Read the policy</a>
      </div>
    </>
  );
}

describe('useTooltip exports', () => {
  it('exports the hook and does not import overlay dismiss machines', () => {
    expect(api.useTooltip).toBe(useTooltip);
    expectTypeOf<UseTooltipResult>().toHaveProperty('getTriggerProps');
    expectTypeOf<UseTooltipResult>().toHaveProperty('getTooltipProps');
    expectTypeOf<UseTooltipOptions>().toHaveProperty('enabled');
    expect(source).not.toContain('./Popover');
    expect(source).not.toContain('useControlledOpen');
    expect(source).not.toContain('useFocusRestore');
    expect(source).not.toContain('useInitialFocus');
    expect(source).not.toContain('useFocusTrap');
    expect(source).not.toContain('useInertOutside');
    const froms = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(new Set(froms)).toEqual(
      new Set([
        'react',
        '../components/props.js',
        '../components/domId.js',
        '../overlay/anchorName.js',
        '../overlay/cssTime.js',
        '../components/Tooltip.intent.js',
        '../components/Tooltip.warmth.js',
        '../components/Tooltip.wire.js',
        '../overlay/tabbables.js',
        '../overlay/useEscapeKey.js',
        './useControlledState.js',
      ]),
    );
  });
});

describe('useTooltip', () => {
  it("keeps the trigger's ref attached across renders", () => {
    const attach = vi.fn();
    function Probe({ tick }: { tick: number }) {
      const tip = api.useTooltip();
      return (
        <button type="button" data-tick={tick} {...tip.getTriggerProps({ ref: attach })}>
          Go
        </button>
      );
    }
    const { rerender } = render(<Probe tick={1} />);
    rerender(<Probe tick={2} />);
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('waits for the delay tokens the trigger computes, unless a delay is passed', () => {
    const tokens = { ['--todae-tooltip-delay-show' as string]: '0.05s', ['--todae-tooltip-delay-hide' as string]: '20ms' };
    function Tokened({ showDelay, hideDelay }: { showDelay?: number; hideDelay?: number }) {
      const tooltip = useTooltip({ showDelay, hideDelay });
      const { id, ref, style } = tooltip.getTooltipProps();
      return (
        <>
          <button type="button" {...tooltip.getTriggerProps({ style: tokens })}>
            Hint
          </button>
          {tooltip.open ? (
            <div role="tooltip" id={id} ref={ref} style={style}>
              Archive
            </div>
          ) : null}
        </>
      );
    }
    const { unmount } = render(<Tokened />);
    const trigger = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(trigger);
    advance(49);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerLeave(trigger);
    advance(19);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    advance(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
    unmount();
    resetTooltipWarmth();

    render(<Tokened showDelay={200} hideDelay={60} />);
    const passed = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(passed);
    advance(199);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerLeave(passed);
    advance(59);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    advance(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('waits 300ms to show and 100ms to hide without the delay tokens', () => {
    render(<TipHarness />);
    const trigger = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(trigger);
    advance(299);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    fireEvent.pointerLeave(trigger);
    advance(99);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    advance(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('uses a provided id on the tip', () => {
    render(<TipHarness id="archive-tip" defaultOpen />);
    expect(screen.getByRole('tooltip').id).toBe('archive-tip');
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBe('archive-tip');
  });

  it("joins the tip's id to the trigger's own aria-describedby while open", () => {
    function Harness() {
      const tooltip = useTooltip({ id: 'archive-tip' });
      return (
        <button type="button" {...tooltip.getTriggerProps({ 'aria-describedby': 'archive-note' })}>
          Hint
        </button>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Hint' });
    expect(trigger.getAttribute('aria-describedby')).toBe('archive-note');
    fireEvent.focus(trigger);
    expect(trigger.getAttribute('aria-describedby')).toBe('archive-note archive-tip');
  });

  it('does not open when the trigger handler the consumer passed prevents the event', () => {
    const onOpenChange = vi.fn();
    function Harness() {
      const tooltip = useTooltip({ onOpenChange });
      return (
        <button
          type="button"
          {...tooltip.getTriggerProps({
            onPointerEnter: (event) => event.preventDefault(),
            onFocus: (event) => event.preventDefault(),
          })}
        >
          Hint
        </button>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Hint' });
    fireEvent.pointerEnter(trigger);
    fireEvent.focus(trigger);
    advance(300);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it.each([
    ['pointer leave', fireEvent.pointerEnter, fireEvent.pointerLeave],
    ['blur', fireEvent.focus, fireEvent.blur],
  ] as const)('still closes on %s when the consumer prevents it', (_label, acquire, release) => {
    function Harness() {
      const tooltip = useTooltip();
      return (
        <button
          type="button"
          {...tooltip.getTriggerProps({
            onPointerLeave: (event) => event.preventDefault(),
            onBlur: (event) => event.preventDefault(),
          })}
        >
          {tooltip.open ? 'Open' : 'Closed'}
        </button>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button');
    acquire(trigger);
    advance(300);
    expect(trigger.textContent).toBe('Open');
    release(trigger);
    advance(300);
    expect(trigger.textContent).toBe('Closed');
  });

  it("adds the tip's id once when the consumer already lists it", () => {
    function Harness() {
      const tooltip = useTooltip({ id: 'archive-tip' });
      return (
        <button type="button" {...tooltip.getTriggerProps({ 'aria-describedby': 'archive-note archive-tip' })}>
          Hint
        </button>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Hint' });
    fireEvent.focus(trigger);
    expect(trigger.getAttribute('aria-describedby')).toBe('archive-note archive-tip');
  });

  it('resets intent and commits close when enabled becomes false', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<TipHarness defaultOpen onOpenChange={onOpenChange} />);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    rerender(<TipHarness defaultOpen enabled={false} onOpenChange={onOpenChange} />);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Hint' }));
    advance(300);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('calls the user pointer handler on enter before the tip commits', () => {
    const user = vi.fn();
    function Harness() {
      const tooltip = useTooltip();
      return (
        <button type="button" {...tooltip.getTriggerProps({ onPointerEnter: user } satisfies TooltipTriggerUserProps)}>
          Hint
        </button>
      );
    }
    render(<Harness />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Hint' }));
    expect(user).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(300);
  });

  it('returns hover-bridge handlers only when interactive', () => {
    const tip = renderHook(() => useTooltip());
    expect(tip.result.current.getTooltipProps()).not.toHaveProperty('onPointerEnter');
    const panel = renderHook(() => useTooltip({ interactive: true }));
    const wire = panel.result.current.getTooltipProps();
    expect(typeof wire.onPointerEnter).toBe('function');
    expectTypeOf(wire).toMatchTypeOf<TooltipWire<true>>();
  });

  it('opens the next hover tip with no show delay inside the warm window', () => {
    render(<Pair showDelay={200} hideDelay={40} skipDelay={80} />);
    const first = openHover('A', 200);
    closeHover(first, 40);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
  });

  it('waits the show delay once the warm window has passed', () => {
    render(<Pair showDelay={200} hideDelay={40} skipDelay={80} />);
    const first = openHover('A', 200);
    closeHover(first, 40);
    advance(80);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    expect(screen.queryByRole('tooltip', { name: 'Tip B' })).toBeNull();
    advance(199);
    expect(screen.queryByRole('tooltip', { name: 'Tip B' })).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
  });

  it('uses a 300ms warm window when skipDelay is omitted', () => {
    render(<Pair showDelay={200} hideDelay={40} />);
    const first = openHover('A', 200);
    closeHover(first, 40);
    advance(299);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
    const second = screen.getByRole('button', { name: 'B' });
    fireEvent.pointerLeave(second);
    advance(40);
    advance(300);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'A' }));
    expect(screen.queryByRole('tooltip', { name: 'Tip A' })).toBeNull();
    advance(200);
    expect(screen.getByRole('tooltip', { name: 'Tip A' })).toBeTruthy();
  });

  it('opens the next hover tip immediately while a hover tip is still within its hide delay', () => {
    render(<Pair showDelay={200} hideDelay={40} skipDelay={0} />);
    const first = openHover('A', 200);
    fireEvent.pointerLeave(first);
    expect(screen.getByRole('tooltip', { name: 'Tip A' })).toBeTruthy();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    expect(screen.getByRole('tooltip', { name: 'Tip A' })).toBeTruthy();
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
    advance(40);
    expect(screen.queryByRole('tooltip', { name: 'Tip A' })).toBeNull();
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
  });

  it("uses the opening tip's skipDelay", () => {
    function Harness() {
      const slow = useTooltip({ showDelay: 200, hideDelay: 40, skipDelay: 1000 });
      const quick = useTooltip({ showDelay: 200, hideDelay: 40, skipDelay: 50 });
      const slowWire = slow.getTooltipProps();
      const quickWire = quick.getTooltipProps();
      return (
        <>
          <button type="button" {...slow.getTriggerProps()}>
            Slow
          </button>
          {slow.open ? (
            <div role="tooltip" ref={slowWire.ref}>
              Slow tip
            </div>
          ) : null}
          <button type="button" {...quick.getTriggerProps()}>
            Quick
          </button>
          {quick.open ? (
            <div role="tooltip" ref={quickWire.ref}>
              Quick tip
            </div>
          ) : null}
        </>
      );
    }
    render(<Harness />);
    const slow = screen.getByRole('button', { name: 'Slow' });
    const quick = screen.getByRole('button', { name: 'Quick' });
    fireEvent.pointerEnter(slow);
    advance(200);
    fireEvent.pointerLeave(slow);
    advance(40);
    fireEvent.pointerEnter(quick);
    expect(screen.getByRole('tooltip', { name: 'Quick tip' })).toBeTruthy();
    fireEvent.pointerLeave(quick);
    advance(40);
    advance(50);
    fireEvent.pointerEnter(slow);
    expect(screen.getByRole('tooltip', { name: 'Slow tip' })).toBeTruthy();
  });

  it('does not warm other tips when a controlled tooltip rejects the hover open', () => {
    function Harness() {
      const rejected = useTooltip({ open: false, showDelay: 200, hideDelay: 40, skipDelay: 80 });
      const next = useTooltip({ showDelay: 200, hideDelay: 40, skipDelay: 80 });
      const wire = next.getTooltipProps();
      return (
        <>
          <button type="button" {...rejected.getTriggerProps()}>
            Rejected
          </button>
          <button type="button" {...next.getTriggerProps()}>
            Next
          </button>
          {next.open ? (
            <div role="tooltip" ref={wire.ref}>
              Next tip
            </div>
          ) : null}
        </>
      );
    }
    render(<Harness />);
    const rejected = screen.getByRole('button', { name: 'Rejected' });
    fireEvent.pointerEnter(rejected);
    advance(200);
    fireEvent.pointerLeave(rejected);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(199);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip', { name: 'Next tip' })).toBeTruthy();
  });

  it('starts the warm window when the parent closes a controlled hover tip', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      const controlled = useTooltip({
        open,
        onOpenChange: setOpen,
        showDelay: 200,
        hideDelay: 40,
        skipDelay: 80,
      });
      const next = useTooltip({ showDelay: 200, hideDelay: 40, skipDelay: 80 });
      const controlledWire = controlled.getTooltipProps();
      const nextWire = next.getTooltipProps();
      return (
        <>
          <button type="button" {...controlled.getTriggerProps()}>
            Controlled
          </button>
          {controlled.open ? (
            <div role="tooltip" ref={controlledWire.ref}>
              Controlled tip
            </div>
          ) : null}
          <button type="button" onClick={() => setOpen(false)}>
            Dismiss
          </button>
          <button type="button" {...next.getTriggerProps()}>
            Next
          </button>
          {next.open ? (
            <div role="tooltip" ref={nextWire.ref}>
              Next tip
            </div>
          ) : null}
        </>
      );
    }
    render(<Harness />);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Controlled' }));
    advance(200);
    expect(screen.getByRole('tooltip', { name: 'Controlled tip' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('tooltip', { name: 'Controlled tip' })).toBeNull();
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('tooltip', { name: 'Next tip' })).toBeTruthy();
  });

  it('waits the show delay after close when skipDelay is 0', () => {
    render(<Pair showDelay={200} hideDelay={40} skipDelay={0} />);
    const first = openHover('A', 200);
    closeHover(first, 40);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    expect(screen.queryByRole('tooltip', { name: 'Tip B' })).toBeNull();
    advance(199);
    expect(screen.queryByRole('tooltip', { name: 'Tip B' })).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
  });

  it('does not start the warm window from keyboard focus', () => {
    render(<Pair showDelay={200} hideDelay={40} skipDelay={80} />);
    const first = screen.getByRole('button', { name: 'A' });
    const second = screen.getByRole('button', { name: 'B' });
    fireEvent.focus(first);
    expect(screen.getByRole('tooltip', { name: 'Tip A' })).toBeTruthy();
    fireEvent.pointerEnter(second);
    expect(screen.queryByRole('tooltip', { name: 'Tip B' })).toBeNull();
    fireEvent.pointerLeave(second);
    fireEvent.blur(first);
    advance(40);
    expect(screen.queryByRole('tooltip', { name: 'Tip A' })).toBeNull();
    fireEvent.pointerEnter(second);
    expect(screen.queryByRole('tooltip', { name: 'Tip B' })).toBeNull();
    advance(199);
    expect(screen.queryByRole('tooltip', { name: 'Tip B' })).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
  });

  it('does not warm the next tip when the pointer leaves before the first tip opens', () => {
    render(<Pair showDelay={200} hideDelay={40} skipDelay={80} />);
    const first = screen.getByRole('button', { name: 'A' });
    fireEvent.pointerEnter(first);
    advance(199);
    fireEvent.pointerLeave(first);
    fireEvent.pointerEnter(screen.getByRole('button', { name: 'B' }));
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(199);
    expect(screen.queryByRole('tooltip')).toBeNull();
    advance(1);
    expect(screen.getByRole('tooltip', { name: 'Tip B' })).toBeTruthy();
  });

  it('keeps the panel open across the hover bridge', () => {
    render(<PanelHarness />);
    const trigger = screen.getByRole('button', { name: 'Hint' });
    const panel = screen.getByRole('dialog', { name: 'Policy', hidden: true });
    fireEvent.pointerEnter(trigger);
    advance(300);
    expect(panel.getAttribute('data-open')).toBe('');
    fireEvent.pointerLeave(trigger, { relatedTarget: panel });
    fireEvent.pointerEnter(panel);
    advance(100);
    expect(panel.getAttribute('data-open')).toBe('');
    fireEvent.pointerLeave(panel, { relatedTarget: document.body });
    advance(100);
    expect(panel.getAttribute('data-open')).toBeNull();
  });
});

describe('useTooltipInternal holdsFocus', () => {
  function HolderHarness({ accepts = () => true }: { accepts?: () => boolean }) {
    const tooltip = useTooltipInternal({}, { holdsFocus: (focused) => focused.id === 'row' && accepts() });
    const wire = tooltip.getTooltipProps();
    return (
      <>
        <a href="#row" id="row">
          <span {...tooltip.getTriggerProps()}>Name</span>
        </a>
        <button type="button">Other</button>
        {tooltip.open ? (
          <div role="tooltip" id={wire.id} ref={wire.ref} style={wire.style}>
            Full name
          </div>
        ) : null}
      </>
    );
  }

  it('shows the tip while an accepted element has focus, and hides it when focus leaves it', () => {
    render(<HolderHarness />);
    act(() => screen.getByRole('link').focus());
    expect(screen.getByRole('tooltip')).toBeTruthy();
    act(() => screen.getByRole('button').focus());
    advance(100);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps a hover-opened tip held when focus moves to an accepted element', () => {
    render(<HolderHarness />);
    const trigger = screen.getByText('Name');
    fireEvent.pointerEnter(trigger);
    advance(300);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    act(() => screen.getByRole('link').focus());
    fireEvent.pointerLeave(trigger);
    advance(100);
    expect(screen.getByRole('tooltip')).toBeTruthy();
  });

  it('releases the hold when focus leaves for the page, even once the element is no longer accepted', () => {
    let accepted = true;
    render(<HolderHarness accepts={() => accepted} />);
    act(() => screen.getByRole('link').focus());
    expect(screen.getByRole('tooltip')).toBeTruthy();
    accepted = false;
    act(() => screen.getByRole('link').blur());
    advance(100);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('keeps the internal options and holds out of the public hook', () => {
    const stray = { holdsFocus: () => true, anchorName: '--stray' } as UseTooltipOptions;
    function Stray() {
      const tooltip = useTooltip(stray);
      const wire = tooltip.getTooltipProps();
      return (
        <>
          <span {...tooltip.getTriggerProps()} data-testid="trigger" data-hold={'holdHover' in tooltip ? '' : undefined}>
            Name
          </span>
          <button type="button">Other</button>
          {tooltip.open ? <div role="tooltip" ref={wire.ref} /> : null}
        </>
      );
    }
    render(<Stray />);
    const trigger = screen.getByTestId('trigger');
    expect(trigger.hasAttribute('data-hold')).toBe(false);
    expect(trigger.style.getPropertyValue('anchor-name')).not.toBe('--stray');
    act(() => screen.getByRole('button').focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('uses a given anchorName on the trigger and the tip', () => {
    const { result } = renderHook(() => useTooltipInternal({}, { anchorName: '--mine' }));
    expect(result.current.getTriggerProps().style.anchorName).toBe('--mine');
    expect(result.current.getTooltipProps().style.positionAnchor).toBe('--mine');
  });
});

describe('useTooltip tooltip ref', () => {
  it('keeps one ref across renders, so React does not detach it', () => {
    const { result, rerender } = renderHook(() => useTooltip());
    const first = result.current.getTooltipProps().ref;
    rerender();
    expect(result.current.getTooltipProps().ref).toBe(first);
  });
});
