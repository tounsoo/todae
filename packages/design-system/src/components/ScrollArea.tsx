import { useLayoutEffect, useRef, type ComponentPropsWithRef, type FocusEvent } from 'react';
import { composeHandlers, cx, useComposedRefs } from '../internal/props.js';
import { revealRing } from '../internal/revealRing.js';
import { ScrollEdges } from './scrollEdges.js';
import { useScrollTabStop, type ScrollAxis } from './scrollTabStop.js';
import styles from './ScrollArea.module.css';

/** The direction a scroll area scrolls in. */
export type ScrollAreaAxis = ScrollAxis;

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
  /**
   * Whether an arrow shows at each edge where its content is cut off, while
   * there is more to scroll that way. Resting a mouse or pen on one scrolls
   * toward it. The arrows are for the pointer only: touch and keys scroll as
   * before, and assistive technology never meets them.
   */
  arrows?: boolean;
} & ComponentPropsWithRef<'div'>;

function Root({ axis = 'block', focusable, arrows = false, className, ref, onFocus, onBlur, children, ...props }: ScrollAreaRootProps) {
  const own = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(own, ref);
  const [stop, setFocused] = useScrollTabStop(own, content, axis, focusable);
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
      {arrows && <ScrollEdges axis={axis} />}
      <div ref={content} className={styles.content}>
        {children}
      </div>
    </div>
  );
}

export const ScrollArea = { Root } as const;
