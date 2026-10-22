import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { useTooltip } from '../hooks/useTooltip.js';
import { mergeAnchorNames } from '../overlay/anchorName.js';
import { useDomId } from './domId.js';
import { useComposedRefs } from './props.js';
import { clampLines, Text as ServerText, type TextRootProps } from './Text.js';
import { Tooltip } from './Tooltip.js';

export type { TextAs, TextHeading, TextRootProps, TextSize, TextTone, TextWeight } from './Text.js';

type FocusTip = {
  el: HTMLElement;
  show: (event: FocusEvent) => void;
  hide: (event: FocusEvent) => void;
};

type FocusWatch = { tips: Set<FocusTip>; shown: FocusTip | null; stop: () => void };

// One focus listener per document for every cut text that shows a tip. A
// focused element shows the tip of the first cut text it holds, in document
// order, so a focused card or row with several shows one tip, not a pile.
const watches = /* @__PURE__ */ new WeakMap<Document, FocusWatch>();

function first(tips: Iterable<FocusTip>, focused: Node): FocusTip | null {
  let pick: FocusTip | null = null;
  for (const tip of tips) {
    if (!focused.contains(tip.el)) continue;
    if (!pick || pick.el.compareDocumentPosition(tip.el) & Node.DOCUMENT_POSITION_PRECEDING) pick = tip;
  }
  return pick;
}

function startWatch(doc: Document): FocusWatch {
  const onFocusIn = (event: FocusEvent) => {
    // The focused element itself, inside a shadow root too.
    const focused = event.composedPath()[0];
    if (!(focused instanceof Node)) return;
    const pick = first(watch.tips, focused);
    if (!pick) return;
    watch.shown = pick;
    // useTooltip's own focusin listener, which runs after this one while the
    // tip is open, releases a focus hold whose target is outside the text, as
    // this one's is when an ancestor holds focus. Acquiring in a microtask
    // lets it go first.
    queueMicrotask(() => {
      if (watch.shown === pick) pick.show(event);
    });
  };
  const onFocusOut = (event: FocusEvent) => {
    const shown = watch.shown;
    watch.shown = null;
    shown?.hide(event);
  };
  const watch: FocusWatch = {
    tips: new Set(),
    shown: null,
    stop: () => {
      doc.removeEventListener('focusin', onFocusIn, true);
      doc.removeEventListener('focusout', onFocusOut, true);
    },
  };
  doc.addEventListener('focusin', onFocusIn, true);
  doc.addEventListener('focusout', onFocusOut, true);
  return watch;
}

function watchFocus(tip: FocusTip): () => void {
  const doc = tip.el.ownerDocument;
  let watch = watches.get(doc);
  if (!watch) {
    watch = startWatch(doc);
    watches.set(doc, watch);
  }
  const own = watch;
  own.tips.add(tip);
  return () => {
    own.tips.delete(tip);
    if (own.shown === tip) own.shown = null;
    if (own.tips.size > 0) return;
    own.stop();
    watches.delete(doc);
  };
}

/** The text of `el` as one line, as the tip shows it. */
function fullText(el: HTMLElement): string {
  return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isCut(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

/**
 * The tip of a clamped Text, beside it. It follows the text element through
 * `target` and listens on it directly, so Text.Root renders the same element
 * with or without it and gaining a tip never remounts the text.
 */
function ClampTip({ target, anchor }: { target: RefObject<HTMLElement | null>; anchor: string }) {
  const [text, setText] = useState<string | null>(null);
  const tip = useTooltip({ enabled: text !== null });
  const wire = tip.getTriggerProps();
  const wireRef = useRef(wire);
  wireRef.current = wire;

  useLayoutEffect(() => {
    const el = target.current;
    if (!el) return;
    const check = () => {
      const full = fullText(el);
      setText(full !== '' && isCut(el) ? full : null);
    };
    check();
    // A child can change the text from its own state without Text rendering again.
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(check);
    mutations?.observe(el, { childList: true, subtree: true, characterData: true });
    const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    resizes?.observe(el);
    return () => {
      mutations?.disconnect();
      resizes?.disconnect();
    };
  }, [target]);

  const cut = text !== null;
  useLayoutEffect(() => {
    const el = target.current;
    if (!el || !cut) return;
    // The wire's handlers read only `defaultPrevented` and `relatedTarget`, which native events carry.
    const onPointerEnter = (event: PointerEvent) =>
      wireRef.current.onPointerEnter(event as unknown as ReactPointerEvent<HTMLElement>);
    const onPointerLeave = (event: PointerEvent) =>
      wireRef.current.onPointerLeave(event as unknown as ReactPointerEvent<HTMLElement>);
    wireRef.current.ref(el);
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
    const stop = watchFocus({
      el,
      show: (event) => wireRef.current.onFocus(event as unknown as ReactFocusEvent<HTMLElement>),
      hide: (event) => wireRef.current.onBlur(event as unknown as ReactFocusEvent<HTMLElement>),
    });
    return () => {
      stop();
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      wireRef.current.ref(null);
    };
  }, [cut, target]);

  if (text === null) return null;
  const props = tip.getTooltipProps();
  const style = { ...props.style, ['--todae-tooltip-anchor' as string]: anchor, positionAnchor: anchor } as CSSProperties;
  // The text itself stays in the accessibility tree whole, since only its
  // painting is clamped, so the tip is for the eye alone.
  return (
    <Tooltip.Root {...props} style={style} aria-hidden="true">
      {text}
    </Tooltip.Root>
  );
}

function Root({ lines, tooltip = true, style, ref, ...props }: TextRootProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const refs = useComposedRefs(elRef, ref);
  const anchor = `--todae-text-${useDomId()}`;
  const tipped = tooltip && clampLines(lines) !== undefined;

  const invalid = lines !== undefined && clampLines(lines) === undefined;
  useLayoutEffect(() => {
    if (process.env.NODE_ENV === 'production' || !invalid) return;
    console.error(`Text.Root lines must be a whole number of 1 or more; got ${String(lines)}`);
  }, [invalid, lines]);

  const ownStyle = tipped ? ({ ...style, anchorName: mergeAnchorNames(style?.anchorName, anchor) } as CSSProperties) : style;
  return (
    <>
      <ServerText.Root {...props} lines={lines} style={ownStyle} ref={refs} />
      {tipped ? <ClampTip target={elRef} anchor={anchor} /> : null}
    </>
  );
}

export const Text = { Root } as const;
