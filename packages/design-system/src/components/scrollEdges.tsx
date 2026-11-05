import { useLayoutEffect, useRef } from 'react';
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

/**
 * Arrows at each edge of a scroller where its content is cut off. Render it as
 * the scroller's first child: a sticky box of no size keeps the arrows on the
 * scroller's edges while its content moves, in block and flex layouts. An
 * arrow shows only while there is more to scroll toward its edge, and a mouse
 * or pen resting on it scrolls that way, faster the longer it rests. Touch
 * and keys scroll as before, so the arrows are hidden from assistive
 * technology and never take focus.
 */
export function ScrollEdges({ axis }: { axis: ScrollAxis }) {
  const rail = useRef<HTMLSpanElement>(null);
  const { chevron } = useGlyphs();
  const edges = EDGES[axis];

  useLayoutEffect(() => {
    const own = rail.current;
    const el = own?.parentElement;
    if (!own || !el) return;
    let rtl = false;
    let frame = 0;
    let resting: { edge: Edge; since: number; last: number; carry: number } | null = null;

    const show = () => {
      const off = own.hasAttribute('data-off');
      for (const node of own.children) {
        const edge = (node as HTMLElement).dataset.edge as Edge;
        node.toggleAttribute('data-shown', !off && room(el, edge, rtl) >= 1);
      }
      if (resting && room(el, resting.edge, rtl) < 1) stop();
    };
    const measure = () => {
      const style = getComputedStyle(el);
      rtl = style.direction === 'rtl';
      // The rail sits at the content box's start corner; the arrows reach
      // back over the padding to the scrollport's edges.
      own.style.setProperty('--_port-inline', `${el.clientWidth}px`);
      own.style.setProperty('--_port-block', `${el.clientHeight}px`);
      own.style.setProperty('--_pad-inline', `${px(rtl ? style.paddingRight : style.paddingLeft)}px`);
      own.style.setProperty('--_pad-block', `${px(style.paddingTop)}px`);
      // A grid would give the rail a cell of its own and move every item, so
      // a grid scroller shows no arrows; a grid inside the scroller is fine.
      own.toggleAttribute('data-off', style.display.includes('grid'));
      // A flex scroller puts its gap after the rail too; take it back.
      const row = style.display.includes('flex') && !style.flexDirection.startsWith('column');
      own.style.setProperty('--_gap', `${style.display.includes('flex') ? px(row ? style.columnGap : style.rowGap) : 0}px`);
      own.toggleAttribute('data-row', row);
      show();
    };

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
      if (event.pointerType === 'touch' || (!event.movementX && !event.movementY)) return;
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
    measure();

    let resize: ResizeObserver | undefined;
    let mutations: MutationObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      // The scroller's own size, and its content's, which can grow without it.
      const sized = new ResizeObserver(measure);
      resize = sized;
      const watch = () => {
        sized.disconnect();
        sized.observe(el);
        for (const child of el.children) if (child !== own) sized.observe(child);
      };
      watch();
      mutations = new MutationObserver(watch);
      mutations.observe(el, { childList: true });
    }
    return () => {
      stop();
      resize?.disconnect();
      mutations?.disconnect();
      el.removeEventListener('scroll', show);
      for (const node of own.children) {
        node.removeEventListener('pointermove', enter as EventListener);
        node.removeEventListener('pointerleave', stop);
        node.removeEventListener('pointerdown', press);
        node.removeEventListener('mousedown', press);
      }
    };
  }, [edges]);

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
