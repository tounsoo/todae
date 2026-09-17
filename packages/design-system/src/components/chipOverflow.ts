export type ChipOverflowInput = {
  W: number;
  g: number;
  c: number[];
  p: number;
  m: number;
  R?: number;
};

export type ChipOverflowPlan = {
  visible: number;
  hidden: number;
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

export function planChipOverflow({ W, g, c, p, m, R }: ChipOverflowInput): ChipOverflowPlan {
  const n = c.length;
  if (R == null || R < 1) return { visible: n, hidden: 0 };
  for (let hidden = 0; hidden <= n; hidden++) {
    const visible = n - hidden;
    const chips = c.slice(hidden);
    const items = hidden > 0 ? [...chips, p, m] : [...chips, m];
    if (rowsFor(items, W, g) <= R) return { visible, hidden };
  }
  return { visible: 0, hidden: n };
}
