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
   * showed them differently: tokens that read a split core token in a way the
   * package cannot follow (another core token aliasing it, or a calc), which
   * get its light value, and one-sided overrides whose Todae value the package
   * cannot read back.
   */
  unsplit: string[];
};

const APPEARANCES = ['light', 'dark'] as const;

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function alias(path: string): { $ref: string } {
  return { $ref: `#/${path.split('.').join('/')}/$value` };
}

/** The file or files a catalog row's token goes to. */
function targetsOf(found: readonly CatalogRow[]): TokenEntry[] {
  const { entry } = found[0] as CatalogRow;
  if (entry.kind === 'set') return [{ kind: 'set', name: entry.name }];
  if (entry.context !== undefined) return [{ kind: 'modifier', name: entry.name, context: entry.context }];
  return found.flatMap((row) => (row.context === null ? [] : [{ kind: 'modifier' as const, name: entry.name, context: row.context }]));
}

function isAppearance(entry: CatalogRow['entry']): boolean {
  return entry.kind === 'modifier' && entry.name === 'appearance';
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
 * `<name>.<path>` (the name without hyphens), in each appearance file with that
 * appearance's value, and the side with no override keeps Todae's value.
 * A contract token then reads that token. A core token cannot read an
 * appearance token, since core comes first, so it keeps its light value and
 * each token that aliases it reads the split token instead.
 */
export function overridesPackage({ name, description, light, dark, catalog, parse }: OverridesPackageInput): OverridesPackage {
  const rows = new Map<string, CatalogRow[]>();
  for (const row of catalog) {
    const list = rows.get(row.path);
    if (list) list.push(row);
    else rows.set(row.path, [row]);
  }

  const tokens: PackageToken[] = [];
  const skipped: string[] = [];
  const split: string[] = [];
  const unsplit = new Set<string>();
  const paths = [...new Set([...Object.keys(light), ...Object.keys(dark)])].sort();
  const values = { light, dark };
  const has = (side: 'light' | 'dark', path: string) => Object.hasOwn(values[side], path);
  const root = ownRoot(name);

  for (const path of paths) {
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
    // The side with no override keeps Todae's value: its alias, or its CSS value read back.
    const todae = first.ref !== null ? alias(first.ref) : parse(path, first.cssValue);
    const valueIn = (side: 'light' | 'dark') => (has(side, path) ? values[side][path] : todae);
    const lightValue = valueIn('light');
    const darkValue = valueIn('dark');
    const unreadable = lightValue === null || lightValue === undefined || darkValue === null || darkValue === undefined;
    if (unreadable || same(lightValue, darkValue)) {
      if (unreadable) unsplit.add(path);
      const value = has('light', path) ? light[path] : dark[path];
      for (const target of targets) tokens.push({ path, type, value, entry: target });
      continue;
    }

    const own = `${root}.${path}`;
    split.push(path);
    tokens.push({ path: own, type, value: lightValue, entry: { kind: 'modifier', name: 'appearance', context: 'light' } });
    tokens.push({ path: own, type, value: darkValue, entry: { kind: 'modifier', name: 'appearance', context: 'dark' } });
    if (readsAppearance(entry)) {
      for (const target of targets) tokens.push({ path, type, value: alias(own), entry: target });
      continue;
    }

    // A core token: keep light in core, and point each token that aliases it at the split token.
    for (const target of targets) tokens.push({ path, type, value: lightValue, entry: target });
    const reads = `var(${first.cssVar}`;
    for (const reader of catalog) {
      if (reader.path === path) continue;
      if (reader.ref !== path) {
        // A value that reads the token some other way, such as in a calc, cannot follow it.
        if (reader.cssValue.includes(`${reads})`) || reader.cssValue.includes(`${reads},`)) unsplit.add(reader.path);
        continue;
      }
      const readerType = reader.type;
      if (isAppearance(reader.entry)) {
        const side = reader.context as 'light' | 'dark';
        if (!has(side, reader.path)) tokens.push({ path: reader.path, type: readerType, value: alias(own), entry: { kind: 'modifier', name: 'appearance', context: side } });
      } else if (!readsAppearance(reader.entry)) {
        unsplit.add(reader.path);
      } else if (!has('light', reader.path) && !has('dark', reader.path)) {
        tokens.push({ path: reader.path, type: readerType, value: alias(own), entry: rowEntry(reader) });
      }
    }
  }

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
