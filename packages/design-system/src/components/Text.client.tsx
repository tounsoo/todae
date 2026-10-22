import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useTooltipInternal, type TooltipInternalResult } from '../hooks/useTooltip.js';
import { canFocusNow } from '../overlay/tabbables.js';
import { mergeAnchorNames } from '../overlay/anchorName.js';
import { useDomId } from './domId.js';
import { composeHandlers, useComposedRefs } from './props.js';
import { clampLines, DEFAULT_AS, Text as ServerText, type TextRootProps as ServerTextRootProps } from './Text.js';
import { Tooltip } from './Tooltip.js';

export type { TextAs, TextHeading, TextSize, TextTone, TextWeight } from './Text.js';

export type TextRootProps = ServerTextRootProps & { tooltip?: boolean };

// Marks a cut text that shows a tip, so a focused element that holds several
// shows the first one's: querySelector reads in document order.
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

type ClampTipProps = {
  target: RefObject<HTMLElement | null>;
  anchor: string;
  hoverRef: RefObject<TooltipInternalResult | null>;
};

/**
 * The tip of a clamped Text, after it while it shows. Text.Root renders the
 * same element with or without it, so gaining a tip never remounts the text;
 * Root reaches its hover holds through `hoverRef`.
 */
function ClampTip({ target, anchor, hoverRef }: ClampTipProps) {
  const [text, setText] = useState<string | null>(null);
  // Keyboard focus on the text, or on the nearest holder around it when this
  // is the first cut text whose nearest holder that element is. A
  // click or a menu opened by one moves focus without :focus-visible, and the
  // pointer has the hover tip.
  const holdsFocus = useCallback(
    (focused: Element) => {
      const el = target.current;
      if (el === null) return false;
      if (!focused.matches(':focus-visible')) return false;
      if (focused === el) return true;
      if (!isHolder(focused) || holderOf(el) !== focused) return false;
      return [...focused.querySelectorAll<HTMLElement>(`[${CUT_ATTR}]`)].find((cut) => holderOf(cut) === focused) === el;
    },
    [target],
  );
  const tip = useTooltipInternal({ enabled: text !== null }, { anchorName: anchor, holdsFocus });

  const check = useCallback(() => {
    const el = target.current;
    if (!el) return;
    setText(isCut(el) ? fullText(el) || null : null);
  }, [target]);

  // Every render, since a size, weight or lines change can cut the text
  // without changing its box.
  useLayoutEffect(check);

  useLayoutEffect(() => {
    const el = target.current;
    if (!el) return;
    // A child can change the text from its own state without Text rendering again.
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(check);
    mutations?.observe(el, { childList: true, subtree: true, characterData: true });
    const resizes = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(check);
    resizes?.observe(el);
    // A web font that loads late changes the text's width, not the box of a
    // one-line clamp. jsdom has no document.fonts.
    const doc = el.ownerDocument;
    const fonts = 'fonts' in doc ? doc.fonts : null;
    fonts?.addEventListener('loadingdone', check);
    return () => {
      mutations?.disconnect();
      resizes?.disconnect();
      fonts?.removeEventListener('loadingdone', check);
    };
  }, [check, target]);

  const { triggerRef, holdHover, releaseHover } = tip;
  useLayoutEffect(() => {
    triggerRef.current = target.current;
    hoverRef.current = { holdHover, releaseHover };
    return () => {
      triggerRef.current = null;
      hoverRef.current = null;
    };
  }, [holdHover, hoverRef, releaseHover, target, triggerRef]);

  const cut = text !== null;
  useLayoutEffect(() => {
    const el = target.current;
    if (!el || !cut) return;
    el.setAttribute(CUT_ATTR, '');
    return () => el.removeAttribute(CUT_ATTR);
  }, [cut, target]);

  if (text === null) return null;
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
  const hoverRef = useRef<TooltipInternalResult | null>(null);
  const refs = useComposedRefs(elRef, ref);
  const anchor = `--todae-text-${useDomId()}`;
  const tipped = tooltip && clampLines(lines) !== undefined;
  const ownStyle = tipped ? ({ ...style, anchorName: mergeAnchorNames(style?.anchorName, anchor) } as CSSProperties) : style;

  // One shape with or without a tip, so the text never remounts. The product's
  // pointer handlers run first, and a prevented enter opens no tip. A new `as`
  // is a new element, so the tip starts over with it.
  return (
    <>
      <ServerText.Root
        {...props}
        lines={lines}
        style={ownStyle}
        onPointerEnter={tipped ? composeHandlers(onPointerEnter, () => hoverRef.current?.holdHover()) : onPointerEnter}
        onPointerLeave={
          tipped
            ? (event) => {
                onPointerLeave?.(event);
                hoverRef.current?.releaseHover(event.relatedTarget);
              }
            : onPointerLeave
        }
        ref={refs}
      />
      {tipped ? <ClampTip key={props.as ?? DEFAULT_AS} target={elRef} anchor={anchor} hoverRef={hoverRef} /> : null}
    </>
  );
}

export const Text = { Root } as const;
