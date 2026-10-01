'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Chip, Popover, useChipList, usePopover } from '@tounsoo/todae';

const TAGS = ['design', 'tokens', 'accessibility', 'a-very-long-tag-that-stays-put', 'react', 'density', 'dark mode', 'docs'];

const ROW =
  'calc(var(--todae-chip-font-size) * var(--todae-chip-leading) + 2 * var(--todae-chip-padding-y) + 2 * var(--todae-chip-border-width))';
const GAP = 'var(--todae-space-inline-gap)';
const PAD = 'calc(var(--todae-chip-ring-width) + var(--todae-chip-ring-offset))';
const MEASURE: CSSProperties = {
  position: 'absolute',
  insetInline: 0,
  top: 0,
  width: '100%',
  display: 'flex',
  visibility: 'hidden',
  pointerEvents: 'none',
  height: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};
const CHIP: CSSProperties = { flex: 'none' };
const TABBABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';

type Pending = { where: 'list' | 'popover' | 'popover-empty'; slot?: number };

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

function chipButtons(list: HTMLElement): HTMLElement[] {
  return [...list.children].flatMap((item) => {
    const button = item.querySelector<HTMLElement>('button[aria-label^="Remove"]');
    return button ? [button] : [];
  });
}

function ChipList({
  label,
  chips,
  maxRows,
  onRemove,
}: {
  label: string;
  chips: readonly string[];
  maxRows: number;
  onRemove?: (index: number) => void;
}) {
  const { listRef, measureRef, visible, hidden, measured } = useChipList({ chips, maxRows });
  const [open, setOpen] = useState(false);
  const [ring, setRing] = useState(false);
  const moreRef = useRef<HTMLButtonElement>(null);
  const parked = useRef(false);
  const pending = useRef<Pending | null>(null);
  const moved = useRef<string | null>(null);
  const hiddenNow = useRef(0);
  hiddenNow.current = hidden;

  useLayoutEffect(() => {
    const value = moved.current;
    const list = listRef.current;
    const button =
      value && list
        ? [...list.querySelectorAll('button')].find((el) => el.getAttribute('aria-label') === `Remove ${value}`)
        : undefined;
    if (hidden === 0 && open) {
      moved.current = null;
      parked.current = false;
      (button ?? list)?.focus({ preventScroll: true });
      setOpen(false);
      return;
    }
    if (!value) return;
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

  useLayoutEffect(() => {
    if (!pending.current) return;
    queueMicrotask(() => {
      const job = pending.current;
      pending.current = null;
      parked.current = false;
      const panel = popover.popoverRef.current;
      if (panel) panel.style.outline = '';
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

  useEffect(() => {
    if (!open || hidden === 0) return;
    const panel = popover.popoverRef.current;
    const button = panel?.querySelector('button');
    (button ?? panel)?.focus({ preventScroll: true });
  }, [open, popover.popoverRef]);

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
    <div style={{ position: 'relative' }}>
      <div
        style={{
          overflow: 'hidden',
          padding: PAD,
          margin: `calc(${PAD} * -1)`,
          minHeight: `calc(${ROW} + 2 * ${PAD})`,
          maxHeight: `calc(${ROW} * ${maxRows} + ${GAP} * ${maxRows - 1} + 2 * ${PAD})`,
        }}
      >
        <div
          ref={listRef}
          role="list"
          aria-label={label}
          tabIndex={-1}
          onFocus={(event) => {
            if (event.target !== event.currentTarget || parked.current) return;
            setRing(true);
          }}
          onBlur={(event) => {
            if (event.target === event.currentTarget) setRing(false);
          }}
          style={{
            width: '100%',
            position: 'relative',
            display: 'flex',
            flexWrap: 'wrap',
            alignContent: 'flex-start',
            gap: GAP,
            minHeight: ROW,
            visibility: measured ? undefined : 'hidden',
            outline: ring ? 'var(--todae-chip-ring-width) solid var(--todae-chip-ring-focus)' : undefined,
            outlineOffset: ring ? 'var(--todae-chip-ring-offset)' : undefined,
          }}
        >
          {visible.map((chip, index) => (
            <Chip
              key={chip.key}
              role="listitem"
              style={chip.ellipsis ? { maxWidth: chip.maxWidth } : undefined}
              onDismiss={
                onRemove
                  ? () => {
                      parked.current = true;
                      pending.current = { where: 'list', slot: index };
                      listRef.current?.focus();
                      onRemove(index);
                    }
                  : undefined
              }
            >
              {chip.value}
            </Chip>
          ))}
          {hidden > 0 ? (
            <span role="listitem">
              <button type="button" className="chip-list-more" {...popover.getTriggerProps({ ref: moreRef })}>
                <Chip.Overflow overflowCount={hidden} overflowLabel={(n) => `+${n} more`} />
              </button>
            </span>
          ) : null}
        </div>
      </div>
      <div ref={measureRef} aria-hidden inert style={MEASURE}>
        {chips.map((value, index) => (
          <Chip key={index} style={CHIP} onDismiss={onRemove ? () => undefined : undefined}>
            {value}
          </Chip>
        ))}
        <Chip style={CHIP} onDismiss={onRemove ? () => undefined : undefined}>
          …
        </Chip>
        <Chip.Overflow style={CHIP} overflowCount={chips.length || 1} />
      </div>
      {open || hidden > 0 ? (
        <Popover
          {...wire}
          role="dialog"
          aria-label={`${hidden} more ${hidden === 1 ? 'tag' : 'tags'}`}
          className="chip-list-panel"
          style={{ ...wire.style, maxWidth: '18rem' }}
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
            <Chip
              onDismiss={
                onRemove
                  ? () => {
                      parked.current = true;
                      const panel = popover.popoverRef.current;
                      if (hidden > 1) {
                        pending.current = { where: 'popover', slot: index };
                        if (panel) panel.style.outline = 'none';
                        panel?.focus();
                      } else {
                        pending.current = { where: 'popover-empty' };
                        listRef.current?.focus();
                        setOpen(false);
                      }
                      onRemove(chips.length - hidden + index);
                    }
                  : undefined
              }
            >
              {value}
            </Chip>
            </HoldFocus>
          ))}
        </Popover>
      ) : null}
    </div>
  );
}

export function ChipListDemo({
  maxRows,
  initialChips = TAGS,
  readOnly = false,
}: {
  maxRows: number;
  initialChips?: readonly string[];
  readOnly?: boolean;
}) {
  const [chips, setChips] = useState(initialChips);
  return (
    <div style={{ width: '100%', maxWidth: '18rem', minWidth: 0 }}>
      <ChipList
        label="Tags"
        chips={chips}
        maxRows={maxRows}
        onRemove={readOnly ? undefined : (index) => setChips((current) => current.filter((_, i) => i !== index))}
      />
    </div>
  );
}
