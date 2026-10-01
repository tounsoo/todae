export type ChipOverflowInput = {
  W: number;
  g: number;
  c: number[];
  p: number;
  /** Input minimum. The same reserve is used while chips are folded, so the input stays on the +N row. */
  m?: number;
  R?: number;
  /** Smallest truncated chip: measured "…" probe plus one character. Below this, the chip folds into +N. */
  minChip?: number;
};

export type ChipOverflowPlan = {
  visible: number;
  hidden: number;
  /** Set when the first visible chip must truncate so the row is not empty. */
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

export function planChipOverflow({ W, g, c, p, m, R, minChip }: ChipOverflowInput): ChipOverflowPlan {
  const n = c.length;
  if (R == null || R < 1) return { visible: n, hidden: 0 };
  for (let hidden = 0; hidden <= n; hidden++) {
    const visible = n - hidden;
    if (visible === 0) break;
    const chips = c.slice(0, visible);
    if (chips.some((w) => w > W)) continue;
    if (rowsFor([...chips, ...tail(hidden, p, m)], W, g) <= R) return { visible, hidden };
  }

  // No full-width chip fits with +N and the input. Keep the first chip, truncated,
  // unless even one character plus the ellipsis cannot fit.
  const first = c[0];
  const floor = minChip ?? 0;
  if (first != null && W > 0) {
    const hidden = n - 1;
    const extras = tail(hidden, p, m);
    if (first > W && W >= floor && rowsFor([W, ...extras], W, g) <= R) {
      return { visible: 1, hidden, lastChipWidth: W };
    }
    const share = W - extras.reduce((sum, w) => sum + g + w, 0);
    if (share > 0 && share >= floor && share < first && rowsFor([share, ...extras], W, g) <= R) {
      return { visible: 1, hidden, lastChipWidth: share };
    }
  }
  return { visible: 0, hidden: n };
}
