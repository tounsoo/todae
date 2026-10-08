import { useCallback, useState } from 'react';
import { sameValues } from '../hooks/useRovingFocus';

// Chip identity when the owner gives no getKey. Keys carry over from the
// last chips, so a chip keeps its key, and React its node, while chips are
// added or removed around it. Chips with the same value are matched by
// order, and a press says which of two neighbouring twins was removed.

export type KnownChips = { chips: readonly string[]; keys: readonly string[]; pressed: number | null };

// The key format is the value numbered among keys already in use. The
// number comes first, so no two keys collide: '0:a', '1:a', '0:1:a'.
function fresh(value: string, used: Set<string>): string {
  let n = 0;
  while (used.has(`${n}:${value}`)) n++;
  const key = `${n}:${value}`;
  used.add(key);
  return key;
}

// The first index where a and b differ.
function split(a: readonly string[], b: readonly string[]): number {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  return p;
}

// The index whose removal turns prev into next, else -1. Removing any chip of
// a run of twins gives the same chips: the pressed one wins, else the first.
function removedAt(prev: readonly string[], next: readonly string[], pressed: number | null): number {
  if (next.length !== prev.length - 1) return -1;
  const p = split(prev, next);
  for (let i = p; i < next.length; i++) if (prev[i + 1] !== next[i]) return -1;
  let first = p;
  while (first > 0 && prev[first - 1] === prev[p]) first--;
  return pressed != null && pressed >= first && pressed <= p ? pressed : first;
}

// The index of the one chip added to prev, else -1. Next to a twin, the
// later index is the new one, so existing chips keep their places.
function insertedAt(prev: readonly string[], next: readonly string[]): number {
  if (next.length !== prev.length + 1) return -1;
  const p = split(prev, next);
  for (let i = p; i < prev.length; i++) if (next[i + 1] !== prev[i]) return -1;
  return p;
}

export function firstKeys(chips: readonly string[]): string[] {
  const used = new Set<string>();
  return chips.map((value) => fresh(value, used));
}

export function nextKeys(prev: KnownChips, chips: readonly string[]): string[] {
  const out = removedAt(prev.chips, chips, prev.pressed);
  if (out >= 0) return prev.keys.filter((_, i) => i !== out);
  const added = insertedAt(prev.chips, chips);
  if (added >= 0) {
    const keys = [...prev.keys];
    keys.splice(added, 0, fresh(chips[added]!, new Set(prev.keys)));
    return keys;
  }
  // Any other change: match by value, in order.
  const pool = new Map<string, string[]>();
  prev.chips.forEach((value, i) => {
    const list = pool.get(value) ?? [];
    list.push(prev.keys[i]!);
    pool.set(value, list);
  });
  const kept = chips.map((value) => pool.get(value)?.shift());
  const used = new Set(kept.filter((key): key is string => key != null));
  return kept.map((key, i) => key ?? fresh(chips[i]!, used));
}

/**
 * A key per chip: getKey's when given, else keys carried over from the last
 * chips. Call press(index) when a remove button is pressed.
 */
export function useChipKeys(chips: readonly string[], getKey?: (value: string, index: number) => string) {
  const [known, setKnown] = useState<KnownChips>(() => ({ chips, keys: firstKeys(chips), pressed: null }));
  let current = known;
  // React's pattern for state that follows a prop: update it during render.
  if (!getKey && !sameValues(known.chips, chips)) {
    current = { chips, keys: nextKeys(known, chips), pressed: null };
    setKnown(current);
  }
  // If chips then lose one of its twins, it is this one.
  const press = useCallback(
    (index: number) => setKnown((prev) => (prev.pressed === index ? prev : { ...prev, pressed: index })),
    [],
  );
  // Focus left the pressed chip before the owner dropped it: the press no
  // longer says which twin went.
  const release = useCallback(
    (index: number) => setKnown((prev) => (prev.pressed === index ? { ...prev, pressed: null } : prev)),
    [],
  );
  return { keys: getKey ? chips.map((value, index) => getKey(value, index)) : current.keys, press, release };
}
