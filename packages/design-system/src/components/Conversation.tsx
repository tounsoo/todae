import {
  Children,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type FocusEvent,
  type RefObject,
  type UIEvent,
} from 'react';
import { useAnnouncer } from '../hooks/useAnnouncer.js';
import { reducedMotion } from '../overlay/useOverlayPresence.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { Button, type ButtonActionProps } from './Button.js';
import { ChevronGlyph, glyphOr } from './glyphs.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import { focusWithoutScroll, revealRing } from './revealRing.js';
import { useScrollTabStop } from './scrollTabStop.js';
import styles from './Conversation.module.css';

export type ConversationRootProps = ComponentPropsWithRef<'div'> & {
  /**
   * Whether it tells screen readers when a message starts and finishes
   * arriving, read from `aria-busy` on the `article`s in Conversation.Content.
   * Default true.
   */
  announceMessages?: boolean;
};
/** The scroller, a `section` named "Conversation" by default, so it is a region landmark. */
export type ConversationViewportProps = ComponentPropsWithRef<'section'>;
export type ConversationContentProps = ComponentPropsWithRef<'div'>;
/** A Button.Root that scrolls to the newest message. Hidden while the reader is at the end. */
export type ConversationScrollButtonProps = ButtonActionProps;

// How far from the end still counts as at the end, for fractional scroll
// positions at some zoom levels.
const END_SLACK = 1;
// The share of the distance left that a glide covers each frame, and its
// smallest step in pixels.
const GLIDE_SHARE = 0.18;
const GLIDE_MIN_STEP = 4;
// The longest a glide runs before it lands at the end.
const GLIDE_MS = 500;

type ConversationContext = {
  viewport: RefObject<HTMLElement | null>;
  content: RefObject<HTMLDivElement | null>;
  button: RefObject<HTMLButtonElement | null>;
  announceMessages: boolean;
  atEnd: boolean;
  onScroll: () => void;
  follow: () => void;
  scrollToEnd: () => void;
};

const Context = /* @__PURE__ */ createContext<ConversationContext | null>(null);

function useConversation(part: string): ConversationContext {
  const context = useContext(Context);
  if (!context) throw new Error(`Conversation.${part} must be rendered inside Conversation.Root`);
  return context;
}

// Instant whatever scroll-behavior the viewport has: a glide steps it frame
// by frame, and following must land in the frame the content grew.
function jump(el: HTMLElement, top: number) {
  // jsdom, where a product's tests run, has no scrollTo.
  if (typeof el.scrollTo === 'function') el.scrollTo({ top, behavior: 'instant' });
  else el.scrollTop = top;
}

function distanceToEnd(el: HTMLElement): number {
  return el.scrollHeight - el.clientHeight - el.scrollTop;
}

/**
 * A conversation of messages that keeps the newest one in view while it
 * grows. It follows the end of the conversation until the reader scrolls up,
 * and Conversation.ScrollButton brings them back.
 */
function Root({ announceMessages = true, className, ...props }: ConversationRootProps) {
  const viewport = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  // Whether to keep the end in view when the content or the viewport resizes.
  const following = useRef(true);
  // The scroll position last seen or set. Todae only scrolls down, other than
  // revealRing following the reader's own focus, and scroll anchoring is off
  // while following, so a scroll event that reads a position above it is the
  // reader scrolling up, or a clamp to a new end. Being short of the end alone
  // isn't: a scroll event can land after the content grew.
  const expected = useRef(0);
  // The frame of the glide Conversation.ScrollButton started, or 0.
  const glideFrame = useRef(0);
  const [atEnd, setAtEndState] = useState(true);

  // Conversation.ScrollButton hides at the end, so focus on it moves to the
  // viewport first rather than being lost.
  const setAtEnd = useCallback((end: boolean) => {
    const own = button.current;
    if (end && own && own === own.ownerDocument.activeElement && viewport.current) focusWithoutScroll(viewport.current);
    setAtEndState(end);
  }, []);

  const stopGlide = useCallback(() => {
    cancelAnimationFrame(glideFrame.current);
    glideFrame.current = 0;
  }, []);

  useEffect(() => stopGlide, [stopGlide]);

  // The ref and the viewport's data-following change together, in the same
  // task, so scroll anchoring is never on for a frame while following.
  const setFollowing = useCallback((on: boolean) => {
    following.current = on;
    viewport.current?.toggleAttribute('data-following', on);
  }, []);

  const onScroll = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    const top = el.scrollTop;
    // At the end first: a shrinking conversation clamps the position up to
    // its new end, which is no reader's doing.
    if (distanceToEnd(el) <= END_SLACK) setFollowing(true);
    else if (top < expected.current - 0.5) {
      setFollowing(false);
      stopGlide();
    }
    expected.current = top;
    setAtEnd(following.current);
  }, [setAtEnd, setFollowing, stopGlide]);

  // Called on every resize: back to the end while following it, so a growing
  // message stays in view, and following again once the end comes to the
  // reader, such as when the content shrinks.
  const follow = useCallback(() => {
    const el = viewport.current;
    // A viewport with no box, such as in a hidden tab panel, reads 0 for
    // everything, which would look like the end.
    if (!el || glideFrame.current || el.clientHeight === 0) return;
    if (following.current) jump(el, el.scrollHeight);
    setFollowing(following.current || distanceToEnd(el) <= END_SLACK);
    expected.current = el.scrollTop;
    setAtEnd(following.current);
  }, [setAtEnd, setFollowing]);

  // Each frame covers a share of what is left, so it slows into an end that
  // may still be moving away while a message grows, and it lands after
  // GLIDE_MS at most.
  const scrollToEnd = useCallback(() => {
    const el = viewport.current;
    if (!el) return;
    setFollowing(true);
    setAtEnd(true);
    stopGlide();
    if (reducedMotion()) {
      jump(el, el.scrollHeight);
      expected.current = el.scrollTop;
      return;
    }
    const start = performance.now();
    const step = () => {
      const left = distanceToEnd(el);
      if (left <= END_SLACK) {
        glideFrame.current = 0;
        return;
      }
      // Past its time, it lands, however fast the end is still moving.
      if (performance.now() - start >= GLIDE_MS) {
        glideFrame.current = 0;
        jump(el, el.scrollHeight);
        expected.current = el.scrollTop;
        return;
      }
      jump(el, el.scrollTop + Math.max(left * GLIDE_SHARE, GLIDE_MIN_STEP));
      expected.current = el.scrollTop;
      glideFrame.current = requestAnimationFrame(step);
    };
    step();
  }, [setAtEnd, setFollowing, stopGlide]);

  const value = useMemo<ConversationContext>(
    () => ({ viewport, content, button, announceMessages, atEnd, onScroll, follow, scrollToEnd }),
    [announceMessages, atEnd, onScroll, follow, scrollToEnd],
  );

  return (
    <Context.Provider value={value}>
      <div {...props} className={cx(styles.root, className)} />
    </Context.Provider>
  );
}

/**
 * The scroller. It opens at the end, follows it while the content grows, and
 * stops following when the reader scrolls up. Its content box is padded by a
 * focus ring's room, as ScrollArea's is.
 */
function Viewport({ 'aria-label': ariaLabel, className, ref, onScroll, onFocus, onBlur, children, ...props }: ConversationViewportProps) {
  const context = useConversation('Viewport');
  const inner = useRef<HTMLDivElement>(null);
  const refs = useComposedRefs(context.viewport, ref);
  const [stop, setFocused] = useScrollTabStop(context.viewport, inner, 'block', undefined);
  const strings = useStrings();
  const { follow } = context;

  useLayoutEffect(() => {
    const el = context.viewport.current;
    if (!el) return;
    follow();
    if (typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(follow);
    resize.observe(el);
    if (inner.current) resize.observe(inner.current);
    return () => resize.disconnect();
  }, [context.viewport, follow]);

  // An empty aria-label names nothing, so the default stands in for it, as on a close button.
  const label = ariaLabel || (props['aria-labelledby'] == null ? strings.conversation : undefined);
  return (
    <section
      aria-label={label}
      // -1 when it takes no Tab stop, so focus can still land on it when
      // Conversation.ScrollButton hides under it.
      tabIndex={stop ? 0 : -1}
      {...props}
      ref={refs}
      className={cx(styles.viewport, className)}
      onScroll={composeHandlers(onScroll, (_event: UIEvent<HTMLElement>) => context.onScroll())}
      onFocus={composeHandlers(onFocus, (event: FocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) setFocused(true);
        else revealRing(event.currentTarget, event.target);
      })}
      onBlur={composeHandlers(onBlur, (event: FocusEvent<HTMLElement>) => {
        if (event.target === event.currentTarget) setFocused(false);
      })}
    >
      <div ref={inner} className={styles.room}>
        {children}
      </div>
    </section>
  );
}

/**
 * Holds the messages. When an `article` in it takes `aria-busy="true"`, as
 * Message.Root does while `streaming`, it announces that a message is arriving;
 * when that clears, that it finished, unless the message now holds a
 * `role="alert"`, which speaks for itself, or another message starts at the
 * same time.
 */
function Content({ className, ref, ...props }: ConversationContentProps) {
  const context = useConversation('Content');
  const refs = useComposedRefs(context.content, ref);
  const strings = useStrings();
  const announce = useAnnouncer();
  const { announceMessages } = context;
  // Read when a message changes, so a new provider's text is used.
  const text = useRef(strings);
  text.current = strings;

  useEffect(() => {
    const el = context.content.current;
    if (!el || !announceMessages || typeof MutationObserver === 'undefined') return;
    const busy = () => new Set(el.querySelectorAll('article[aria-busy="true"]'));
    // A message already arriving when it mounts has no start to announce.
    let arriving = busy();
    const mutations = new MutationObserver(() => {
      const now = busy();
      const started = [...now].some((message) => !arriving.has(message));
      const finished = [...arriving].some(
        (message) => !now.has(message) && el.contains(message) && message.querySelector('[role="alert"]') === null,
      );
      arriving = now;
      if (started) announce(text.current.messageStarted);
      else if (finished) announce(text.current.messageFinished);
    });
    mutations.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-busy'] });
    return () => mutations.disconnect();
  }, [context.content, announceMessages, announce]);

  return <div {...props} ref={refs} className={cx(styles.content, className)} />;
}

/**
 * A button over the end of the viewport that scrolls to the newest message,
 * hidden while the reader is at the end. With no children it
 * shows the chevron glyph and is named by the `scrollToLatest` string.
 */
function ScrollButton({ 'aria-label': ariaLabel, onClick, className, children, ref, ...props }: ConversationScrollButtonProps) {
  const context = useConversation('ScrollButton');
  const strings = useStrings();
  const { chevron } = useGlyphs();
  const refs = useComposedRefs(context.button, ref);

  // The button's height, so the viewport's scroll padding keeps focus clear
  // of it while it shows; its inset is added in CSS. Set on the root, which
  // outlives the viewport, and measured for whichever button is mounted.
  useLayoutEffect(() => {
    const own = context.button.current;
    const root = own?.parentElement;
    if (!own || !root || typeof ResizeObserver === 'undefined') return;
    const resize = new ResizeObserver(([entry]) => {
      const size = entry?.borderBoxSize?.[0]?.blockSize ?? own.offsetHeight;
      if (size > 0) root.style.setProperty('--_conversation-scroll-size', `${size}px`);
    });
    resize.observe(own, { box: 'border-box' });
    return () => {
      resize.disconnect();
      root.style.removeProperty('--_conversation-scroll-size');
    };
  }, [context.button]);
  // What React would render: no nodes, or only empty text.
  const empty = Children.toArray(children).every((child) => child === '');

  return (
    <Button.Root
      variant="secondary"
      hidden={context.atEnd}
      aria-label={ariaLabel || (empty ? strings.scrollToLatest : undefined)}
      {...props}
      ref={refs}
      className={cx(styles.scrollButton, className)}
      onClick={composeHandlers(onClick, () => context.scrollToEnd())}
    >
      {empty ? <Button.Icon data-todae-glyph="">{glyphOr(chevron, <ChevronGlyph />)}</Button.Icon> : children}
    </Button.Root>
  );
}

export const Conversation = { Root, Viewport, Content, ScrollButton } as const;
