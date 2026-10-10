import { useLayoutEffect, useRef, useState, type ComponentPropsWithRef, type FocusEvent } from 'react';
import { composeHandlers, cx, useComposedRefs } from './props';
import styles from './ScrollArea.module.css';

/** The direction a scroll area scrolls in. */
export type ScrollAreaAxis = 'block' | 'inline' | 'both';

/**
 * A `div` that scrolls and keeps the focus rings of what it holds whole. It
 * pads itself by a focus ring's width and offset and gives that back with a
 * matching negative margin, so it takes the same space it would without the
 * room, and it scroll-pads by the same amount, so focus scrolls a control's
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

function Root({ axis = 'block', focusable, className, ref, onFocus, onBlur, ...props }: ScrollAreaRootProps) {
  const own = useRef<HTMLDivElement>(null);
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
    const watch = () => {
      resize.disconnect();
      resize.observe(el);
      for (const child of el.children) resize.observe(child);
    };
    watch();
    const mutations = new MutationObserver(() => {
      watch();
      measure();
    });
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
      })}
      onBlur={composeHandlers(onBlur, (event: FocusEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) setFocused(false);
      })}
    />
  );
}

export const ScrollArea = { Root } as const;
