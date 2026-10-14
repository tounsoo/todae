import {
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
  type UIEvent,
} from 'react';
import { useDomId } from './domId';
import styles from './Field.module.css';

export type FieldTextareaHighlight = {
  /** Index of the range's first character. */
  start: number;
  /** Index just past its last character. */
  end: number;
  /** Set as `data-kind` on the range, to style kinds apart, such as mentions and commands. */
  kind?: string;
  /** A CSS anchor name for the range, so a popover can sit at it. */
  anchorName?: string;
  /** Draws the range as a token. Default true; false keeps only its anchor. */
  draw?: boolean;
};

/**
 * What lays out text in a textarea. The layer copies these from the textarea,
 * so a company class that changes its type or padding moves the tokens too.
 */
const COPIED = [
  'box-sizing',
  'padding-top',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'border-top-width',
  'border-bottom-width',
  'border-left-width',
  'border-right-width',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'font-stretch',
  'font-variant',
  'font-feature-settings',
  'font-variation-settings',
  'font-kerning',
  'font-optical-sizing',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-indent',
  'text-transform',
  'text-align',
  'tab-size',
  'white-space',
  'word-break',
  'overflow-wrap',
  'hyphens',
  'direction',
  'unicode-bidi',
  'writing-mode',
] as const;

function px(value: string): number {
  return Number.parseFloat(value) || 0;
}

/** Keeps the layer's text laid out and scrolled like the textarea's. */
export function useTextareaHighlights(
  textarea: RefObject<HTMLTextAreaElement | null>,
  enabled: boolean,
): { ref: Ref<HTMLDivElement>; anchorName: string; onScroll: (event: UIEvent<HTMLTextAreaElement>) => void } {
  const anchorName = `--todae-textarea-${useDomId()}`;
  const layer = useRef<HTMLDivElement | null>(null);

  const scroll = useCallback(() => {
    const el = textarea.current;
    const div = layer.current;
    if (!el || !div) return;
    div.scrollTop = el.scrollTop;
    div.scrollLeft = el.scrollLeft;
  }, [textarea]);

  // Runs after every render, since an edit can change the direction (`dir="auto"`)
  // or show a scrollbar, and when the textarea changes size.
  const sync = useCallback(() => {
    const el = textarea.current;
    const div = layer.current;
    if (!el || !div) return;
    const view = el.ownerDocument.defaultView;
    if (!view) return;
    const computed = view.getComputedStyle(el);
    for (const property of COPIED) div.style.setProperty(property, computed.getPropertyValue(property));
    // A scrollbar takes room from the textarea's text, not from the layer's.
    const borders = px(computed.borderLeftWidth) + px(computed.borderRightWidth);
    const scrollbar = Math.max(0, el.offsetWidth - el.clientWidth - borders);
    const side = computed.direction === 'rtl' ? 'padding-left' : 'padding-right';
    div.style.setProperty(side, `${px(computed.getPropertyValue(side)) + scrollbar}px`);
    scroll();
  }, [scroll, textarea]);

  useLayoutEffect(() => {
    const el = textarea.current;
    if (!enabled || !el) return;
    sync();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => sync());
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, sync, textarea]);

  useLayoutEffect(() => {
    if (enabled) sync();
  });

  const onScroll = useCallback(() => {
    if (enabled) scroll();
  }, [enabled, scroll]);

  return { ref: layer, anchorName, onScroll };
}

/** The ranges in order, without overlaps, inside the text. */
function ordered(text: string, highlights: readonly FieldTextareaHighlight[]): FieldTextareaHighlight[] {
  const kept: FieldTextareaHighlight[] = [];
  for (const range of [...highlights].sort((a, b) => a.start - b.start)) {
    const start = Math.max(0, range.start);
    const end = Math.min(text.length, range.end);
    const last = kept[kept.length - 1];
    if (end <= start || (last && start < last.end)) continue;
    kept.push({ ...range, start, end });
  }
  return kept;
}

/**
 * A copy of the textarea's text, without its color, sitting behind it, where
 * each range is a span that draws a token. It is hidden from screen readers:
 * the textarea holds the text.
 */
export function TextareaHighlights({
  ref,
  anchorName,
  value,
  highlights,
}: {
  ref: Ref<HTMLDivElement>;
  anchorName: string;
  value: string;
  highlights: readonly FieldTextareaHighlight[];
}) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const range of ordered(value, highlights)) {
    if (range.start > at) parts.push(value.slice(at, range.start));
    parts.push(
      <span
        key={range.anchorName ?? `${range.start}:${range.end}`}
        className={range.draw === false ? undefined : styles.token}
        data-kind={range.kind}
        style={range.anchorName ? ({ anchorName: range.anchorName } as CSSProperties) : undefined}
      >
        {value.slice(range.start, range.end)}
      </span>,
    );
    at = range.end;
  }
  // A last line break gets its line, as it does in the textarea.
  parts.push(`${value.slice(at)}\u200b`);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={styles.highlights}
      style={{ positionAnchor: anchorName } as CSSProperties}
    >
      {parts}
    </div>
  );
}
