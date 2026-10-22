import { useCallback, useLayoutEffect, useReducer, useRef, type RefObject } from 'react';
import { tokenMs } from '../overlay/cssTime.js';
import { reducedMotion } from '../overlay/useOverlayPresence.js';

export type Stack = readonly string[];

export type StackDirection = 'forward' | 'back';

/** A change of the shown stack, as its slide starts, with the trigger that pushed the view it shows, if one did. */
export type StackChange = { from: Stack; to: Stack; direction: StackDirection; trigger: HTMLElement | null };

/** A view sliding in or out, in the direction of the change that moved it. */
type Moving = { view: string; direction: StackDirection };

export type ViewStatus =
  | { kind: 'current' | 'below' }
  | { kind: 'entering' | 'leaving'; direction: StackDirection };

type MotionState = {
  shown: Stack;
  /** The last change, kept until a reset. */
  change: StackChange | null;
  entering: Moving | null;
  /** Every view still sliding out, also those an earlier change moved. */
  leaving: readonly Moving[];
  /** A push's trigger, until the render that shows the stack it asked for, or keeps the stack. */
  pushing: { to: Stack; trigger: HTMLElement } | null;
};

type MotionAction =
  | { type: 'push'; to: Stack; trigger: HTMLElement }
  | { type: 'show'; stack: Stack }
  | { type: 'kept' }
  | { type: 'settle'; views: readonly string[] }
  | { type: 'reset'; stack: Stack };

export function sameStack(a: Stack, b: Stack): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function motionReducer(state: MotionState, action: MotionAction): MotionState {
  switch (action.type) {
    case 'push':
      return { ...state, pushing: { to: action.to, trigger: action.trigger } };
    case 'kept':
      return { ...state, pushing: null };
    case 'show': {
      const direction: StackDirection = action.stack.length >= state.shown.length ? 'forward' : 'back';
      const top = action.stack.at(-1);
      const left = state.shown.at(-1);
      const leaving = left === undefined || left === top ? state.leaving : [...state.leaving, { view: left, direction }];
      const trigger = state.pushing && sameStack(state.pushing.to, action.stack) ? state.pushing.trigger : null;
      return {
        shown: action.stack,
        change: { from: state.shown, to: action.stack, direction, trigger },
        entering: top === undefined || top === left ? null : { view: top, direction },
        leaving: leaving.filter((moving) => moving.view !== top),
        pushing: null,
      };
    }
    case 'settle': {
      const entering = state.entering && action.views.includes(state.entering.view) ? null : state.entering;
      const leaving = state.leaving.filter((moving) => !action.views.includes(moving.view));
      return entering === state.entering && leaving.length === state.leaving.length ? state : { ...state, entering, leaving };
    }
    case 'reset':
      return { shown: action.stack, change: null, entering: null, leaving: [], pushing: null };
  }
}

function scrollContainer(el: HTMLElement): Element {
  for (let node = el.parentElement; node && node !== el.ownerDocument.body; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
  }
  return el.ownerDocument.scrollingElement ?? el.ownerDocument.documentElement;
}

// The offset that brings the viewport's top to the top of `scroller`, inside
// its padding: 0 for a viewport that starts an overlay body, and the
// viewport's place for one further down a page. The page scrolls the
// viewport's own box to the top of the window, past the root's padding.
function topOf(viewport: HTMLElement, scroller: Element): number {
  const top = viewport.getBoundingClientRect().top + scroller.scrollTop;
  if (scroller === viewport.ownerDocument.scrollingElement) return top;
  const { paddingTop } = getComputedStyle(scroller);
  return top - scroller.getBoundingClientRect().top - scroller.clientTop - Number.parseFloat(paddingTop);
}

function enterEasing(viewport: HTMLElement): string | undefined {
  const easing = getComputedStyle(viewport).getPropertyValue('--todae-drilldown-motion-easing-enter').trim();
  if (process.env.NODE_ENV !== 'production' && !easing) {
    console.error("Drilldown: --todae-drilldown-motion-easing-enter reads empty, so the viewport's height changes at a constant speed. Load Todae's stylesheet or set the token.");
  }
  return easing || undefined;
}

// The animations on the elements themselves, as getAnimations() leaves out
// their content's, without endless ones, which never finish.
function slideAnimations(elements: readonly (HTMLElement | null | undefined)[]): Animation[] {
  return elements.flatMap((el) => el?.getAnimations() ?? []).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
}

export type StackViews = { entering: HTMLElement | undefined; leaving: HTMLElement | undefined };

type UseStackMotionOptions = {
  stack: Stack;
  viewportRef: RefObject<HTMLElement | null>;
  elementOf: (view: string) => HTMLElement | undefined;
  /**
   * Runs as each change starts, before the views move, given the scroll
   * offset before it. Returns the offset to bring back, or none to show the
   * new view from its top.
   */
  onChange: (change: StackChange, views: StackViews, offset: number) => number | undefined;
};

type UseStackMotionResult = {
  shown: Stack;
  /** The last change's, while a view still moves. */
  direction: StackDirection | undefined;
  statusOf: (view: string) => ViewStatus | null;
  /** Shows `stack` at once, with no slide. */
  reset: (stack: Stack) => void;
  /** Notes that `trigger` asks for `to`, so the change to it carries the trigger. */
  requestPush: (to: Stack, trigger: HTMLElement) => void;
};

/**
 * The stack on screen as it follows `stack`: which view enters, which leave
 * and which wait below, the scroll, and the viewport's height. Each moving
 * view settles when its own transitions and animations finish, so a change
 * during a slide lets the views already moving finish theirs.
 */
export function useStackMotion({ stack, viewportRef, elementOf, onChange }: UseStackMotionOptions): UseStackMotionResult {
  const [{ shown, change, entering, leaving, pushing }, dispatch] = useReducer(motionReducer, {
    shown: stack,
    change: null,
    entering: null,
    leaving: [],
    pushing: null,
  });
  if (!sameStack(stack, shown)) dispatch({ type: 'show', stack });
  else if (pushing) dispatch({ type: 'kept' });
  const latest = useRef({ elementOf, onChange });
  latest.current = { elementOf, onChange };
  // An effect created again on a tree that already shows the change, as an
  // <Activity> that shows again does, must not move focus or scroll again.
  const applied = useRef<StackChange | null>(null);

  useLayoutEffect(() => {
    if (!change || applied.current === change) return;
    applied.current = change;
    const { elementOf, onChange } = latest.current;
    const viewport = viewportRef.current;
    const top = change.to.at(-1);
    const left = change.from.at(-1);
    const views: StackViews = {
      entering: top === undefined ? undefined : elementOf(top),
      leaving: left === undefined || left === top ? undefined : elementOf(left),
    };
    const scroller = viewport && scrollContainer(viewport);
    const restored = onChange(change, views, scroller?.scrollTop ?? 0);
    if (!viewport || !scroller) return;
    scroller.scrollTop = restored ?? Math.min(scroller.scrollTop, topOf(viewport, scroller));
    const duration = reducedMotion() ? 0 : tokenMs(viewport, '--todae-drilldown-motion-duration');
    // A restored offset needs the viewport's full height at once, or the
    // scroll container clamps it.
    if (views.entering && views.leaving && duration && !restored) {
      viewport.animate([{ height: `${views.leaving.offsetHeight}px` }, { height: `${views.entering.offsetHeight}px` }], {
        duration,
        easing: enterEasing(viewport),
      });
    }
  }, [change, viewportRef]);

  // Settles each moving view when its slide's transitions finish, so CSS that
  // changes them keeps it on screen as long as it moves. The entering view
  // waits for the viewport's height too.
  useLayoutEffect(() => {
    const moving = entering ? [entering, ...leaving] : leaving;
    if (moving.length === 0) return;
    let current = true;
    const idle: string[] = [];
    for (const { view } of moving) {
      const own = latest.current.elementOf(view);
      const animations = slideAnimations(view === entering?.view ? [own, viewportRef.current] : [own]);
      if (animations.length === 0) {
        idle.push(view);
        continue;
      }
      void Promise.allSettled(animations.map((a) => a.finished)).then(() => {
        if (current) dispatch({ type: 'settle', views: [view] });
      });
    }
    if (idle.length > 0) dispatch({ type: 'settle', views: idle });
    return () => {
      current = false;
    };
  }, [entering, leaving, viewportRef]);

  const statusOf = useCallback(
    (view: string): ViewStatus | null => {
      if (entering?.view === view) return { kind: 'entering', direction: entering.direction };
      const out = leaving.find((moving) => moving.view === view);
      if (out) return { kind: 'leaving', direction: out.direction };
      if (view === shown.at(-1)) return { kind: 'current' };
      return shown.includes(view) ? { kind: 'below' } : null;
    },
    [entering, leaving, shown],
  );

  const reset = useCallback((next: Stack) => dispatch({ type: 'reset', stack: next }), []);
  const requestPush = useCallback((to: Stack, trigger: HTMLElement) => dispatch({ type: 'push', to, trigger }), []);

  return { shown, direction: entering || leaving.length > 0 ? change?.direction : undefined, statusOf, reset, requestPush };
}
