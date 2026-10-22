import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import { useTooltipInternal } from '../hooks/useTooltip.js';
import { mergeAnchorNames } from '../overlay/anchorName.js';
import { useDomId } from './domId.js';
import { useComposedRefs } from './props.js';
import { clampLines, Text as ServerText, type TextRootProps as ServerTextRootProps } from './Text.js';
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

function isCut(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

type ClampTipProps = { target: RefObject<HTMLElement | null>; anchor: string };

/**
 * The tip of a clamped Text, after it while it shows. Text.Root renders the
 * same element with or without it, so gaining a tip never remounts the text;
 * the tip listens on the text element itself.
 */
function ClampTip({ target, anchor }: ClampTipProps) {
  const [text, setText] = useState<string | null>(null);
  // Focus on the text, or on a tab stop around it such as a link or a row,
  // when this is the first cut text that element holds. A container focused
  // by script, such as a dialog or a skip link's target, is no tab stop.
  const holdsFocus = useCallback(
    (focused: Element) => {
      const el = target.current;
      if (el === null) return false;
      if (focused === el) return true;
      return focused instanceof HTMLElement && focused.tabIndex >= 0 && focused.contains(el) && focused.querySelector(`[${CUT_ATTR}]`) === el;
    },
    [target],
  );
  const tip = useTooltipInternal({ enabled: text !== null, anchorName: anchor, holdsFocus });

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

  const { getTriggerProps, holdHover, releaseHover } = tip;
  const setTrigger = getTriggerProps().ref;
  useLayoutEffect(() => {
    const el = target.current;
    if (!el) return;
    setTrigger(el);
    const onPointerEnter = () => holdHover();
    const onPointerLeave = (event: PointerEvent) => releaseHover(event.relatedTarget);
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
    return () => {
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      setTrigger(null);
    };
  }, [holdHover, releaseHover, setTrigger, target]);

  const cut = text !== null;
  useLayoutEffect(() => {
    const el = target.current;
    if (!el || !cut) return;
    el.setAttribute(CUT_ATTR, '');
    return () => el.removeAttribute(CUT_ATTR);
  }, [cut, target]);

  // Mounted only while open, so a closed tip adds no element after the text.
  if (text === null || !tip.open) return null;
  // Clamping changes only painting, so the text stays whole in the
  // accessibility tree and the tip is for the eye alone.
  return (
    <Tooltip.Root {...tip.getTooltipProps()} aria-hidden="true">
      {text}
    </Tooltip.Root>
  );
}

function Root({ lines, tooltip = true, style, ref, ...props }: TextRootProps) {
  const elRef = useRef<HTMLElement | null>(null);
  const refs = useComposedRefs(elRef, ref);
  const anchor = `--todae-text-${useDomId()}`;
  const tipped = tooltip && clampLines(lines) !== undefined;
  const ownStyle = tipped ? ({ ...style, anchorName: mergeAnchorNames(style?.anchorName, anchor) } as CSSProperties) : style;

  // One shape with or without a tip, so the text never remounts.
  return (
    <>
      <ServerText.Root {...props} lines={lines} style={ownStyle} ref={refs} />
      {tipped ? <ClampTip target={elRef} anchor={anchor} /> : null}
    </>
  );
}

export const Text = { Root } as const;
