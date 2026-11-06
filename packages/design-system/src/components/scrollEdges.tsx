import { useLayoutEffect, useRef, useState } from 'react';
import { cancelLayout, queueLayout, STAGE } from '../internal/layoutBatch.js';
import { revealRing } from '../internal/revealRing.js';
import { watchScroller, type ScrollerBox } from '../internal/sharedObservers.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { ChevronGlyph, glyphOr } from './glyphs.js';
import type { ScrollAxis } from './scrollTabStop.js';
import styles from './ScrollEdges.module.css';

type Edge = 'block-start' | 'block-end' | 'inline-start' | 'inline-end';

const EDGES: Record<ScrollAxis, readonly Edge[]> = {
  block: ['block-start', 'block-end'],
  inline: ['inline-start', 'inline-end'],
  both: ['block-start', 'block-end', 'inline-start', 'inline-end'],
};

// Pixels per millisecond. Resting on an arrow starts slow, so a short rest
// moves a row or two, and speeds up to the top speed over the ramp: about a
// dozen menu rows in under two seconds, as in the reference recording.
const START_SPEED = 0.08;
const TOP_SPEED = 0.4;
const RAMP_MS = 2000;
// Reduced motion scrolls at one even speed from the start.
const EVEN_SPEED = 0.2;

// How far the scroller can still go toward an edge, in pixels. An RTL
// scroller's scrollLeft runs from 0 at its start down to negative numbers.
function room(el: HTMLElement, edge: Edge, rtl: boolean): number {
  switch (edge) {
    case 'block-start':
      return el.scrollTop;
    case 'block-end':
      return el.scrollHeight - el.clientHeight - el.scrollTop;
    case 'inline-start':
      return Math.abs(el.scrollLeft);
    case 'inline-end':
      return el.scrollWidth - el.clientWidth - (rtl ? -el.scrollLeft : el.scrollLeft);
  }
}

function step(el: HTMLElement, edge: Edge, rtl: boolean, by: number) {
  if (edge === 'block-start') el.scrollTop -= by;
  else if (edge === 'block-end') el.scrollTop += by;
  else el.scrollLeft += (edge === 'inline-end') !== rtl ? by : -by;
}

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}

// Where each mouse or pen was before its latest move, per window, so an arrow
// can tell a pointer moving onto it from one it showed up under. Not every
// browser reports movementX and movementY for every move, so this is the
// fallback. It listens in the capture phase, before any part of the page can
// stop the event, and keeps the place before the move the arrow sees. Touch
// is left out, so a finger elsewhere says nothing about where a mouse rests.
type Point = { x: number; y: number; before: { x: number; y: number } | null };
const points = new WeakMap<Window, Map<number, Point>>();
function watchPointer(win: Window) {
  if (points.has(win)) return;
  const byPointer = new Map<number, Point>();
  points.set(win, byPointer);
  win.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType === 'touch') return;
      const last = byPointer.get(event.pointerId);
      byPointer.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
        before: last ? { x: last.x, y: last.y } : null,
      });
    },
    { capture: true, passive: true },
  );
}
function moved(event: PointerEvent, win: Window): boolean {
  if (event.movementX || event.movementY) return true;
  // A pointer never seen before this move has no place to compare with.
  const before = points.get(win)?.get(event.pointerId)?.before;
  if (!before) return false;
  return Math.abs(event.clientX - before.x) >= 0.5 || Math.abs(event.clientY - before.y) >= 0.5;
}

/**
 * Arrows at each edge of a scroller where its content is cut off. Render it as
 * the scroller's first child: a sticky box of no size keeps the arrows on the
 * scroller's edges while its content moves, in block and flex layouts. An
 * arrow shows only while there is more to scroll toward its edge, and a mouse
 * or pen resting on it scrolls that way, faster the longer it rests. Touch
 * and keys scroll as before, so the arrows are hidden from assistive
 * technology and never take focus.
 *
 * An overlay passes `active` as its open state, so a closed one does no
 * work: the rail mounts on its first open, and it measures and watches only
 * while open. On close it stops where it is, so the arrows fade out with the
 * overlay as they were.
 */
export function ScrollEdges({ axis, active = true }: { axis: ScrollAxis; active?: boolean }) {
  const rail = useRef<HTMLSpanElement>(null);
  const { chevron } = useGlyphs();
  const edges = EDGES[axis];
  const [mounted, setMounted] = useState(active);
  if (active && !mounted) setMounted(true);

  useLayoutEffect(() => {
    if (!active) return;
    const own = rail.current;
    const el = own?.parentElement;
    if (!own || !el) return;
    const win = el.ownerDocument.defaultView ?? window;
    watchPointer(win);
    let rtl = false;
    let padInline = 0;
    // The shift an earlier open left on the rail, which keeps it through
    // the exit fade and is where the next open starts from.
    let shift = px(own.style.translate);
    let content: ScrollerBox | null = null;
    let frame = 0;
    let resting: { edge: Edge; since: number; last: number; carry: number } | null = null;
    // A measure that finds nothing new writes nothing: a write between two
    // reads makes the browser lay the page out again, once per rail on a
    // page of many. The rail's inline style is read without a layout.
    const set = (name: string, value: string) => {
      if (own.style.getPropertyValue(name) !== value) own.style.setProperty(name, value);
    };

    // WebKit leaves a sticky box in place along the inline axis of a
    // right-to-left scroller, so the rail would scroll away with the content.
    // Where the rail has moved off the content box's start edge, move it back.
    const align = (style: CSSStyleDeclaration) => {
      if (!rtl || el.scrollWidth <= el.clientWidth) {
        if (shift) own.style.translate = '';
        shift = 0;
        return;
      }
      // The padding box's right edge from the scroller's fractional box, less
      // its right border and a scrollbar on the right, if any: clientWidth
      // rounds, which would move a rail that sticky already holds.
      const port = el.getBoundingClientRect();
      const borders = px(style.borderLeftWidth) + px(style.borderRightWidth);
      const bar = Math.max(0, Math.round(el.offsetWidth - borders - el.clientWidth));
      const barRight = el.clientLeft - px(style.borderLeftWidth) < 0.5 ? bar : 0;
      const want = port.right - px(style.borderRightWidth) - barRight - padInline;
      const off = want - own.getBoundingClientRect().right;
      if (Math.abs(off) < 0.5) return;
      shift += off;
      own.style.translate = shift ? `${shift}px 0` : '';
    };
    // Which arrows have room to show, read before any is written.
    let shown: boolean[] = [];
    const readShown = () => {
      const off = own.hasAttribute('data-off');
      shown = [...own.children].map((node) => !off && room(el, (node as HTMLElement).dataset.edge as Edge, rtl) >= 1);
    };
    const writeShown = () => {
      [...own.children].forEach((node, index) => node.toggleAttribute('data-shown', shown[index] ?? false));
      if (resting && room(el, resting.edge, rtl) < 1) stop();
    };
    // Scrolling and resting on an arrow show at once, for this rail alone.
    const show = () => {
      const style = getComputedStyle(el);
      // A change of direction resizes nothing, so the observers miss it.
      if ((style.direction === 'rtl') !== rtl) {
        readMeasure();
        writeMeasure();
        return;
      }
      align(style);
      readShown();
      writeShown();
    };
    let found: { style: CSSStyleDeclaration; inline: number; block: number; padBlock: number; row: boolean; grid: boolean; gap: number } | null =
      null;
    const readMeasure = () => {
      const style = getComputedStyle(el);
      rtl = style.direction === 'rtl';
      // The rail sits at the content box's start corner; the arrows reach
      // back over the padding to the scrollport's edges. The scrollport's
      // size comes from the content box a ResizeObserver reports, which keeps
      // its fraction: clientWidth and clientHeight round, and a band half a
      // pixel past the scrollport makes overflow of its own in Firefox.
      const padding = {
        inline: px(style.paddingLeft) + px(style.paddingRight),
        block: px(style.paddingTop) + px(style.paddingBottom),
      };
      padInline = px(rtl ? style.paddingRight : style.paddingLeft);
      // A flex scroller puts its gap after the rail too; take it back.
      const flex = style.display.includes('flex');
      const row = flex && !style.flexDirection.startsWith('column');
      found = {
        style,
        inline: content ? content.inline + padding.inline : el.clientWidth,
        block: content ? content.block + padding.block : el.clientHeight,
        padBlock: px(style.paddingTop),
        row,
        // A grid would give the rail a cell of its own and move every item,
        // so a grid scroller shows no arrows; a grid inside the scroller is fine.
        grid: style.display.includes('grid'),
        gap: flex ? px(row ? style.columnGap : style.rowGap) : 0,
      };
    };
    const writeMeasure = () => {
      if (!found) return;
      set('--_port-inline', `${found.inline}px`);
      set('--_port-block', `${found.block}px`);
      set('--_pad-inline', `${padInline}px`);
      set('--_pad-block', `${found.padBlock}px`);
      own.toggleAttribute('data-off', found.grid);
      set('--_gap', `${found.gap}px`);
      own.toggleAttribute('data-row', found.row);
      const { style } = found;
      found = null;
      // WebKit's fix reads and writes one rail at a time, and only in a
      // right-to-left scroller; every other rail shows its arrows in the
      // next stage, with the rest of the page's.
      if (rtl) {
        align(style);
        readShown();
        writeShown();
      } else {
        // A turn to left-to-right drops the shift WebKit's fix left.
        if (shift) own.style.translate = '';
        shift = 0;
        queueLayout(showKey, STAGE.show, { read: readShown, write: writeShown });
      }
    };
    // Measures with every other rail and tab list on the page that measures
    // in this commit or this observer callback, so they share one layout.
    const measureKey = {};
    const showKey = {};
    const measure = () => queueLayout(measureKey, STAGE.measure, { read: readMeasure, write: writeMeasure });

    const tick = (now: number) => {
      if (!resting) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const speed = reduce
        ? EVEN_SPEED
        : START_SPEED + (TOP_SPEED - START_SPEED) * Math.min(1, (now - resting.since) / RAMP_MS);
      // Browsers round a scroll position, so a frame's share under a pixel
      // would be lost each frame on a fast display: carry it to the next.
      resting.carry += speed * (now - resting.last);
      const by = Math.min(room(el, resting.edge, rtl), Math.floor(resting.carry));
      if (by > 0) {
        step(el, resting.edge, rtl, by);
        resting.carry -= by;
      }
      resting.last = now;
      show();
      if (resting) frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      resting = null;
      cancelAnimationFrame(frame);
    };
    // Only a pointer that moves onto an arrow starts it. An arrow that shows
    // up under a pointer left still, as keys or a wheel scroll the list, gets
    // a pointerenter too, and must not pull the list back.
    const enter = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !moved(event, win)) return;
      const edge = (event.currentTarget as HTMLElement).dataset.edge as Edge;
      if (resting?.edge === edge || room(el, edge, rtl) < 1) return;
      const now = performance.now();
      stop();
      resting = { edge, since: now, last: now, carry: 0 };
      frame = requestAnimationFrame(tick);
    };
    // A press on an arrow would focus the scroller, or close what it sits in.
    const press = (event: Event) => event.preventDefault();

    for (const node of own.children) {
      node.addEventListener('pointermove', enter as EventListener);
      node.addEventListener('pointerleave', stop);
      node.addEventListener('pointerdown', press);
      node.addEventListener('mousedown', press);
    }
    el.addEventListener('scroll', show, { passive: true });
    // Firefox can leave a newly focused row under a shown arrow, inside the
    // scrollport, so the scroll padding the arrow adds is honored here too.
    const focused = (event: FocusEvent) => revealRing(el, event.target);
    el.addEventListener('focusin', focused);
    // An overlay shows its popover in its own layout effect, which runs after
    // this one, so on an open the scroller is still display: none here and
    // reads as neither flex nor grid. The batch measures once the commit has
    // shown it, still before the frame, so the rail takes its gap at once
    // rather than in the first resize callback, which would resize the
    // scroller it observes: a second layout in the open's frame, and
    // Chromium's "ResizeObserver loop" report.
    const watch = watchScroller(el, {
      resized: (box) => {
        content = box;
        measure();
      },
      // Children leaving can end the overflow with nothing resized, as when
      // tabs close in a list sized by its container.
      children: measure,
    });
    content = watch.box();
    measure();
    return () => {
      cancelLayout(measureKey);
      cancelLayout(showKey);
      stop();
      watch.stop();
      el.removeEventListener('scroll', show);
      el.removeEventListener('focusin', focused);
      for (const node of own.children) {
        node.removeEventListener('pointermove', enter as EventListener);
        node.removeEventListener('pointerleave', stop);
        node.removeEventListener('pointerdown', press);
        node.removeEventListener('mousedown', press);
      }
    };
  }, [active, edges]);

  if (!mounted) return null;
  return (
    <span ref={rail} aria-hidden="true" data-todae-scroll-edges="" className={styles.rail}>
      {edges.map((edge) => (
        <span key={edge} data-edge={edge} className={styles.edge}>
          <span data-todae-glyph="" className={styles.glyph}>
            {glyphOr(chevron, <ChevronGlyph />)}
          </span>
        </span>
      ))}
    </span>
  );
}
