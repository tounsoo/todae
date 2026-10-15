import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import * as api from '../index.js';
import { resetMatchMedia } from '../test/setup.js';
import {
  useTooltip,
  type TooltipTriggerUserProps,
  type TooltipWire,
  type UseTooltipOptions,
  type UseTooltipResult,
} from './useTooltip.js';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'useTooltip.ts'), 'utf8');

afterEach(() => {
  cleanup();
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

describe('useTooltip tooltip ref', () => {
  it('keeps one ref across renders, so React does not detach it', () => {
    const { result, rerender } = renderHook(() => useTooltip());
    const first = result.current.getTooltipProps().ref;
    rerender();
    expect(result.current.getTooltipProps().ref).toBe(first);
  });
});
