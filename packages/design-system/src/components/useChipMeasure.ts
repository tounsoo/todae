import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
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
}): { visible: number; hidden: number; lastChipWidth?: number; measured: boolean; settled: () => boolean } {
  const [plan, setPlan] = useState<{ visible: number; hidden: number; lastChipWidth?: number }>({
    visible: chips.length,
    hidden: 0,
  });
  const [measured, setMeasured] = useState(false);
  // The plan the last measure asked for. Until a re-render applies it, the
  // rendered chips are about to move.
  const planned = useRef(plan);

  const measure = useCallback(() => {
    if (maxRows == null || maxRows < 1) {
      planned.current = { visible: chips.length, hidden: 0 };
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
    const style = getComputedStyle(flow);
    // The content width: a clipped flow pads itself to leave room for focus rings.
    const W =
      flow.getBoundingClientRect().width -
      (Number.parseFloat(style.paddingLeft) || 0) -
      (Number.parseFloat(style.paddingRight) || 0) -
      (Number.parseFloat(style.borderLeftWidth) || 0) -
      (Number.parseFloat(style.borderRightWidth) || 0);
    const gap = style.columnGap || style.gap;
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
    planned.current = next;
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

  // Read it in a layout effect after this hook's own: false while a measure
  // in this commit has asked for a re-render.
  const settled = () =>
    planned.current.visible === plan.visible &&
    planned.current.hidden === plan.hidden &&
    planned.current.lastChipWidth === plan.lastChipWidth;
  return { ...plan, measured, settled };
}
