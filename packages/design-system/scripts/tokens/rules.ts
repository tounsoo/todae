import { aliasGroups, cssVarName, serializeValue } from './serialize.ts';
import { PATH_RE, fail, type FlatToken, type Layer, type ResolvedEntry, type Rule, type SlotRules, type TokenNode } from './shared.ts';

export const RESERVED_ROOTS = [
  'color',
  'space',
  'radius',
  'border',
  'font',
  'motion',
  'z',
  'focus',
  'button',
  'stack',
  'text',
  'prose',
  'field',
  'chip',
  'overlay',
  'dialog',
  'sheet',
  'popover',
  'tooltip',
  'option',
  'menu',
  'tabs',
  'selection',
  'alert',
  'toast',
  'fieldset',
  'form',
  'link',
  'disclosure',
  'separator',
  'table',
  'progress',
  'meter',
  'slider',
  'badge',
  'card',
  'datalist',
  'message',
  'mention',
  'conversation',
  'attachment',
  'steps',
  'emptystate',
  'splitter',
  'breadcrumbs',
  'toolbar',
  'togglegroup',
  'drawer',
  'loader',
  'skeleton',
  'code',
  'kbd',
  'avatar',
  'grid',
  'pagination',
  'scroll',
  'tree',
  'nav',
  'contents',
  'picker',
  'calendar',
  'drilldown',
  'opacity',
  'shadow',
] as const;

export function validatePaths(paths: Iterable<string>, loc: string): void {
  for (const path of paths) {
    if (!PATH_RE.test(path)) fail(`${loc} token "${path}" must be lowercase dot segments`);
  }
}

export function validateReservedRoots(paths: Iterable<string>, loc: string): void {
  for (const path of paths) {
    const root = path.slice(0, path.indexOf('.'));
    if (!RESERVED_ROOTS.includes(root as (typeof RESERVED_ROOTS)[number])) {
      fail(`${loc} token "${path}" uses reserved-root-violating category "${root}"`);
    }
  }
}

export function validateParity(
  light: Map<string, TokenNode>,
  dark: Map<string, TokenNode>,
  label = 'appearance',
  [first, second]: [string, string] = ['light', 'dark'],
): void {
  const differences = keyDifferences(light.keys(), dark.keys(), first, second);
  if (differences) fail(`${label} ${first}/${second} key trees differ: ${differences}`);
}

/**
 * Names the keys only one of two lists has, at most five, as
 * `"a" only in light, "b" only in dark`; empty when the lists match.
 */
function keyDifferences(a: Iterable<string>, b: Iterable<string>, aName: string, bName: string): string {
  const left = new Set(a);
  const right = new Set(b);
  const missing = [
    ...[...left].filter((key) => !right.has(key)).map((key) => `"${key}" only in ${aName}`),
    ...[...right].filter((key) => !left.has(key)).map((key) => `"${key}" only in ${bName}`),
  ];
  if (missing.length === 0) return '';
  return missing.length > 5 ? `${missing.slice(0, 5).join(', ')} and ${missing.length - 5} more` : missing.join(', ');
}

export function validateDensitySpaceOnly(tokens: Map<string, TokenNode>, loc: string): void {
  for (const path of tokens.keys()) {
    if (!path.startsWith('space.')) fail(`${loc} density token "${path}" must be under space.*`);
  }
}

function collectGroups(paths: Iterable<string>): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const i = path.lastIndexOf('.');
    if (i === -1) continue;
    const group = path.slice(0, i);
    const leaf = path.slice(i + 1);
    const list = groups.get(group) ?? [];
    list.push(leaf);
    groups.set(group, list);
  }
  return groups;
}

function matchesGroup(pattern: string, group: string): boolean {
  const want = pattern.split('.');
  const have = group.split('.');
  return want.length === have.length && want.every((segment, i) => segment === '*' || segment === have[i]);
}

export function validateSlots(tokens: Map<string, TokenNode>, slots: SlotRules, loc: string): void {
  const groups = collectGroups(tokens.keys());
  for (const [pattern, expected] of Object.entries(slots)) {
    const want = [...expected].sort();
    let matched = false;
    for (const [group, leaves] of groups) {
      if (!matchesGroup(pattern, group)) continue;
      matched = true;
      const have = [...leaves].sort();
      if (have.length !== want.length || have.some((leaf, i) => leaf !== want[i])) {
        fail(`${loc} "${group}" must have exactly ${expected.join('|')}`);
      }
    }
    if (!matched) fail(`${loc} slot group "${pattern}" matches no tokens`);
  }
}

/**
 * Every context of an alias modifier declares `<root>.<context>.…`; with the
 * context segment removed, each must declare the same tokens as the default.
 */
export function validateAliasParity(contexts: Map<string, Iterable<string>>, defaultContext: string, loc: string): void {
  const shape = (context: string, paths: Iterable<string>) =>
    [...paths]
      .map((path) => {
        const parts = path.split('.');
        return parts[1] === context ? [parts[0], ...parts.slice(2)].join('.') : path;
      })
      .sort();
  const expected = shape(defaultContext, contexts.get(defaultContext) ?? []);
  for (const [context, paths] of contexts) {
    const differences = keyDifferences(expected, shape(context, paths), `"${defaultContext}"`, `"${context}"`);
    if (differences) fail(`${loc} context "${context}" must declare the same tokens as "${defaultContext}": ${differences}`);
  }
}

export type LayerChecks = {
  rules?: readonly Rule[];
  slots?: SlotRules;
  /** Tokens these extend (Todae's, for a company layer); group rules see them merged. */
  inherited?: Map<string, TokenNode>;
};

/** Validates one merged set or context and serializes its tokens. */
export function layerTokens(
  flat: Map<string, TokenNode>,
  layer: Layer,
  context: string | undefined,
  checks: LayerChecks = {},
): FlatToken[] {
  const loc = context ? `${layer}/${context}` : layer;
  const rules = checks.rules ?? [];
  validatePaths(flat.keys(), loc);
  if (rules.includes('reserved-roots')) validateReservedRoots(flat.keys(), loc);
  if (rules.includes('density-space')) validateDensitySpaceOnly(flat, loc);
  const whole = checks.inherited ? new Map([...checks.inherited, ...flat]) : flat;
  if (checks.slots) validateSlots(whole, checks.slots, loc);
  const tokens: FlatToken[] = [];
  for (const [path, node] of flat) {
    const { ref, refs, cssValue } = serializeValue(node, path);
    tokens.push({
      path,
      type: node.$type ?? '',
      value: node.$value,
      ref,
      refs,
      cssVar: cssVarName(path),
      cssValue,
      layer,
      context,
      ...(node.$description === undefined ? {} : { description: node.$description }),
    });
  }
  return tokens;
}

export function tokenMapOf(tokens: FlatToken[]): Map<string, TokenNode> {
  return new Map(tokens.map((t) => [t.path, { $type: t.type, $value: t.value }]));
}

/** Context-level checks that need a modifier's full set of contexts. */
export function validateEntries(entries: ResolvedEntry[]): void {
  for (const entry of entries) {
    if (entry.kind !== 'modifier') continue;
    const { extension, defaultContext, contexts } = entry;
    const loc = `modifier "${entry.name}"`;
    const defaults = contexts.get(defaultContext);
    if (!defaults) fail(`${loc} default must name one of its contexts`);
    if (extension.alias) {
      validateAliasParity(
        new Map([...contexts].map(([context, tokens]) => [context, tokens.map((t) => t.path)])),
        defaultContext,
        loc,
      );
      const root = aliasGroups([entry])[0]!.root;
      for (const [context, tokens] of contexts) {
        const stray = tokens.find((t) => !t.path.startsWith(`${root}.${context}.`));
        if (stray) fail(`${loc} context "${context}" token "${stray.path}" must be under ${root}.${context}.*`);
      }
      continue;
    }
    for (const [context, tokens] of contexts) {
      if (context === defaultContext) continue;
      const label = extension.layer === 'appearance' ? 'appearance' : loc;
      validateParity(tokenMapOf(defaults), tokenMapOf(tokens), label, [defaultContext, context]);
    }
  }
}
