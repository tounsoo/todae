import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { useControlledValue } from '../hooks/useControlledState.js';
import { frontModal } from '../overlay/modalStack.js';
import { useSurface } from '../overlay/surfaceContext.js';
import { useEscapeKey } from '../overlay/useEscapeKey.js';
import { firstTabbable, isReachable } from '../overlay/tabbables.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { Button, type ButtonActionProps, type ButtonRenderedProps } from './Button.js';
import { useDismissLabel } from './dismissLabel.js';
import { BackGlyph, glyphOr } from './glyphs.js';
import { isImeKeyEvent } from './ime.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { focusWithoutScroll } from './revealRing.js';
import { sameStack, useStackMotion, type Stack, type StackChange, type StackDirection, type StackViews, type ViewStatus } from './useStackMotion.js';
import { createViewMemory } from './viewMemory.js';
import styles from './Drilldown.module.css';

/**
 * Why the stack changed: a Drilldown.Trigger, Drilldown.Back, Escape and the
 * Android back gesture, or an uncontrolled stack starting over as the overlay
 * around it closes.
 */
export type DrilldownChangeReason = 'push' | 'back' | 'escape' | 'reset';

/** What Escape does below the first view: go back one view, or leave it to the overlay, which closes. */
export type DrilldownEscape = 'back' | 'close';

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

type ViewRecord = { element: HTMLElement; initialFocusRef?: RefObject<HTMLElement | null> };

type DrilldownContextValue = {
  stack: Stack;
  direction: StackDirection | undefined;
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

// With focus lost to the body, a key and a close request go to the surface in front.
function inFrontSurface(surface: Element): boolean {
  const front = frontModal();
  return front === null || front.contains(surface);
}

// A key a popup or field inside already took, or one that ends an IME composition.
function handledOrComposing(event: KeyboardEvent): boolean {
  return event.defaultPrevented || isImeKeyEvent(event);
}

function canTakeFocusBack(trigger: HTMLElement | null | undefined, view: HTMLElement): trigger is HTMLElement {
  return Boolean(trigger?.isConnected && view.contains(trigger) && isReachable(trigger) && !trigger.matches(':disabled'));
}

const EMPTY: Stack = [];

function Root({ value, defaultValue = EMPTY, onValueChange, escape = 'back', children }: DrilldownRootProps) {
  const [stack, change] = useControlledValue<Stack, [reason: DrilldownChangeReason]>(value, defaultValue, onValueChange);
  const [memory] = useState(createViewMemory);
  const views = useRef(new Map<string, ViewRecord>());
  const [labels, setLabels] = useState<ReadonlyMap<string, string>>(() => new Map());
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLButtonElement | null>(null);

  const onChange = (next: StackChange, { entering, leaving }: StackViews, offset: number) => {
    const back = memory.follow(next, offset);
    const viewport = viewportRef.current;
    const active = viewport?.ownerDocument.activeElement;
    // Focus moves with the views when it was on them, on Back, on the
    // overlay's own element, or lost; not from another control, such as the
    // product's own that set a controlled stack.
    const ownsFocus =
      !active ||
      active === active.ownerDocument.body ||
      active === viewport?.closest('dialog, [popover]') ||
      leaving?.contains(active) ||
      backRef.current === active;
    if (entering && ownsFocus) {
      const top = next.to.at(-1);
      const trigger = back?.trigger;
      const returnTo = canTakeFocusBack(trigger, entering) ? trigger : null;
      const initialFocus = next.direction === 'forward' && top !== undefined ? views.current.get(top)?.initialFocusRef?.current : null;
      focusWithoutScroll(returnTo ?? initialFocus ?? firstTabbable(entering) ?? entering);
    }
    return back?.offset;
  };
  const elementOf = (view: string) => views.current.get(view)?.element;
  const { shown, direction, statusOf, reset } = useStackMotion({ stack, viewportRef, elementOf, onChange });

  const push = useCallback(
    (next: string, trigger: HTMLElement) => {
      if (stack.includes(next)) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`Drilldown: "${next}" is already in the stack, so Drilldown.Trigger can't push it again.`);
        }
        return;
      }
      memory.pushing(next, trigger);
      change([...stack, next], 'push');
    },
    [change, memory, stack],
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

  // After the views' own layout effects, so every view in the stack has registered.
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    if (shown.length === 0) {
      console.error('Drilldown: the stack is empty, so no view shows. Pass Drilldown.Root a value or defaultValue that starts with the first view.');
    } else if (new Set(shown).size < shown.length) {
      console.error(`Drilldown: the stack [${shown.join(', ')}] holds a value twice. Each view can be in the stack once.`);
    }
    for (const view of shown) {
      if (!views.current.has(view)) {
        console.error(`Drilldown: no Drilldown.View with the value "${view}" rendered with the stack that holds it, so nothing shows for it. A view must render in the same commit as the stack that shows it.`);
      }
    }
  }, [shown]);

  // An uncontrolled stack starts over each time the surface around it
  // closes: as Dialog, Drawer and Popover, which keep their content mounted,
  // stop being present, and as BottomSheet, which doesn't, unmounts it.
  const surface = useSurface();
  const present = surface?.present;
  const startsOver = value === undefined && !sameStack(stack, defaultValue);
  const wasPresent = useRef(present);
  useLayoutEffect(() => {
    const was = wasPresent.current;
    wasPresent.current = present;
    if (!was || present !== false || !startsOver) return;
    memory.clear();
    change(defaultValue, 'reset');
    reset(defaultValue);
  }, [present, startsOver, defaultValue, change, memory, reset]);
  const reportOnUnmount = useRef<() => void>(undefined);
  useLayoutEffect(() => {
    reportOnUnmount.current = () => {
      if (surface?.open === false && startsOver) onValueChange?.(defaultValue, 'reset');
    };
  });
  useLayoutEffect(() => () => reportOnUnmount.current?.(), []);

  // Escape and a modal's close requests, such as the Android back gesture,
  // come through the overlays' Escape stack, which also stops the key's close
  // request in a modal. A popup open beside the views goes first.
  const goBack = useCallback(() => pop('escape'), [pop]);
  const takes = useCallback((target: Element | null) => {
    const viewport = viewportRef.current;
    if (!viewport?.checkVisibility()) return false;
    const surface = viewport.closest('dialog, [popover]');
    if (!surface) return viewport.contains(target) || backRef.current?.contains(target) === true;
    if (target === viewport.ownerDocument.body) return inFrontSurface(surface);
    return surface.contains(target);
  }, []);
  useEscapeKey(escape === 'back' && stack.length > 1, takes, goBack, viewportRef, { popup: false, passesKey: handledOrComposing });

  const ctx = useMemo<DrilldownContextValue>(
    () => ({
      stack: shown,
      direction,
      statusOf,
      labels,
      push,
      pop,
      registerView,
      viewportRef,
      backRef,
    }),
    [direction, labels, pop, push, registerView, shown, statusOf],
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
  const leaving = status.kind === 'leaving';
  const moving = status.kind === 'entering' || status.kind === 'leaving' ? status.direction : undefined;
  return (
    <div
      tabIndex={-1}
      {...props}
      ref={refs}
      role="group"
      aria-label={label}
      className={cx(styles.view, className)}
      hidden={status.kind === 'below'}
      inert={leaving || undefined}
      aria-hidden={leaving ? true : props['aria-hidden']}
      data-entering={status.kind === 'entering' ? moving : undefined}
      data-leaving={leaving ? moving : undefined}
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
  // The same body twice: Button.Root's overloads take one shape at a time, so
  // only a narrowed `props` reaches them without a cast.
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
