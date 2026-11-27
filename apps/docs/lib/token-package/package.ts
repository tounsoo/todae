/**
 * A company token package: DTCG token files and a 2025.10 resolver that layer
 * on Todae's, laid out the way `examples/fernway/tokens` is. Each token goes
 * to the file of the set or modifier context that declares it in Todae (the
 * catalog's `entry`), so whatever tokens a caller passes, motion and any
 * token added later included, land where `todae-tokens build` expects them.
 *
 * Pure: no file system and no catalog import, so the Playground can run it in
 * the browser and the docs MCP server on Node.
 */

/** Where a token is declared: a set, or one context of a modifier. */
export type TokenEntry = { kind: 'set'; name: string } | { kind: 'modifier'; name: string; context: string };

/** One token to write: its path, DTCG `$type` and `$value`, and the entry it belongs to. */
export type PackageToken = { path: string; type: string; value: unknown; entry: TokenEntry };

/** A starting tree for one entry's file, such as a new button variant copied from `secondary`. */
export type PackageSeed = { entry: TokenEntry; tree: Record<string, unknown> };

export type PackageInput = {
  /** The design system's name, written into its resolver. */
  name: string;
  description?: string;
  tokens?: readonly PackageToken[];
  seeds?: readonly PackageSeed[];
};

type DevTodae = Record<string, unknown>;

/**
 * Todae's own sets and modifiers, in Todae's resolution order, with the
 * `dev.todae` extension a company entry of the same name carries. A test
 * checks this against `packages/design-system/tokens/resolver.json`.
 */
export const TODAE_ENTRIES: readonly { kind: 'set' | 'modifier'; name: string; extension: DevTodae }[] = [
  { kind: 'set', name: 'core', extension: { layer: 'core' } },
  {
    kind: 'modifier',
    name: 'appearance',
    extension: { layer: 'appearance', attribute: 'data-appearance', root: true, colorScheme: true },
  },
  {
    kind: 'modifier',
    name: 'density',
    extension: { layer: 'density', rules: ['density-space'], attribute: 'data-density', root: true },
  },
  { kind: 'set', name: 'focus', extension: { layer: 'contract' } },
  { kind: 'set', name: 'button', extension: { layer: 'contract' } },
  {
    kind: 'modifier',
    name: 'buttonVariant',
    extension: { layer: 'contract', attribute: 'data-button-variant', alias: true },
  },
  { kind: 'set', name: 'contract', extension: { layer: 'contract' } },
];

const RESOLVER_SCHEMA = 'https://www.designtokens.org/schemas/2025.10/resolver.json';

/**
 * The file an entry's tokens go to, inside the tokens folder: `core.json` for
 * a set, `appearance/light.json` for a modifier context, and
 * `button.soft.json` for a button variant, as Fernway names them.
 */
export function entryFile(entry: TokenEntry): string {
  if (entry.kind === 'set') return `${entry.name}.json`;
  if (entry.name === 'buttonVariant') return `button.${entry.context}.json`;
  return `${entry.name}/${entry.context}.json`;
}

export function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isGroup(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !('$value' in value);
}

/** Puts `node` at a dotted path in a DTCG tree, replacing a token already there. */
export function place(root: Record<string, unknown>, path: string, node: unknown): void {
  const segments = path.split('.');
  let group = root;
  for (const segment of segments.slice(0, -1)) {
    const next = group[segment];
    if (!isGroup(next)) group[segment] = {};
    group = group[segment] as Record<string, unknown>;
  }
  group[segments[segments.length - 1] as string] = node;
}

function entryKey(entry: TokenEntry): string {
  return entry.kind === 'set' ? `set:${entry.name}` : `modifier:${entry.name}:${entry.context}`;
}

/** True when an entry comes after Todae's `appearance` modifier, so its tokens may read appearance tokens. */
export function readsAppearance(entry: { kind: string; name: string }): boolean {
  return rank(entry) > rank({ kind: 'modifier', name: 'appearance' });
}

function rank(entry: { kind: string; name: string }): number {
  const index = TODAE_ENTRIES.findIndex((known) => known.kind === entry.kind && known.name === entry.name);
  return index === -1 ? TODAE_ENTRIES.length : index;
}

/**
 * The package's files by path inside its tokens folder, resolver first, then
 * each entry's file in Todae's resolution order. Only entries that get a token
 * or a seed appear, and entries Todae lacks come last. Tokens within a file
 * are sorted by path, after the seed's own order.
 */
export function tokenPackage({ name, description, tokens = [], seeds = [] }: PackageInput): Record<string, string> {
  const files = new Map<string, { entry: TokenEntry; tree: Record<string, unknown> }>();
  const fileFor = (entry: TokenEntry) => {
    const key = entryKey(entry);
    let file = files.get(key);
    if (!file) {
      file = { entry, tree: {} };
      files.set(key, file);
    }
    return file;
  };
  for (const seed of seeds) Object.assign(fileFor(seed.entry).tree, structuredClone(seed.tree));
  // Files keep the order the caller lists entries in, such as light before dark, within Todae's order.
  for (const token of tokens) fileFor(token.entry);
  for (const token of [...tokens].sort((a, b) => a.path.localeCompare(b.path))) {
    place(fileFor(token.entry).tree, token.path, { $type: token.type, $value: token.value });
  }

  const ordered = [...files.values()].sort((a, b) => rank(a.entry) - rank(b.entry));

  const sets: Record<string, unknown> = {};
  const modifiers: Record<string, { contexts: Record<string, { $ref: string }[]>; $extensions?: unknown }> = {};
  const order: { $ref: string }[] = [];
  for (const { entry } of ordered) {
    const known = TODAE_ENTRIES.find((candidate) => candidate.kind === entry.kind && candidate.name === entry.name);
    const extensions = { 'dev.todae': known?.extension ?? { layer: 'contract' } };
    const ref = { $ref: `./${entryFile(entry)}` };
    if (entry.kind === 'set') {
      sets[entry.name] = { sources: [ref], $extensions: extensions };
      order.push({ $ref: `#/sets/${entry.name}` });
    } else {
      const modifier = modifiers[entry.name];
      if (modifier) modifier.contexts[entry.context] = [ref];
      else {
        modifiers[entry.name] = { contexts: { [entry.context]: [ref] }, $extensions: extensions };
        order.push({ $ref: `#/modifiers/${entry.name}` });
      }
    }
  }

  const resolver = {
    $schema: RESOLVER_SCHEMA,
    name,
    version: '2025.10',
    ...(description ? { description } : {}),
    sets,
    modifiers,
    resolutionOrder: order,
  };
  const out: Record<string, string> = { 'resolver.json': json(resolver) };
  for (const file of ordered) out[entryFile(file.entry)] = json(file.tree);
  return out;
}
