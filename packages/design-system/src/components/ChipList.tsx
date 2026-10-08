import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { useChipList } from '../hooks/useChipList';
import { usePopover } from '../hooks/usePopover';
import { isReachable } from '../hooks/useRovingFocus';
import { getTabbables } from '../overlay/tabbables';
import { Chip } from './Chip';
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
   * change. Default is the value, numbered among chips with the same value.
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

const PANEL_GAP = 4;
const PANEL_INSET = 16;

// Keeps the panel 16px inside the viewport and flips it above +N when
// there is no room below.
function placePanel(trigger: HTMLElement, panel: HTMLElement) {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  if (vw <= 0 || vh <= 0) return null;
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const maxWidth = Math.max(0, Math.min(18 * rem, vw - PANEL_INSET * 2));
  panel.style.maxWidth = `${maxWidth}px`;
  const anchor = trigger.getBoundingClientRect();
  const rect = panel.getBoundingClientRect();
  let left = anchor.left;
  const maxLeft = vw - PANEL_INSET - rect.width;
  if (left > maxLeft) left = maxLeft;
  if (left < PANEL_INSET) left = PANEL_INSET;
  const spaceBelow = vh - anchor.bottom - PANEL_GAP;
  let top = rect.height > spaceBelow ? anchor.top - PANEL_GAP - rect.height : anchor.bottom + PANEL_GAP;
  if (top < 0) top = 0;
  if (top + rect.height > vh) top = Math.max(0, vh - rect.height);
  return { top, left, maxWidth };
}

type Pending = { where: 'list' | 'popover' | 'popover-empty'; slot?: number };

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

// The value, numbered among chips with the same value: 'a', 'a#1', 'a#2'.
function keyByValue(chips: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return chips.map((value) => {
    const n = seen.get(value) ?? 0;
    seen.set(value, n + 1);
    return n === 0 ? value : `${value}#${n}`;
  });
}

// Calls onLost when its element unmounts holding focus, before the browser
// drops focus to the body: a chip removed, or moved between the row and the
// panel.
function Held({ onLost, children }: { onLost: () => void; children: (ref: RefObject<HTMLSpanElement | null>) => ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const lost = useRef(onLost);
  lost.current = onLost;
  useLayoutEffect(() => {
    const node = ref.current;
    return () => {
      const active = document.activeElement;
      if (!(active instanceof Node) || !node?.contains(active)) return;
      lost.current();
    };
  }, []);
  return children(ref);
}

// A click does not focus a button in every browser (Safari). Focus the
// pressed remove button, so focus moves on when its chip leaves.
function holdOn(chip: HTMLElement | null) {
  if (!chip || chip.contains(document.activeElement)) return;
  chip.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
}

// The remove buttons of the chips in the row, in order.
function chipButtons(list: HTMLElement): HTMLElement[] {
  return [...list.children].flatMap((item) => {
    const button = item.hasAttribute('data-value') ? item.querySelector<HTMLElement>('button') : null;
    return button ? [button] : [];
  });
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
  const { listRef, measureRef, measured, visible, hidden } = useChipList({ chips, maxRows: rows });
  const [open, setOpen] = useState(false);
  const [panelBox, setPanelBox] = useState<{ top: number; left: number; maxWidth: number } | null>(null);
  const [ring, setRing] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  // Focus is parked on the list or panel while a removal re-measures, so it
  // never falls to the body.
  const parked = useRef(false);
  const keys = getKey ? chips.map((value, index) => getKey(value, index)) : keyByValue(chips);
  // A focused chip that unmounts was removed once its key is gone from chips,
  // whenever the owner drops it. Otherwise it moved between the row and the
  // panel, and focus follows its key.
  const keysNow = useRef(new Set(keys));
  keysNow.current = new Set(keys);
  const pending = useRef<Pending | null>(null);
  const moved = useRef<string | null>(null);

  // A focused chip moved from the panel back to the row: focus follows it.
  useLayoutEffect(() => {
    const chip = moved.current;
    const list = listRef.current;
    const match = chip === null || !list ? undefined : [...list.children].find((item) => item.getAttribute('data-key') === chip);
    const button = match?.querySelector('button');
    // Nothing to follow: focus stays on the list, with its ring.
    const onList = () => {
      list?.focus({ preventScroll: true });
      setRing(true);
    };
    if (hidden === 0 && open) {
      moved.current = null;
      parked.current = false;
      if (button) button.focus({ preventScroll: true });
      else onList();
      setOpen(false);
      return;
    }
    if (chip === null) return;
    moved.current = null;
    parked.current = false;
    const next = button ?? moreRef.current;
    if (next) next.focus({ preventScroll: true });
    else onList();
  }, [chips, hidden, listRef, open]);

  const popover = usePopover({
    open: open && hidden > 0,
    onOpenChange: (next) => setOpen(next),
    restoreFocusRef: moreRef,
  });
  const wire = popover.getPopoverProps();
  const tail = chips.slice(chips.length - hidden);
  const tailKey = tail.join('\n');
  const shown = open && hidden > 0;

  useLayoutEffect(() => {
    if (!shown) return;
    const trigger = moreRef.current;
    const panel = popover.popoverRef.current;
    if (!trigger || !panel) return;
    const apply = () => {
      const next = placePanel(trigger, panel);
      if (!next) return;
      setPanelBox((prev) =>
        prev && prev.top === next.top && prev.left === next.left && prev.maxWidth === next.maxWidth ? prev : next,
      );
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('scroll', apply, true);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', apply, true);
    };
  }, [shown, popover.popoverRef, tailKey]);

  // After a removal re-measures: the chip that now fills the slot, else the
  // previous one, else the list.
  useLayoutEffect(() => {
    if (!pending.current) return;
    queueMicrotask(() => {
      const job = pending.current;
      pending.current = null;
      parked.current = false;
      const panel = popover.popoverRef.current;
      panel?.removeAttribute('data-parked');
      if (!job) return;
      const list = listRef.current;
      if (job.where === 'list' && list) {
        const slot = job.slot ?? 0;
        const buttons = chipButtons(list);
        const next = buttons[slot] ?? buttons[slot - 1];
        if (next) next.focus();
        else {
          list.focus();
          setRing(true);
        }
        return;
      }
      if (job.where === 'popover' && panel) {
        const buttons = [...panel.querySelectorAll<HTMLElement>('button')];
        const slot = job.slot ?? 0;
        (buttons[slot] ?? buttons[slot - 1])?.focus();
        return;
      }
      const last = list ? chipButtons(list).at(-1) : undefined;
      if (last) last.focus();
      else if (list) {
        list.focus();
        setRing(true);
      }
    });
  }, [chips, listRef, popover.popoverRef]);

  const hasHidden = hidden > 0;
  useEffect(() => {
    if (!open || !hasHidden) return;
    const panel = popover.popoverRef.current;
    const button = panel?.querySelector('button');
    (button ?? panel)?.focus({ preventScroll: true });
  }, [open, hasHidden, popover.popoverRef]);

  // Tab past either end of the panel closes it: forward continues after +N,
  // backward returns to +N.
  useEffect(() => {
    if (!open || hidden === 0) return;
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const panel = popover.popoverRef.current;
      if (!(event.target instanceof Node) || !panel?.contains(event.target)) return;
      const buttons = [...panel.querySelectorAll<HTMLElement>('button:not([disabled])')];
      const edge = event.shiftKey ? buttons[0] : buttons[buttons.length - 1];
      if (event.target !== panel && buttons.length > 0 && event.target !== edge) return;
      event.preventDefault();
      if (event.shiftKey) moreRef.current?.focus();
      else focusAfter(moreRef.current);
      setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hidden, open, popover.popoverRef]);

  return (
    <div {...props} className={[styles.root, className].filter(Boolean).join(' ')} style={style}>
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
            if (event.target !== event.currentTarget || parked.current) return;
            setRing(true);
          }}
          onBlur={(event) => {
            if (event.target === event.currentTarget) setRing(false);
          }}
        >
          {visible.map((chip, index) => (
            <Held
              key={keys[index]}
              onLost={() => {
                parked.current = true;
                listRef.current?.focus({ preventScroll: true });
                if (keysNow.current.has(keys[index]!)) moved.current = keys[index]!;
                else pending.current = { where: 'list', slot: index };
              }}
            >
              {(ref) => (
                <Chip.Root
                  ref={ref}
                  role="listitem"
                  data-key={keys[index]}
                  data-value={chip.value}
                  data-index={index}
                  dismissLabel={dismissLabel?.(chip.value)}
                  style={chip.ellipsis ? { maxWidth: chip.maxWidth } : undefined}
                  onDismiss={
                    onRemove
                      ? () => {
                          holdOn(ref.current);
                          onRemove(index, chip.value);
                        }
                      : undefined
                  }
                >
                  {chip.value}
                </Chip.Root>
              )}
            </Held>
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
      {open || hidden > 0 ? (
        <Popover.Root
          {...wire}
          role="dialog"
          aria-label={panelLabel(hidden)}
          className={styles.panel}
          style={{
            ...wire.style,
            maxWidth: panelBox?.maxWidth,
            positionTryFallbacks: panelBox ? 'none' : undefined,
            top: panelBox?.top,
            left: panelBox?.left,
          }}
        >
          {tail.map((value, index) => {
            const at = chips.length - hidden + index;
            return (
              <Held
                key={keys[at]}
                onLost={() => {
                  if (!keysNow.current.has(keys[at]!)) {
                    parked.current = true;
                    if (hidden > 1) {
                      pending.current = { where: 'popover', slot: index };
                      const panel = popover.popoverRef.current;
                      panel?.setAttribute('data-parked', '');
                      panel?.focus({ preventScroll: true });
                    } else {
                      pending.current = { where: 'popover-empty' };
                      listRef.current?.focus({ preventScroll: true });
                      setOpen(false);
                    }
                    return;
                  }
                  moved.current = keys[at]!;
                  parked.current = true;
                  listRef.current?.focus({ preventScroll: true });
                }}
              >
                {(ref) => (
                  <Chip.Root
                    ref={ref}
                    className={styles.panelChip}
                    dismissLabel={dismissLabel?.(value)}
                    onDismiss={
                      onRemove
                        ? () => {
                            holdOn(ref.current);
                            onRemove(at, value);
                          }
                        : undefined
                    }
                  >
                    {value}
                  </Chip.Root>
                )}
              </Held>
            );
          })}
        </Popover.Root>
      ) : null}
    </div>
  );
}

export const ChipList = { Root } as const;
