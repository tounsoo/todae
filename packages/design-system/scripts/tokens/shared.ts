export const PATH_RE = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

export const LAYER_RANK = { core: 0, appearance: 1, density: 2, contract: 3 } as const;

/** `; did you mean "x"?` for the known path closest to `path`, when one is close. */
export function didYouMean(path: string, known: Iterable<string>): string {
  let best: { path: string; distance: number } | null = null;
  for (const candidate of known) {
    if (Math.abs(candidate.length - path.length) > 3) continue;
    const distance = editDistance(path, candidate);
    if (distance <= Math.max(1, Math.floor(path.length / 6)) && (best === null || distance < best.distance)) {
      best = { path: candidate, distance };
    }
  }
  return best ? `; did you mean "${best.path}"?` : '';
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j]! + 1, row[j - 1]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length]!;
}

/**
 * Todae-specific checks a set or modifier opts into with
 * `$extensions["dev.todae"].rules`. Every set always gets the generic checks:
 * path format, a $type per token, value shapes, ref existence, cycles, layer
 * order, resolution order, and context parity.
 */
export const RULES = ['reserved-roots', 'density-space', 'button'] as const;
export type Rule = (typeof RULES)[number];

/** Token groups (`*` matches one segment) mapped to the exact leaves each must have. */
export type SlotRules = Record<string, string[]>;

export type Layer = keyof typeof LAYER_RANK;

export type TokenNode = {
  $type?: string;
  $value: unknown;
  /** The token's own `$description`, or the nearest group's. */
  $description?: string;
};

export type TokenTree = { [key: string]: TokenNode | TokenTree };

/**
 * A token another token's value reads: the whole value (`value`), the OKLCH
 * channels of a color (`component`), or a color's alpha (`alpha`). `type` is
 * the $type the target must have.
 */
export type TokenRef = { path: string; type: string; role: 'value' | 'component' | 'alpha' };

/** A set or modifier, and for a variant modifier (`alias`) the context, since a variant's tokens belong to its context. */
export type TokenEntry = { kind: 'set' | 'modifier'; name: string; context?: string };

export type FlatToken = {
  path: string;
  type: string;
  value: unknown;
  /** The aliased token, or the color whose channels this color reads; shown in the catalog. */
  ref: string | null;
  /** Every token the value reads, `ref` included. */
  refs: TokenRef[];
  cssVar: string;
  cssValue: string;
  layer: Layer;
  context?: string;
  /**
   * The token's `$description`, or the nearest enclosing group's in the same
   * file; a later source file with neither keeps the earlier file's. Once settled (see `settleDescriptions`), the same on every context's
   * row of a path.
   */
  description?: string;
};

/** A token as a resolver loads it. */
export type EntryToken = FlatToken & {
  /** The set or modifier that declares it, named in the catalog so a company knows where to override it. */
  entry: TokenEntry;
};

export function fail(message: string): never {
  throw new Error(message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isRef(value: unknown): value is { $ref: string } {
  return isRecord(value) && typeof value.$ref === 'string';
}

export function pathToPointer(path: string): string {
  return `#/${path.split('.').join('/')}/$value`;
}

/**
 * Parses a DTCG 2025.10 JSON Pointer alias (`#/color/gray/50/$value`) into the
 * dot path of the token it names. Only whole-value aliases are supported here;
 * color channels use {@link parseComponentPointer}.
 */
export function pointerToPath(pointer: string, loc: string): string {
  if (!pointer.startsWith('#/')) {
    const hint = PATH_RE.test(pointer) ? `; write "${pathToPointer(pointer)}"` : '';
    fail(`${loc} $ref "${pointer}" must be a JSON Pointer like "#/color/gray/50/$value"${hint}`);
  }
  const segments = pointer
    .slice(2)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'));
  if (segments.at(-1) !== '$value') {
    fail(`${loc} $ref "${pointer}" must end at a token's /$value`);
  }
  const tokenSegments = segments.slice(0, -1);
  if (tokenSegments.includes('$value')) {
    fail(`${loc} $ref "${pointer}" points inside a value; only whole-value aliases are supported`);
  }
  const path = tokenSegments.join('.');
  if (tokenSegments.some((segment) => segment === '' || segment.includes('.')) || !PATH_RE.test(path)) {
    fail(`${loc} $ref "${pointer}" must name a token with lowercase segments`);
  }
  return path;
}

const OKLCH_CHANNELS = ['l', 'c', 'h'] as const;

/**
 * Parses a property-level pointer to one OKLCH channel of another color token,
 * `#/color/accent/default/$value/components/0`, into its token path and channel.
 */
export function parseComponentPointer(pointer: string, loc: string): { path: string; channel: 'l' | 'c' | 'h' } {
  const match = typeof pointer === 'string' ? pointer.match(/^(#\/.+\/\$value)\/components\/([0-2])$/) : null;
  if (!match) fail(`${loc} component $ref "${String(pointer)}" must point at "#/<token>/$value/components/0|1|2"`);
  return { path: pointerToPath(match[1]!, loc), channel: OKLCH_CHANNELS[Number(match[2])]! };
}

export function block(selector: string, lines: string[]): string[] {
  const body = lines.filter((line) => line !== '');
  return body.length === 0 ? [] : [`${selector} {\n${body.join('\n')}\n}`];
}

export function indent(rules: string[]): string[] {
  return rules.map((rule) => rule.replace(/^/gm, '  '));
}

/**
 * A text color and the background it sits on, checked with APCA in every
 * context of the set or modifier that declares it. `min` is the lowest
 * absolute Lc allowed. `over` lists the opaque surfaces a translucent `bg`
 * may sit on; the pair is checked over each one. Without it, `bg` must be
 * opaque.
 */
export type ContrastPair = { fg: string; bg: string; min: number; over?: string[] };

export type TodaeExtension = {
  layer: Layer;
  rules?: Rule[];
  slots?: SlotRules;
  contrast?: ContrastPair[];
  attribute?: string;
  root?: boolean;
  colorScheme?: boolean;
  alias?: boolean;
};

export type ResolvedEntry =
  | { kind: 'set'; name: string; extension: TodaeExtension; tokens: EntryToken[] }
  | {
      kind: 'modifier';
      name: string;
      extension: TodaeExtension;
      defaultContext: string;
      contexts: Map<string, EntryToken[]>;
    };
