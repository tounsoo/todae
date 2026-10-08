import {
  Component,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
} from 'react';
import { useChipListInternal } from '../hooks/useChipList';
import { usePopover } from '../hooks/usePopover';
import { isReachable } from '../hooks/useRovingFocus';
import { getTabbables } from '../overlay/tabbables';
import { Chip } from './Chip';
import { useChipKeys } from './chipKeys';
import { Popover } from './Popover';
import styles from './ChipList.module.css';

/**
 * A read-only or removable list of chips that folds the ones past `maxRows`
 * into a +N button. +N opens a popover with the rest. Name the list with
 * `aria-label` or `aria-labelledby`.
 */
export type ChipListRootProps = {
  chips: readonly string[];
  /** Rows to show before folding the rest into +N. Without it, every chip wraps onto as many rows as it needs. */
  maxRows?: number;
  /**
   * A stable, unique key for each chip, so focus can follow it when chips
   * change. Without it, chips are matched by value, so focus can land on
   * another chip with the same value.
   */
  getKey?: (value: string, index: number) => string;
  /** Renders a remove button on each chip. */
  onRemove?: (index: number, value: string) => void;
  /** Remove button name. Default is Remove {value}. */
  dismissLabel?: (value: string) => string;
  /** +N button name. Default is {n} more. */
  overflowLabel?: (n: number) => string;
  /** Name of the popover with the folded chips. Default is {n} more chips, or 1 more chip. */
  panelLabel?: (n: number) => string;
} & Omit<ComponentPropsWithRef<'div'>, 'children'>;

// The next tabbable control after +N, skipping its own panel. The costly
// visibility check runs last, on candidates after +N only.
function focusAfter(el: HTMLElement | null) {
  if (!el) return;
  const panel = document.getElementById(el.getAttribute('aria-controls') ?? '');
  const next = getTabbables(document.body).find(
    (node) =>
      (el.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
      !panel?.contains(node) &&
      !node.closest('[aria-hidden="true"]') &&
      // Not rendered, such as inside a closed popover.
      isReachable(node),
  );
  (next ?? el).focus();
}

// What can hold focus in one render: chip keys in the row and in the open panel.
type Layout = {
  row: readonly string[];
  /** null while the panel is closed: its chips cannot hold focus. */
  panel: readonly string[] | null;
  more: boolean;
  removable: boolean;
};

// What had focus before a commit, and where.
type Spot =
  | { kind: 'chip'; key: string; in: 'row' | 'panel'; slot: number }
  | { kind: 'more'; slot: number }
  | { kind: 'panel' };

// The keys both lists hold are in the same order, so React moves no node.
function sameOrder(a: readonly string[], b: readonly string[]): boolean {
  const inA = new Set(a);
  const inB = new Set(b);
  const x = a.filter((key) => inB.has(key));
  const y = b.filter((key) => inA.has(key));
  return x.every((key, i) => key === y[i]);
}

// The focused node stays in the DOM, unmoved and focusable, through this commit.
function stays(spot: Spot, prev: Layout, next: Layout): boolean {
  if (spot.kind === 'more') return next.more;
  if (spot.kind === 'panel') return next.panel != null;
  if (!next.removable) return false;
  const from = spot.in === 'row' ? prev.row : (prev.panel ?? []);
  const to = spot.in === 'row' ? next.row : next.panel;
  return to != null && to.includes(spot.key) && sameOrder(from, to);
}

// When React removes or moves a focused node, the browser drops focus to the
// body and fires focusout with no relatedTarget. getSnapshotBeforeUpdate is
// the one hook that runs before React touches the DOM, so park runs there.
// React dispatches no events then, so the list's onFocus does not fire.
class FocusGuard extends Component<{ layout: Layout; park: (prev: Layout, next: Layout) => void }> {
  getSnapshotBeforeUpdate(prev: Readonly<{ layout: Layout }>) {
    this.props.park(prev.layout, this.props.layout);
    return null;
  }

  // React wants componentDidUpdate next to getSnapshotBeforeUpdate.
  componentDidUpdate() {}

  render() {
    return null;
  }
}

// The remove buttons of the chips directly in box, in order.
function buttons(box: Element | null | undefined): HTMLElement[] {
  return box ? [...box.querySelectorAll<HTMLElement>(':scope > [data-key] > button')] : [];
}

function buttonFor(box: Element | null | undefined, key: string): HTMLElement | null {
  const item = box ? [...box.children].find((el) => el.getAttribute('data-key') === key) : undefined;
  return item?.querySelector('button') ?? null;
}

function Root({
  chips,
  maxRows,
  getKey,
  onRemove,
  dismissLabel,
  overflowLabel,
  panelLabel = (n) => `${n} more ${n === 1 ? 'chip' : 'chips'}`,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  'aria-describedby': ariaDescribedby,
  'aria-details': ariaDetails,
  className,
  style,
  ...props
}: ChipListRootProps) {
  // Whole rows only, and at least one, as useChipList counts them; anything
  // else is no limit, so the clamp never hides chips that +N does not count.
  const rows = maxRows != null && maxRows >= 1 ? Math.floor(maxRows) : undefined;
  const { listRef, measureRef, measured, visible, hidden, settled } = useChipListInternal({ chips, maxRows: rows });
  const { keys, press } = useChipKeys(chips, getKey);
  const [open, setOpen] = useState(false);
  // Nothing left to fold: the panel closes, and stays closed if chips fold again.
  if (open && hidden === 0) setOpen(false);
  const shown = open && hidden > 0;
  const [ring, setRing] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const popover = usePopover({ open: shown, onOpenChange: setOpen, restoreFocusRef: moreRef });
  const row = keys.slice(0, visible.length);
  const layout: Layout = {
    row,
    panel: shown ? keys.slice(visible.length) : null,
    more: hidden > 0,
    removable: onRemove != null,
  };

  // Where focus was when a commit was about to take its node out of the
  // DOM. Focus waits on the list until the commit is measured.
  const parked = useRef<Spot | null>(null);

  const park = (prev: Layout, next: Layout) => {
    const list = listRef.current;
    const panel = popover.popoverRef.current;
    const active = document.activeElement;
    if (parked.current || !list || !(active instanceof HTMLElement)) return;
    let spot: Spot | null = null;
    if (active === moreRef.current) spot = { kind: 'more', slot: prev.row.length };
    else if (panel && active === panel) spot = { kind: 'panel' };
    else {
      const item = active.closest('[data-key]');
      const key = item?.getAttribute('data-key');
      if (item && key != null && item.parentElement === list) {
        spot = { kind: 'chip', key, in: 'row', slot: prev.row.indexOf(key) };
      } else if (item && key != null && panel && item.parentElement === panel) {
        spot = { kind: 'chip', key, in: 'panel', slot: (prev.panel ?? []).indexOf(key) };
      }
    }
    if (!spot || stays(spot, prev, next)) return;
    parked.current = spot;
    list.focus({ preventScroll: true });
  };

  // After the commit, once the fold is measured for these chips: the same
  // chip (or +N, or the open panel), else +N if the chip folded into the
  // closed panel, else the chip now in its slot or the last one before it,
  // else +N, else the list. A chip that leaves the panel as it closes
  // leaves to the last chip in the row.
  // Runs after every commit, and after useChipListInternal's own effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const spot = parked.current;
    const list = listRef.current;
    if (!spot || !list || !settled()) return;
    parked.current = null;
    const panel = shown ? popover.popoverRef.current : null;
    const more = moreRef.current;
    const active = document.activeElement;
    // Something else took focus meanwhile: leave it there.
    if (active !== list && !list.contains(active) && !panel?.contains(active)) return;
    let target: HTMLElement | null;
    if (spot.kind === 'more') target = more;
    else if (spot.kind === 'panel') target = panel;
    else {
      target = buttonFor(list, spot.key) ?? buttonFor(panel, spot.key);
      // Folded into the closed panel: +N is the way to it.
      if (!target && keys.includes(spot.key) && !row.includes(spot.key)) target = more;
    }
    if (!target) {
      const inPanel = spot.kind === 'chip' && spot.in === 'panel' ? buttons(panel) : [];
      const seq = inPanel.length > 0 ? inPanel : buttons(list);
      const toEnd = spot.kind === 'panel' || (spot.kind === 'chip' && spot.in === 'panel' && inPanel.length === 0);
      const slot = toEnd ? seq.length - 1 : spot.slot;
      target = seq[Math.min(slot, seq.length - 1)] ?? more ?? list;
    }
    if (target !== active) target.focus();
    if (target === list) setRing(true);
  });

  // Tab past either end of the panel closes it: forward continues after +N,
  // backward returns to +N.
  useEffect(() => {
    if (!shown) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const panel = popover.popoverRef.current;
      if (!(event.target instanceof Node) || !panel?.contains(event.target)) return;
      const all = [...panel.querySelectorAll<HTMLElement>('button:not([disabled])')];
      const edge = event.shiftKey ? all[0] : all[all.length - 1];
      if (event.target !== panel && all.length > 0 && event.target !== edge) return;
      event.preventDefault();
      if (event.shiftKey) moreRef.current?.focus();
      else focusAfter(moreRef.current);
      setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, popover.popoverRef]);

  const removeAt = (index: number, value: string, box: Element | null) => {
    press(index);
    // A click does not focus a button in every browser (Safari). Focus the
    // pressed button, so focus moves on when its chip leaves.
    const item = box ? [...box.children].find((el) => el.getAttribute('data-key') === keys[index]) : undefined;
    if (item && !item.contains(document.activeElement)) item.querySelector('button')?.focus({ preventScroll: true });
    onRemove?.(index, value);
  };

  const wire = popover.getPopoverProps();
  return (
    <div {...props} className={[styles.root, className].filter(Boolean).join(' ')} style={style}>
      <FocusGuard layout={layout} park={park} />
      <div
        className={styles.clip}
        data-rows={rows != null ? '' : undefined}
        style={rows != null ? ({ '--_rows': rows } as CSSProperties) : undefined}
      >
        <div
          ref={listRef}
          role="list"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          aria-describedby={ariaDescribedby}
          aria-details={ariaDetails}
          tabIndex={-1}
          className={styles.list}
          data-measuring={rows != null && !measured ? '' : undefined}
          data-ring={ring ? '' : undefined}
          onFocus={(event) => {
            if (event.target === event.currentTarget) setRing(true);
          }}
          onBlur={(event) => {
            if (event.target === event.currentTarget) setRing(false);
          }}
        >
          {visible.map((chip, index) => (
            <Chip.Root
              key={keys[index]}
              role="listitem"
              data-key={keys[index]}
              data-value={chip.value}
              data-index={index}
              dismissLabel={dismissLabel?.(chip.value)}
              style={chip.ellipsis ? { maxWidth: chip.maxWidth } : undefined}
              onDismiss={onRemove ? () => removeAt(index, chip.value, listRef.current) : undefined}
            >
              {chip.value}
            </Chip.Root>
          ))}
          {hidden > 0 ? (
            <span role="listitem">
              <button type="button" className={styles.more} {...popover.getTriggerProps({ ref: moreRef })}>
                <Chip.Overflow overflowCount={hidden} overflowLabel={overflowLabel} />
              </button>
            </span>
          ) : null}
        </div>
      </div>
      {rows != null ? (
        // Read by useChipList only when there is a row limit.
        <div ref={measureRef} aria-hidden inert className={styles.measure}>
          {chips.map((value, index) => (
            <Chip.Root key={index} onDismiss={onRemove ? () => undefined : undefined}>
              {value}
            </Chip.Root>
          ))}
          <Chip.Root onDismiss={onRemove ? () => undefined : undefined}>…</Chip.Root>
          <Chip.Overflow overflowCount={chips.length || 1} overflowLabel={overflowLabel} />
        </div>
      ) : null}
      {hidden > 0 ? (
        <Popover.Root {...wire} role="dialog" aria-label={panelLabel(hidden)} className={styles.panel}>
          {chips.slice(visible.length).map((value, i) => {
            const at = visible.length + i;
            return (
              <Chip.Root
                key={keys[at]}
                data-key={keys[at]}
                data-value={value}
                data-index={at}
                className={styles.panelChip}
                dismissLabel={dismissLabel?.(value)}
                onDismiss={onRemove ? () => removeAt(at, value, popover.popoverRef.current) : undefined}
              >
                {value}
              </Chip.Root>
            );
          })}
        </Popover.Root>
      ) : null}
    </div>
  );
}

export const ChipList = { Root } as const;
