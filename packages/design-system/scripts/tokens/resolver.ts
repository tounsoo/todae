import { dirname, join, relative, resolve, sep } from 'node:path';
import { insideRoot, readJson } from './io.ts';
import { layerTokens, tokenMapOf, validateEntries } from './rules.ts';
import {
  LAYER_RANK,
  PATH_RE,
  RULES,
  entryTokens,
  fail,
  isFiniteNumber,
  isRecord,
  type ContrastPair,
  type EntryToken,
  type FlatToken,
  type Layer,
  type ResolvedEntry,
  type Rule,
  type SlotRules,
  type TodaeExtension,
  type TokenEntry,
  type TokenNode,
  type TokenTree,
} from './shared.ts';

function isToken(value: unknown): value is TokenNode {
  return isRecord(value) && '$value' in value;
}

function sortKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

export function flattenTokens(tree: TokenTree, inheritedType?: string): Map<string, TokenNode> {
  const out = new Map<string, TokenNode>();
  function describe(node: Record<string, unknown>, path: string, inherited?: string): string | undefined {
    if (node.$description === undefined) return inherited;
    if (typeof node.$description !== 'string' || node.$description.trim() === '') {
      fail(`$description at "${path || '(root)'}" must be a non-empty string`);
    }
    return node.$description;
  }
  function walk(node: unknown, path: string, type?: string, description?: string) {
    if (!isRecord(node)) fail(`Token node at "${path || '(root)'}" must be an object`);
    if (isToken(node)) {
      if (!path) fail('Token is missing a path');
      const resolvedType = typeof node.$type === 'string' ? node.$type : type;
      if (!resolvedType) fail(`Token "${path}" is missing $type`);
      const own = describe(node, path, description);
      out.set(path, own === undefined ? { $type: resolvedType, $value: node.$value } : { $type: resolvedType, $value: node.$value, $description: own });
      return;
    }
    const nextType = typeof node.$type === 'string' ? node.$type : type;
    const nextDescription = describe(node, path, description);
    for (const key of sortKeys(Object.keys(node))) {
      if (key.startsWith('$')) continue;
      walk(node[key], path ? `${path}.${key}` : key, nextType, nextDescription);
    }
  }
  walk(tree, '', inheritedType);
  return out;
}

function asTree(value: unknown, loc: string): TokenTree {
  if (!isRecord(value)) fail(`${loc} must be an object`);
  return value as TokenTree;
}

function collectFileRefs(value: unknown, out: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectFileRefs(item, out);
    return;
  }
  if (!isRecord(value)) return;
  if (typeof value.$ref === 'string' && !value.$ref.startsWith('#')) out.push(value.$ref);
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref') continue;
    collectFileRefs(child, out);
  }
}

export const TODAE_EXTENSION = 'dev.todae';

const ATTRIBUTE_RE = /^data-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CONTEXT_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const SLOT_GROUP_RE = /^(?:\*|[a-z0-9]+(?:-[a-z0-9]+)*)(?:\.(?:\*|[a-z0-9]+(?:-[a-z0-9]+)*))*$/;
const SLOT_LEAF_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseRules(rules: unknown, loc: string): { rules?: Rule[] } {
  if (rules === undefined) return {};
  if (!Array.isArray(rules)) fail(`${loc} rules must be an array`);
  for (const rule of rules) {
    if (!RULES.includes(rule as Rule)) fail(`${loc} rule "${String(rule)}" must be one of ${RULES.join('|')}`);
  }
  if (new Set(rules).size !== rules.length) fail(`${loc} rules must not repeat`);
  return { rules: rules as Rule[] };
}

function parseSlots(slots: unknown, loc: string): { slots?: SlotRules } {
  if (slots === undefined) return {};
  if (!isRecord(slots)) fail(`${loc} slots must map token groups to child names`);
  for (const [group, leaves] of Object.entries(slots)) {
    if (!SLOT_GROUP_RE.test(group)) fail(`${loc} slot group "${group}" must be lowercase dot segments or *`);
    if (
      !Array.isArray(leaves) ||
      leaves.length === 0 ||
      leaves.some((leaf) => typeof leaf !== 'string' || !SLOT_LEAF_RE.test(leaf)) ||
      new Set(leaves).size !== leaves.length
    ) {
      fail(`${loc} slot group "${group}" must list distinct lowercase child names`);
    }
  }
  return { slots: slots as SlotRules };
}

function parseContrast(contrast: unknown, loc: string): { contrast?: ContrastPair[] } {
  if (contrast === undefined) return {};
  if (!Array.isArray(contrast) || contrast.length === 0) fail(`${loc} contrast must be a non-empty array of pairs`);
  const seen = new Set<string>();
  for (const [i, pair] of contrast.entries()) {
    const at = `${loc} contrast[${i}]`;
    if (!isRecord(pair)) fail(`${at} must be { fg, bg, min, over? }`);
    const extra = Object.keys(pair).find((key) => !['fg', 'bg', 'min', 'over'].includes(key));
    if (extra) fail(`${at} has unknown key "${extra}"`);
    for (const key of ['fg', 'bg'] as const) {
      if (typeof pair[key] !== 'string' || !PATH_RE.test(pair[key])) fail(`${at} ${key} must be a token path`);
    }
    if (!isFiniteNumber(pair.min) || pair.min <= 0 || pair.min > 108) fail(`${at} min must be an APCA Lc above 0 and at most 108`);
    if (
      pair.over !== undefined &&
      (!Array.isArray(pair.over) ||
        pair.over.length === 0 ||
        pair.over.some((path) => typeof path !== 'string' || !PATH_RE.test(path)) ||
        new Set(pair.over).size !== pair.over.length)
    ) {
      fail(`${at} over must list distinct token paths`);
    }
    const key = `${pair.fg} on ${pair.bg}`;
    if (seen.has(key)) fail(`${at} repeats ${key}`);
    seen.add(key);
  }
  return { contrast: contrast as ContrastPair[] };
}

const pairKey = (pair: ContrastPair) => `${pair.fg} on ${pair.bg}`;

/** `pair`, keeping `upstream`'s surfaces when it lists none of its own. */
function retune(pair: ContrastPair, upstream: ContrastPair | undefined): ContrastPair {
  return pair.over === undefined && upstream?.over !== undefined ? { ...pair, over: upstream.over } : pair;
}

/**
 * Upstream pairs plus the extension's own. A pair naming the same fg and bg
 * replaces the upstream one, and keeps its `over` unless it lists its own.
 */
function mergeContrast(base: readonly ContrastPair[] = [], own: readonly ContrastPair[] = []): ContrastPair[] {
  const merged = new Map(base.map((pair) => [pairKey(pair), pair]));
  for (const pair of own) merged.set(pairKey(pair), retune(pair, merged.get(pairKey(pair))));
  return [...merged.values()];
}

export function parseExtension(def: Record<string, unknown>, kind: 'set' | 'modifier', loc: string): TodaeExtension {
  const extensions = def.$extensions;
  const ext = isRecord(extensions) ? extensions[TODAE_EXTENSION] : undefined;
  if (!isRecord(ext)) fail(`${loc} must declare $extensions["${TODAE_EXTENSION}"]`);
  const { layer, attribute, root, colorScheme, alias, rules, slots, contrast } = ext;
  const known = ['layer', 'rules', 'slots', 'contrast', ...(kind === 'modifier' ? ['attribute', 'root', 'colorScheme', 'alias'] : [])];
  const unknown = Object.keys(ext).find((key) => !known.includes(key));
  if (unknown) fail(`${loc} has unknown ${TODAE_EXTENSION} key "${unknown}" (allowed: ${known.join(', ')})`);
  if (typeof layer !== 'string' || !Object.hasOwn(LAYER_RANK, layer)) {
    fail(`${loc} layer must be one of ${Object.keys(LAYER_RANK).join('|')}`);
  }
  const checks = { ...parseRules(rules, loc), ...parseSlots(slots, loc), ...parseContrast(contrast, loc) };
  for (const [key, value] of Object.entries({ root, colorScheme, alias })) {
    if (value !== undefined && typeof value !== 'boolean') fail(`${loc} ${key} must be a boolean`);
  }
  if (kind === 'set') return { layer: layer as Layer, ...checks };
  if (typeof attribute !== 'string' || !ATTRIBUTE_RE.test(attribute)) {
    fail(`${loc} attribute must be a lowercase data-* attribute`);
  }
  if (alias && (root || colorScheme)) fail(`${loc} an alias modifier cannot set root or colorScheme`);
  return {
    layer: layer as Layer,
    ...checks,
    attribute,
    ...(root === true ? { root } : {}),
    ...(colorScheme === true ? { colorScheme } : {}),
    ...(alias === true ? { alias } : {}),
  };
}

async function loadSources(sources: unknown, loc: string, tokensRoot: string): Promise<{ loc: string; tree: TokenTree }[]> {
  if (!Array.isArray(sources) || sources.length === 0) fail(`${loc} must be a non-empty array of sources`);
  const out: { loc: string; tree: TokenTree }[] = [];
  for (const [i, source] of sources.entries()) {
    if (!isRecord(source)) fail(`${loc}[${i}] must be an object`);
    if (!('$ref' in source)) {
      out.push({ loc: `${loc}[${i}]`, tree: asTree(source, `${loc}[${i}]`) });
      continue;
    }
    const ref = source.$ref;
    if (typeof ref !== 'string' || ref.includes('#')) {
      fail(`${loc}[${i}] $ref must be a relative token file path`);
    }
    const abs = resolve(tokensRoot, ref);
    if (!insideRoot(tokensRoot, abs)) fail(`resolver $ref "${ref}" escapes tokens/`);
    const file = relative(tokensRoot, abs).split(sep).join('/');
    out.push({ loc: file, tree: asTree(await readJson(abs, tokensRoot), file) });
  }
  return out;
}

type LoadTokensOptions = {
  sources: unknown;
  loc: string;
  tokensRoot: string;
  /** Stamped on every token loaded. */
  entry: TokenEntry;
  extension: TodaeExtension;
  /** The modifier context being loaded, which places the tokens. */
  context?: string;
  /** Todae's tokens for the same entry and context, which an extension's shape rules see. */
  inherited: FlatToken[];
  /** The entry that declares each of Todae's tokens. */
  todaeOwners: ReadonlyMap<string, TokenEntry>;
};

/** Loads one set's or context's sources and stamps each token with its entry. */
async function loadTokens({
  sources,
  loc,
  tokensRoot,
  entry,
  extension,
  context,
  inherited,
  todaeOwners,
}: LoadTokensOptions): Promise<EntryToken[]> {
  const merged = new Map<string, TokenNode>();
  for (const source of await loadSources(sources, loc, tokensRoot)) {
    // A later source's description wins; one with none (its own or a group's) keeps the
    // earlier source's. Precedence across contexts and over Todae is settleDescriptions'.
    for (const [path, node] of flattenTokens(source.tree)) {
      const description = node.$description ?? merged.get(path)?.$description;
      merged.set(path, description === undefined ? node : { ...node, $description: description });
    }
  }
  // Checked before the shape rules, whose messages would otherwise describe the wrong entry.
  for (const path of merged.keys()) checkPlacement(todaeOwners.get(path), entry, path, loc);
  const { layer, rules, slots } = extension;
  return layerTokens(merged, layer, context, { rules, slots, inherited: tokenMapOf(inherited) }).map((token) => ({
    ...token,
    entry,
  }));
}

/**
 * Fails when one of Todae's tokens is declared outside the entry that owns it, naming that entry.
 * Comparing `context` whole relies on a company entry matching its Todae entry's `alias`
 * (MATCHED_EXTENSION_KEYS), so both entries carry a context or neither does.
 */
function checkPlacement(owner: TokenEntry | undefined, entry: TokenEntry, path: string, loc: string): void {
  if (!owner || (owner.kind === entry.kind && owner.name === entry.name && owner.context === entry.context)) return;
  const where =
    owner.kind === 'set'
      ? `a set named "${owner.name}"`
      : owner.context === undefined
        ? `a context of the modifier named "${owner.name}"`
        : `context "${owner.context}" of the modifier named "${owner.name}"`;
  fail(`${loc}: token "${path}" belongs to Todae's ${owner.kind} "${owner.name}", so override it in ${where}`);
}


const MATCHED_EXTENSION_KEYS = ['layer', 'attribute', 'root', 'colorScheme', 'alias'] as const;

/**
 * Loads a resolver and the token files it names. With `upstream` (Todae's own
 * entries), a set or modifier that shares an upstream name extends it: it must
 * keep the upstream layer and CSS placement, and a modifier inherits the
 * upstream default context.
 */
export async function loadResolver(resolverFile: string, upstream: ResolvedEntry[] = []): Promise<ResolvedEntry[]> {
  const tokensRoot = dirname(resolve(resolverFile));
  const label = relative(process.cwd(), resolve(resolverFile)) || resolverFile;
  const resolver = await readJson(resolve(resolverFile), tokensRoot);
  if (!isRecord(resolver) || resolver.version !== '2025.10' || !Array.isArray(resolver.resolutionOrder)) {
    fail(`${label} must be Resolver 2025.10 with resolutionOrder`);
  }
  const fileRefs: string[] = [];
  collectFileRefs(resolver, fileRefs);
  for (const ref of fileRefs) {
    const abs = resolve(tokensRoot, ref);
    if (!insideRoot(tokensRoot, abs)) fail(`resolver $ref "${ref}" escapes tokens/`);
  }
  const sets = isRecord(resolver.sets) ? resolver.sets : {};
  const modifiers = isRecord(resolver.modifiers) ? resolver.modifiers : {};
  const upstreamOf = (kind: 'set' | 'modifier', name: string) =>
    upstream.find((entry) => entry.kind === kind && entry.name === name);
  const todaeOwners = new Map<string, TokenEntry>();
  for (const entry of upstream) {
    for (const token of entryTokens(entry)) todaeOwners.set(token.path, token.entry);
  }

  const order: { kind: 'set' | 'modifier'; name: string; def: Record<string, unknown>; extension: TodaeExtension }[] = [];
  const seen = new Set<string>();
  for (const [i, item] of resolver.resolutionOrder.entries()) {
    const ref = isRecord(item) ? item.$ref : undefined;
    const match = typeof ref === 'string' ? ref.match(/^#\/(sets|modifiers)\/([^/]+)$/) : null;
    if (!match) fail(`resolutionOrder[${i}] must be { "$ref": "#/sets/…" } or { "$ref": "#/modifiers/…" }`);
    const kind = match[1] === 'sets' ? 'set' : 'modifier';
    const name = match[2]!.replaceAll('~1', '/').replaceAll('~0', '~');
    const def = (kind === 'set' ? sets : modifiers)[name];
    if (!isRecord(def)) fail(`resolutionOrder[${i}] ${match[0]} does not exist`);
    if (seen.has(match[0])) fail(`resolutionOrder lists ${match[0]} twice`);
    seen.add(match[0]);
    const loc = `${kind} "${name}"`;
    const extension = parseExtension(def, kind, loc);
    const base = upstreamOf(kind, name);
    if (base) {
      const changed = MATCHED_EXTENSION_KEYS.find((key) => extension[key] !== base.extension[key]);
      if (changed) {
        const want = base.extension[changed];
        fail(`${loc} extends Todae's ${kind} "${name}", so ${want === undefined ? `leave out ${changed}` : `its ${changed} must be ${JSON.stringify(want)}`}`);
      }
      // An extension keeps Todae's structural rules and slot shapes, plus its
      // own. reserved-roots guards Todae's own namespace, so a company's
      // brand.* tokens are not held to it.
      const inheritedRules = (base.extension.rules ?? []).filter((rule) => rule !== 'reserved-roots');
      const rules = [...new Set([...inheritedRules, ...(extension.rules ?? [])])];
      for (const [group, children] of Object.entries(extension.slots ?? {})) {
        const todae = base.extension.slots?.[group];
        if (todae && (todae.length !== children.length || todae.some((child) => !children.includes(child)))) {
          fail(`${loc} slot group "${group}" is Todae's, so its list must be ${todae.join('|')}; leave it out to keep Todae's`);
        }
      }
      const slots = { ...base.extension.slots, ...extension.slots };
      if (rules.length > 0) extension.rules = rules;
      if (Object.keys(slots).length > 0) extension.slots = slots;
      const contrast = mergeContrast(base.extension.contrast, extension.contrast);
      if (contrast.length > 0) extension.contrast = contrast;
    }
    order.push({ kind, name, def, extension });
  }

  const attributes = new Map<string, string>();
  for (const entry of upstream) {
    if (entry.kind === 'modifier') attributes.set(entry.extension.attribute!, entry.name);
  }
  for (const { kind, name, extension } of order) {
    if (kind !== 'modifier') continue;
    const owner = attributes.get(extension.attribute!);
    if (owner !== undefined && owner !== name) {
      fail(`modifier "${name}" reuses attribute ${extension.attribute}, which modifier "${owner}" sets; give it its own data-* attribute`);
    }
    attributes.set(extension.attribute!, name);
  }

  const entries: ResolvedEntry[] = [];
  for (const { kind, name, def, extension } of order) {
    const loc = `${kind} "${name}"`;
    if (kind === 'set') {
      const upstreamSet = upstreamOf(kind, name);
      entries.push({
        kind,
        name,
        extension,
        tokens: await loadTokens({
          sources: def.sources,
          loc: `${loc} sources`,
          tokensRoot,
          entry: { kind, name },
          extension,
          inherited: upstreamSet?.kind === 'set' ? upstreamSet.tokens : [],
          todaeOwners,
        }),
      });
      continue;
    }
    if (!isRecord(def.contexts) || Object.keys(def.contexts).length === 0) fail(`${loc} must declare contexts`);
    const base = upstreamOf(kind, name);
    const inherited = base?.kind === 'modifier' ? base.defaultContext : undefined;
    const defaultContext = def.default ?? inherited;
    if (inherited !== undefined && defaultContext !== inherited) {
      fail(`${loc} extends Todae's modifier "${name}", so its default must stay "${inherited}"`);
    }
    if (
      typeof defaultContext !== 'string' ||
      (inherited === undefined && !Object.hasOwn(def.contexts, defaultContext))
    ) {
      fail(`${loc} default must name one of its contexts`);
    }
    const contexts = new Map<string, EntryToken[]>();
    for (const [context, sources] of Object.entries(def.contexts)) {
      if (!CONTEXT_RE.test(context)) fail(`${loc} context "${context}" must be lowercase`);
      if (extension.colorScheme && context !== 'light' && context !== 'dark') {
        fail(`${loc} sets colorScheme, so its contexts must be light or dark, not "${context}"`);
      }
      if (extension.alias && context === 'base') fail(`${loc} context "base" is reserved for shared <root>.base tokens`);
      contexts.set(
        context,
        await loadTokens({
          sources,
          loc: `${loc} context "${context}"`,
          tokensRoot,
          entry: { kind, name, ...(extension.alias ? { context } : {}) },
          extension,
          context,
          inherited: base?.kind === 'modifier' ? (base.contexts.get(context) ?? []) : [],
          todaeOwners,
        }),
      );
    }
    entries.push({ kind, name, extension, defaultContext, contexts });
  }
  return entries;
}

function mergeTokens(base: EntryToken[], extra: EntryToken[], loc: string): EntryToken[] {
  const merged = new Map(base.map((token) => [token.path, token]));
  for (const token of extra) {
    const previous = merged.get(token.path);
    if (previous && previous.type !== token.type) {
      fail(`${loc} token "${token.path}" overrides a ${previous.type} with a ${token.type}`);
    }
    merged.set(token.path, token);
  }
  return [...merged.values()];
}

/**
 * Layers a company's entries over Todae's. Entries sharing a name merge (the
 * company's tokens win). A new entry is placed just before the next Todae
 * entry the company lists after it, or at the end. `merged` is the full
 * graph; `company` keeps the same order with only the company's tokens, for
 * emitting a CSS file layered after Todae's; `inherited` holds the token paths
 * whose consume aliases Todae's CSS already declares.
 */
export function mergeEntries(
  base: ResolvedEntry[],
  extra: ResolvedEntry[],
): { merged: ResolvedEntry[]; company: ResolvedEntry[]; inherited: Set<string> } {
  const merged: ResolvedEntry[] = base.map((entry) =>
    entry.kind === 'set' ? { ...entry } : { ...entry, contexts: new Map(entry.contexts) },
  );
  const company: ResolvedEntry[] = base.map((entry) =>
    entry.kind === 'set' ? { ...entry, tokens: [] } : { ...entry, contexts: new Map() },
  );
  const inherited = new Set(base.flatMap(entryTokens).map((token) => token.path));
  let pending: ResolvedEntry[] = [];
  for (const entry of extra) {
    const index = merged.findIndex((candidate) => candidate.kind === entry.kind && candidate.name === entry.name);
    if (index === -1) {
      pending.push(entry);
      continue;
    }
    merged.splice(index, 0, ...pending);
    company.splice(index, 0, ...pending);
    const at = index + pending.length;
    pending = [];
    const target = merged[at]!;
    const view = company[at]!;
    const loc = `${entry.kind} "${entry.name}"`;
    // The company's extension already carries Todae's pairs plus its own.
    if (entry.extension.contrast) target.extension = { ...target.extension, contrast: entry.extension.contrast };
    if (entry.kind === 'set' && target.kind === 'set' && view.kind === 'set') {
      target.tokens = mergeTokens(target.tokens, entry.tokens, loc);
      view.tokens = entry.tokens;
    } else if (entry.kind === 'modifier' && target.kind === 'modifier' && view.kind === 'modifier') {
      for (const [context, tokens] of entry.contexts) {
        target.contexts.set(context, mergeTokens(target.contexts.get(context) ?? [], tokens, `${loc} context "${context}"`));
        view.contexts.set(context, tokens);
      }
    }
  }
  merged.push(...pending);
  company.push(...pending);
  retuneAcrossEntries(base, extra, merged);
  return { merged, company, inherited };
}

/**
 * A company pair naming the same fg and bg as one of Todae's replaces it
 * wherever Todae declares it, so a company retunes a component pair from its
 * appearance modifier or any set, not only from a set of the same name. The
 * replacement keeps Todae's `over` unless it lists its own.
 */
function retuneAcrossEntries(base: ResolvedEntry[], extra: ResolvedEntry[], merged: ResolvedEntry[]): void {
  const todae = new Map<string, ContrastPair>();
  for (const entry of base) for (const pair of entry.extension.contrast ?? []) todae.set(pairKey(pair), pair);
  // The company's own pairs: those its entries declare that aren't Todae's inherited ones.
  // A company may re-list a key in several of its entries; each of them keeps it.
  const owners = new Map<string, Set<string>>();
  for (const entry of extra) {
    const upstream = base.find((candidate) => candidate.kind === entry.kind && candidate.name === entry.name);
    const inherited = new Set(upstream?.extension.contrast ?? []);
    for (const pair of entry.extension.contrast ?? []) {
      const key = pairKey(pair);
      if (inherited.has(pair) || !todae.has(key)) continue;
      owners.set(key, (owners.get(key) ?? new Set()).add(`${entry.kind} ${entry.name}`));
    }
  }
  if (owners.size === 0) return;
  for (const [i, entry] of merged.entries()) {
    const pairs = entry.extension.contrast;
    if (!pairs) continue;
    const here = `${entry.kind} ${entry.name}`;
    const kept: ContrastPair[] = [];
    for (const pair of pairs) {
      const owning = owners.get(pairKey(pair));
      if (!owning) kept.push(pair);
      else if (owning.has(here)) kept.push(retune(pair, todae.get(pairKey(pair))));
    }
    const { contrast: _dropped, ...rest } = entry.extension;
    merged[i] = { ...entry, extension: kept.length > 0 ? { ...rest, contrast: kept } : rest } as ResolvedEntry;
  }
}

export async function resolveEntries(tokensRoot: string): Promise<ResolvedEntry[]> {
  const entries = await loadResolver(join(tokensRoot, 'resolver.json'));
  validateEntries(entries);
  return entries;
}
