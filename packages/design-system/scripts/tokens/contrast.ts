import { apcaContrast, compositeSrgb, oklchToSrgb, type Rgb } from '../../src/color/apca.ts';
import {
  didYouMean,
  fail,
  isRecord,
  isRef,
  parseComponentPointer,
  pointerToPath,
  type ContrastPair,
  type EntryToken,
  type FlatToken,
  type ResolvedEntry,
} from './shared.ts';

// The OKLCH and APCA math is src/color/apca.ts, shared with the runtime
// override check. This module resolves token colors and runs the checks.
export { apcaContrast, oklchToSrgb };

type Oklch = { l: number; c: number; h: number; alpha: number };

/** Paints `top` with its alpha over an opaque `bottom`, in gamma-encoded sRGB as browsers composite. */
export function composite(top: Oklch, bottom: Rgb): Rgb {
  return compositeSrgb([...oklchToSrgb(top), top.alpha], bottom);
}

const CHANNEL_INDEX = { l: 0, c: 1, h: 2 } as const;

/** The literal OKLCH a color token resolves to in one view of the graph. */
function resolveOklch(path: string, view: Map<string, FlatToken>, stack: string[] = []): Oklch {
  if (stack.includes(path)) fail(`contrast: color "${path}" refers to itself through ${stack.join(' → ')}`);
  const token = view.get(path);
  if (!token) fail(`contrast: token "${path}" does not exist${didYouMean(path, view.keys())}`);
  if (token.type !== 'color') fail(`contrast: token "${path}" is a ${token.type}, not a color`);
  const value = token.value;
  if (isRef(value)) return resolveOklch(pointerToPath(value.$ref, `Token "${path}"`), view, [...stack, path]);
  const record = value as { components: unknown[]; alpha?: unknown };
  const channels = record.components.map((component) => {
    if (typeof component === 'number') return component;
    const ref = parseComponentPointer((component as { $ref: string }).$ref, `Token "${path}"`);
    const origin = resolveOklch(ref.path, view, [...stack, path]);
    return [origin.l, origin.c, origin.h][CHANNEL_INDEX[ref.channel]]!;
  });
  const alpha = isRef(record.alpha)
    ? resolveNumber(pointerToPath(record.alpha.$ref, `Token "${path}" alpha`), view, [...stack, path])
    : ((record.alpha as number | undefined) ?? 1);
  return { l: channels[0]!, c: channels[1]!, h: channels[2]!, alpha };
}

/** The literal a number token resolves to in one view of the graph. */
function resolveNumber(path: string, view: Map<string, FlatToken>, stack: string[]): number {
  if (stack.includes(path)) fail(`contrast: number "${path}" refers to itself through ${stack.join(' → ')}`);
  const token = view.get(path);
  if (!token) fail(`contrast: token "${path}" does not exist`);
  if (token.type !== 'number') fail(`contrast: token "${path}" is a ${token.type}, not a number`);
  if (isRef(token.value)) return resolveNumber(pointerToPath(token.value.$ref, `Token "${path}"`), view, [...stack, path]);
  return token.value as number;
}

/**
 * APCA Lc of `fg` painted on `bg`. A translucent `fg` is composited over the
 * background. `bg` must be opaque, unless `over` names the opaque surface it
 * is composited over first.
 */
export function contrastOf(fg: string, bg: string, view: Map<string, FlatToken>, over?: string): number {
  const back = resolveOklch(bg, view);
  let base: Rgb;
  if (over === undefined) {
    if (back.alpha !== 1) fail(`contrast: background "${bg}" must be opaque, or list the surfaces it sits on in "over"`);
    base = oklchToSrgb(back);
  } else {
    const surface = resolveOklch(over, view);
    if (surface.alpha !== 1) fail(`contrast: surface "${over}" under "${bg}" must be opaque`);
    base = composite(back, oklchToSrgb(surface));
  }
  return apcaContrast(composite(resolveOklch(fg, view), base), base);
}

export type ContrastResult = Omit<ContrastPair, 'over'> & {
  /** The surface under a translucent `bg`, one result per `over` entry. */
  over?: string;
  /** The declaring set, or the modifier and context, e.g. `appearance "dark"`. */
  where: string;
  /** Absolute APCA Lc. */
  lc: number;
};

/** A result with the view of the graph it was measured in and every token its colors read. */
type Measured = { result: ContrastResult; view: Map<string, EntryToken>; reads: Set<string> };

/** Every token `path`'s value reads, at any depth, `path` included. */
function readsOf(path: string, view: Map<string, EntryToken>, out = new Set<string>()): Set<string> {
  if (out.has(path)) return out;
  out.add(path);
  const value = view.get(path)?.value;
  if (isRef(value)) return readsOf(pointerToPath(value.$ref, `Token "${path}"`), view, out);
  if (!isRecord(value)) return out;
  const refs = [...(Array.isArray(value.components) ? value.components : []), value.alpha].filter(isRef);
  for (const ref of refs) {
    const loc = `Token "${path}"`;
    readsOf(ref.$ref.includes('/components/') ? parseComponentPointer(ref.$ref, loc).path : pointerToPath(ref.$ref, loc), view, out);
  }
  return out;
}

/**
 * Measures every declared contrast pair. Each pair runs once per combination
 * of the declaring modifier's contexts and every color-scheme modifier's
 * contexts, so a set's pairs are checked in light and dark too, and once per
 * `over` surface in each. Other modifiers stay at their defaults.
 */
function measureContrast(entries: ResolvedEntry[]): Measured[] {
  const measured: Measured[] = [];
  for (const declaring of entries) {
    const pairs = declaring.extension.contrast;
    if (!pairs) continue;
    const varied = entries.filter(
      (entry): entry is Extract<ResolvedEntry, { kind: 'modifier' }> =>
        entry.kind === 'modifier' && !entry.extension.alias && (entry === declaring || entry.extension.colorScheme === true),
    );
    let combos: Map<ResolvedEntry, string>[] = [new Map()];
    for (const modifier of varied) {
      combos = combos.flatMap((combo) => [...modifier.contexts.keys()].map((context) => new Map([...combo, [modifier, context]])));
    }
    for (const combo of combos) {
      const view = new Map<string, EntryToken>();
      for (const entry of entries) {
        const tokens =
          entry.kind === 'set'
            ? entry.tokens
            : entry.extension.alias
              ? [...entry.contexts.values()].flat()
              : (entry.contexts.get(combo.get(entry) ?? entry.defaultContext) ?? []);
        for (const token of tokens) view.set(token.path, token);
      }
      const where =
        combo.size > 0
          ? [...combo].map(([entry, context]) => `${entry.name} "${context}"`).join(', ')
          : `${declaring.kind} "${declaring.name}"`;
      for (const { over, ...pair } of pairs) {
        for (const surface of over ?? [undefined]) {
          const lc = Math.abs(contrastOf(pair.fg, pair.bg, view, surface));
          const result = surface === undefined ? { ...pair, where, lc } : { ...pair, over: surface, where, lc };
          measured.push({ result, view, reads: new Set() });
        }
      }
    }
  }
  return measured;
}

/** Every declared contrast pair, measured as `measureContrast` describes. */
export function contrastResults(entries: ResolvedEntry[]): ContrastResult[] {
  return measureContrast(entries).map(({ result }) => result);
}

/**
 * A lightness that would make a failing pair pass: `token` holds the literal
 * lightness `fg` or `bg` resolves to, in the set or modifier context `entry`
 * names, `from` is its value now, and setting it to `to`, the nearest that
 * passes without failing another pair, gives `lc`.
 */
/** `todae` is true when the literal is in Todae's own token files, which a company overrides rather than edits. */
type LightnessFix = { side: 'fg' | 'bg'; token: string; entry: string; from: number; to: number; lc: number; todae: boolean };

/**
 * The token whose literal OKLCH holds the lightness `path` resolves to, or
 * null when its lightness is read from another channel.
 */
function lightnessSource(path: string, view: Map<string, EntryToken>): string | null {
  const value = view.get(path)!.value;
  if (isRef(value)) return lightnessSource(pointerToPath(value.$ref, `Token "${path}"`), view);
  const l = (value as { components: unknown[] }).components[0];
  if (typeof l === 'number') return path;
  const ref = parseComponentPointer((l as { $ref: string }).$ref, `Token "${path}"`);
  return ref.channel === 'l' ? lightnessSource(ref.path, view) : null;
}

/**
 * The lightness nearest the current one, in steps of 0.001, at which the
 * failing pair reaches its minimum and every pair that passes now still
 * does, changing only the token that holds `side`'s literal lightness; null
 * when there is none, and 'derived' when that lightness is read from another
 * channel. A token both sides read moves both, as it would in the file.
 */
function lightnessFix(side: 'fg' | 'bg', failing: Measured, all: Measured[], todae: Set<EntryToken>): LightnessFix | 'derived' | null {
  const { result, view } = failing;
  const token = lightnessSource(result[side], view);
  if (token === null) return 'derived';
  const literal = view.get(token)!;
  const value = literal.value as { components: unknown[] };
  const from = value.components[0] as number;
  const { kind, name } = literal.entry;
  const entry = `${kind} "${name}"${kind === 'modifier' && literal.context ? ` context "${literal.context}"` : ''}`;
  // The passing pairs measured in a view where the token is this same literal, and that read it.
  const guarded = all.filter(
    (other) => other.result.lc >= other.result.min && other.view.get(token) === literal && guardReads(other).has(token),
  );
  const views = new Set([view, ...guarded.map((other) => other.view)]);
  const passes = ({ result: r, view: v }: Measured) => Math.abs(contrastOf(r.fg, r.bg, v, r.over)) >= r.min;
  try {
    for (let step = 1; step <= 1000; step++) {
      for (const to of [from - step / 1000, from + step / 1000]) {
        const rounded = Number(to.toFixed(3));
        if (rounded < 0 || rounded > 1) continue;
        const trial = { ...literal, value: { ...value, components: [rounded, ...value.components.slice(1)] } };
        for (const each of views) each.set(token, trial);
        if (passes(failing) && guarded.every(passes)) {
          return { side, token, entry, from, to: rounded, lc: Math.abs(contrastOf(result.fg, result.bg, view, result.over)), todae: todae.has(literal) };
        }
      }
    }
    return null;
  } finally {
    for (const each of views) each.set(token, literal);
  }
}

/** Every token a measured pair's colors read, filled in once. */
function guardReads(measured: Measured): Set<string> {
  const { result, view, reads } = measured;
  for (const path of [result.fg, result.bg, ...(result.over ? [result.over] : [])]) readsOf(path, view, reads);
  return reads;
}

function describeFix({ side, token, entry, from, to, lc, todae }: LightnessFix, pair: Omit<ContrastPair, 'over'>): string {
  const via = token === pair[side] ? '' : `, read by "${pair[side]}"`;
  const where = todae ? `Todae's ${entry}${via}; override it in your resolver's ${entry}` : `${entry}${via}`;
  return `set the lightness of "${token}" (${where}) from ${from} to ${to}, for Lc ${lc.toFixed(1)}`;
}

/**
 * Fails with every contrast pair below its minimum, and for each the nearest
 * lightness of its fg or its bg that passes without failing another pair that
 * passes now, nearest first.
 */
export function validateContrast(entries: ResolvedEntry[], todae: Set<EntryToken> = new Set()): void {
  const measured = measureContrast(entries);
  let previous = '';
  const failures = measured
    .filter(({ result }) => result.lc < result.min)
    .map((failing) => {
      const { fg, bg, over, where, lc, min } = failing.result;
      const found = (['fg', 'bg'] as const).map((side) => lightnessFix(side, failing, measured, todae));
      const fixes = found
        .filter((fix): fix is LightnessFix => fix !== null && fix !== 'derived')
        .sort((a, b) => Math.abs(a.to - a.from) - Math.abs(b.to - b.from));
      const none = (side: 'fg' | 'bg', i: number) =>
        found[i] === 'derived'
          ? `"${failing.result[side]}" reads its lightness from another channel, so no fix is shown for it`
          : `no lightness of "${failing.result[side]}" alone reaches Lc ${min} without failing another pair; change its chroma or hue too`;
      const advice =
        fixes.length > 0
          ? `\n    fix: ${fixes.map((each) => describeFix(each, failing.result)).join(`\n    or:  `)}`
          : `\n    ${none('fg', 0)}\n    ${none('bg', 1)}`;
      // The same pair often fails the same way in each appearance; say it once.
      const fix = advice === previous ? '\n    same as above' : advice;
      previous = advice;
      return `"${fg}" on "${bg}"${over ? ` over "${over}"` : ''} in ${where} is Lc ${lc.toFixed(1)}, below ${min}${fix}`;
    });
  if (failures.length > 0) fail(`contrast: ${failures.length} pair(s) fail APCA\n  ${failures.join('\n  ')}`);
}
