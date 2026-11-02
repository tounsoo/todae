import { aliasGroups, consumeCssVar } from './serialize.ts';
import { LAYER_RANK, didYouMean, entryTokens, fail, type EntryToken, type FlatToken, type Layer, type ResolvedEntry } from './shared.ts';

const LAYER_ORDER = Object.keys(LAYER_RANK).join(' < ');

/**
 * Refs must exist, form no cycle, and point at a lower layer, or at a token
 * `inScope` allows: one declared alongside in the same set or modifier
 * context, or in an earlier entry of the same layer.
 */
export function validateRefs(
  tokens: FlatToken[],
  known: Map<string, Layer>,
  inScope: (from: string, to: string) => boolean = () => false,
): void {
  const layerPaths = new Map<string, Layer>();
  for (const [path, layer] of known) layerPaths.set(path, layer);
  const byPath = new Map<string, FlatToken[]>();
  for (const token of tokens) {
    const list = byPath.get(token.path);
    if (list) list.push(token);
    else byPath.set(token.path, [token]);
  }
  // A path followed in a context checks the same refs whoever reached it, so
  // each (path, context) is walked once. `stack` holds the chain being walked.
  const done = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  // Follows a ref chain within one modifier context: light and dark may each
  // alias the other way round without forming a cycle.
  function resolveLayer(path: string, from: Layer, fromPath: string, context: string | undefined): void {
    const targetLayer = layerPaths.get(path);
    if (!targetLayer) fail(`token "${fromPath}" reads $ref "${path}", which does not exist${didYouMean(path, layerPaths.keys())}`);
    if (LAYER_RANK[targetLayer] >= LAYER_RANK[from] && !inScope(fromPath, path)) {
      fail(
        `token "${fromPath}" reads $ref "${path}" from the ${targetLayer} layer, but a $ref must point at a lower layer than ${from}` +
          ` (${LAYER_ORDER}), at a token in its own set or context, or at an earlier set or modifier of its own layer`,
      );
    }
    const key = `${path}\u0000${context ?? ''}`;
    if (onStack.has(key)) fail(`$ref cycle: ${[...stack, path].join(' -> ')}`);
    if (done.has(key)) return;
    onStack.add(key);
    stack.push(path);
    const candidates = (byPath.get(path) ?? []).filter((t) => t.layer === targetLayer);
    const inContext = candidates.filter((t) => t.context === context);
    for (const target of inContext.length > 0 ? inContext : candidates) {
      for (const ref of target.refs) resolveLayer(ref.path, targetLayer, path, target.context ?? context);
    }
    stack.pop();
    onStack.delete(key);
    done.add(key);
  }

  for (const token of tokens) {
    const key = `${token.path}\u0000${token.context ?? ''}`;
    onStack.add(key);
    stack.push(token.path);
    for (const ref of token.refs) resolveLayer(ref.path, token.layer, token.path, token.context);
    stack.pop();
    onStack.delete(key);
  }
}

/** Who declares each path: its owner's label, its resolutionOrder position and its layer. */
type Declarations = {
  owner: Map<string, string>;
  position: Map<string, number>;
  known: Map<string, Layer>;
};

/** Graph-level checks: one owner per token, refs, layer and resolution order. Returns every token. */
export function checkGraph(entries: ResolvedEntry[]): EntryToken[] {
  const declarations: Declarations = { owner: new Map(), position: new Map(), known: new Map() };
  const { owner, position, known } = declarations;
  const all: EntryToken[] = [];
  const rootOnly: FlatToken[] = [];
  let rootSet = true;
  for (const [index, entry] of entries.entries()) {
    if (entry.kind === 'set' && rootSet) rootOnly.push(...entry.tokens);
    if (entry.kind === 'modifier' && !entry.extension.alias) rootSet = false;
    const declared =
      entry.kind === 'set'
        ? entry.tokens
        : entry.extension.alias
          ? [...entry.contexts.values()].flat()
          : entry.contexts.get(entry.defaultContext)!;
    for (const token of declared) {
      const previous = owner.get(token.path);
      if (previous) fail(`token "${token.path}" is declared by both ${previous} and ${entry.kind} "${entry.name}"; declare it in one of them`);
      owner.set(token.path, `${entry.kind} "${entry.name}"`);
      position.set(token.path, index);
      known.set(token.path, token.layer);
    }
    all.push(...entryTokens(entry));
  }
  checkTypes(all);
  // A later entry may read an earlier one of its layer, e.g. a button variant reads focus.ring.color.
  validateRefs(all, known, (from, to) => {
    const [at, target] = [position.get(from)!, position.get(to)!];
    return at === target || (target < at && known.get(from) === known.get(to));
  });
  checkRootAliases(rootOnly);
  checkAlphaRanges(all);
  checkOrder(entries, all, declarations);
  checkConsumeVars(entries, all);
  return all;
}

function checkTypes(all: EntryToken[]): void {
  const types = new Map<string, string>();
  for (const token of all) {
    const seen = types.get(token.path);
    if (seen && seen !== token.type) fail(`token "${token.path}" has $type ${seen} and ${token.type} across contexts`);
    types.set(token.path, token.type);
  }
  for (const token of all) {
    for (const ref of token.refs) {
      const target = types.get(ref.path);
      if (target === undefined || target === ref.type) continue;
      if (ref.role === 'value') {
        fail(`token "${token.path}" is a ${token.type} but references the ${target} "${ref.path}"`);
      }
      fail(`token "${token.path}" ${ref.role} must reference a ${ref.type}, not the ${target} "${ref.path}"`);
    }
  }
}

/**
 * Sets before the first scoped modifier are declared on :root alone, so an
 * alias there resolves once: an override of its target below :root, on a
 * provider or a [data-*] element, would never reach it.
 */
function checkRootAliases(rootOnly: FlatToken[]): void {
  const rootAlias = rootOnly.find((token) => token.refs.length > 0);
  if (rootAlias) {
    fail(
      `token "${rootAlias.path}" is declared only on :root, so it can't reference "${rootAlias.refs[0]!.path}";` +
        ' give it a literal value, or move it to a set listed after the first modifier in resolutionOrder',
    );
  }
}

/**
 * An alpha must land in [0, 1] in every context its number token takes.
 * Each alpha target is walked once, with its own `seen` set, so a loop
 * across contexts (light reads b, dark reads a) ends the walk. The walk
 * keeps its own stack, so a long alias chain cannot overflow the call
 * stack, and visits literals in the order a depth-first walk reaches them.
 */
function checkAlphaRanges(all: EntryToken[]): void {
  const byPath = new Map<string, FlatToken[]>();
  for (const token of all) {
    const list = byPath.get(token.path);
    if (list) list.push(token);
    else byPath.set(token.path, [token]);
  }
  const outOfRange = new Map<string, number | null>();
  function firstOutOfRange(root: string): number | null {
    const cached = outOfRange.get(root);
    if (cached !== undefined) return cached;
    const seen = new Set<string>();
    const stack: ({ path: string } | { value: number })[] = [{ path: root }];
    let found: number | null = null;
    while (stack.length > 0) {
      const item = stack.pop()!;
      if ('value' in item) {
        if (item.value < 0 || item.value > 1) {
          found = item.value;
          break;
        }
        continue;
      }
      if (seen.has(item.path)) continue;
      seen.add(item.path);
      const tokens = byPath.get(item.path) ?? [];
      for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i]!;
        if (token.refs.length === 0) stack.push({ value: token.value as number });
        else for (let j = token.refs.length - 1; j >= 0; j--) stack.push({ path: token.refs[j]!.path });
      }
    }
    outOfRange.set(root, found);
    return found;
  }
  for (const token of all) {
    for (const ref of token.refs) {
      if (ref.role !== 'alpha') continue;
      const out = firstOutOfRange(ref.path);
      if (out !== null) fail(`token "${token.path}" alpha "${ref.path}" must stay in [0, 1], not ${out}`);
    }
  }
}

/**
 * CSS places each entry by its resolutionOrder position, so an alias to a
 * later entry would resolve before that entry's context is applied. Scoped
 * modifier blocks are not re-declared when another modifier's context
 * changes, so they may not alias each other either.
 */
function checkOrder(entries: ResolvedEntry[], all: EntryToken[], { owner, position }: Declarations): void {
  const scoped = (entry: ResolvedEntry | undefined) => entry?.kind === 'modifier' && !entry.extension.alias;
  // Paths that read others, so a walk can run from what is read back to its readers.
  const readers = new Map<string, Set<string>>();
  for (const token of all) {
    for (const { path } of token.refs) {
      const set = readers.get(path);
      if (set) set.add(token.path);
      else readers.set(path, new Set([token.path]));
    }
  }
  // For one entry, each path that reaches (at any depth) a token another scoped
  // modifier declares, mapped to that token. One backward walk per entry.
  const reachCache = new Map<number, Map<string, string>>();
  function scopedReach(from: number): Map<string, string> {
    const cached = reachCache.get(from);
    if (cached) return cached;
    const reach = new Map<string, string>();
    const queue: string[] = [];
    for (const [path, at] of position) {
      if (at !== from && scoped(entries[at])) {
        reach.set(path, path);
        queue.push(path);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const path = queue[i]!;
      for (const reader of readers.get(path) ?? []) {
        if (reach.has(reader)) continue;
        reach.set(reader, reach.get(path)!);
        queue.push(reader);
      }
    }
    reachCache.set(from, reach);
    return reach;
  }
  for (const [index, entry] of entries.entries()) {
    for (const token of entryTokens(entry)) {
      for (const { path: ref } of token.refs) {
        const target = position.get(ref) ?? -1;
        if (target > index) {
          fail(
            `token "${token.path}" references "${ref}" from ${owner.get(ref)}, which must come earlier in resolutionOrder;` +
              ` list ${owner.get(ref)} before ${entry.kind} "${entry.name}"`,
          );
        }
        const dependency = scoped(entry) ? (scopedReach(index).get(ref) ?? null) : null;
        if (dependency) {
          fail(
            `token "${token.path}" in ${entry.kind} "${entry.name}" depends on "${dependency}" from ${owner.get(dependency)}; scoped modifiers may not alias each other,` +
              ' so give it a literal value or a $ref to a token that reads no scoped modifier\'s tokens, such as a core token',
          );
        }
      }
    }
  }
}

/**
 * Each context of an alias modifier, and `<root>.base`, feed the consume vars
 * components read (`button.primary.bg.default` and `button.base.radius` feed
 * `--todae-button-bg-default` and `--todae-button-radius`). A token whose own
 * var is one of those would fight it. A context and the base feeding the same
 * var is caught earlier, in `validateEntries`.
 */
function checkConsumeVars(entries: ResolvedEntry[], all: EntryToken[]): void {
  const groups = aliasGroups(entries);
  if (groups.length === 0) return;
  const fedBy = new Map<string, string>();
  for (const token of all) {
    const consume = consumeCssVar(token.path, groups);
    if (consume !== null && !fedBy.has(consume)) fedBy.set(consume, token.path);
  }
  for (const token of all) {
    if (consumeCssVar(token.path, groups) !== null) continue;
    const feeder = fedBy.get(token.cssVar);
    if (feeder) fail(`token "${token.path}" declares ${token.cssVar}, which "${feeder}" feeds; declare it in a context of that modifier or under its base`);
  }
}
