export type ChipOverflowInput = {
  W: number;
  g: number;
  c: number[];
  p: number;
  /** Input minimum. The same reserve is used while chips are folded, so the input stays on the +N row. */
  m?: number;
  R?: number;
  /** Measured width of the "…" probe. Callers still pass it; a full-width chip is never narrowed to it. */
  minChip?: number;
};

export type ChipOverflowPlan = {
  visible: number;
  hidden: number;
  /** Set only when the last visible chip is wider than the row and must truncate. */
  lastChipWidth?: number;
};

function tail(hidden: number, p: number, m: number | undefined): number[] {
  if (hidden > 0) return m == null ? [p] : [p, m];
  return m == null ? [] : [m];
}

export function rowsFor(items: number[], W: number, g: number): number {
  if (items.length === 0) return 1;
  let cur = 0;
  let rows = 1;
  for (const w of items) {
    const next = cur === 0 ? w : cur + g + w;
    if (next > W) {
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
    if (visible === 0) break;
    const chips = c.slice(0, visible);
    if (chips.some((w) => w > W)) continue;
    if (rowsFor([...chips, ...tail(hidden, p, m)], W, g) <= R) return { visible, hidden };
  }

  const first = c[0];
  if (first != null && W > 0 && first > W) {
    const hidden = n - 1;
    const extras = tail(hidden, p, m);
    if (rowsFor([W, ...extras], W, g) <= R) return { visible: 1, hidden, lastChipWidth: W };
    const share = W - extras.reduce((sum, w) => sum + g + w, 0);
    if (share > 0 && rowsFor([share, ...extras], W, g) <= R) {
      return { visible: 1, hidden, lastChipWidth: share };
    }
  }
  return { visible: 0, hidden: n };
}
