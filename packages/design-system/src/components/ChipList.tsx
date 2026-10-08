import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { useChipList } from '../hooks/useChipList';
import { usePopover } from '../hooks/usePopover';
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
  /** Renders a remove button on each chip. */
  onRemove?: (index: number, value: string) => void;
  /** Remove button name. Default is Remove {value}. */
  dismissLabel?: (value: string) => string;
  /** +N button name. Default is {n} more. */
  overflowLabel?: (n: number) => string;
  /** Name of the popover with the folded chips. Default is {n} more. */
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

const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

type Pending = { where: 'list' | 'popover' | 'popover-empty'; slot?: number };

// The next tabbable control after +N, skipping its own panel.
function focusAfter(el: HTMLElement | null) {
  if (!el) return;
  const panel = document.getElementById(el.getAttribute('aria-controls') ?? '');
  const next = [...document.querySelectorAll<HTMLElement>(TABBABLE)].find((node) => {
    if (node.closest('[inert],[hidden],[disabled]') || node.closest('[aria-hidden="true"]')) return false;
    if (panel?.contains(node)) return false;
    return (el.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  (next ?? el).focus();
}

// Calls onLost when it unmounts holding focus, such as a chip in the panel
// that moves back to the row.
function HoldFocus({ onLost, children }: { onLost: () => void; children: ReactNode }) {
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
  return (
    <span ref={ref} style={{ display: 'contents' }}>
      {children}
    </span>
  );
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
  onRemove,
  dismissLabel,
  overflowLabel,
  panelLabel = (n) => `${n} more`,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledby,
  className,
  style,
  ...props
}: ChipListRootProps) {
  const { listRef, measureRef, measured, visible, hidden } = useChipList({ chips, maxRows });
  const [open, setOpen] = useState(false);
  const [panelBox, setPanelBox] = useState<{ top: number; left: number; maxWidth: number } | null>(null);
  const [ring, setRing] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  // Focus is parked on the list or panel while a removal re-measures, so it
  // never falls to the body.
  const parked = useRef(false);
  const pending = useRef<Pending | null>(null);
  const moved = useRef<string | null>(null);
  const hiddenNow = useRef(0);
  hiddenNow.current = hidden;

  // A focused chip moved from the panel back to the row: focus follows it.
  useLayoutEffect(() => {
    const value = moved.current;
    const list = listRef.current;
    const button =
      value !== null && list
        ? [...list.children].find((item) => item.getAttribute('data-value') === value)?.querySelector('button')
        : undefined;
    if (hidden === 0 && open) {
      moved.current = null;
      parked.current = false;
      (button ?? list)?.focus({ preventScroll: true });
      setOpen(false);
      return;
    }
    if (value === null) return;
    moved.current = null;
    parked.current = false;
    (button ?? moreRef.current)?.focus({ preventScroll: true });
  }, [chips, hidden, listRef, open]);

  const popover = usePopover({
    open: open && hidden > 0,
    onOpenChange: (next) => setOpen(next),
    restoreFocusRef: moreRef,
  });
  const wire = popover.getPopoverProps();
  const tail = chips.slice(chips.length - hidden);
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
  }, [shown, popover.popoverRef, tail.length]);

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
        data-rows={maxRows != null ? '' : undefined}
        style={maxRows != null ? ({ '--_rows': maxRows } as CSSProperties) : undefined}
      >
        <div
          ref={listRef}
          role="list"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby}
          tabIndex={-1}
          className={styles.list}
          data-measuring={measured ? undefined : ''}
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
            <Chip.Root
              key={chip.key}
              role="listitem"
              data-value={chip.value}
              dismissLabel={dismissLabel?.(chip.value)}
              style={chip.ellipsis ? { maxWidth: chip.maxWidth } : undefined}
              onDismiss={
                onRemove
                  ? () => {
                      parked.current = true;
                      pending.current = { where: 'list', slot: index };
                      listRef.current?.focus();
                      onRemove(index, chip.value);
                    }
                  : undefined
              }
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
      <div ref={measureRef} aria-hidden inert className={styles.measure}>
        {chips.map((value, index) => (
          <Chip.Root key={index} onDismiss={onRemove ? () => undefined : undefined}>
            {value}
          </Chip.Root>
        ))}
        <Chip.Root onDismiss={onRemove ? () => undefined : undefined}>…</Chip.Root>
        <Chip.Overflow overflowCount={chips.length || 1} overflowLabel={overflowLabel} />
      </div>
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
          {tail.map((value, index) => (
            <HoldFocus
              key={`${chips.length - hidden + index}:${value}`}
              onLost={() => {
                moved.current = value;
                if (hiddenNow.current > 0) parked.current = true;
                listRef.current?.focus({ preventScroll: true });
              }}
            >
              <Chip.Root
                className={styles.panelChip}
                dismissLabel={dismissLabel?.(value)}
                onDismiss={
                  onRemove
                    ? () => {
                        parked.current = true;
                        const panel = popover.popoverRef.current;
                        const at = chips.length - hidden + index;
                        if (hidden > 1) {
                          pending.current = { where: 'popover', slot: index };
                          panel?.setAttribute('data-parked', '');
                          panel?.focus();
                        } else {
                          pending.current = { where: 'popover-empty' };
                          listRef.current?.focus();
                          setOpen(false);
                        }
                        onRemove(at, value);
                      }
                    : undefined
                }
              >
                {value}
              </Chip.Root>
            </HoldFocus>
          ))}
        </Popover.Root>
      ) : null}
    </div>
  );
}

export const ChipList = { Root } as const;
