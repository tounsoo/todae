import { useEffect, useRef, type ComponentPropsWithRef, type MouseEvent } from 'react';
import { useAnnouncer } from '../hooks/useAnnouncer.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { cx } from './cx.js';
import { glyphOr, SortGlyph } from './glyphs.js';
import { Body, Caption, Cell, Foot, HeaderCell, Head, Root, Row } from './Table.js';
import styles from './Table.module.css';

export type { TableBodyProps, TableCaptionProps, TableCellProps, TableFootProps, TableHeadProps, TableHeaderCellProps, TableRootProps, TableRowProps, TableSort } from './Table.js';

/**
 * A native `button` for a sortable column: put it inside a `Table.HeaderCell`
 * that takes `sort`, with the column's label as its children. It draws the
 * `sort` glyph after the label, from the header cell's `data-sort`: shown on a
 * sorted column, turned when it is descending, and dimmed when unsorted; on
 * a device with a hovering pointer it shows only on hover or focus. It does
 * not sort; set the cell's `sort` from `onClick`. After a click it announces
 * the column's next `aria-sort` or `data-sort` change, if it comes before the
 * user's next press or key; a lone modifier key doesn't count.
 */
export type TableSortButtonProps = ComponentPropsWithRef<'button'>;

/** What a header cell's sort attributes say: `aria-sort` for a sorted column, else none. */
function sortOf(cell: Element): 'ascending' | 'descending' | 'none' {
  const value = cell.getAttribute('aria-sort');
  return value === 'ascending' || value === 'descending' ? value : 'none';
}

/** The column's name: the button's `aria-label`, else its text without the glyph. */
function columnName(button: HTMLElement): string {
  const label = button.getAttribute('aria-label')?.trim();
  if (label) return label;
  const copy = button.cloneNode(true) as HTMLElement;
  for (const glyph of copy.querySelectorAll('[data-todae-glyph]')) glyph.remove();
  return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
}

type Stop = () => void;

// One sort announcement waits per table, so a click on another column's
// button drops the wait of the last one.
const waiting = /* @__PURE__ */ new WeakMap<Element, Stop>();

const USER_ACTIONS = ['pointerdown', 'keydown'] as const;
// Insert and CapsLock are the NVDA and JAWS keys.
const MODIFIER_KEYS = /* @__PURE__ */ new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'OS', 'Super', 'Hyper', 'Fn', 'FnLock', 'Symbol', 'SymbolLock', 'CapsLock', 'NumLock', 'ScrollLock', 'Insert']);

function SortButton({ className, children, onClick, ...props }: TableSortButtonProps) {
  const { sort } = useGlyphs();
  const strings = useStrings();
  const announce = useAnnouncer();
  const stopRef = useRef<Stop | null>(null);
  useEffect(() => () => stopRef.current?.(), []);

  // Waits for the cell's next sort change and announces it, until the user
  // presses or types anything else, so a click that sorted nothing can't
  // claim a change made later by other means.
  const wait = (cell: HTMLTableCellElement, button: HTMLButtonElement): Stop => {
    const doc = cell.ownerDocument;
    const stop = () => {
      observer.disconnect();
      for (const type of USER_ACTIONS) doc.removeEventListener(type, onAction, true);
    };
    // A lone modifier, such as Control to quiet a screen reader, is not a new action.
    const onAction = (event: Event) => {
      if ('key' in event && ((event as KeyboardEvent).repeat || MODIFIER_KEYS.has((event as KeyboardEvent).key))) return;
      stop();
    };
    const observer = new MutationObserver(() => {
      stop();
      const { sortedAscending, sortedDescending, sortCleared } = strings;
      const say = { ascending: sortedAscending, descending: sortedDescending, none: sortCleared }[sortOf(cell)];
      announce(say(columnName(button)));
    });
    observer.observe(cell, { attributes: true, attributeFilter: ['aria-sort', 'data-sort'] });
    for (const type of USER_ACTIONS) doc.addEventListener(type, onAction, true);
    return stop;
  };

  // Starts waiting before the product's handler runs, so a sort committed
  // inside it, such as with flushSync, is still seen; replaces the table's
  // earlier wait only when the product did not prevent the click.
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const preventedBefore = event.defaultPrevented;
    const cell = event.currentTarget.closest('th');
    const stop = cell ? wait(cell, event.currentTarget) : null;
    onClick?.(event);
    if (!cell || !stop) return;
    if (!preventedBefore && event.defaultPrevented) {
      stop();
      return;
    }
    const table = cell.closest('table') ?? cell;
    waiting.get(table)?.();
    waiting.set(table, stop);
    stopRef.current = stop;
  };

  return (
    <button type="button" {...props} className={cx(styles.sortButton, className)} onClick={handleClick}>
      {children}
      <span className={styles.sortGlyph} data-todae-glyph="" aria-hidden="true">
        {glyphOr(sort, <SortGlyph />)}
      </span>
    </button>
  );
}

/** The server entry's parts and the sort button, which needs hooks. */
export const Table = { Root, Caption, Head, Body, Foot, Row, HeaderCell, Cell, SortButton } as const;
