import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type FocusEvent } from 'react';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './ScrollArea.module.css';

/** The direction a scroll area scrolls in. */
export type ScrollAreaAxis = 'block' | 'inline' | 'both';

/**
 * A `div` that scrolls and keeps the focus rings of what it holds whole. Its
 * children sit in a content box padded by a focus ring's width and offset, so
 * a ring at the edge stays inside what it clips whatever padding you give the
 * area, and it scroll-pads by the same amount, so focus scrolls a control's
 * whole ring into view.
 */
export type ScrollAreaRootProps = {
  /** The direction it scrolls in. The other direction is clipped. */
  axis?: ScrollAreaAxis;
  /**
   * Whether it takes a Tab stop, so a keyboard can scroll it, while its content
   * overflows. Without it, only when nothing inside can take focus. Name it
   * with aria-label or aria-labelledby when it can take one.
   */
  focusable?: boolean;
} & ComponentPropsWithRef<'div'>;

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, iframe, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

function overflows(el: HTMLElement, axis: ScrollAreaAxis): boolean {
  const block = el.scrollHeight > el.clientHeight;
  const inline = el.scrollWidth > el.clientWidth;
  return axis === 'block' ? block : axis === 'inline' ? inline : block || inline;
}

/**
 * Scrolls `area` so the ring around `target` is inside it. Focus scrolls a
 * control into view only when part of its box is hidden, so one that just fits
 * would keep a cut ring. The ring can be on an ancestor, such as a Field shell.
 */
function revealRing(area: HTMLElement, target: Element) {
  let ringed = target;
  let ring = 0;
  for (let el: Element | null = target; el && el !== area; el = el.parentElement) {
    const style = getComputedStyle(el);
    const width = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth) || 0;
    if (width > 0) {
      ringed = el;
      ring = width + (Number.parseFloat(style.outlineOffset) || 0);
      break;
    }
  }
  const room = Math.max(ring, Number.parseFloat(getComputedStyle(area).scrollPaddingTop) || 0);
  const box = ringed.getBoundingClientRect();
  const port = area.getBoundingClientRect();
  const top = port.top + area.clientTop;
  const left = port.left + area.clientLeft;
  const dy =
    box.top - room < top ? box.top - room - top : box.bottom + room > top + area.clientHeight ? box.bottom + room - top - area.clientHeight : 0;
  const dx =
    box.left - room < left ? box.left - room - left : box.right + room > left + area.clientWidth ? box.right + room - left - area.clientWidth : 0;
  if (dx || dy) area.scrollBy({ left: dx, top: dy, behavior: 'instant' });
}

function Root({ axis = 'block', focusable, className, ref, onFocus, onBlur, children, ...props }: ScrollAreaRootProps) {
  const own = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(own, ref);
  const [tabStop, setTabStop] = useState(false);
  // Keeps the Tab stop while focus is on it, so a resize never drops focus.
  const [focused, setFocused] = useState(false);

  useLayoutEffect(() => {
    const el = own.current;
    if (!el || focusable === false) {
      setTabStop(false);
      return;
    }
    const measure = () =>
      setTabStop(overflows(el, axis) && (focusable === true || el.querySelector(FOCUSABLE) === null));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    if (content.current) resize.observe(content.current);
    const mutations = new MutationObserver(measure);
    mutations.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'href', 'tabindex'] });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [axis, focusable]);

  const stop = tabStop || focused;
  const named = props['aria-label'] != null || props['aria-labelledby'] != null;
  useLayoutEffect(() => {
    if (process.env.NODE_ENV === 'production' || !stop || named) return;
    console.error('ScrollArea.Root takes a Tab stop while it overflows, so it requires aria-label or aria-labelledby');
  }, [stop, named]);

  return (
    <div
      role={stop ? 'region' : undefined}
      tabIndex={stop ? 0 : undefined}
      {...props}
      ref={refs}
      data-axis={axis}
      className={cx(styles.root, className)}
      onFocus={composeHandlers(onFocus, (event: FocusEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) setFocused(true);
        else revealRing(event.currentTarget, event.target);
      })}
      onBlur={composeHandlers(onBlur, (event: FocusEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) setFocused(false);
      })}
    >
      <div ref={content} className={styles.content}>
        {children}
      </div>
    </div>
  );
}

export const ScrollArea = { Root } as const;
