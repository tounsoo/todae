import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const PATH_RE = /^[a-z][a-z0-9]*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/;
export const RESERVED_ROOTS = ['color', 'space', 'radius', 'font', 'button', 'stack', 'text', 'field', 'chip'] as const;
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

export function validateParity(light: Map<string, TokenNode>, dark: Map<string, TokenNode>): void {
  const lightKeys = [...light.keys()].sort();
  const darkKeys = [...dark.keys()].sort();
  if (lightKeys.length !== darkKeys.length || lightKeys.some((key, i) => key !== darkKeys[i])) {
    fail(`appearance light/dark key trees differ`);
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

export function validatePaintPacks(packs: Record<string, Map<string, TokenNode>>): void {
  const expected = paintSuffixes('primary', packs.primary ?? new Map());
  if (expected.length === 0) fail('button.primary paint pack is empty');
  for (const name of ['secondary', 'ghost'] as const) {
    const keys = paintSuffixes(name, packs[name] ?? new Map());
    if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
      fail(`variant "${name}" paint keys must match button.primary`);
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

export function validateInteractive(tokens: Map<string, TokenNode>, loc: string): void {
  const groups = collectGroups(tokens.keys());
  for (const [group, leaves] of groups) {
    const parts = group.split('.');
    if (parts[0] !== 'button') continue;
    const pack = parts[1];
    if (!pack || pack === 'base') continue;
    if (INTERACTIVE_GROUPS.includes(pack as (typeof INTERACTIVE_GROUPS)[number]) || pack === 'ring') {
      fail(`${loc} "${group}" must live under button.primary|secondary|ghost`);
    }
    if (!(BUTTON_PAINTS as readonly string[]).includes(pack)) continue;
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

export function consumeCssVar(path: string): string | null {
  if (path.startsWith('button.base.')) return cssVarName(`button.${path.slice('button.base.'.length)}`);
  const paint = path.match(/^button\.(primary|secondary|ghost)\.(.+)$/);
  return paint ? cssVarName(`button.${paint[2]}`) : null;
}

export function serializeValue(token: TokenNode, path: string): { ref: string | null; cssValue: string } {
  if (isRef(token.$value)) {
    if (!PATH_RE.test(token.$value.$ref)) {
      fail(`Token "${path}" $ref "${token.$value.$ref}" must be a lowercase path`);
    }
    return { ref: token.$value.$ref, cssValue: `var(${cssVarName(token.$value.$ref)})` };
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
): FlatToken[] {
  const flat = flattenTokens(tree);
  validatePaths(flat.keys(), context ? `${layer}/${context}` : layer);
  if (layer === 'density') validateDensitySpaceOnly(flat, context ? `${layer}/${context}` : layer);
  if (layer === 'contract' || layer === 'variant') {
    const loc = context ? `${layer}/${context}` : layer;
    validateInteractive(flat, loc);
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

function aliasDecls(tokens: FlatToken[]): string {
  return tokens
    .map((token) => {
      const consume = consumeCssVar(token.path);
      if (!consume || consume === token.cssVar) return null;
      return `  ${consume}: var(${token.cssVar});`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

export function emitCss(parts: {
  core: FlatToken[];
  light: FlatToken[];
  dark: FlatToken[];
  density: Record<string, FlatToken[]>;
  contract: FlatToken[];
  base: FlatToken[];
  paints: Record<(typeof BUTTON_PAINTS)[number], FlatToken[]>;
}): string {
  const densityBlocks = ['compact', 'comfortable', 'spacious']
    .map((name) => {
      const tokens = parts.density[name];
      if (!tokens) fail(`Missing density "${name}"`);
      return `[data-density="${name}"] {\n${decls(tokens)}\n}`;
    })
    .join('\n\n');
  const variantBlocks = BUTTON_PAINTS.map((name) => {
    const tokens = parts.paints[name];
    if (!tokens) fail(`Missing button variant "${name}"`);
    return `[data-button-variant="${name}"] {\n${aliasDecls(tokens)}\n}`;
  }).join('\n\n');
  return `@layer todae.base {
:root {
${decls(parts.core)}
}

:root,
[data-appearance="light"] {
${decls(parts.light)}
}

[data-appearance="dark"] {
${decls(parts.dark)}
}

${densityBlocks}

[data-appearance],
[data-density] {
${decls(parts.contract)}
${aliasDecls(parts.base)}
${aliasDecls(parts.paints.primary)}
}

${variantBlocks}
}
`;
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

export async function buildTokensGraph(tokensRoot: string): Promise<BuildTokensResult> {
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

  const core = flattenLayer(asTree(await readJson(join(tokensRoot, 'core.json'), tokensRoot), 'core.json'), 'core');
  const light = flattenLayer(
    asTree(await readJson(join(tokensRoot, 'appearance/light.json'), tokensRoot), 'appearance/light.json'),
    'appearance',
    'light',
  );
  const dark = flattenLayer(
    asTree(await readJson(join(tokensRoot, 'appearance/dark.json'), tokensRoot), 'appearance/dark.json'),
    'appearance',
    'dark',
  );
  validateParity(
    new Map(light.map((t) => [t.path, { $type: t.type, $value: t.value }])),
    new Map(dark.map((t) => [t.path, { $type: t.type, $value: t.value }])),
  );

  const densityNames = ['compact', 'comfortable', 'spacious'] as const;
  const density: Record<string, FlatToken[]> = {};
  for (const name of densityNames) {
    density[name] = flattenLayer(
      asTree(await readJson(join(tokensRoot, `density/${name}.json`), tokensRoot), `density/${name}.json`),
      'density',
      name,
    );
  }

  const base = flattenLayer(
    asTree(await readJson(join(tokensRoot, 'components/button.base.json'), tokensRoot), 'components/button.base.json'),
    'contract',
  );
  const paints = {} as Record<(typeof BUTTON_PAINTS)[number], FlatToken[]>;
  for (const name of BUTTON_PAINTS) {
    paints[name] = flattenLayer(
      asTree(
        await readJson(join(tokensRoot, `components/button.${name}.json`), tokensRoot),
        `components/button.${name}.json`,
      ),
      'contract',
      name,
    );
  }
  validatePaintPacks(
    Object.fromEntries(
      BUTTON_PAINTS.map((name) => [
        name,
        new Map(paints[name].map((t) => [t.path, { $type: t.type, $value: t.value }])),
      ]),
    ),
  );

  const contract: FlatToken[] = [...base, ...BUTTON_PAINTS.flatMap((name) => paints[name])];
  for (const file of ['stack.json', 'text.json', 'field.json', 'chip.json']) {
    contract.push(
      ...flattenLayer(
        asTree(await readJson(join(tokensRoot, 'components', file), tokensRoot), `components/${file}`),
        'contract',
      ),
    );
  }

  const known = new Map<string, Layer>();
  for (const token of core) known.set(token.path, 'core');
  for (const token of light) known.set(token.path, 'appearance');
  for (const token of density.comfortable ?? []) known.set(token.path, 'density');
  for (const token of contract) known.set(token.path, 'contract');

  const all = [...core, ...light, ...dark, ...Object.values(density).flat(), ...contract];
  validateRefs(all, known);

  const css = emitCss({ core, light, dark, density, contract, base, paints });
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
