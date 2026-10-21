import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { useControlledState } from '../hooks/useControlledState.js';
import { cssTimeMs } from '../overlay/cssTime.js';
import { useModalContext } from '../overlay/modalContext.js';
import { firstTabbable, isReachable } from '../overlay/tabbables.js';
import { reducedMotion } from '../overlay/useOverlayPresence.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { Button, type ButtonActionProps, type ButtonRenderedProps } from './Button.js';
import { useDismissLabel } from './dismissLabel.js';
import { BackGlyph, glyphOr } from './glyphs.js';
import { isImeKeyEvent } from './ime.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { focusWithoutScroll } from './revealRing.js';
import styles from './Drilldown.module.css';

/** Why the stack changed: a Drilldown.Trigger, Drilldown.Back, or Escape and the Android back gesture. */
export type DrilldownChangeReason = 'push' | 'back' | 'escape';

/** What Escape does below the first view: go back one view, or leave it to the overlay, which closes. */
export type DrilldownEscape = 'back' | 'close';

type DrilldownDirection = 'forward' | 'back';

export type DrilldownRootProps = {
  /** Controlled stack of view values, the first view first and the shown view last. */
  value?: readonly string[];
  defaultValue?: readonly string[];
  onValueChange?: (value: readonly string[], reason: DrilldownChangeReason) => void;
  escape?: DrilldownEscape;
  children?: ReactNode;
};

export type DrilldownViewportProps = ComponentPropsWithRef<'div'>;

export type DrilldownViewProps = {
  value: string;
  /** Names the view's group, Drilldown.Label while it shows, and Drilldown.Back from the view above it. */
  label: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
} & Omit<ComponentPropsWithRef<'div'>, 'role'>;

export type DrilldownTriggerProps = (ButtonActionProps | ButtonRenderedProps) & { value: string };

export type DrilldownBackProps = ButtonActionProps;

export type DrilldownLabelProps = Omit<ComponentPropsWithRef<'span'>, 'children'>;

type Stack = readonly string[];

// The stack a slide leaves, and which way it goes.
type Motion = { from: Stack; direction: DrilldownDirection };

type MotionState = { shown: Stack; motion: Motion | null };

type MotionAction = { type: 'show'; stack: Stack } | { type: 'settle' } | { type: 'reset'; stack: Stack };

function sameStack(a: Stack, b: Stack): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

function motionReducer(state: MotionState, action: MotionAction): MotionState {
  switch (action.type) {
    case 'show':
      return {
        shown: action.stack,
        motion: { from: state.shown, direction: action.stack.length >= state.shown.length ? 'forward' : 'back' },
      };
    case 'settle':
      return state.motion ? { ...state, motion: null } : state;
    case 'reset':
      return { shown: action.stack, motion: null };
  }
}

// What a stack entry remembers while views above it show.
type Entry = { trigger: HTMLElement | null; scrollTop: number };

type ViewRecord = { element: HTMLElement; initialFocusRef?: RefObject<HTMLElement | null> };

type ViewStatus = 'current' | 'entering' | 'leaving' | 'below';

type DrilldownContextValue = {
  stack: Stack;
  direction: DrilldownDirection | undefined;
  statusOf: (value: string) => ViewStatus | null;
  labels: ReadonlyMap<string, string>;
  push: (value: string, trigger: HTMLElement | null) => void;
  pop: (reason: DrilldownChangeReason) => void;
  registerView: (value: string, label: string, record: ViewRecord) => () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
  backRef: RefObject<HTMLButtonElement | null>;
};

const DrilldownContext = /* @__PURE__ */ createContext<DrilldownContextValue | null>(null);

function useDrilldown(part: string): DrilldownContextValue {
  const ctx = useContext(DrilldownContext);
  if (!ctx) throw new Error(`${part} must render inside Drilldown.Root`);
  return ctx;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node && node !== el.ownerDocument.body; node = node.parentElement) {
    if (/auto|scroll/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

function motionToken(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(`--todae-drilldown-motion-${name}`).trim();
}

type MotionStart = {
  motion: Motion;
  shown: Stack;
  /** The Drilldown.Trigger that pushed the new top, if one did. */
  trigger: HTMLElement | null;
  duration: number;
  viewport: HTMLElement | null;
  back: HTMLElement | null;
  views: ReadonlyMap<string, ViewRecord>;
  memory: Map<string, Entry>;
};

// Runs once as a slide starts: notes what the covered view must get back,
// then moves the height, scroll and focus to the new view.
function startMotion({ motion, shown, trigger, duration, viewport, back, views, memory }: MotionStart) {
  const top = shown.at(-1);
  const left = motion.from.at(-1);
  const entering = top === undefined ? undefined : views.get(top)?.element;
  const leaving = left === undefined || left === top ? undefined : views.get(left)?.element;
  const scroller = viewport && scrollParent(viewport);
  const active = viewport?.ownerDocument.activeElement;
  // Focus moves with the views when it was on them, on Back, lost, or
  // anywhere in the modal around them; not from the product's own control
  // elsewhere on the page that set a controlled stack.
  const ownsFocus =
    !active ||
    active === active.ownerDocument.body ||
    leaving?.contains(active) ||
    back === active ||
    Boolean(viewport?.closest('dialog')?.contains(active));

  let scrollTop = 0;
  if (motion.direction === 'forward') {
    if (left !== undefined) memory.set(left, { trigger: memory.get(left)?.trigger ?? null, scrollTop: scroller?.scrollTop ?? 0 });
    if (top !== undefined) memory.set(top, { trigger, scrollTop: 0 });
  } else if (top !== undefined) {
    scrollTop = memory.get(top)?.scrollTop ?? 0;
  }

  // A restored offset needs the parent's full height at once, or the scroll
  // container clamps it.
  if (viewport && entering && leaving && duration > 0 && scrollTop === 0) {
    viewport.animate([{ height: `${leaving.offsetHeight}px` }, { height: `${entering.offsetHeight}px` }], {
      duration,
      easing: motionToken(viewport, 'easing-enter') || 'ease',
    });
  }
  if (scroller) scroller.scrollTop = scrollTop;

  if (!entering || !ownsFocus) return;
  // The entry just above the new top: a jump back several views returns to
  // the trigger in the view it lands on.
  const child = motion.from[shown.length];
  const returnTo = motion.direction === 'back' && child !== undefined ? memory.get(child)?.trigger : null;
  const initial = motion.direction === 'forward' && top !== undefined ? views.get(top)?.initialFocusRef?.current : null;
  focusWithoutScroll(
    returnTo && returnTo.isConnected && entering.contains(returnTo) && isReachable(returnTo) && !returnTo.matches(':disabled')
      ? returnTo
      : (initial ?? firstTabbable(entering) ?? entering),
  );
}

const EMPTY: Stack = [];

function Root({ value, defaultValue = EMPTY, onValueChange, escape = 'back', children }: DrilldownRootProps) {
  const [stack, setStack] = useControlledState<Stack>(value, defaultValue);
  const [{ shown, motion }, dispatch] = useReducer(motionReducer, { shown: stack, motion: null });
  if (!sameStack(stack, shown)) dispatch({ type: 'show', stack });

  const memory = useRef(new Map<string, Entry>());
  const pushed = useRef<{ value: string; trigger: HTMLElement | null } | null>(null);
  // The slide whose memory, scroll and focus are done, so StrictMode's second
  // run of the effect doesn't record the offset it just reset.
  const started = useRef<Motion | null>(null);
  const views = useRef(new Map<string, ViewRecord>());
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);
  const modal = useModalContext();

  const latest = useRef({ stack, onValueChange });
  latest.current = { stack, onValueChange };
  const change = useCallback(
    (next: Stack, reason: DrilldownChangeReason) => {
      setStack(next);
      latest.current.onValueChange?.(next, reason);
    },
    [setStack],
  );
  const push = useCallback(
    (next: string, trigger: HTMLElement | null) => {
      const current = latest.current.stack;
      if (current.includes(next)) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`Drilldown: "${next}" is already in the stack, so Drilldown.Trigger can't push it again.`);
        }
        return;
      }
      pushed.current = { value: next, trigger };
      change([...current, next], 'push');
    },
    [change],
  );
  const pop = useCallback(
    (reason: DrilldownChangeReason) => {
      const current = latest.current.stack;
      if (current.length > 1) change(current.slice(0, -1), reason);
    },
    [change],
  );

  const registerView = useCallback((view: string, label: string, record: ViewRecord) => {
    views.current.set(view, record);
    setLabels((prev) => (prev.get(view) === label ? prev : new Map(prev).set(view, label)));
    return () => {
      if (views.current.get(view) === record) views.current.delete(view);
      setLabels((prev) => {
        if (!prev.has(view)) return prev;
        const next = new Map(prev);
        next.delete(view);
        return next;
      });
    };
  }, []);

  useLayoutEffect(() => {
    if (!motion) return;
    const settle = () => dispatch({ type: 'settle' });
    const viewport = viewportRef.current;
    const duration = viewport && !reducedMotion() ? (cssTimeMs(motionToken(viewport, 'duration')) ?? 0) : 0;
    if (started.current !== motion) {
      started.current = motion;
      const push = pushed.current;
      pushed.current = null;
      const trigger = push && push.value === shown.at(-1) ? push.trigger : null;
      startMotion({ motion, shown, trigger, duration, viewport, back: backRef.current, views: views.current, memory: memory.current });
    }
    if (duration <= 0) {
      settle();
      return;
    }
    const timer = window.setTimeout(settle, duration);
    return () => window.clearTimeout(timer);
  }, [motion, shown]);

  // An uncontrolled stack starts over each time its modal opens. Dialog and
  // Drawer keep their content mounted while closed.
  const present = modal?.present;
  const controlled = value !== undefined;
  useLayoutEffect(() => {
    if (present !== false || controlled || sameStack(latest.current.stack, defaultValue)) return;
    memory.current.clear();
    setStack(defaultValue);
    dispatch({ type: 'reset', stack: defaultValue });
  }, [present, controlled, defaultValue, setStack]);

  const holds = escape === 'back' && stack.length > 1;
  const holdCloseRequests = modal?.holdCloseRequests;
  useLayoutEffect(() => {
    if (!holds || !holdCloseRequests) return;
    return holdCloseRequests(() => pop('escape'));
  }, [holds, holdCloseRequests, pop]);
  // Outside a modal, Escape on the views or Back goes back. On the window, so
  // a popover or menu inside the view that takes Escape has prevented it by then.
  const inModal = modal !== null;
  useEffect(() => {
    if (!holds || inModal) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || isImeKeyEvent(event)) return;
      const target = event.target instanceof Node ? event.target : null;
      if (!target || !(viewportRef.current?.contains(target) || backRef.current?.contains(target))) return;
      event.preventDefault();
      pop('escape');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [holds, inModal, pop]);

  const statusOf = useCallback(
    (view: string): ViewStatus | null => {
      const top = shown.at(-1);
      if (view === top) return motion ? 'entering' : 'current';
      if (motion && view === motion.from.at(-1)) return 'leaving';
      return shown.includes(view) ? 'below' : null;
    },
    [motion, shown],
  );

  const ctx = useMemo<DrilldownContextValue>(
    () => ({
      stack: shown,
      direction: motion?.direction,
      statusOf,
      labels,
      push,
      pop,
      registerView,
      viewportRef,
      backRef,
    }),
    [labels, motion, pop, push, registerView, shown, statusOf],
  );

  return <DrilldownContext.Provider value={ctx}>{children}</DrilldownContext.Provider>;
}

function Viewport({ className, ref, ...props }: DrilldownViewportProps) {
  const { direction, viewportRef } = useDrilldown('Drilldown.Viewport');
  const refs = useComposedRefs(viewportRef, ref);
  return <div {...props} ref={refs} className={cx(styles.viewport, className)} data-direction={direction} />;
}

function MountedView({
  value,
  label,
  initialFocusRef,
  status,
  className,
  ref,
  ...props
}: DrilldownViewProps & { status: ViewStatus }) {
  const { registerView } = useDrilldown('Drilldown.View');
  const elementRef = useRef<HTMLDivElement | null>(null);
  const refs = useComposedRefs(elementRef, ref);
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    return registerView(value, label, { element, initialFocusRef });
  }, [initialFocusRef, label, registerView, value]);
  const leaving = status === 'leaving';
  return (
    <div
      aria-label={label}
      tabIndex={-1}
      {...props}
      ref={refs}
      role="group"
      className={cx(styles.view, className)}
      hidden={status === 'below'}
      inert={leaving || undefined}
      aria-hidden={leaving ? true : props['aria-hidden']}
      data-entering={status === 'entering' ? '' : undefined}
      data-leaving={leaving ? '' : undefined}
    />
  );
}

function View(props: DrilldownViewProps) {
  const status = useDrilldown('Drilldown.View').statusOf(props.value);
  return status === null ? null : <MountedView {...props} status={status} />;
}

function Trigger({ value, onClick, ...props }: DrilldownTriggerProps) {
  const { push } = useDrilldown('Drilldown.Trigger');
  const handleClick = composeHandlers(onClick as ((event: MouseEvent<HTMLElement>) => void) | undefined, (event) =>
    push(value, event.currentTarget),
  );
  return <Button.Root {...(props as ButtonActionProps)} onClick={handleClick} />;
}

function Back({ 'aria-label': ariaLabel, onClick, children, ref, ...props }: DrilldownBackProps) {
  const { stack, labels, pop, backRef } = useDrilldown('Drilldown.Back');
  const strings = useStrings();
  const parent = stack.at(-2);
  const parentLabel = parent === undefined ? undefined : labels.get(parent);
  const [label, labelRef] = useDismissLabel(children, ariaLabel, ref, parentLabel ? strings.backTo(parentLabel) : strings.back);
  const refs = useComposedRefs(backRef, labelRef);
  const glyph = useGlyphs().back;
  if (stack.length < 2) return null;
  return (
    <Button.Root
      variant="ghost"
      aria-label={label}
      {...props}
      ref={refs}
      onClick={composeHandlers(onClick, () => pop('back'))}
    >
      {children ?? (
        <Button.Icon className={styles.backIcon}>
          <span className={styles.glyph} data-todae-glyph="">
            {glyphOr(glyph, <BackGlyph />)}
          </span>
        </Button.Icon>
      )}
    </Button.Root>
  );
}

function Label(props: DrilldownLabelProps) {
  const { stack, labels } = useDrilldown('Drilldown.Label');
  const top = stack.at(-1);
  return <span {...props}>{top === undefined ? null : labels.get(top)}</span>;
}

export const Drilldown = { Root, Viewport, View, Trigger, Back, Label } as const;
