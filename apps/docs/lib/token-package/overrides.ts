import { ownRoot, readsAppearance, rowEntry, tokenPackage, type PackageToken, type TokenEntry } from './package';

/** The catalog fields this export reads: one row per token, or per context for a token a modifier sets. */
export type CatalogRow = {
  path: string;
  type: string;
  cssVar: string;
  ref: string | null;
  cssValue: string;
  context: string | null;
  entry: { kind: 'set' | 'modifier'; name: string; context?: string };
};

/** Override values by token path, the shape ThemeProvider `overrides` takes. */
export type OverrideSet = Readonly<Record<string, unknown>>;

export type OverridesPackageInput = {
  name: string;
  description?: string;
  light: OverrideSet;
  dark: OverrideSet;
  /** Todae's token catalog rows, from `@tounsoo/todae/tokens.json`. */
  catalog: readonly CatalogRow[];
  /** Reads a catalog CSS value back into a token value, such as ThemeProvider's `parseThemeValue`. */
  parse: (path: string, css: string) => unknown;
};

export type OverridesPackage = {
  /** Token files by path inside the `tokens` folder, resolver first. */
  files: Record<string, string>;
  /** Override keys the catalog does not know, left out of the package. */
  skipped: string[];
  /**
   * Tokens whose light and dark values differ although Todae declares them
   * once for both appearances. The package holds each appearance's value in a
   * token of its own in its appearance files, like Fernway's `fernway.hero.*`.
   */
  split: string[];
  /** The root of the package's own split tokens, such as `acme` for `acme.color.gray.900`. */
  root: string;
  /**
   * Tokens that get one value in both appearances although the Playground
   * showed them differently: a density token, a token whose Todae value reads
   * a density token or a CSS value the package can't read back, and a core or
   * density token that reads a split core token.
   */
  unsplit: string[];
};

const APPEARANCES = ['light', 'dark'] as const;
type Side = (typeof APPEARANCES)[number];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function alias(path: string): { $ref: string } {
  return { $ref: `#/${path.split('.').join('/')}/$value` };
}

/** A relative color as Todae's appearance files write it: `oklch(from var(--origin) l c h / alpha)`. */
const RELATIVE = /^oklch\(from var\((--todae-[a-z0-9-]+)\) l c h \/ (.+)\)$/;
const VAR = /^var\((--todae-[a-z0-9-]+)\)$/;

function isAppearance(entry: CatalogRow['entry']): boolean {
  return entry.kind === 'modifier' && entry.name === 'appearance';
}

function isCore(entry: CatalogRow['entry']): boolean {
  return entry.kind === 'set' && entry.name === 'core';
}

/** The file or files a token goes to: one for a set or a button variant, each context for a density token. */
function targetsOf(found: readonly CatalogRow[]): TokenEntry[] {
  const { entry } = found[0] as CatalogRow;
  if (entry.kind === 'set') return [{ kind: 'set', name: entry.name }];
  if (entry.context !== undefined) return [{ kind: 'modifier', name: entry.name, context: entry.context }];
  return found.flatMap((row) => (row.context === null ? [] : [{ kind: 'modifier' as const, name: entry.name, context: row.context }]));
}

/**
 * A company token package from Playground overrides. Every override key goes
 * to the file of the set or modifier that declares it in Todae's catalog, so
 * any token the Playground can set (color, radius, font, shadow, motion, and
 * tokens added later) needs no list of its own here.
 *
 * - A token of the `appearance` modifier gets its light value in
 *   `appearance/light.json` and its dark value in `appearance/dark.json`.
 * - A token of another modifier context, such as a button variant, goes to that
 *   context. One that every context of a modifier declares, such as a density
 *   token, goes to each, since a ThemeProvider override applies at every density.
 * - A token of a set goes to the set's file.
 *
 * A Playground override applies only in the appearance it is set for, while a
 * set declares a token once for both. So a set token whose light and dark
 * values differ is split: the package declares a token of its own,
 * `<root>.<path>`, in each appearance file with that appearance's value, and
 * the side with no override keeps Todae's value. A contract token then reads
 * that token. A core token cannot read an appearance token, since core comes
 * first, so it keeps its light value and the tokens that read it read the
 * split token instead. An appearance file may hold only a value, or an alias
 * of a core or appearance token, so a token that cannot be split within that
 * rule, such as a density token, gets one value and is listed in `unsplit`.
 */
export function overridesPackage({ name, description, light, dark, catalog, parse }: OverridesPackageInput): OverridesPackage {
  const rows = new Map<string, CatalogRow[]>();
  const byVar = new Map<string, string>();
  for (const row of catalog) {
    const list = rows.get(row.path);
    if (list) list.push(row);
    else rows.set(row.path, [row]);
    byVar.set(row.cssVar, row.path);
  }

  const tokens: PackageToken[] = [];
  const skipped: string[] = [];
  const split: string[] = [];
  const unsplit = new Set<string>();
  /** Core tokens split so far, which an appearance value reads as `<root>.<path>`. */
  const splitCore = new Set<string>();
  const values = { light, dark };
  const has = (side: Side, path: string) => Object.hasOwn(values[side], path);
  const root = ownRoot(name);
  const own = (path: string) => `${root}.${path}`;

  /** The row of `path` that applies in an appearance. */
  const rowIn = (path: string, side: Side): CatalogRow | undefined => {
    const found = rows.get(path) ?? [];
    return found.find((row) => row.context === side) ?? found.find((row) => row.context === null) ?? found[0];
  };

  /** An alias an appearance file may hold: of a core or appearance token, or of the split token that stands in for it. */
  const legalAlias = (path: string, side: Side): unknown => {
    const row = rowIn(path, side);
    if (!row) return null;
    if (isCore(row.entry)) return alias(splitCore.has(path) ? own(path) : path);
    if (isAppearance(row.entry)) return alias(path);
    return undefined;
  };

  /** A relative color of `origin` with its alpha kept, as a DTCG value, or null when the CSS is another shape. */
  const relative = (row: CatalogRow, side: Side): unknown => {
    const match = RELATIVE.exec(row.cssValue);
    const origin = match ? byVar.get(match[1] as string) : undefined;
    if (!match || !origin) return null;
    const base = legalAlias(origin, side) as { $ref: string } | null | undefined;
    if (!base) return null;
    const css = (match[2] as string).trim();
    const opacity = VAR.exec(css);
    const alphaPath = opacity ? byVar.get(opacity[1] as string) : undefined;
    // The alpha may read a split core token too, such as a dark-only opacity.
    const alpha = alphaPath ? (legalAlias(alphaPath, side) ?? null) : Number.isFinite(Number(css)) ? Number(css) : null;
    if (alpha === null) return null;
    const prefix = base.$ref;
    return { colorSpace: 'oklch', components: [0, 1, 2].map((index) => ({ $ref: `${prefix}/components/${index}` })), alpha };
  };

  /**
   * Todae's value of a token in one appearance, in a form an appearance file may
   * hold. Whole-value aliases are followed down to a core or appearance token or
   * a value. Null when the chain reaches a density token or a CSS value it can't read.
   */
  const todaeIn = (path: string, side: Side): unknown => {
    let row = rowIn(path, side);
    for (let hop = 0; row && hop < 32; hop++) {
      if (hop > 0) {
        // An alias of a core or appearance token stays live; an overridden contract token is copied.
        const direct = legalAlias(row.path, side);
        if (direct !== undefined) return direct;
        if (has(side, row.path)) return values[side][row.path];
      }
      if (row.entry.kind === 'modifier' && !isAppearance(row.entry) && row.entry.context === undefined) return null;
      if (row.ref === null) return parse(row.path, row.cssValue) ?? null;
      const target = rows.get(row.ref)?.[0];
      if (!target || row.cssValue !== `var(${target.cssVar})`) return relative(row, side);
      row = rowIn(row.ref, side);
    }
    return null;
  };

  /** Points the tokens that read a split core token at its split token, or lists them when they can't follow. */
  const rewire = (path: string, cssVar: string) => {
    const whole = `var(${cssVar})`;
    for (const reader of catalog) {
      if (reader.path === path) continue;
      const aliases = reader.ref === path && reader.cssValue === whole;
      const reads = aliases || reader.ref === path || reader.cssValue.includes(`${whole.slice(0, -1)})`) || reader.cssValue.includes(`${whole.slice(0, -1)},`);
      if (!reads) continue;
      if (isAppearance(reader.entry)) {
        const side = reader.context as Side;
        if (has(side, reader.path)) continue;
        const value = aliases ? alias(own(path)) : relative(reader, side);
        if (value === null) unsplit.add(reader.path);
        else tokens.push({ path: reader.path, type: reader.type, value, entry: { kind: 'modifier', name: 'appearance', context: side } });
      } else if (!readsAppearance(reader.entry) || !aliases) {
        // A core or density token can't read an appearance token, and a set token reads it whole or not at all.
        if (!has('light', reader.path) && !has('dark', reader.path)) unsplit.add(reader.path);
      } else if (!has('light', reader.path) && !has('dark', reader.path)) {
        tokens.push({ path: reader.path, type: reader.type, value: alias(own(path)), entry: rowEntry(reader) });
      }
    }
  };

  // Core first, so a later token's Todae value can read a split core token.
  const paths = [...new Set([...Object.keys(light), ...Object.keys(dark)])].sort();
  const coreFirst = (path: string) => (rows.get(path)?.[0] && isCore((rows.get(path)?.[0] as CatalogRow).entry) ? 0 : 1);
  paths.sort((a, b) => coreFirst(a) - coreFirst(b));

  // Every core split is known before any reader is rewired, so a color that reads two of them,
  // such as a scrim's gray and its opacity, reads both split tokens.
  const rewires: [path: string, cssVar: string][] = [];
  let rewired = false;
  const flush = () => {
    if (rewired) return;
    rewired = true;
    for (const [path, cssVar] of rewires) rewire(path, cssVar);
  };

  for (const path of paths) {
    if (coreFirst(path) === 1) flush();
    const found = rows.get(path);
    const first = found?.[0];
    if (!found || !first) {
      skipped.push(path);
      continue;
    }
    const { type, entry } = first;
    if (isAppearance(entry)) {
      for (const side of APPEARANCES) {
        if (has(side, path)) tokens.push({ path, type, value: values[side][path], entry: { kind: 'modifier', name: 'appearance', context: side } });
      }
      continue;
    }
    const targets = targetsOf(found);
    const one = has('light', path) ? light[path] : dark[path];
    if (has('light', path) && has('dark', path) && same(light[path], dark[path])) {
      for (const target of targets) tokens.push({ path, type, value: one, entry: target });
      continue;
    }
    const lightValue = has('light', path) ? light[path] : todaeIn(path, 'light');
    const darkValue = has('dark', path) ? dark[path] : todaeIn(path, 'dark');
    const splittable = isCore(entry) || readsAppearance(entry);
    if (!splittable || lightValue === null || lightValue === undefined || darkValue === null || darkValue === undefined || same(lightValue, darkValue)) {
      if (!same(lightValue, darkValue)) unsplit.add(path);
      for (const target of targets) tokens.push({ path, type, value: one, entry: target });
      continue;
    }

    split.push(path);
    tokens.push({ path: own(path), type, value: lightValue, entry: { kind: 'modifier', name: 'appearance', context: 'light' } });
    tokens.push({ path: own(path), type, value: darkValue, entry: { kind: 'modifier', name: 'appearance', context: 'dark' } });
    if (!isCore(entry)) {
      for (const target of targets) tokens.push({ path, type, value: alias(own(path)), entry: target });
      continue;
    }
    // A core token keeps light in core, and the tokens that read it read the split token.
    for (const target of targets) tokens.push({ path, type, value: lightValue, entry: target });
    splitCore.add(path);
    rewires.push([path, first.cssVar]);
  }
  flush();

  // Light's file before dark's, whichever token reaches an appearance first.
  const lightFirst = (token: PackageToken) => (token.entry.kind === 'modifier' && token.entry.context === 'dark' ? 1 : 0);
  tokens.sort((a, b) => lightFirst(a) - lightFirst(b));
  return {
    files: tokenPackage({ name, ...(description ? { description } : {}), tokens }),
    skipped,
    split,
    root,
    unsplit: [...unsplit].sort(),
  };
}
