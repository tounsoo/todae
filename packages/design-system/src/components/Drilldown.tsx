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
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { useControlledValue } from '../hooks/useControlledState.js';
import { cssTimeMs } from '../overlay/cssTime.js';
import { useSurfacePresent } from '../overlay/surfaceContext.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';
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

/**
 * Why the stack changed: a Drilldown.Trigger, Drilldown.Back, Escape and the
 * Android back gesture, or an uncontrolled stack starting over as the overlay
 * around it closes.
 */
export type DrilldownChangeReason = 'push' | 'back' | 'escape' | 'reset';

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
} & Omit<ComponentPropsWithRef<'div'>, 'role' | 'aria-label'>;

// `value` names the view to push, in place of a button's own value attribute.
type TriggerAction = Omit<ButtonActionProps, 'value'> & { value: string };
type TriggerRendered = Omit<ButtonRenderedProps, 'value'> & { value: string };

export type DrilldownTriggerProps = TriggerAction | TriggerRendered;

export type DrilldownBackProps = ButtonActionProps;

export type DrilldownLabelProps = Omit<ComponentPropsWithRef<'span'>, 'children'>;

type Stack = readonly string[];

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

type ViewRecord = { element: HTMLElement; initialFocusRef?: RefObject<HTMLElement | null> };

type ViewStatus = 'current' | 'entering' | 'leaving' | 'below';

type DrilldownContextValue = {
  stack: Stack;
  direction: DrilldownDirection | undefined;
  statusOf: (value: string) => ViewStatus | null;
  labels: ReadonlyMap<string, string>;
  push: (value: string, trigger: HTMLElement) => void;
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

// Not in a closed popover, a hidden tab panel or a lower view of another Drilldown.
function shows(viewport: HTMLElement | null): boolean {
  return viewport?.checkVisibility?.() !== false;
}

function motionToken(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(`--todae-drilldown-motion-${name}`).trim();
}

// What the views below the shown one get back on a pop, recorded as a
// Drilldown.Trigger pushes: the trigger that pushed each view, and the scroll
// offset of each view a push covered.
type Memory = { triggers: Map<string, HTMLElement>; offsets: Map<string, number> };

/**
 * Where focus goes as a slide shows `entering`: back to the trigger that
 * pushed the view just above it, while that trigger can take focus, else
 * the pushed view's `initialFocusRef`, else the view's first tab stop, else
 * the view itself.
 */
function focusTarget(motion: Motion, shown: Stack, entering: HTMLElement, views: ReadonlyMap<string, ViewRecord>, memory: Memory) {
  if (motion.direction === 'back') {
    // The view just above the new top: a jump back several views returns to
    // the trigger in the view it lands on.
    const child = motion.from[shown.length];
    const trigger = child === undefined ? undefined : memory.triggers.get(child);
    if (trigger?.isConnected && entering.contains(trigger) && isReachable(trigger) && !trigger.matches(':disabled')) return trigger;
    return firstTabbable(entering) ?? entering;
  }
  const top = shown.at(-1);
  return (top === undefined ? null : views.get(top)?.initialFocusRef?.current) ?? firstTabbable(entering) ?? entering;
}

type MotionStart = {
  motion: Motion;
  shown: Stack;
  entering: HTMLElement | undefined;
  leaving: HTMLElement | undefined;
  duration: number;
  viewport: HTMLElement | null;
  back: HTMLElement | null;
  views: ReadonlyMap<string, ViewRecord>;
  memory: Memory;
};

// Moves the height, scroll and focus to the new view as a slide starts.
function startMotion({ motion, shown, entering, leaving, duration, viewport, back, views, memory }: MotionStart) {
  const scroller = viewport && scrollParent(viewport);
  const active = viewport?.ownerDocument.activeElement;
  // Focus moves with the views when it was on them, on Back, or lost; not
  // from another control, such as the product's own that set a controlled
  // stack.
  const ownsFocus = !active || active === active.ownerDocument.body || leaving?.contains(active) || back === active;
  const top = shown.at(-1);
  const scrollTop = motion.direction === 'back' && top !== undefined ? (memory.offsets.get(top) ?? 0) : 0;

  // A restored offset needs the parent's full height at once, or the scroll
  // container clamps it.
  if (viewport && entering && leaving && duration > 0 && scrollTop === 0) {
    viewport.animate([{ height: `${leaving.offsetHeight}px` }, { height: `${entering.offsetHeight}px` }], {
      duration,
      easing: motionToken(viewport, 'easing-enter') || 'ease',
    });
  }
  if (scroller) scroller.scrollTop = scrollTop;
  if (entering && ownsFocus) focusWithoutScroll(focusTarget(motion, shown, entering, views, memory));
}

// The animations a slide runs, without endless ones inside a view's content.
function slideAnimations(elements: readonly (HTMLElement | null | undefined)[]): Animation[] {
  return elements.flatMap((el) => el?.getAnimations() ?? []).filter((a) => a.effect?.getComputedTiming().endTime !== Infinity);
}

const EMPTY: Stack = [];

function Root({ value, defaultValue = EMPTY, onValueChange, escape = 'back', children }: DrilldownRootProps) {
  const [stack, change] = useControlledValue<Stack, [reason: DrilldownChangeReason]>(value, defaultValue, onValueChange);
  const [{ shown, motion }, dispatch] = useReducer(motionReducer, { shown: stack, motion: null });
  if (!sameStack(stack, shown)) dispatch({ type: 'show', stack });

  const memory = useRef<Memory>({ triggers: new Map(), offsets: new Map() });
  const views = useRef(new Map<string, ViewRecord>());
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);

  const push = useCallback(
    (next: string, trigger: HTMLElement) => {
      if (stack.includes(next)) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`Drilldown: "${next}" is already in the stack, so Drilldown.Trigger can't push it again.`);
        }
        return;
      }
      const top = stack.at(-1);
      const scroller = viewportRef.current && scrollParent(viewportRef.current);
      if (top !== undefined) memory.current.offsets.set(top, scroller?.scrollTop ?? 0);
      memory.current.triggers.set(next, trigger);
      change([...stack, next], 'push');
    },
    [change, stack],
  );
  const pop = useCallback(
    (reason: DrilldownChangeReason) => {
      if (stack.length > 1) change(stack.slice(0, -1), reason);
    },
    [change, stack],
  );

  const registerView = useCallback((view: string, label: string, record: ViewRecord) => {
    if (process.env.NODE_ENV !== 'production' && views.current.has(view)) {
      console.error(`Drilldown: two Drilldown.Views have the value "${view}". Give each view its own value.`);
    }
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
    const top = shown.at(-1);
    const left = motion.from.at(-1);
    const entering = top === undefined ? undefined : views.current.get(top)?.element;
    const leaving = left === undefined || left === top ? undefined : views.current.get(left)?.element;
    const duration = viewport && !reducedMotion() ? (cssTimeMs(motionToken(viewport, 'duration')) ?? 0) : 0;
    startMotion({ motion, shown, entering, leaving, duration, viewport, back: backRef.current, views: views.current, memory: memory.current });
    if (duration <= 0) {
      settle();
      return;
    }
    // Settles when the slide's animations finish, so CSS that changes them
    // keeps the leaving view on screen as long as it moves.
    if (viewport?.getAnimations) {
      let current = true;
      void Promise.allSettled(slideAnimations([viewport, entering, leaving]).map((a) => a.finished)).then(() => {
        if (current) settle();
      });
      return () => {
        current = false;
      };
    }
    const timer = window.setTimeout(settle, duration);
    return () => window.clearTimeout(timer);
  }, [motion, shown]);

  // After the views' own layout effects, so every view in the stack has registered.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (shown.length === 0) {
      console.error('Drilldown: the stack is empty, so no view shows. Pass Drilldown.Root a value or defaultValue that starts with the first view.');
    } else if (new Set(shown).size < shown.length) {
      console.error(`Drilldown: the stack [${shown.join(', ')}] holds a value twice. Each view can be in the stack once.`);
    }
    for (const view of shown) {
      if (!views.current.has(view)) console.error(`Drilldown: no Drilldown.View has the value "${view}", so nothing shows for it.`);
    }
  }, [shown]);

  // An uncontrolled stack starts over each time its overlay closes. Dialog,
  // Drawer and Popover keep their content mounted while closed.
  const present = useSurfacePresent();
  const controlled = value !== undefined;
  useLayoutEffect(() => {
    if (present !== false || controlled || sameStack(stack, defaultValue)) return;
    memory.current.triggers.clear();
    memory.current.offsets.clear();
    change(defaultValue, 'reset');
    dispatch({ type: 'reset', stack: defaultValue });
  }, [present, controlled, defaultValue, change, stack]);

  // Escape and a modal's close requests, such as the Android back gesture,
  // come through the overlays' Escape stack, which also stops the key's close
  // request in a modal. A popup open beside the views goes first.
  const goBack = useCallback(() => pop('escape'), [pop]);
  const takesEscape = useCallback((event: KeyboardEvent | null) => {
    const viewport = viewportRef.current;
    if (!shows(viewport)) return false;
    if (!event) return true;
    if (event.defaultPrevented || isImeKeyEvent(event)) return false;
    const target = event.target instanceof Node ? event.target : null;
    const layer = viewport?.closest('dialog, [popover]');
    if (layer) return layer.contains(target);
    return Boolean(viewport?.contains(target) || backRef.current?.contains(target));
  }, []);
  useEscapeKey(escape === 'back' && stack.length > 1, takesEscape, goBack, viewportRef, { popup: false });

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
      tabIndex={-1}
      {...props}
      ref={refs}
      role="group"
      aria-label={label}
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

function Trigger(props: TriggerRendered): ReactElement;
function Trigger(props: TriggerAction): ReactElement;
// Last, so ComponentProps reads DrilldownTriggerProps and a wrapper typed with it can pass it on.
function Trigger(props: DrilldownTriggerProps): ReactElement;
function Trigger(props: DrilldownTriggerProps) {
  const { push } = useDrilldown('Drilldown.Trigger');
  if (props.render) {
    const { value, onClick, ...rest } = props;
    return <Button.Root {...rest} onClick={composeHandlers(onClick, (event) => push(value, event.currentTarget))} />;
  }
  const { value, onClick, ...rest } = props;
  return <Button.Root {...rest} onClick={composeHandlers(onClick, (event) => push(value, event.currentTarget))} />;
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
