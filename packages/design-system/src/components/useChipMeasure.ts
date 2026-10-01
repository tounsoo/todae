import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';
import { planChipOverflow } from './chipOverflow';

export function useChipMeasure({
  chips,
  maxRows,
  flowRef,
  measureRef,
  inputRef,
}: {
  chips: readonly string[];
  maxRows?: number;
  flowRef: RefObject<HTMLElement | null>;
  measureRef: RefObject<HTMLElement | null>;
  inputRef?: RefObject<HTMLElement | null>;
}): { visible: number; hidden: number; lastChipWidth?: number; measured: boolean } {
  const [plan, setPlan] = useState<{ visible: number; hidden: number; lastChipWidth?: number }>({
    visible: chips.length,
    hidden: 0,
  });
  const [measured, setMeasured] = useState(false);

  const measure = useCallback(() => {
    if (maxRows == null || maxRows < 1) {
      setPlan((prev) =>
        prev.visible === chips.length && prev.hidden === 0 && prev.lastChipWidth === undefined
          ? prev
          : { visible: chips.length, hidden: 0 },
      );
      return;
    }
    const flow = flowRef.current;
    const layer = measureRef.current;
    const input = inputRef?.current;
    if (!flow || !layer || (inputRef && !input)) return;
    const W = flow.getBoundingClientRect().width;
    const gap = getComputedStyle(flow).columnGap || getComputedStyle(flow).gap;
    const g = Number.parseFloat(gap) || 0;
    const kids = [...layer.children] as HTMLElement[];
    const overflowEl = kids.at(-1);
    const probeEl = kids.at(-2);
    if (!overflowEl || !probeEl) return;
    const chipEls = kids.slice(0, -2);
    const c = chipEls.map((el) => el.getBoundingClientRect().width);
    const p = overflowEl.getBoundingClientRect().width;
    const open = input ? Number.parseFloat(getComputedStyle(input).minWidth) || 0 : undefined;
    const next = planChipOverflow({ W, g, c, p, m: open, R: maxRows });
    setPlan((prev) =>
      prev.visible === next.visible && prev.hidden === next.hidden && prev.lastChipWidth === next.lastChipWidth
        ? prev
        : next,
    );
  }, [chips, maxRows, flowRef, measureRef, inputRef]);

  useLayoutEffect(() => {
    measure();
    setMeasured(true);
    const flow = flowRef.current;
    const layer = measureRef.current;
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(measure);
    if (flow) ro.observe(flow);
    if (layer) ro.observe(layer);
    return () => ro.disconnect();
  }, [measure, flowRef, measureRef]);

  return { ...plan, measured };
}
