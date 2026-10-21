import { useEffect, useRef, type ComponentPropsWithRef, type MouseEvent } from 'react';
import { useAnnouncer } from '../hooks/useAnnouncer.js';
import { useGlyphs } from '../providers/GlyphsProvider.js';
import { useStrings } from '../providers/StringsProvider.js';
import { cx } from './cx.js';
import { glyphOr, SortGlyph } from './glyphs.js';
import { composeHandlers } from './props.js';
import { Body, Caption, Cell, Foot, HeaderCell, Head, Root, Row } from './Table.js';
import styles from './Table.module.css';

export type { TableBodyProps, TableCaptionProps, TableCellProps, TableFootProps, TableHeadProps, TableHeaderCellProps, TableRootProps, TableRowProps, TableSort } from './Table.js';

/**
 * A native `button` for a sortable column: put it inside a `Table.HeaderCell`
 * that takes `sort`, with the column's label as its children. It draws the
 * `sort` glyph after the label, from the header cell's `data-sort`: shown on a
 * sorted column, turned when it is descending, and shown dimmed on hover and
 * focus otherwise. It does not sort; set the cell's `sort` from `onClick`.
 * After a click it announces the column's next `aria-sort` or `data-sort` change.
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

function SortButton({ className, children, onClick, ...props }: TableSortButtonProps) {
  const { sort } = useGlyphs();
  const strings = useStrings();
  const announce = useAnnouncer();
  const watcher = useRef<MutationObserver | null>(null);
  useEffect(() => () => watcher.current?.disconnect(), []);

  const watch = (event: MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    const cell = button.closest('th');
    if (!cell) return;
    watcher.current?.disconnect();
    const observer = new MutationObserver(() => {
      observer.disconnect();
      const { sortedAscending, sortedDescending, sortCleared } = strings;
      const column = columnName(button);
      const say = { ascending: sortedAscending, descending: sortedDescending, none: sortCleared }[sortOf(cell)];
      announce(say(column));
    });
    observer.observe(cell, { attributes: true, attributeFilter: ['aria-sort', 'data-sort'] });
    watcher.current = observer;
  };

  return (
    <button type="button" {...props} className={cx(styles.sortButton, className)} onClick={composeHandlers(onClick, watch)}>
      {children}
      <span className={styles.sortGlyph} data-todae-glyph="" aria-hidden="true">
        {glyphOr(sort, <SortGlyph />)}
      </span>
    </button>
  );
}

/** The server entry's parts and the sort button, which needs hooks. */
export const Table = { Root, Caption, Head, Body, Foot, Row, HeaderCell, Cell, SortButton } as const;
