import { aliasGroups, cssVarName, serializeValue } from './serialize.ts';
import { PATH_RE, entryTokens, fail, type FlatToken, type Layer, type ResolvedEntry, type Rule, type SlotRules, type TokenNode } from './shared.ts';

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

/** Maps every group to the names of its children, tokens and subgroups alike. */
function collectGroups(paths: Iterable<string>): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();
  for (const path of paths) {
    const parts = path.split('.');
    for (let i = 1; i < parts.length; i++) {
      const group = parts.slice(0, i).join('.');
      const children = groups.get(group) ?? new Set<string>();
      children.add(parts[i]!);
      groups.set(group, children);
    }
  }
  return groups;
}

function matchesGroup(pattern: string, group: string): boolean {
  const want = pattern.split('.');
  const have = group.split('.');
  return want.length === have.length && want.every((segment, i) => segment === '*' || segment === have[i]);
}

/**
 * Each group a slot pattern matches has exactly the listed children, so a
 * slot closes its group: a token or subgroup it doesn't list is an error.
 */
export function validateSlots(tokens: Map<string, TokenNode>, slots: SlotRules, loc: string): void {
  const groups = collectGroups(tokens.keys());
  for (const [pattern, expected] of Object.entries(slots)) {
    let matched = false;
    for (const [group, children] of groups) {
      if (!matchesGroup(pattern, group)) continue;
      matched = true;
      const missing = expected.filter((key) => !children.has(key));
      const extra = [...children].filter((key) => !expected.includes(key));
      if (missing.length === 0 && extra.length === 0) continue;
      const parts = [
        ...missing.map((key) => `"${group}.${key}" is missing`),
        ...extra.map((key) => `"${group}.${key}" is not one of them`),
      ];
      fail(`${loc} "${group}" must have exactly ${expected.join('|')}: ${parts.join(', ')}`);
    }
    if (matched) continue;
    const cut = pattern.lastIndexOf('.');
    const parent = cut === -1 ? undefined : [...groups.keys()].find((group) => matchesGroup(pattern.slice(0, cut), group));
    if (parent) fail(`${loc} "${parent}${pattern.slice(cut)}" is missing; it must have ${expected.join('|')}`);
    fail(`${loc} slot group "${pattern}" matches no tokens`);
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
  const roots = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind !== 'modifier' || !entry.extension.alias) continue;
    const { root } = aliasGroups([entry])[0]!;
    const first = roots.get(root);
    if (first) fail(`modifier "${entry.name}" and modifier "${first}" both alias ${root}.*; make one of them a context of the other`);
    roots.set(root, entry.name);
  }
  validateSlotOwners(entries);
  for (const entry of entries) {
    if (entry.kind !== 'modifier') continue;
    const { extension, defaultContext, contexts } = entry;
    const loc = `modifier "${entry.name}"`;
    const defaults = contexts.get(defaultContext);
    if (!defaults) fail(`${loc} default must name one of its contexts`);
    if (extension.alias) {
      const root = aliasGroups([entry])[0]!.root;
      // A context and `<root>.base` both feed `--todae-<root>-*`, so each
      // name under the root belongs to one of them.
      const shared = new Set(
        entries
          .flatMap(entryTokens)
          .filter((t) => t.path.startsWith(`${root}.base.`))
          .map((t) => t.path.split('.')[2]!),
      );
      const baseFeeds = new Map(
        entries
          .flatMap(entryTokens)
          .filter((t) => t.path.startsWith(`${root}.base.`))
          .map((t) => [cssVarName(`${root}.${t.path.slice(root.length + 6)}`), t.path] as const),
      );
      // A context named like a group under the root (`bg`, `radius`) would
      // make `<root>.<name>.*` mean two things.
      const names = new Set([
        ...shared,
        ...[...contexts.values()].flat().map((t) => t.path.split('.')[2]!),
      ]);
      for (const context of contexts.keys()) {
        if (names.has(context)) fail(`${loc} context "${context}" is named like ${root}.<context>.${context}; pick another name`);
      }
      // Only a context declares `<root>.<context>.*`. When the root has a
      // `<root>.base`, as button does, that is where its shared tokens live,
      // so the modifier owns all of `<root>.*`.
      for (const other of entries) {
        if (other === entry) continue;
        for (const t of entryTokens(other)) {
          if (!t.path.startsWith(`${root}.`) || t.path.startsWith(`${root}.base.`)) continue;
          const context = t.path.split('.')[1]!;
          if (contexts.has(context)) fail(`${other.kind} "${other.name}" token "${t.path}" belongs in context "${context}" of ${loc}`);
          if (baseFeeds.size > 0) fail(`${other.kind} "${other.name}" token "${t.path}" must be in a context of ${loc} or under ${root}.base`);
        }
      }
      for (const [context, tokens] of contexts) {
        const stray = tokens.find((t) => !t.path.startsWith(`${root}.${context}.`));
        if (stray) fail(`${loc} context "${context}" token "${stray.path}" must be under ${root}.${context}.*`);
        const base = tokens.find((t) => shared.has(t.path.split('.')[2]!));
        if (base) {
          const name = base.path.split('.')[2]!;
          fail(`${loc} context "${context}" token "${base.path}" sets "${name}", which ${root}.base also sets; declare ${name} on ${root}.base or in every context, not both`);
        }
        for (const t of tokens) {
          const feeds = `${root}.${t.path.slice(root.length + context.length + 2)}`;
          const twin = baseFeeds.get(cssVarName(feeds));
          if (twin) fail(`${loc} context "${context}" token "${t.path}" and "${twin}" both feed ${cssVarName(feeds)}; rename one of them`);
        }
      }
      validateAliasParity(
        new Map([...contexts].map(([context, tokens]) => [context, tokens.map((t) => t.path)])),
        defaultContext,
        loc,
      );
      continue;
    }
    for (const [context, tokens] of contexts) {
      if (context === defaultContext) continue;
      const label = extension.layer === 'appearance' ? 'appearance' : loc;
      validateParity(tokenMapOf(defaults), tokenMapOf(tokens), label, [defaultContext, context]);
    }
  }
}

/**
 * A slot group closes its group for the whole build: a token under it
 * belongs in the set or modifier that declares the slot, where the slot
 * checks it.
 */
function validateSlotOwners(entries: ResolvedEntry[]): void {
  for (const owner of entries) {
    const patterns = Object.keys(owner.extension.slots ?? {});
    if (patterns.length === 0) continue;
    for (const other of entries) {
      if (other === owner) continue;
      for (const t of entryTokens(other)) {
        const parts = t.path.split('.');
        for (let i = 1; i < parts.length; i++) {
          const group = parts.slice(0, i).join('.');
          const pattern = patterns.find((p) => matchesGroup(p, group));
          if (pattern) {
            fail(`${other.kind} "${other.name}" token "${t.path}" is under "${group}", which ${owner.kind} "${owner.name}" closes with slot group "${pattern}"; declare it there`);
          }
        }
      }
    }
  }
}
