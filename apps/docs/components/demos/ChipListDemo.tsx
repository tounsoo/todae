'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Chip, useChipList } from '@tounsoo/todae';

const TAGS = ['design', 'tokens', 'accessibility', 'a-very-long-tag-that-stays-put', 'react', 'density', 'dark mode', 'docs'];

// 1.25 and 2px mirror Chip's line-height and 1px border on each side in packages/design-system/src/components/Chip.module.css; Chip has no tokens for those yet.
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
        style={{
          // 4px is Chip's 2px ring plus 2px offset from packages/design-system/src/components/Chip.module.css.
          overflow: 'hidden',
          padding: '4px',
          margin: '-4px',
          minHeight: `calc(${ROW} + 8px)`,
          maxHeight: `calc(${ROW} * ${maxRows} + ${GAP} * ${maxRows - 1} + 8px)`,
        }}
      >
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
            visibility: measured ? undefined : 'hidden',
            outline: ring ? '2px solid var(--todae-chip-ring-focus)' : undefined,
            // -2px is Chip's 2px ring offset from Chip.module.css, pulled inside so the list's clip doesn't cut the ring off.
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
