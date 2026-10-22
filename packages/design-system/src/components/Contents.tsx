import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { useStrings } from '../providers/StringsProvider.js';
import { hasGlyph } from './glyphs.js';
import { composeHandlers, cx, useComposedRefs } from './props.js';
import type { LinkRenderProps } from './Link.js';
import styles from './Contents.module.css';

/**
 * A `nav` landmark holding a list of links to the sections of the page. It
 * marks the link to the section being read with `aria-current="location"`.
 */
export type ContentsRootProps = {
  /** Text shown above the list, which also names the landmark. Without it, `aria-labelledby`, `aria-label` or the `contents` string names it. */
  label?: ReactNode;
  children?: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithRef<'nav'>, 'children'>;

/** A nested list of Contents.Item elements, for the sections under one heading. */
export type ContentsListProps = ComponentPropsWithRef<'ul'>;

/** One entry: a Contents.Link, or a Contents.Link followed by the Contents.List of its sub-sections. */
export type ContentsItemProps = ComponentPropsWithRef<'li'>;

/**
 * A link to a section, by its `href` fragment, such as `#props`. Renders an
 * `a`, or whatever `render` returns, such as a router's link.
 */
export type ContentsLinkProps = {
  render?: (props: LinkRenderProps) => ReactElement;
} & ComponentPropsWithRef<'a'>;

type ContentsContextValue = {
  current: string | null;
  register: (id: string) => () => void;
  pick: (id: string) => void;
};

const ContentsContext = /* @__PURE__ */ createContext<ContentsContextValue | null>(null);

// How far above the scroller the observers' boxes reach, so a section scrolled out of sight above still counts as passed.
const FAR = 1_000_000;

const SCROLL_KEYS = /* @__PURE__ */ new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

/** The id a fragment names, or null without one. */
function fragmentOf(href: string | undefined): string | null {
  const at = href?.indexOf('#') ?? -1;
  if (!href || at < 0 || at === href.length - 1) return null;
  try {
    return decodeURIComponent(href.slice(at + 1));
  } catch {
    return href.slice(at + 1);
  }
}

/** Whether `href` points into the page that is showing, so its fragment names an element here. */
function onThisPage(href: string, doc: Document): boolean {
  let there: URL;
  try {
    there = new URL(href, doc.baseURI);
  } catch {
    return false;
  }
  const here = new URL(doc.URL);
  return there.origin === here.origin && there.pathname === here.pathname && there.search === here.search;
}

/** The nearest ancestor that scrolls `el`, or null when the page itself does. */
function scrollerOf(el: Element): Element | null {
  const { body, documentElement } = el.ownerDocument;
  for (let node = el.parentElement; node && node !== body && node !== documentElement; node = node.parentElement) {
    // `overflow-x: hidden` alone computes `overflow-y` to `auto` too, so a box counts only when it overflows.
    // A pixel of slack, since both sizes are rounded.
    if (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY) && node.scrollHeight - node.clientHeight > 1) return node;
  }
  return null;
}

/** A computed length in pixels, with a percentage of `basis`, or 0 for `auto` and the like. */
function pixels(value: string, basis: number): number {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 0;
  return value.endsWith('%') ? (n * basis) / 100 : n;
}

/**
 * Whether `key` on `target` edits or presses a control rather than scrolling:
 * any key in a field, or Space on a button. Widgets that take arrow keys for
 * themselves cancel the key, which the listener checks instead.
 */
function ownsKey(target: EventTarget | undefined, key: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return true;
  return key === ' ' && /^(BUTTON|SUMMARY)$/.test(target.tagName);
}

type FollowOptions = {
  /** Whether the page's hash may pick a section now, on the first follow after mounting. */
  pickFromHash: boolean;
  /** Called when a section that was missing mounts or a followed one leaves the page, so following starts again. */
  onTargetsChange: () => void;
};

/**
 * Follows the sections `ids` name and reports the one being read: the last
 * whose top has passed its line, where a fragment link scrolls it to (the
 * scroller's `scroll-padding-block-start` plus the section's own
 * `scroll-margin-block-start`). A section picked through a link, or named by
 * the page's hash, holds until the person scrolls on their own or it leaves
 * the view, so a short last section can be current too.
 */
function followSections(
  nav: HTMLElement,
  ids: readonly string[],
  picked: { current: string | null },
  report: (id: string | null) => void,
  { pickFromHash, onTargetsChange }: FollowOptions,
): { update: () => void; stop: () => void; found: boolean } {
  const doc = nav.ownerDocument;
  const win = doc.defaultView;
  const root = nav.getRootNode() as Document | ShadowRoot;
  if (!win || typeof win.IntersectionObserver === 'undefined' || typeof win.ResizeObserver === 'undefined') {
    report(null);
    return { update: () => {}, stop: () => {}, found: false };
  }
  const targets = ids
    .map((id) => root.getElementById(id))
    .filter((el): el is HTMLElement => el !== null)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  const missing = ids.filter((id) => !targets.some((target) => target.id === id));
  const followedIds = targets.map((target) => target.id);
  // A pick lapses when its link or its section goes, so it can't come back long after.
  if (picked.current !== null && !followedIds.includes(picked.current)) picked.current = null;

  // Start again when a missing section mounts, or a followed one is replaced or renamed.
  const mutations = new MutationObserver(() => {
    const changed = targets.some((target, i) => !target.isConnected || target.id !== followedIds[i]);
    if (changed || missing.some((id) => root.getElementById(id))) onTargetsChange();
  });
  mutations.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['id'],
  });

  if (targets.length === 0) {
    report(null);
    const drop = () => {
      picked.current = null;
      report(null);
    };
    return { update: drop, stop: () => mutations.disconnect(), found: false };
  }
  const has = (id: string | null) => id !== null && targets.some((target) => target.id === id);
  let scroller = null as Element | null;
  let sections: { el: HTMLElement; line: number }[] = [];
  // Whether the picked section has come into view since it was picked.
  let pickSeen = false;

  const update = () => {
    if (has(picked.current)) return report(picked.current);
    // Scroll padding starts at the scroller's padding edge, inside its border.
    const top = scroller ? scroller.getBoundingClientRect().top + scroller.clientTop : 0;
    let found: string | null = null;
    for (const { el, line } of sections) {
      // A pixel of slack, since a fragment link can leave the top a fraction short of the line.
      if (el.getBoundingClientRect().top > top + line + 1) break;
      found = el.id;
    }
    report(found);
  };

  const release = () => {
    if (picked.current === null) return;
    view?.disconnect();
    picked.current = null;
    update();
  };

  // Watches the picked section alone, to release it once it has been in view and leaves.
  let view: IntersectionObserver | null = null;
  // A fresh observation hands the observer an entry that says whether the section is in view now.
  const startPick = () => {
    pickSeen = false;
    view?.disconnect();
    const target = targets.find((el) => el.id === picked.current);
    // A pick of a section that isn't on the page lapses now, so it can't hold when the section mounts later.
    if (target) view?.observe(target);
    else picked.current = null;
    update();
  };

  // Measures the scroller and each section's line, and watches the lines with
  // one observer per line, whose box runs from far above the scroller down to
  // that line, so a section's entry changes whenever its top crosses its own
  // line, however far one scroll jumps.
  let passed: IntersectionObserver[] = [];
  // The first heading's parent stays watched; the scroller, whose size sets the lines' boxes, is watched by a second
  // observer that moves when the scroller changes. Observing again only on a change keeps it from calling itself.
  // Resizes measure once in the next frame: several observers may report one change, and observing a new scroller
  // from inside a resize callback would raise the browser's "ResizeObserver loop" error.
  let frame = 0;
  const measureSoon = () => {
    if (!frame)
      frame = win.requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
  };
  const resizes = new ResizeObserver(measureSoon);
  resizes.observe(targets[0]!.parentElement ?? targets[0]!);
  const scrollerResizes = new ResizeObserver(measureSoon);
  let watchedBox: Element | null = null;
  const measure = () => {
    for (const observer of passed) observer.disconnect();
    view?.disconnect();
    scroller = scrollerOf(targets[0]!);
    const box = scroller ?? doc.documentElement;
    if (box !== watchedBox) {
      scrollerResizes.disconnect();
      scrollerResizes.observe(box);
      watchedBox = box;
    }
    const height = box.clientHeight;
    const padding = pixels(getComputedStyle(box).scrollPaddingBlockStart, height);
    sections = targets.map((el) => ({
      el,
      line: padding + pixels(getComputedStyle(el).scrollMarginBlockStart, height),
    }));
    const byLine = new Map<number, IntersectionObserver>();
    for (const { el, line } of sections) {
      let observer = byLine.get(line);
      if (!observer) {
        observer = new IntersectionObserver(update, {
          root: scroller ?? doc,
          rootMargin: `${FAR}px 0px ${Math.min(0, line + 1 - height)}px 0px`,
        });
        byLine.set(line, observer);
      }
      observer.observe(el);
    }
    passed = [...byLine.values()];
    view = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) pickSeen = true;
          else if (pickSeen) release();
        }
      },
      { root: scroller ?? doc },
    );
    const target = targets.find((el) => el.id === picked.current);
    if (target) view.observe(target);
  };
  measure();
  win.addEventListener('resize', measureSoon);

  const inView = (el: Element) => {
    const rect = el.getBoundingClientRect();
    const area = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: win.innerHeight };
    return rect.bottom > area.top && rect.top < area.bottom;
  };

  // A hash picks its section only where the page shows it, not where history restored another position.
  const pickHash = () => {
    const id = fragmentOf(doc.location.hash);
    const target = targets.find((el) => el.id === id);
    if (!target || !inView(target)) return false;
    picked.current = target.id;
    startPick();
    return true;
  };

  const onHashChange = () => {
    // A hash that names the picked section keeps it, as a click's own hash does while a smooth scroll is on its way.
    if (picked.current !== null && fragmentOf(doc.location.hash) === picked.current) return;
    if (!pickHash()) release();
  };

  // Listens as the key bubbles, so a widget that cancels it has had its turn. A widget that stops the key keeps the pick too.
  const onKey = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key) && !event.isComposing && !event.defaultPrevented && !ownsKey(event.composedPath()[0], event.key)) release();
  };
  const options = { capture: true, passive: true } as const;
  doc.addEventListener('wheel', release, options);
  doc.addEventListener('touchstart', release, options);
  doc.addEventListener('keydown', onKey);
  win.addEventListener('hashchange', onHashChange);

  if (has(picked.current)) startPick();
  else if (!pickFromHash || !pickHash()) update();

  return {
    found: true,
    update: startPick,
    stop: () => {
      for (const observer of passed) observer.disconnect();
      view?.disconnect();
      resizes.disconnect();
      scrollerResizes.disconnect();
      mutations.disconnect();
      win.cancelAnimationFrame(frame);
      win.removeEventListener('resize', measureSoon);
      doc.removeEventListener('wheel', release, options);
      doc.removeEventListener('touchstart', release, options);
      doc.removeEventListener('keydown', onKey);
      win.removeEventListener('hashchange', onHashChange);
    },
  };
}

function Root({ label, children, className, ref, 'aria-label': ariaLabel, 'aria-labelledby': labelledby, ...props }: ContentsRootProps) {
  const strings = useStrings();
  const labelId = useId();
  const labelled = hasGlyph(label);
  const nav = useRef<HTMLElement>(null);
  const composedRef = useComposedRefs(nav, ref);
  const counts = useRef(new Map<string, number>());
  const [ids, setIds] = useState<readonly string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const picked = useRef<string | null>(null);
  const following = useRef<{ update: () => void } | null>(null);
  // Whether the hash has had its chance to pick: on the first follow that found sections, or once a click picked.
  const followed = useRef(false);

  const register = useCallback((id: string) => {
    const count = counts.current.get(id) ?? 0;
    counts.current.set(id, count + 1);
    if (count === 0) setIds([...counts.current.keys()]);
    return () => {
      const left = (counts.current.get(id) ?? 1) - 1;
      if (left > 0) {
        counts.current.set(id, left);
        return;
      }
      counts.current.delete(id);
      setIds([...counts.current.keys()]);
    };
  }, []);

  const pick = useCallback((id: string) => {
    picked.current = id;
    // The click puts its own fragment in the hash, which must not pick again when sections mount later.
    followed.current = true;
    following.current?.update();
  }, []);

  // Bumped when a section mounts late or is replaced, to follow the page again.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!nav.current) return;
    const follow = followSections(nav.current, ids, picked, setCurrent, {
      pickFromHash: !followed.current,
      onTargetsChange: () => setGeneration((n) => n + 1),
    });
    // The hash may pick only on the first follow that found sections to pick from.
    if (follow.found) followed.current = true;
    following.current = follow;
    return () => {
      follow.stop();
      following.current = null;
    };
  }, [ids, generation]);

  const context = useMemo(() => ({ current, register, pick }), [current, register, pick]);

  return (
    <nav
      {...props}
      ref={composedRef}
      aria-label={labelled || labelledby ? undefined : (ariaLabel ?? strings.contents)}
      aria-labelledby={labelledby ?? (labelled ? labelId : undefined)}
      className={cx(styles.root, className)}
    >
      {labelled ? (
        <div id={labelId} className={styles.label}>
          {label}
        </div>
      ) : null}
      <ContentsContext.Provider value={context}>
        {/* Safari drops the list role from a list without markers; role="list" keeps it. */}
        <ul role="list" className={cx(styles.list, styles.top)}>
          {children}
        </ul>
      </ContentsContext.Provider>
    </nav>
  );
}

function List({ className, ...props }: ContentsListProps) {
  return <ul role="list" {...props} className={cx(styles.list, className)} />;
}

function Item({ className, ...props }: ContentsItemProps) {
  return <li {...props} className={cx(styles.item, className)} />;
}

function Link({ render, className, href, onClick, ref, 'aria-current': ariaCurrent, ...props }: ContentsLinkProps) {
  const ctx = useContext(ContentsContext);
  if (!ctx) throw new Error('Contents.Link must be rendered inside Contents.Root');
  const { current, register, pick } = ctx;
  const id = fragmentOf(href);
  const anchor = useRef<HTMLAnchorElement>(null);
  const composedRef = useComposedRefs(anchor, ref);
  // Only a link into the page that is showing follows its section. A render that drops the ref falls back to this document.
  const [local, setLocal] = useState(false);

  useEffect(() => {
    const here = id !== null && href !== undefined && onThisPage(href, anchor.current?.ownerDocument ?? document);
    setLocal(here);
    if (!here || id === null) return;
    return register(id);
  }, [id, href, register]);

  const own = {
    ...props,
    href,
    ref: composedRef,
    'aria-current': ariaCurrent ?? (local && current === id ? ('location' as const) : undefined),
    className: cx(styles.link, className),
    onClick: composeHandlers(onClick, (event: MouseEvent<HTMLAnchorElement>) => {
      if (!local || id === null || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      pick(id);
    }),
  };
  return render ? render(own) : <a {...own} />;
}

export const Contents = { Root, List, Item, Link } as const;
