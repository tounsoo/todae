import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTooltipWarmth } from './tooltipWarmth.js';
import { useTooltip } from '../hooks/useTooltip.js';

let resolveFinished: () => void = () => undefined;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  resetTooltipWarmth();
  vi.useRealTimers();
  delete (document as unknown as { getAnimations?: unknown }).getAnimations;
});

/** A popover-like box that is still scaling open (a running finite `scale` transition). */
function stubScalingBox(box: Element) {
  const anim = {
    playState: 'running' as AnimationPlayState,
    transitionProperty: 'scale',
    effect: { target: box, pseudoElement: null, getComputedTiming: () => ({ endTime: 160 }), getKeyframes: () => [] },
    finished: new Promise<void>((resolve) => {
      resolveFinished = () => {
        anim.playState = 'finished';
        resolve();
      };
    }),
  };
  Object.defineProperty(document, 'getAnimations', {
    configurable: true,
    value: () => (anim.playState === 'running' ? [anim] : []),
  });
}

function Harness({ onOpenChange }: { onOpenChange: (open: boolean, reason: string) => void }) {
  const tip = useTooltip({ onOpenChange });
  const wire = tip.getTooltipProps();
  return (
    <div data-testid="box">
      <button type="button" {...tip.getTriggerProps()}>
        Pin
      </button>
      {tip.open ? (
        <div role="tooltip" id={wire.id} ref={wire.ref}>
          Pin it
        </div>
      ) : null}
    </div>
  );
}

describe('A tip whose trigger is still growing open', () => {
  it('keeps a later hover show delay once the focus that asked has left', async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    stubScalingBox(screen.getByTestId('box'));
    const trigger = screen.getByRole('button', { name: 'Pin' });

    // Focus lands while the box still scales: the open is deferred.
    act(() => trigger.focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
    // Focus leaves, then the pointer comes onto the trigger: a hover
    // starts its 300ms show delay.
    act(() => trigger.blur());
    fireEvent.pointerEnter(trigger);

    // The scale ends 10ms later, long before the hover delay.
    await act(async () => {
      vi.advanceTimersByTime(10);
      resolveFinished();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The hover show delay (300ms) has not run out; focus is gone.
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalledWith(true, 'focus');
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    expect(onOpenChange).toHaveBeenLastCalledWith(true, 'hover');
  });

  it('opens once the scale ends while focus still holds it', async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    stubScalingBox(screen.getByTestId('box'));
    act(() => screen.getByRole('button', { name: 'Pin' }).focus());
    expect(screen.queryByRole('tooltip')).toBeNull();
    await act(async () => {
      resolveFinished();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(true, 'focus');
  });
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe('A tip that waited while the hold that asked for it hands over', () => {
  it('opens for a hover already holding it once focus leaves', async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    stubScalingBox(screen.getByTestId('box'));
    const trigger = screen.getByRole('button', { name: 'Pin' });

    act(() => trigger.focus()); // focus asks to open now; deferred by the scale
    fireEvent.pointerEnter(trigger); // pointer comes onto the trigger while focused
    act(() => trigger.blur()); // focus leaves; the hover still holds

    await act(async () => {
      resolveFinished();
      await flush();
    });
    // Give any show delay plenty of time to run out.
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flush();
    });
    // The pointer is still on the trigger: the tip should be up.
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });

  it('opens for focus still holding it once the hover that asked leaves', async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    stubScalingBox(screen.getByTestId('box'));
    const trigger = screen.getByRole('button', { name: 'Pin' });

    fireEvent.pointerEnter(trigger);
    await act(async () => {
      vi.advanceTimersByTime(1000); // hover show delay runs out; the open is deferred by the scale
      await flush();
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
    act(() => trigger.focus()); // focus now holds it too
    fireEvent.pointerLeave(trigger); // the pointer leaves; focus still holds

    await act(async () => {
      resolveFinished();
      await flush();
    });
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flush();
    });
    expect(document.activeElement).toBe(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });

  it('ends open the same way with no scale running', async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Pin' });
    act(() => trigger.focus());
    fireEvent.pointerEnter(trigger);
    act(() => trigger.blur());
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flush();
    });
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });
});

describe('A tip held by focus after the hover leaves', () => {
  it('stays open with no scale running', async () => {
    render(<Harness onOpenChange={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Pin' });
    fireEvent.pointerEnter(trigger);
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flush();
    });
    act(() => trigger.focus());
    fireEvent.pointerLeave(trigger);
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flush();
    });
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });
});

describe('A waiting tip when a new hover delay starts', () => {
  it('reports the open once', async () => {
    const onOpenChange = vi.fn();
    render(<Harness onOpenChange={onOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'Pin' });
    fireEvent.pointerEnter(trigger);
    stubScalingBox(screen.getByTestId('box'));
    await act(async () => {
      vi.advanceTimersByTime(1000); // hover delay runs out; deferred by the scale
      await flush();
    });
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerEnter(trigger); // a new hover: a new show delay is pending
    await act(async () => {
      resolveFinished();
      await flush();
    });
    // The new delay, not the settle, opens it.
    expect(screen.queryByRole('tooltip')).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await flush();
    });
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    expect(onOpenChange.mock.calls.filter(([open]) => open === true)).toHaveLength(1);
  });
});
