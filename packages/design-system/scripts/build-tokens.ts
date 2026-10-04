import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PATH_RE = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
export const RESERVED_ROOTS = [
  'color',
  'space',
  'radius',
  'font',
  'button',
  'stack',
  'text',
  'field',
  'chip',
  'overlay',
  'dialog',
  'sheet',
  'popover',
  'tooltip',
  'option',
  'selection',
] as const;
export const CHIP_SLOTS = ['default', 'hover', 'focus', 'disabled'] as const;
export const FIELD_BORDER_SLOTS = ['default', 'hover', 'focus', 'disabled', 'invalid'] as const;
export const FIELD_RING_SLOTS = ['focus', 'invalid'] as const;
export const INTERACTIVE_SLOTS = ['default', 'hover', 'active', 'focus', 'disabled'] as const;
export const INTERACTIVE_GROUPS = ['bg', 'fg', 'border'] as const;
export const BUTTON_PAINTS = ['primary', 'secondary', 'ghost'] as const;
export const BUTTON_BASE_PATHS = [
  'button.base.radius',
  'button.base.padding.x',
  'button.base.padding.y',
  'button.base.font.size',
  'button.base.font.weight',
  'button.base.gap',
] as const;

const LAYER_RANK = { core: 0, appearance: 1, density: 2, contract: 3, variant: 3 } as const;

export type Layer = keyof typeof LAYER_RANK;

export type TokenNode = {
  $type?: string;
  $value: unknown;
};

export type TokenTree = { [key: string]: TokenNode | TokenTree };

export type FlatToken = {
  path: string;
  type: string;
  value: unknown;
  ref: string | null;
  cssVar: string;
  cssValue: string;
  layer: Layer;
  context?: string;
};

export function fail(message: string): never {
  throw new Error(message);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function cssVarName(path: string): string {
  return `--todae-${path.replaceAll('.', '-')}`;
}

function isToken(value: unknown): value is TokenNode {
  return isRecord(value) && '$value' in value;
}

function isRef(value: unknown): value is { $ref: string } {
  return isRecord(value) && typeof value.$ref === 'string';
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
  function walk(node: unknown, path: string, type?: string) {
    if (!isRecord(node)) fail(`Token node at "${path || '(root)'}" must be an object`);
    if (isToken(node)) {
      if (!path) fail('Token is missing a path');
      const resolvedType = typeof node.$type === 'string' ? node.$type : type;
      if (!resolvedType) fail(`Token "${path}" is missing $type`);
      out.set(path, { $type: resolvedType, $value: node.$value });
      return;
    }
    const nextType = typeof node.$type === 'string' ? node.$type : type;
    for (const key of sortKeys(Object.keys(node))) {
      if (key.startsWith('$')) continue;
      walk(node[key], path ? `${path}.${key}` : key, nextType);
    }
  }
  walk(tree, '', inheritedType);
  return out;
}

export function validatePaths(paths: Iterable<string>, loc: string): void {
  for (const path of paths) {
    if (!PATH_RE.test(path)) fail(`${loc} token "${path}" must be lowercase dot segments`);
    const root = path.slice(0, path.indexOf('.'));
    if (!RESERVED_ROOTS.includes(root as (typeof RESERVED_ROOTS)[number])) {
      fail(`${loc} token "${path}" uses reserved-root-violating category "${root}"`);
    }
  }
}

export function validateParity(
  light: Map<string, TokenNode>,
  dark: Map<string, TokenNode>,
  label = 'appearance light/dark',
): void {
  const lightKeys = [...light.keys()].sort();
  const darkKeys = [...dark.keys()].sort();
  if (lightKeys.length !== darkKeys.length || lightKeys.some((key, i) => key !== darkKeys[i])) {
    fail(`${label} key trees differ`);
  }
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

export function validateButtonBase(tokens: Map<string, TokenNode>, loc: string): void {
  const keys = [...tokens.keys()].filter((path) => path.startsWith('button.base.')).sort();
  const expected = [...BUTTON_BASE_PATHS].sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    fail(`${loc} button.base must be radius, padding.x/y, font.size/weight, gap`);
  }
}

function paintSuffixes(name: string, tokens: Map<string, TokenNode>): string[] {
  const prefix = `button.${name}.`;
  return [...tokens.keys()]
    .filter((path) => path.startsWith(prefix))
    .map((path) => path.slice(prefix.length))
    .sort();
}

export function validatePaintPacks(packs: Record<string, Map<string, TokenNode>>, defaultPaint = 'primary'): void {
  const expected = paintSuffixes(defaultPaint, packs[defaultPaint] ?? new Map());
  if (expected.length === 0) fail(`button.${defaultPaint} paint pack is empty`);
  for (const name of Object.keys(packs)) {
    if (name === defaultPaint) continue;
    const keys = paintSuffixes(name, packs[name] ?? new Map());
    if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
      fail(`variant "${name}" paint keys must match button.${defaultPaint}`);
    }
  }
}

export function validateFieldChipSlots(tokens: Map<string, TokenNode>, loc: string): void {
  const groups = collectGroups(tokens.keys());
  for (const [group, leaves] of groups) {
    const parts = group.split('.');
    if (parts[0] === 'chip' && INTERACTIVE_GROUPS.includes(parts[1] as (typeof INTERACTIVE_GROUPS)[number]) && parts.length === 2) {
      const sorted = [...leaves].sort();
      const expected = [...CHIP_SLOTS].sort();
      if (sorted.length !== expected.length || sorted.some((leaf, i) => leaf !== expected[i])) {
        fail(`${loc} "${group}" must have exactly ${CHIP_SLOTS.join('|')}`);
      }
    }
    if (parts[0] === 'chip' && parts[1] === 'ring' && parts.length === 2) {
      if (leaves.length !== 1 || leaves[0] !== 'focus') {
        fail(`${loc} "${group}" must be ring.focus only`);
      }
    }
    if (parts[0] === 'field' && parts[1] === 'border' && parts.length === 2) {
      const sorted = [...leaves].sort();
      const expected = [...FIELD_BORDER_SLOTS].sort();
      if (sorted.length !== expected.length || sorted.some((leaf, i) => leaf !== expected[i])) {
        fail(`${loc} "${group}" must have exactly ${FIELD_BORDER_SLOTS.join('|')}`);
      }
    }
    if (parts[0] === 'field' && parts[1] === 'ring' && parts.length === 2) {
      const sorted = [...leaves].sort();
      const expected = [...FIELD_RING_SLOTS].sort();
      if (sorted.length !== expected.length || sorted.some((leaf, i) => leaf !== expected[i])) {
        fail(`${loc} "${group}" must have exactly ${FIELD_RING_SLOTS.join('|')}`);
      }
    }
  }
}

export function validateInteractive(
  tokens: Map<string, TokenNode>,
  loc: string,
  paints: readonly string[] = BUTTON_PAINTS,
): void {
  const groups = collectGroups(tokens.keys());
  for (const [group, leaves] of groups) {
    const parts = group.split('.');
    if (parts[0] !== 'button') continue;
    const pack = parts[1];
    if (!pack || pack === 'base') continue;
    if (INTERACTIVE_GROUPS.includes(pack as (typeof INTERACTIVE_GROUPS)[number]) || pack === 'ring') {
      fail(`${loc} "${group}" must live under button.${paints.join('|')}`);
    }
    if (!paints.includes(pack)) continue;
    if (['radius', 'padding', 'font', 'gap'].includes(parts[2] ?? '')) {
      fail(`${loc} "${group}" geometry belongs on button.base`);
    }
    const slot = parts[2];
    if (slot === 'ring') {
      if (leaves.length !== 1 || leaves[0] !== 'focus') {
        fail(`${loc} "${group}" must be ring.focus only`);
      }
      continue;
    }
    if (!INTERACTIVE_GROUPS.includes(slot as (typeof INTERACTIVE_GROUPS)[number])) continue;
    const sorted = [...leaves].sort();
    const expected = [...INTERACTIVE_SLOTS].sort();
    if (sorted.length !== expected.length || sorted.some((leaf, i) => leaf !== expected[i])) {
      fail(`${loc} "${group}" must have exactly ${INTERACTIVE_SLOTS.join('|')}`);
    }
  }
}

export function consumeCssVar(path: string, paints: readonly string[] = BUTTON_PAINTS): string | null {
  for (const pack of ['base', ...paints]) {
    const prefix = `button.${pack}.`;
    if (path.startsWith(prefix)) return cssVarName(`button.${path.slice(prefix.length)}`);
  }
  return null;
}

export function pathToPointer(path: string): string {
  return `#/${path.split('.').join('/')}/$value`;
}

/**
 * Parses a DTCG 2025.10 JSON Pointer alias (`#/color/gray/50/$value`) into the
 * dot path of the token it names. Only whole-value aliases are supported.
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

export function serializeValue(token: TokenNode, path: string): { ref: string | null; cssValue: string } {
  if (isRef(token.$value)) {
    const ref = pointerToPath(token.$value.$ref, `Token "${path}"`);
    return { ref, cssValue: `var(${cssVarName(ref)})` };
  }
  if (token.$type === 'color') {
    if (!isRecord(token.$value) || token.$value.colorSpace !== 'oklch' || !Array.isArray(token.$value.components)) {
      fail(`Token "${path}" color must be OKLCH`);
    }
    const [l, c, h] = token.$value.components;
    if (![l, c, h].every((n) => typeof n === 'number')) fail(`Token "${path}" OKLCH components must be numbers`);
    const alpha = token.$value.alpha;
    if (alpha !== undefined && typeof alpha !== 'number') fail(`Token "${path}" alpha must be a number`);
    const base = `oklch(${l} ${c} ${h})`;
    return { ref: null, cssValue: alpha === undefined || alpha === 1 ? base : `oklch(${l} ${c} ${h} / ${alpha})` };
  }
  if (token.$type === 'dimension') {
    if (!isRecord(token.$value) || typeof token.$value.value !== 'number' || typeof token.$value.unit !== 'string') {
      fail(`Token "${path}" dimension must be { value, unit }`);
    }
    if (!/^[a-z]+$/.test(token.$value.unit)) fail(`Token "${path}" has an invalid dimension unit`);
    return { ref: null, cssValue: `${token.$value.value}${token.$value.unit}` };
  }
  if (token.$type === 'fontWeight' || token.$type === 'number') {
    if (typeof token.$value !== 'number') fail(`Token "${path}" ${token.$type} must be a number`);
    return { ref: null, cssValue: String(token.$value) };
  }
  fail(`Token "${path}" has unsupported $type "${token.$type ?? ''}"`);
}

export function validateRefs(
  tokens: FlatToken[],
  known: Map<string, Layer>,
): void {
  const layerPaths = new Map<string, Layer>();
  for (const [path, layer] of known) layerPaths.set(path, layer);

  function resolveLayer(path: string, from: Layer, stack: string[]): Layer {
    if (stack.includes(path)) fail(`$ref cycle: ${[...stack, path].join(' -> ')}`);
    const targetLayer = layerPaths.get(path);
    if (!targetLayer) fail(`$ref "${path}" does not exist`);
    if (LAYER_RANK[targetLayer] >= LAYER_RANK[from]) {
      fail(`$ref "${path}" must point at a lower layer than ${from}`);
    }
    const target = tokens.find((t) => t.path === path && t.layer === targetLayer);
    if (target?.ref) resolveLayer(target.ref, targetLayer, [...stack, path]);
    return targetLayer;
  }

  for (const token of tokens) {
    if (!token.ref) continue;
    resolveLayer(token.ref, token.layer, [token.path]);
  }
}

export function flattenLayer(
  tree: TokenTree,
  layer: Layer,
  context?: string,
  paints: readonly string[] = BUTTON_PAINTS,
): FlatToken[] {
  return layerTokens(flattenTokens(tree), layer, context, paints);
}

/** Validates one merged set or context and serializes its tokens. */
export function layerTokens(
  flat: Map<string, TokenNode>,
  layer: Layer,
  context?: string,
  paints: readonly string[] = BUTTON_PAINTS,
): FlatToken[] {
  validatePaths(flat.keys(), context ? `${layer}/${context}` : layer);
  if (layer === 'density') validateDensitySpaceOnly(flat, context ? `${layer}/${context}` : layer);
  if (layer === 'contract' || layer === 'variant') {
    const loc = context ? `${layer}/${context}` : layer;
    validateInteractive(flat, loc, paints);
    validateFieldChipSlots(flat, loc);
    if ([...flat.keys()].some((path) => path.startsWith('button.base.'))) validateButtonBase(flat, loc);
  }
  const tokens: FlatToken[] = [];
  for (const [path, node] of flat) {
    const { ref, cssValue } = serializeValue(node, path);
    tokens.push({
      path,
      type: node.$type ?? '',
      value: node.$value,
      ref,
      cssVar: cssVarName(path),
      cssValue,
      layer,
      context,
    });
  }
  return tokens;
}

function decls(tokens: FlatToken[]): string {
  return tokens.map((t) => `  ${t.cssVar}: ${t.cssValue};`).join('\n');
}

function aliasDecls(tokens: FlatToken[], paints: readonly string[]): string {
  return tokens
    .map((token) => {
      const consume = consumeCssVar(token.path, paints);
      if (!consume || consume === token.cssVar) return null;
      return `  ${consume}: var(${token.cssVar});`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

function block(selector: string, lines: string[]): string {
  return `${selector} {\n${lines.filter((line) => line !== '').join('\n')}\n}`;
}

/**
 * Emits one CSS layer from the resolved entries, in resolutionOrder:
 * - sets before the first scoped modifier are declared on `:root`;
 * - a scoped modifier emits one `[attribute="context"]` block per context;
 * - later sets and every context of the alias modifier are re-declared on each
 *   scoped modifier's attribute, so their var() chains re-resolve wherever a
 *   context changes, along with the default context's consume aliases;
 * - the alias modifier emits one block per context that only swaps aliases.
 */
export function emitCss(entries: ResolvedEntry[]): string {
  const paints = aliasPaints(entries);
  const root: FlatToken[] = [];
  const scopedBlocks: string[] = [];
  const attributes: string[] = [];
  const rescoped: FlatToken[] = [];
  const defaults: FlatToken[] = [];
  const aliasBlocks: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'set') {
      if (attributes.length === 0) root.push(...entry.tokens);
      else {
        rescoped.push(...entry.tokens);
        defaults.push(...entry.tokens);
      }
      continue;
    }
    const { attribute, alias, colorScheme } = entry.extension;
    if (!attribute) fail(`modifier "${entry.name}" is missing an attribute`);
    for (const [context, tokens] of entry.contexts) {
      const selector = `[${attribute}="${context}"]`;
      if (alias) {
        rescoped.push(...tokens);
        if (context === entry.defaultContext) defaults.push(...tokens);
        aliasBlocks.push(block(selector, [aliasDecls(tokens, paints)]));
        continue;
      }
      const rootDefault = entry.extension.root && context === entry.defaultContext;
      scopedBlocks.push(
        block(rootDefault ? `:root,\n${selector}` : selector, [
          decls(tokens),
          colorScheme ? `  color-scheme: ${context};` : '',
        ]),
      );
    }
    if (!alias) attributes.push(`[${attribute}]`);
  }
  const blocks = [
    ...(root.length > 0 ? [block(':root', [decls(root), aliasDecls(root, paints)])] : []),
    ...scopedBlocks,
    ...(rescoped.length > 0
      ? [block(attributes.length > 0 ? attributes.join(',\n') : ':root', [decls(rescoped), aliasDecls(defaults, paints)])]
      : []),
    ...aliasBlocks,
  ];
  return `@layer todae.base {\n${blocks.join('\n\n')}\n}\n`;
}

export function emitCatalog(tokens: FlatToken[]): string {
  const rows = tokens.map(({ path, type, cssVar, cssValue, ref, layer, context }) => ({
    path,
    type,
    cssVar,
    cssValue,
    ref,
    layer,
    context: context ?? null,
  }));
  return `${JSON.stringify({ version: 1, tokens: rows }, null, 2)}\n`;
}

export function catalogSelectors(css: string): string[] {
  const selectors: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth <= 1) {
        const sel = css.slice(start, i).replace(/\s+/g, ' ').trim();
        if (sel) selectors.push(sel);
      }
      depth += 1;
      start = i + 1;
    } else if (ch === '}') {
      depth -= 1;
      start = i + 1;
    }
  }
  return selectors;
}

function insideRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`);
}

async function readJson(file: string, tokensRoot: string): Promise<unknown> {
  const abs = resolve(file);
  if (!insideRoot(tokensRoot, abs) && abs !== tokensRoot) {
    fail(`Refused to read ${abs}: outside tokens/`);
  }
  let raw: string;
  try {
    raw = await readFile(abs, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Failed to read ${relative(tokensRoot, abs)}: ${detail}`);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    fail(`Invalid JSON: ${relative(tokensRoot, abs)}`);
  }
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

async function atomicWrite(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  try {
    await writeFile(tmp, contents);
    await rename(tmp, file);
  } catch (error) {
    await unlink(tmp).catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    fail(`Refused to replace ${file}: ${detail}`);
  }
  const written = await readFile(file, 'utf8');
  if (written !== contents) fail(`Wrote ${file} but the file did not match`);
}

export type BuildTokensResult = {
  css: string;
  json: string;
  tokens: FlatToken[];
};

export const TODAE_EXTENSION = 'dev.todae';

export type TodaeExtension = {
  layer: Layer;
  attribute?: string;
  root?: boolean;
  colorScheme?: boolean;
  alias?: boolean;
};

export type ResolvedEntry =
  | { kind: 'set'; name: string; extension: TodaeExtension; tokens: FlatToken[] }
  | {
      kind: 'modifier';
      name: string;
      extension: TodaeExtension;
      defaultContext: string;
      contexts: Map<string, FlatToken[]>;
    };

const ATTRIBUTE_RE = /^data-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CONTEXT_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function aliasPaints(entries: ResolvedEntry[]): string[] {
  const alias = entries.find((entry) => entry.kind === 'modifier' && entry.extension.alias);
  return alias?.kind === 'modifier' ? [...alias.contexts.keys()] : [];
}

export function parseExtension(def: Record<string, unknown>, kind: 'set' | 'modifier', loc: string): TodaeExtension {
  const extensions = def.$extensions;
  const ext = isRecord(extensions) ? extensions[TODAE_EXTENSION] : undefined;
  if (!isRecord(ext)) fail(`${loc} must declare $extensions["${TODAE_EXTENSION}"]`);
  const { layer, attribute, root, colorScheme, alias } = ext;
  if (typeof layer !== 'string' || !(layer in LAYER_RANK)) {
    fail(`${loc} layer must be one of ${Object.keys(LAYER_RANK).join('|')}`);
  }
  for (const [key, value] of Object.entries({ root, colorScheme, alias })) {
    if (value !== undefined && typeof value !== 'boolean') fail(`${loc} ${key} must be a boolean`);
  }
  if (kind === 'set') {
    if (attribute !== undefined || root !== undefined || colorScheme !== undefined || alias !== undefined) {
      fail(`${loc} attribute, root, colorScheme and alias only apply to modifiers`);
    }
    return { layer: layer as Layer };
  }
  if (typeof attribute !== 'string' || !ATTRIBUTE_RE.test(attribute)) {
    fail(`${loc} attribute must be a lowercase data-* attribute`);
  }
  if (alias && (root || colorScheme)) fail(`${loc} an alias modifier cannot set root or colorScheme`);
  return {
    layer: layer as Layer,
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

async function loadTokens(
  sources: unknown,
  loc: string,
  tokensRoot: string,
  layer: Layer,
  context: string | undefined,
  paints: readonly string[],
): Promise<FlatToken[]> {
  const merged = new Map<string, TokenNode>();
  for (const source of await loadSources(sources, loc, tokensRoot)) {
    for (const [path, node] of flattenTokens(source.tree)) merged.set(path, node);
  }
  return layerTokens(merged, layer, context, paints);
}

function tokenMapOf(tokens: FlatToken[]): Map<string, TokenNode> {
  return new Map(tokens.map((t) => [t.path, { $type: t.type, $value: t.value }]));
}

export async function resolveEntries(tokensRoot: string): Promise<ResolvedEntry[]> {
  const resolver = await readJson(join(tokensRoot, 'resolver.json'), tokensRoot);
  if (!isRecord(resolver) || resolver.version !== '2025.10' || !Array.isArray(resolver.resolutionOrder)) {
    fail('resolver.json must be Resolver 2025.10 with resolutionOrder');
  }
  const fileRefs: string[] = [];
  collectFileRefs(resolver, fileRefs);
  for (const ref of fileRefs) {
    const abs = resolve(tokensRoot, ref);
    if (!insideRoot(tokensRoot, abs)) fail(`resolver $ref "${ref}" escapes tokens/`);
  }
  const sets = isRecord(resolver.sets) ? resolver.sets : {};
  const modifiers = isRecord(resolver.modifiers) ? resolver.modifiers : {};

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
    order.push({ kind, name, def, extension: parseExtension(def, kind, `${kind} "${name}"`) });
  }

  const attributes = new Set<string>();
  for (const { kind, name, extension } of order) {
    if (kind !== 'modifier') continue;
    if (attributes.has(extension.attribute!)) fail(`modifier "${name}" reuses attribute ${extension.attribute}`);
    attributes.add(extension.attribute!);
  }
  const aliases = order.filter((entry) => entry.kind === 'modifier' && entry.extension.alias);
  if (aliases.length > 1) fail('resolver may declare at most one alias modifier');
  const aliasContexts = aliases[0]?.def.contexts;
  const paints = isRecord(aliasContexts) ? Object.keys(aliasContexts) : [];

  const entries: ResolvedEntry[] = [];
  for (const { kind, name, def, extension } of order) {
    const loc = `${kind} "${name}"`;
    if (kind === 'set') {
      entries.push({
        kind,
        name,
        extension,
        tokens: await loadTokens(def.sources, `${loc} sources`, tokensRoot, extension.layer, undefined, paints),
      });
      continue;
    }
    if (!isRecord(def.contexts) || Object.keys(def.contexts).length === 0) fail(`${loc} must declare contexts`);
    const defaultContext = def.default;
    if (typeof defaultContext !== 'string' || !(defaultContext in def.contexts)) {
      fail(`${loc} default must name one of its contexts`);
    }
    const contexts = new Map<string, FlatToken[]>();
    for (const [context, sources] of Object.entries(def.contexts)) {
      if (!CONTEXT_RE.test(context)) fail(`${loc} context "${context}" must be lowercase`);
      if (extension.colorScheme && context !== 'light' && context !== 'dark') {
        fail(`${loc} sets colorScheme, so its contexts must be light or dark, not "${context}"`);
      }
      contexts.set(
        context,
        await loadTokens(sources, `${loc} context "${context}"`, tokensRoot, extension.layer, context, paints),
      );
    }
    const defaults = tokenMapOf(contexts.get(defaultContext)!);
    if (extension.alias) {
      validatePaintPacks(
        Object.fromEntries([...contexts].map(([context, tokens]) => [context, tokenMapOf(tokens)])),
        defaultContext,
      );
    } else {
      for (const [context, tokens] of contexts) {
        if (context === defaultContext) continue;
        const label = extension.layer === 'appearance' ? 'appearance' : `${loc}`;
        validateParity(defaults, tokenMapOf(tokens), `${label} ${defaultContext}/${context}`);
      }
    }
    entries.push({ kind, name, extension, defaultContext, contexts });
  }
  return entries;
}

export async function buildTokensGraph(tokensRoot: string): Promise<BuildTokensResult> {
  const entries = await resolveEntries(tokensRoot);

  const known = new Map<string, Layer>();
  const owner = new Map<string, string>();
  const all: FlatToken[] = [];
  for (const entry of entries) {
    const declared =
      entry.kind === 'set'
        ? entry.tokens
        : entry.extension.alias
          ? [...entry.contexts.values()].flat()
          : entry.contexts.get(entry.defaultContext)!;
    for (const token of declared) {
      const previous = owner.get(token.path);
      if (previous) fail(`token "${token.path}" is declared by both ${previous} and ${entry.kind} "${entry.name}"`);
      owner.set(token.path, `${entry.kind} "${entry.name}"`);
      known.set(token.path, token.layer);
    }
    all.push(...(entry.kind === 'set' ? entry.tokens : [...entry.contexts.values()].flat()));
  }
  validateRefs(all, known);

  const css = emitCss(entries);
  const json = emitCatalog(all);
  return { css, json, tokens: all };
}

export async function buildTokens(options: { check?: boolean; root?: string } = {}): Promise<BuildTokensResult> {
  const pkgRoot = options.root ?? join(import.meta.dirname, '..');
  const tokensRoot = join(pkgRoot, 'tokens');
  const result = await buildTokensGraph(tokensRoot);
  const cssFile = join(pkgRoot, 'src/styles/tokens.generated.css');
  const jsonFile = join(tokensRoot, 'tokens.generated.json');
  if (options.check) {
    let css: string;
    let json: string;
    try {
      css = await readFile(cssFile, 'utf8');
      json = await readFile(jsonFile, 'utf8');
    } catch {
      fail('tokens:check failed: generated files are missing');
    }
    if (css !== result.css || json !== result.json) fail('tokens:check failed: generated tokens drifted');
    return result;
  }
  await atomicWrite(cssFile, result.css);
  await atomicWrite(jsonFile, result.json);
  process.stdout.write(
    `Wrote ${relative(pkgRoot, cssFile)} and ${relative(pkgRoot, jsonFile)} (${result.tokens.length} tokens)\n`,
  );
  return result;
}

const invoked = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (invoked) {
  await buildTokens({ check: process.argv.includes('--check') });
}
