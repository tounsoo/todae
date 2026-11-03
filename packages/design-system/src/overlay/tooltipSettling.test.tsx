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
