import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEventHandler,
  type RefObject,
} from 'react';
import { useTooltip, type TooltipTriggerWire } from '../hooks/useTooltip.js';
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

/** The text of `el` as one line, as it renders: innerText leaves out what isn't rendered. jsdom has no innerText. */
function fullText(el: HTMLElement): string {
  return (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isCut(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth;
}

type ClampTipProps = {
  target: RefObject<HTMLElement | null>;
  anchor: string;
  wireRef: RefObject<TooltipTriggerWire | null>;
  onPointerEnter: PointerEventHandler<HTMLElement> | undefined;
  onPointerLeave: PointerEventHandler<HTMLElement> | undefined;
};

/**
 * The tip of a clamped Text, beside it. Text.Root renders the same element
 * with or without it, so gaining a tip never remounts the text; it reaches the
 * tip's hover handlers through `wireRef`.
 */
function ClampTip({ target, anchor, wireRef, onPointerEnter, onPointerLeave }: ClampTipProps) {
  const [text, setText] = useState<string | null>(null);
  // Focus on the text, or on an element around it such as a link or a row,
  // when this is the first cut text that element holds.
  const holdsFocus = useCallback(
    (focused: Element) => {
      const el = target.current;
      return el !== null && (focused === el || (focused.contains(el) && focused.querySelector(`[${CUT_ATTR}]`) === el));
    },
    [target],
  );
  const tip = useTooltip({ enabled: text !== null, anchorName: anchor, holdsFocus });
  const wire = tip.getTriggerProps({ onPointerEnter, onPointerLeave });

  const check = useCallback(() => {
    const el = target.current;
    if (!el) return;
    const full = fullText(el);
    setText(full !== '' && isCut(el) ? full : null);
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
    // A web font that loads late changes the text's width, not the box of a one-line clamp.
    const fonts = el.ownerDocument.fonts as FontFaceSet | undefined;
    fonts?.addEventListener?.('loadingdone', check);
    return () => {
      mutations?.disconnect();
      resizes?.disconnect();
      fonts?.removeEventListener?.('loadingdone', check);
    };
  }, [check, target]);

  const setTrigger = wire.ref;
  useLayoutEffect(() => {
    setTrigger(target.current);
    return () => setTrigger(null);
  }, [setTrigger, target]);

  const cut = text !== null;
  useLayoutEffect(() => {
    const el = target.current;
    if (!el || !cut) return;
    el.setAttribute(CUT_ATTR, '');
    return () => el.removeAttribute(CUT_ATTR);
  }, [cut, target]);

  useLayoutEffect(() => {
    wireRef.current = wire;
  });
  useLayoutEffect(
    () => () => {
      wireRef.current = null;
    },
    [wireRef],
  );

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
  const wireRef = useRef<TooltipTriggerWire | null>(null);
  const refs = useComposedRefs(elRef, ref);
  const anchor = `--todae-text-${useDomId()}`;
  const tipped = tooltip && clampLines(lines) !== undefined;

  // One shape with or without a tip, so the text never remounts. The tip's
  // wire runs the product's handler first, as getTriggerProps does.
  return (
    <>
      <ServerText.Root
        {...props}
        lines={lines}
        style={tipped ? ({ ...style, anchorName: mergeAnchorNames(style?.anchorName, anchor) } as CSSProperties) : style}
        onPointerEnter={tipped ? (event) => (wireRef.current?.onPointerEnter ?? onPointerEnter)?.(event) : onPointerEnter}
        onPointerLeave={tipped ? (event) => (wireRef.current?.onPointerLeave ?? onPointerLeave)?.(event) : onPointerLeave}
        ref={refs}
      />
      {tipped ? (
        <ClampTip target={elRef} anchor={anchor} wireRef={wireRef} onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} />
      ) : null}
    </>
  );
}

export const Text = { Root } as const;
