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
  /** Text shown above the list, which also names the landmark. Without it, `aria-label`, `aria-labelledby` or the `contents` string names it. */
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
  const here = new URL(doc.URL);
  const there = new URL(href, doc.baseURI);
  return there.origin === here.origin && there.pathname === here.pathname && there.search === here.search;
}

/** The nearest ancestor that scrolls `el`, or null when the page itself does. */
function scrollerOf(el: Element): Element | null {
  const { body, documentElement } = el.ownerDocument;
  for (let node = el.parentElement; node && node !== body && node !== documentElement; node = node.parentElement) {
    if (/auto|scroll|overlay/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
}

/** A length in pixels from a computed style, or 0 for `auto` and the like. */
function pixels(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

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
): { update: () => void; stop: () => void } {
  const doc = nav.ownerDocument;
  const root = nav.getRootNode() as Document | ShadowRoot;
  const targets = ids
    .map((id) => root.getElementById(id))
    .filter((el): el is HTMLElement => el !== null)
    .sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
  if (targets.length === 0) {
    report(null);
    return { update: () => report(null), stop: () => {} };
  }
  const has = (id: string | null) => id !== null && targets.some((target) => target.id === id);
  const scroller = scrollerOf(targets[0]!);
  const padding = pixels(getComputedStyle(scroller ?? doc.documentElement).scrollPaddingBlockStart);
  const sections = targets.map((el) => ({ el, line: padding + pixels(getComputedStyle(el).scrollMarginBlockStart) }));
  // Whether the picked section has come into view since it was picked.
  let pickSeen = false;

  const update = () => {
    if (has(picked.current)) return report(picked.current);
    const top = scroller ? scroller.getBoundingClientRect().top : 0;
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
    view.disconnect();
    picked.current = null;
    update();
  };

  // Watches the picked section alone, to release it once it has been in view and leaves.
  const view = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) pickSeen = true;
        else if (pickSeen) release();
      }
    },
    { root: scroller ?? doc },
  );

  // A fresh observation hands the observer an entry that says whether the section is in view now.
  const startPick = () => {
    pickSeen = false;
    view.disconnect();
    const target = targets.find((el) => el.id === picked.current);
    if (target) view.observe(target);
    update();
  };

  // One observer per line, whose box runs from far above the scroller down to
  // that line, so a section's entry changes whenever its top crosses its own
  // line, however far one scroll jumps.
  let passed: IntersectionObserver[] = [];
  const watchLines = () => {
    for (const observer of passed) observer.disconnect();
    const height = scroller ? scroller.clientHeight : doc.documentElement.clientHeight;
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
  };
  watchLines();
  const resizes = new ResizeObserver(watchLines);
  if (scroller) resizes.observe(scroller);
  doc.defaultView?.addEventListener('resize', watchLines);

  const pickHash = () => {
    const id = fragmentOf(doc.location?.hash);
    if (!has(id)) return;
    picked.current = id;
    startPick();
  };

  const onKey = (event: KeyboardEvent) => {
    if (SCROLL_KEYS.has(event.key)) release();
  };
  const options = { capture: true, passive: true } as const;
  doc.addEventListener('wheel', release, options);
  doc.addEventListener('touchstart', release, options);
  doc.addEventListener('keydown', onKey, options);
  doc.defaultView?.addEventListener('hashchange', pickHash);
  if (picked.current === null) pickHash();
  update();

  return {
    update: startPick,
    stop: () => {
      for (const observer of passed) observer.disconnect();
      view.disconnect();
      resizes.disconnect();
      doc.defaultView?.removeEventListener('resize', watchLines);
      doc.removeEventListener('wheel', release, options);
      doc.removeEventListener('touchstart', release, options);
      doc.removeEventListener('keydown', onKey, options);
      doc.defaultView?.removeEventListener('hashchange', pickHash);
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
    following.current?.update();
  }, []);

  useEffect(() => {
    if (!nav.current) return;
    const follow = followSections(nav.current, ids, picked, setCurrent);
    following.current = follow;
    return () => {
      follow.stop();
      following.current = null;
    };
  }, [ids]);

  const context = useMemo(() => ({ current, register, pick }), [current, register, pick]);

  return (
    <nav
      {...props}
      ref={composedRef}
      aria-label={labelled || labelledby ? ariaLabel : (ariaLabel ?? strings.contents)}
      aria-labelledby={labelledby ?? (labelled && !ariaLabel ? labelId : undefined)}
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

function Link({ render, className, href, onClick, 'aria-current': ariaCurrent, ...props }: ContentsLinkProps) {
  const ctx = useContext(ContentsContext);
  if (!ctx) throw new Error('Contents.Link must be rendered inside Contents.Root');
  const { current, register, pick } = ctx;
  const id = fragmentOf(href);

  useEffect(() => {
    if (id === null || !href || typeof document === 'undefined' || !onThisPage(href, document)) return;
    return register(id);
  }, [id, href, register]);

  const own = {
    ...props,
    href,
    'aria-current': ariaCurrent ?? (id !== null && current === id ? ('location' as const) : undefined),
    className: cx(styles.link, className),
    onClick: composeHandlers(onClick, (event: MouseEvent<HTMLAnchorElement>) => {
      if (id === null || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      pick(id);
    }),
  };
  return render ? render(own) : <a {...own} />;
}

export const Contents = { Root, List, Item, Link } as const;
