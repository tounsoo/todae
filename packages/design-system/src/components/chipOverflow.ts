export type ChipOverflowInput = {
  W: number;
  g: number;
  c: number[];
  p: number;
  m: number;
  R?: number;
  minChip?: number;
};

export type ChipOverflowPlan = {
  visible: number;
  hidden: number;
  lastChipWidth?: number;
};

const EPSILON = 0.5;

export function rowsFor(items: number[], W: number, g: number): number {
  if (items.length === 0) return 1;
  let cur = 0;
  let rows = 1;
  for (const w of items) {
    const next = cur === 0 ? w : cur + g + w;
    if (next > W + EPSILON) {
      rows += 1;
      cur = w;
    } else {
      cur = next;
    }
  }
  return rows;
}

export function planChipOverflow({ W, g, c, p, m, R, minChip }: ChipOverflowInput): ChipOverflowPlan {
  const n = c.length;
  if (R == null || R < 1) return { visible: n, hidden: 0 };
  for (let hidden = 0; hidden <= n; hidden++) {
    const visible = n - hidden;
    const chips = c.slice(0, visible);
    const items = hidden > 0 ? [...chips, p, m] : [...chips, m];
    if (rowsFor(items, W, g) <= R) return { visible, hidden };

    const cLast = chips.at(-1);
    if (minChip == null || hidden === 0 || cLast == null || cLast < minChip) continue;

    const head = chips.slice(0, -1);
    let cur = 0;
    for (const w of head) {
      const next = cur === 0 ? w : cur + g + w;
      cur = next > W + EPSILON ? w : next;
    }
    const avail = cur === 0 ? W : W - cur - g;
    let best: number | undefined;
    for (const w of [cLast, minChip, avail, avail - g - p, avail - g - p - g - m, W, W - g - p, W - g - p - g - m]) {
      if (w < minChip || w > cLast) continue;
      if (rowsFor([...head, w, p, m], W, g) > R) continue;
      if (best == null || w > best) best = w;
    }
    if (best != null && best < cLast) return { visible, hidden, lastChipWidth: best };
  }
  return { visible: 0, hidden: n };
}
