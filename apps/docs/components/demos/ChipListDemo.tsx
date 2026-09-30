'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Chip, useChipList } from '@tounsoo/todae';

const TAGS = ['design', 'tokens', 'accessibility', 'a-very-long-tag-that-truncates', 'react', 'density', 'dark mode', 'docs'];

// Chip.module.css: line-height 1.25, padding-y, 1px border each side.
const ROW = 'calc(var(--todae-chip-font-size) * 1.25 + 2 * var(--todae-chip-padding-y) + 2px)';
const GAP = 'var(--todae-space-inline-gap)';
const MEASURE: CSSProperties = {
  position: 'absolute',
  inset: '0 auto auto 0',
  display: 'flex',
  visibility: 'hidden',
  pointerEvents: 'none',
  height: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
};

function ChipList({
  label,
  chips,
  maxRows,
  onRemove,
}: {
  label: string;
  chips: readonly string[];
  maxRows: number;
  onRemove: (index: number) => void;
}) {
  const { listRef, measureRef, visible, hidden, measured } = useChipList({ chips, maxRows });
  const removed = useRef<number | null>(null);
  const layoutPass = useRef(0);
  const [ring, setRing] = useState(false);

  // The first layout pass still has the previous fold. Focus after the remeasure.
  useLayoutEffect(() => {
    const index = removed.current;
    if (index == null) return;
    const buttons = listRef.current?.querySelectorAll<HTMLElement>('[role="listitem"] button') ?? [];
    layoutPass.current += 1;
    if (layoutPass.current === 1 && buttons.length === 0 && hidden > 0) return;
    removed.current = null;
    layoutPass.current = 0;
    (buttons[Math.min(index, buttons.length - 1)] ?? listRef.current)?.focus();
  }, [chips, hidden, listRef]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={listRef}
        role="list"
        aria-label={label}
        tabIndex={-1}
        onFocus={(event) => {
          if (event.target === event.currentTarget) setRing(true);
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
          maxHeight: `calc(${ROW} * ${maxRows} + ${GAP} * ${maxRows - 1})`,
          overflow: 'hidden',
          visibility: measured ? undefined : 'hidden',
          outline: ring ? '2px solid var(--todae-chip-ring-focus)' : undefined,
          outlineOffset: ring ? '-2px' : undefined,
        }}
      >
        {visible.map((chip, index) => (
          <Chip
            key={chip.key}
            role="listitem"
            style={chip.ellipsis ? { maxWidth: chip.maxWidth } : undefined}
            onDismiss={() => {
              removed.current = index;
              layoutPass.current = 0;
              onRemove(index);
            }}
          >
            {chip.value}
          </Chip>
        ))}
        {hidden > 0 ? <Chip.Overflow role="listitem" overflowCount={hidden} /> : null}
      </div>
      <div ref={measureRef} aria-hidden inert style={MEASURE}>
        {chips.map((value, index) => (
          <Chip key={index} onDismiss={() => undefined}>
            {value}
          </Chip>
        ))}
        <Chip onDismiss={() => undefined}>…</Chip>
        <Chip.Overflow overflowCount={chips.length || 1} />
      </div>
    </div>
  );
}

export function ChipListDemo({
  maxRows,
  initialChips = TAGS,
}: {
  maxRows: number;
  initialChips?: readonly string[];
}) {
  const [chips, setChips] = useState(initialChips);
  return (
    <div style={{ width: '100%', maxWidth: '18rem', minWidth: 0 }}>
      <ChipList
        label="Tags"
        chips={chips}
        maxRows={maxRows}
        onRemove={(index) => setChips((current) => current.filter((_, i) => i !== index))}
      />
    </div>
  );
}
