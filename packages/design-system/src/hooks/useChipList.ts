import { useRef, type RefObject } from 'react';
import { useChipMeasure } from '../components/useChipMeasure';

export type UseChipListOptions = {
  chips: readonly string[];
  maxRows?: number;
  /** Element whose computed min-width stays free on the last line (inline Field.ChipInput's input). */
  reserveWidth?: RefObject<HTMLElement | null>;
};

export type UseChipListItem = {
  key: string;
  value: string;
  ellipsis?: true;
  maxWidth?: number;
};

export type UseChipListResult = {
  listRef: RefObject<HTMLDivElement | null>;
  measureRef: RefObject<HTMLDivElement | null>;
  visible: readonly UseChipListItem[];
  hidden: number;
  measured: boolean;
};

export function useChipList(options: UseChipListOptions): UseChipListResult {
  const { settled: _, ...result } = useChipListInternal(options);
  return result;
}

/**
 * Not re-exported from the package index. `settled()`, read in a layout
 * effect after this hook, is false while a measure is about to re-render.
 */
export function useChipListInternal({
  chips,
  maxRows,
  reserveWidth,
}: UseChipListOptions): UseChipListResult & { settled: () => boolean } {
  const listRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const plan = useChipMeasure({ chips, maxRows, flowRef: listRef, measureRef, inputRef: reserveWidth });
  const hidden = maxRows == null ? 0 : Math.min(plan.hidden, chips.length);
  const count = chips.length - hidden;
  const visible = chips.slice(0, count).map((value, index): UseChipListItem =>
    plan.lastChipWidth != null && index === count - 1
      ? { key: `${index}:${value}`, value, ellipsis: true, maxWidth: plan.lastChipWidth }
      : { key: `${index}:${value}`, value },
  );
  return { listRef, measureRef, visible, hidden, measured: plan.measured, settled: plan.settled };
}
