import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useTooltipInternal, type TooltipInternalResult } from '../overlay/tooltip.js';
import { canFocusNow } from '../overlay/tabbables.js';
import { mergeAnchorNames } from '../overlay/anchorName.js';
import { useDomId } from '../internal/domId.js';
import { composeHandlers, useComposedRefs } from '../internal/props.js';
import { clampLines, DEFAULT_AS, Text as ServerText, type TextRootProps as ServerTextRootProps } from './Text.js';
import { Tooltip } from './Tooltip.js';

export type { TextAs, TextHeading, TextTone, TextVariant, TextWeight } from './Text.js';

export type TextRootProps = ServerTextRootProps & { tooltip?: boolean };

// Marks a clamped text while its tip is on: from when a hover or keyboard
// focus finds it cut until one finds it fits.
const CUT_ATTR = 'data-todae-cut';

/** The text of `el` as one line. innerText leaves out text that isn't rendered, such as `display: none`; jsdom has no innerText. */
function fullText(el: HTMLElement): string {
  return (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Whether focus on `el` can show the tip of a cut text inside it: a tab stop
 * or a roving item that can take focus now, such as a link, a row or a menu
 * item. A container focused by script, such as a dialog or a skip link's
 * target, is neither. A roving item still has tabIndex -1 when it takes
 * focus, so it counts by its marker. An `aria-activedescendant` host, such as
 * a listbox, keeps focus while its active item moves, so it shows no tip
 * rather than the wrong one. Chromium gives an `a` without `href` tabIndex 0.
 */
function isHolder(el: Element): boolean {
  if (!(el instanceof HTMLElement) || el.hasAttribute('aria-activedescendant')) return false;
  if (el instanceof HTMLAnchorElement && !el.hasAttribute('href')) return false;
  return (el.tabIndex >= 0 || el.hasAttribute('data-todae-roving')) && canFocusNow(el);
}

/** The nearest holder around `el`, so a parent tree item doesn't show its child's tip. */
function holderOf(el: Element): Element | null {
  let node = el.parentElement;
  while (node && !isHolder(node)) node = node.parentElement;
  return node;
}

function isCut(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

/** The full text of a clamped `el` when it is cut, or null when it fits. */
function readCut(el: HTMLElement | null): string | null {
  return el && isCut(el) ? fullText(el) || null : null;
}

// Whether a clamped text is cut is read when the person reaches it, not kept
// up to date: by the pointer entering it, or by keyboard focus on it or on the
// nearest holder around it. Focus is watched once per document for every
// clamped text, so a page of them watches nothing of its own.
type FocusWatch = {
  target: RefObject<HTMLElement | null>;
  /** Reads the text for focus on `focused`, turning its tip on or off, and says whether it is cut. */
  reach: (focused: Element) => boolean;
};
const focusWatches = new Map<Document, { watches: Set<FocusWatch>; stop: () => void }>();
// The text each holder shows the tip of, as focus on it last found: the
// first cut one it holds, in document order.
const shownBy = new WeakMap<Element, HTMLElement>();

function inOrder(a: FocusWatch, b: FocusWatch): number {
  return a.target.current!.compareDocumentPosition(b.target.current!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
}

// Runs before any tip's own focus listeners, as a capture listener on the
// document, so a tip that is already on sees the holder's answer for the same
// focus. A click or a menu opened by one moves focus without :focus-visible,
// and the pointer has the hover tip.
function onFocusIn(watches: Set<FocusWatch>, event: globalThis.FocusEvent) {
  const focused = event.composedPath()[0] as Element | undefined;
  if (focused?.nodeType !== 1 || !focused.matches(':focus-visible')) return;
  for (const watch of watches) {
    if (watch.target.current === focused) {
      watch.reach(focused);
      return;
    }
  }
  if (!isHolder(focused)) return;
  const held = [...watches].filter((watch) => {
    const el = watch.target.current;
    return el !== null && focused.contains(el) && holderOf(el) === focused;
  });
  shownBy.delete(focused);
  for (const watch of held.sort(inOrder)) {
    if (watch.reach(focused)) {
      shownBy.set(focused, watch.target.current!);
      return;
    }
  }
}

function watchFocus(watch: FocusWatch, doc: Document): () => void {
  let entry = focusWatches.get(doc);
  if (!entry) {
    const watches = new Set<FocusWatch>();
    const listener = (event: globalThis.FocusEvent) => onFocusIn(watches, event);
    doc.addEventListener('focusin', listener, true);
    entry = { watches, stop: () => doc.removeEventListener('focusin', listener, true) };
    focusWatches.set(doc, entry);
  }
  const own = entry;
  own.watches.add(watch);
  return () => {
    own.watches.delete(watch);
    if (own.watches.size) return;
    own.stop();
    focusWatches.delete(doc);
  };
}

type HoverHolds = Pick<TooltipInternalResult, 'holdHover' | 'releaseHover'>;
type Waiting = { hover: boolean; focus: Element | null };

type ClampTipProps = {
  target: RefObject<HTMLElement | null>;
  anchor: string;
  text: string;
  hoverRef: RefObject<HoverHolds | null>;
  waiting: RefObject<Waiting>;
};

/**
 * The tip of a clamped Text, after it, mounted only while a hover or keyboard
 * focus has found the text cut. Text.Root renders the same element with or
 * without it, so gaining a tip never remounts the text; Root reaches its hover
 * holds through `hoverRef`, and the hold that turned it on waits in `waiting`.
 */
function ClampTip({ target, anchor, text, hoverRef, waiting }: ClampTipProps) {
  // Keyboard focus on the text, or on the nearest holder around it when this
  // is the text that focus on the holder found first.
  const holdsFocus = useCallback(
    (focused: Element) => {
      const el = target.current;
      if (el === null || !focused.matches(':focus-visible')) return false;
      if (focused === el) return true;
      return isHolder(focused) && holderOf(el) === focused && shownBy.get(focused) === el;
    },
    [target],
  );
  // Focus a product handler moved on from takes no hold.
  const focusedAtStart = useCallback(() => {
    const focused = waiting.current.focus;
    waiting.current.focus = null;
    return focused?.matches(':focus') ? focused : null;
  }, [waiting]);
  const tip = useTooltipInternal({}, { anchorName: anchor, holdsFocus, focusedAtStart });

  const { triggerRef, holdHover, releaseHover } = tip;
  useLayoutEffect(() => {
    triggerRef.current = target.current;
    hoverRef.current = { holdHover, releaseHover };
    if (waiting.current.hover) {
      waiting.current.hover = false;
      holdHover();
    }
    return () => {
      triggerRef.current = null;
      hoverRef.current = null;
    };
  }, [holdHover, hoverRef, releaseHover, target, triggerRef, waiting]);

  useLayoutEffect(() => {
    const el = target.current;
    if (!el) return;
    el.setAttribute(CUT_ATTR, '');
    return () => el.removeAttribute(CUT_ATTR);
  }, [target]);

  // Clamping changes only painting, so the text stays whole in the
  // accessibility tree and the tip is for the eye alone.
  return (
    <Tooltip.Root {...tip.getTooltipProps()} aria-hidden="true">
      {text}
    </Tooltip.Root>
  );
}

function Root({ lines, tooltip = true, style, onPointerEnter, onPointerLeave, ref, ...props }: TextRootProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const hoverRef = useRef<HoverHolds | null>(null);
  const refs = useComposedRefs(elRef, ref);
  const anchor = `--todae-text-${useDomId()}`;
  const tipped = tooltip && clampLines(lines) !== undefined;
  const ownStyle = tipped ? ({ ...style, anchorName: mergeAnchorNames(style?.anchorName, anchor) } as CSSProperties) : style;

  // The full text while the tip is on: from when a reach finds the text cut
  // until one finds it fits.
  const [text, setText] = useState<string | null>(null);
  const textRef = useRef(text);
  textRef.current = text;
  // The hold that turned the tip on, kept until the tip has mounted.
  const waiting = useRef<Waiting>({ hover: false, focus: null });
  const reach = useCallback((hover: boolean, focus: Element | null) => {
    const next = readCut(elRef.current);
    if (next !== null && textRef.current === null) {
      if (hover) waiting.current.hover = true;
      else waiting.current.focus = focus;
    } else if (next !== null && hover) hoverRef.current?.holdHover();
    if (next !== textRef.current) setText(next);
    return next !== null;
  }, []);

  useEffect(() => {
    if (!tipped) return;
    const doc = elRef.current?.ownerDocument ?? document;
    return watchFocus({ target: elRef, reach: (focused) => reach(false, focused) }, doc);
  }, [reach, tipped]);

  // A tip that is on follows the text as it renders again, and goes once
  // the text fits; a tip that is off reads nothing.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs after every commit; a same text sets nothing.
  useLayoutEffect(() => {
    if (textRef.current === null) return;
    const next = tipped ? readCut(elRef.current) : null;
    if (next !== textRef.current) setText(next);
  });

  // One shape with or without a tip, so the text never remounts. The product's
  // pointer handlers run first, and a prevented enter opens no tip. A new `as`
  // is a new element, so the tip starts over with it.
  return (
    <>
      <ServerText.Root
        {...props}
        lines={lines}
        style={ownStyle}
        onPointerEnter={tipped ? composeHandlers(onPointerEnter, () => reach(true, null)) : onPointerEnter}
        onPointerLeave={
          tipped
            ? (event) => {
                onPointerLeave?.(event);
                waiting.current.hover = false;
                hoverRef.current?.releaseHover(event.relatedTarget);
              }
            : onPointerLeave
        }
        ref={refs}
      />
      {tipped && text !== null ? (
        <ClampTip key={props.as ?? DEFAULT_AS} target={elRef} anchor={anchor} text={text} hoverRef={hoverRef} waiting={waiting} />
      ) : null}
    </>
  );
}

export const Text = { Root } as const;
