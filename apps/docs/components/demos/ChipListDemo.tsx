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
const MEASURE_CHIP: CSSProperties = { flex: 'none', maxWidth: 'none' };
const PANEL_GAP = 4;
const PANEL_INSET = 16;

function placeChipPanel(trigger: HTMLElement, panel: HTMLElement) {
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
  const { listRef, measureRef, measured, visible, hidden } = useChipList({ chips, maxRows });
  const [open, setOpen] = useState(false);
  const [panelBox, setPanelBox] = useState<{ top: number; left: number; maxWidth: number } | null>(null);
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
  const shown = open && hidden > 0;

  useLayoutEffect(() => {
    if (!shown) return;
    const trigger = moreRef.current;
    const panel = popover.popoverRef.current;
    if (!trigger || !panel) return;
    const apply = () => {
      const next = placeChipPanel(trigger, panel);
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
            <Chip.Root
              key={chip.key}
              role="listitem"
              style={{ ...CHIP, ...(chip.ellipsis ? { maxWidth: chip.maxWidth } : {}) }}
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
            </Chip.Root>
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
          <Chip.Root key={index} style={MEASURE_CHIP} onDismiss={onRemove ? () => undefined : undefined}>
            {value}
          </Chip.Root>
        ))}
        <Chip.Root style={MEASURE_CHIP} onDismiss={onRemove ? () => undefined : undefined}>
          …
        </Chip.Root>
        <Chip.Overflow style={MEASURE_CHIP} overflowCount={chips.length || 1} />
      </div>
      {open || hidden > 0 ? (
        <Popover.Root
          {...wire}
          role="dialog"
          aria-label={`${hidden} more ${hidden === 1 ? 'tag' : 'tags'}`}
          className="chip-list-panel"
          style={{
            ...wire.style,
            maxWidth: panelBox?.maxWidth ?? 'min(18rem, calc(100vw - 32px))',
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
              style={{ maxWidth: '100%', minWidth: 0 }}
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
            </Chip.Root>
            </HoldFocus>
          ))}
        </Popover.Root>
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
