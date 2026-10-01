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

export function useChipList({ chips, maxRows, reserveWidth }: UseChipListOptions): UseChipListResult {
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
  return { listRef, measureRef, visible, hidden, measured: plan.measured };
}
