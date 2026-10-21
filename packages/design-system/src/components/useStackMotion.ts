import { useCallback, useLayoutEffect, useReducer, type RefObject } from 'react';
import { cssTimeMs } from '../overlay/cssTime.js';
import { reducedMotion } from '../overlay/useOverlayPresence.js';

export type Stack = readonly string[];

export type StackDirection = 'forward' | 'back';

/** A change of the shown stack, as its slide starts. */
export type StackChange = { from: Stack; to: Stack; direction: StackDirection };

export type ViewStatus = 'current' | 'entering' | 'leaving' | 'below';

type MotionState = { shown: Stack; change: StackChange | null };

type MotionAction = { type: 'show'; stack: Stack } | { type: 'settle' } | { type: 'reset'; stack: Stack };

export function sameStack(a: Stack, b: Stack): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function motionReducer(state: MotionState, action: MotionAction): MotionState {
  switch (action.type) {
    case 'show':
      return {
        shown: action.stack,
        change: {
          from: state.shown,
          to: action.stack,
          direction: action.stack.length >= state.shown.length ? 'forward' : 'back',
        },
      };
    case 'settle':
      return state.change ? { ...state, change: null } : state;
    case 'reset':
      return { shown: action.stack, change: null };
  }
}

function motionToken(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(`--todae-drilldown-motion-${name}`).trim();
}

// The animations on the elements themselves, as getAnimations() leaves out
// their content's, without endless ones, which never finish.
function slideAnimations(elements: readonly (HTMLElement | null | undefined)[]): Animation[] {
  return elements.flatMap((el) => el?.getAnimations() ?? []).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
}

type UseStackMotionOptions = {
  stack: Stack;
  viewportRef: RefObject<HTMLElement | null>;
  /** Stable, as are viewportRef and onChange: the slide starts again when one changes. */
  elementOf: (view: string) => HTMLElement | undefined;
  /**
   * Runs as each change starts, before the views move. Returns true when it
   * brought back a scroll offset, which needs the viewport's full height at
   * once, or the scroll container clamps it.
   */
  onChange: (change: StackChange, entering: HTMLElement | undefined, leaving: HTMLElement | undefined) => boolean;
};

type UseStackMotionResult = {
  shown: Stack;
  direction: StackDirection | undefined;
  statusOf: (view: string) => ViewStatus | null;
  /** Shows `stack` at once, with no slide. */
  reset: (stack: Stack) => void;
};

/**
 * The stack on screen as it follows `stack`: which view enters, which leaves
 * and which wait below, and the viewport's height, until the slide's
 * animations finish.
 */
export function useStackMotion({ stack, viewportRef, elementOf, onChange }: UseStackMotionOptions): UseStackMotionResult {
  const [{ shown, change }, dispatch] = useReducer(motionReducer, { shown: stack, change: null });
  if (!sameStack(stack, shown)) dispatch({ type: 'show', stack });

  useLayoutEffect(() => {
    if (!change) return;
    const settle = () => dispatch({ type: 'settle' });
    const viewport = viewportRef.current;
    const top = change.to.at(-1);
    const left = change.from.at(-1);
    const entering = top === undefined ? undefined : elementOf(top);
    const leaving = left === undefined || left === top ? undefined : elementOf(left);
    const duration = viewport && !reducedMotion() ? (cssTimeMs(motionToken(viewport, 'duration')) ?? 0) : 0;
    const keepsHeight = onChange(change, entering, leaving);
    if (viewport && entering && leaving && duration > 0 && !keepsHeight) {
      viewport.animate([{ height: `${leaving.offsetHeight}px` }, { height: `${entering.offsetHeight}px` }], {
        duration,
        easing: motionToken(viewport, 'easing-enter') || 'ease',
      });
    }
    if (duration <= 0) {
      settle();
      return;
    }
    // Settles when the slide's animations finish, so CSS that changes them
    // keeps the leaving view on screen as long as it moves.
    let current = true;
    void Promise.allSettled(slideAnimations([viewport, entering, leaving]).map((a) => a.finished)).then(() => {
      if (current) settle();
    });
    return () => {
      current = false;
    };
  }, [change, elementOf, onChange, viewportRef]);

  const statusOf = useCallback(
    (view: string): ViewStatus | null => {
      const top = shown.at(-1);
      if (view === top) return change ? 'entering' : 'current';
      if (change && view === change.from.at(-1)) return 'leaving';
      return shown.includes(view) ? 'below' : null;
    },
    [change, shown],
  );

  const reset = useCallback((next: Stack) => dispatch({ type: 'reset', stack: next }), []);

  return { shown, direction: change?.direction, statusOf, reset };
}
