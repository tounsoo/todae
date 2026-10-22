#!/usr/bin/env node
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { clearedInputs, parseScope, scopeFallbacks } from './tokens/scope.ts';
import { validateContrast } from './tokens/contrast.ts';
import {
  LAYER_RANK,
  PATH_RE,
  RULES,
  block,
  didYouMean,
  fail,
  indent,
  isRecord,
  isRef,
  parseComponentPointer,
  pathToPointer,
  pointerToPath,
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
  type TokenRef,
  type TokenTree,
} from './tokens/shared.ts';

export { PATH_RE, RULES, didYouMean, fail, isRecord, parseComponentPointer, pathToPointer, pointerToPath } from './tokens/shared.ts';
export type {
  ContrastPair,
  EntryToken,
  FlatToken,
  Layer,
  ResolvedEntry,
  Rule,
  SlotRules,
  TodaeExtension,
  TokenEntry,
  TokenNode,
  TokenRef,
  TokenTree,
} from './tokens/shared.ts';
export { parseScope } from './tokens/scope.ts';
export { apcaContrast, composite, contrastOf, contrastResults, oklchToSrgb, validateContrast } from './tokens/contrast.ts';
export type { ContrastResult } from './tokens/contrast.ts';

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
  'conversation',
  'attachment',
  'steps',
  'emptystate',
  'splitter',
  'breadcrumbs',
  'toolbar',
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
  'button.base.pressed-ring-width',
  'button.base.border-width',
  'button.base.icon.size',
  'button.base.font.letter-spacing',
  'button.base.font.text-transform',
] as const;

const LAYER_ORDER = Object.keys(LAYER_RANK).join(' < ');

export function cssVarName(path: string): string {
  return `--todae-${path.replaceAll('.', '-')}`;
}

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

export function validateButtonBase(tokens: Map<string, TokenNode>, loc: string): void {
  const keys = [...tokens.keys()].filter((path) => path.startsWith('button.base.')).sort();
  const expected = [...BUTTON_BASE_PATHS].sort();
  if (keys.length !== expected.length || keys.some((key, i) => key !== expected[i])) {
    fail(`${loc} button.base must be radius, padding.x/y, font.size/weight/letter-spacing/text-transform, gap, border-width, pressed-ring-width, icon.size`);
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
    const differences = keyDifferences(expected, paintSuffixes(name, packs[name] ?? new Map()), defaultPaint, name);
    if (differences) fail(`variant "${name}" paint keys must match button.${defaultPaint}: ${differences}`);
  }
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
    if (['radius', 'padding', 'font', 'gap', 'icon'].includes(parts[2] ?? '')) {
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

/** An alias modifier's token root (`button`) and its contexts (`primary`, …). */
export type AliasGroup = { root: string; contexts: readonly string[] };

const BUTTON_ALIAS: AliasGroup = { root: 'button', contexts: BUTTON_PAINTS };

/**
 * The consume var a pack token aliases: `<root>.<context>.x` and the shared
 * `<root>.base.x` both feed `--todae-<root>-x`.
 */
export function consumeCssVar(path: string, aliases: readonly AliasGroup[] = [BUTTON_ALIAS]): string | null {
  for (const { root, contexts } of aliases) {
    for (const pack of ['base', ...contexts]) {
      const prefix = `${root}.${pack}.`;
      if (path.startsWith(prefix)) return cssVarName(`${root}.${path.slice(prefix.length)}`);
    }
  }
  return null;
}

type Serialized = { ref: string | null; refs: TokenRef[]; cssValue: string };

/**
 * A color's alpha: a number in [0, 1], or a JSON Pointer to a number token
 * (`#/opacity/12/$value`), emitted as that token's var so it stays live.
 */
function serializeAlpha(alpha: unknown, path: string): { refs: TokenRef[]; css: string | null } {
  if (alpha === undefined) return { refs: [], css: null };
  if (isRef(alpha)) {
    const ref = pointerToPath(alpha.$ref, `Token "${path}" alpha`);
    return { refs: [{ path: ref, type: 'number', role: 'alpha' }], css: `var(${cssVarName(ref)})` };
  }
  if (!isFiniteNumber(alpha) || alpha < 0 || alpha > 1) {
    fail(`Token "${path}" alpha must be a number in [0, 1] or a $ref to a number token`);
  }
  return { refs: [], css: alpha === 1 ? null : String(alpha) };
}

function serializeColor(value: unknown, path: string): Serialized {
  if (!isRecord(value) || value.colorSpace !== 'oklch' || !Array.isArray(value.components)) {
    fail(`Token "${path}" color must be OKLCH`);
  }
  if (value.components.length !== 3) fail(`Token "${path}" OKLCH must have three components`);
  const alpha = serializeAlpha(value.alpha, path);
  let origin: string | null = null;
  const channels = value.components.map((component, i) => {
    if (typeof component === 'number') return String(component);
    if (!isRef(component)) fail(`Token "${path}" OKLCH component ${i} must be a number or a component $ref`);
    const ref = parseComponentPointer(component.$ref, `Token "${path}"`);
    if (origin !== null && origin !== ref.path) {
      fail(`Token "${path}" component $refs must all point at one color, not ${origin} and ${ref.path}`);
    }
    origin = ref.path;
    return ref.channel;
  });
  const [l, c, h] = channels;
  if (origin !== null) {
    // Relative color syntax keeps the origin live: overriding it at runtime
    // re-tints this color too. Alpha is always written, since a missing DTCG
    // alpha means opaque while relative syntax would inherit the origin's.
    return {
      ref: origin,
      refs: [{ path: origin, type: 'color', role: 'component' }, ...alpha.refs],
      cssValue: `oklch(from var(${cssVarName(origin)}) ${l} ${c} ${h} / ${alpha.css ?? 1})`,
    };
  }
  const cssValue = alpha.css === null ? `oklch(${l} ${c} ${h})` : `oklch(${l} ${c} ${h} / ${alpha.css})`;
  return { ref: null, refs: alpha.refs, cssValue };
}

export function serializeValue(token: TokenNode, path: string): Serialized {
  if (typeof token.$value === 'string' && /^\{[^{}]+\}$/.test(token.$value)) {
    const target = token.$value.slice(1, -1);
    const hint = PATH_RE.test(target) ? `{ "$ref": "${pathToPointer(target)}" }` : '{ "$ref": "#/<token>/$value" }';
    fail(`Token "${path}" uses a curly-brace alias; write ${hint}`);
  }
  if (isRef(token.$value)) {
    const ref = pointerToPath(token.$value.$ref, `Token "${path}"`);
    return { ref, refs: [{ path: ref, type: token.$type ?? '', role: 'value' }], cssValue: `var(${cssVarName(ref)})` };
  }
  if (token.$type === 'color') return serializeColor(token.$value, path);
  if (token.$type === 'dimension') return { ref: null, refs: [], cssValue: serializeDimension(token.$value, path) };
  if (token.$type === 'fontWeight' || token.$type === 'number') {
    if (!isFiniteNumber(token.$value)) fail(`Token "${path}" ${token.$type} must be a number`);
    if (path.startsWith('z.') && !Number.isInteger(token.$value)) fail(`Token "${path}" z-index must be an integer`);
    return { ref: null, refs: [], cssValue: String(token.$value) };
  }
  if (token.$type === 'duration') {
    const value = token.$value;
    if (!isRecord(value) || !isFiniteNumber(value.value) || value.value < 0 || (value.unit !== 'ms' && value.unit !== 's')) {
      fail(`Token "${path}" duration must be { value, unit: "ms" | "s" } with a non-negative value`);
    }
    return { ref: null, refs: [], cssValue: `${value.value}${value.unit}` };
  }
  if (token.$type === 'cubicBezier') {
    const value = token.$value;
    if (!Array.isArray(value) || value.length !== 4 || !value.every(isFiniteNumber)) {
      fail(`Token "${path}" cubicBezier must be four numbers`);
    }
    if ([value[0]!, value[2]!].some((x) => x < 0 || x > 1)) fail(`Token "${path}" cubicBezier x values must be in [0, 1]`);
    return { ref: null, refs: [], cssValue: `cubic-bezier(${value.join(', ')})` };
  }
  if (token.$type === 'fontFamily') return { ref: null, refs: [], cssValue: serializeFontFamily(token.$value, path) };
  // DTCG 2025.10 has no type for letter case. Todae adds textTransform until it
  // does; ARCHITECTURE.md asks to revisit this when a standard type lands.
  if (token.$type === 'textTransform') {
    if (typeof token.$value !== 'string' || !TEXT_TRANSFORMS.includes(token.$value)) {
      fail(`Token "${path}" textTransform must be one of ${TEXT_TRANSFORMS.join(', ')}`);
    }
    return { ref: null, refs: [], cssValue: token.$value };
  }
  if (token.$type === 'shadow') {
    const layers = Array.isArray(token.$value) ? token.$value : [token.$value];
    if (layers.length === 0) fail(`Token "${path}" shadow must have at least one layer`);
    return { ref: null, refs: [], cssValue: layers.map((layer) => serializeShadowLayer(layer, path)).join(', ') };
  }
  fail(`Token "${path}" has unsupported $type "${token.$type ?? ''}"`);
}

export const TEXT_TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'];

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function serializeDimension(value: unknown, path: string): string {
  if (!isRecord(value) || !isFiniteNumber(value.value) || typeof value.unit !== 'string') {
    fail(`Token "${path}" dimension must be { value, unit }`);
  }
  if (!/^[a-z]+$/.test(value.unit)) fail(`Token "${path}" has an invalid dimension unit`);
  return `${value.value}${value.unit}`;
}

const GENERIC_FONT_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
  'fangsong',
]);

// Family names are quoted unless generic; the character set keeps them from
// closing the quote or the declaration.
function serializeFontFamily(value: unknown, path: string): string {
  const names = Array.isArray(value) ? value : [value];
  if (names.length === 0) fail(`Token "${path}" fontFamily must name at least one family`);
  return names
    .map((name) => {
      if (typeof name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(name)) {
        fail(`Token "${path}" fontFamily names may only use letters, digits, spaces, "-" and "_"`);
      }
      return GENERIC_FONT_FAMILIES.has(name) ? name : `"${name}"`;
    })
    .join(', ');
}

const SHADOW_KEYS = ['color', 'offsetX', 'offsetY', 'blur', 'spread', 'inset'];

function serializeShadowLayer(layer: unknown, path: string): string {
  if (!isRecord(layer)) fail(`Token "${path}" shadow layers must be objects`);
  const unknown = Object.keys(layer).filter((key) => !SHADOW_KEYS.includes(key));
  if (unknown.length > 0) fail(`Token "${path}" shadow has unknown key "${unknown[0]}"`);
  if (layer.inset !== undefined && typeof layer.inset !== 'boolean') fail(`Token "${path}" shadow inset must be a boolean`);
  if (isRef(layer.color)) fail(`Token "${path}" shadow color must be a literal OKLCH color`);
  const color = serializeColor(layer.color, path);
  if (color.refs.length > 0) fail(`Token "${path}" shadow color must be a literal OKLCH color, with no $ref in its channels or alpha`);
  const lengths = (['offsetX', 'offsetY', 'blur', 'spread'] as const).map((key) => {
    const length = layer[key];
    if (isRef(length)) fail(`Token "${path}" shadow ${key} must be a literal dimension`);
    // Same units and blur floor as ThemeProvider overrides accept.
    if (!isRecord(length) || (length.unit !== 'px' && length.unit !== 'rem')) {
      fail(`Token "${path}" shadow ${key} must be in px or rem`);
    }
    if (key === 'blur' && isFiniteNumber(length.value) && length.value < 0) fail(`Token "${path}" shadow blur must not be negative`);
    return serializeDimension(length, path);
  });
  return `${layer.inset ? 'inset ' : ''}${lengths.join(' ')} ${color.cssValue}`;
}

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

export type LayerChecks = {
  rules?: readonly Rule[];
  slots?: SlotRules;
  paints?: readonly string[];
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
  if (rules.includes('button')) {
    validateInteractive(whole, loc, checks.paints ?? BUTTON_PAINTS);
    if ([...whole.keys()].some((path) => path.startsWith('button.base.'))) validateButtonBase(whole, loc);
  }
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

function decls(tokens: FlatToken[]): string {
  return tokens.map((t) => `  ${t.cssVar}: ${t.cssValue};`).join('\n');
}

/**
 * Re-declared tokens read a private `--_todae-*` input first. ThemeProvider
 * sets it next to each override, and it inherits through every re-declaring
 * element, so an override survives nested providers.
 */
function overridableDecls(tokens: FlatToken[]): string {
  return tokens.map((t) => `  ${t.cssVar}: var(--_${t.cssVar.slice(2)}, ${t.cssValue});`).join('\n');
}

function aliasDecls(tokens: FlatToken[], aliases: readonly AliasGroup[]): string {
  return tokens
    .map((token) => {
      const consume = consumeCssVar(token.path, aliases);
      if (!consume || consume === token.cssVar) return null;
      return `  ${consume}: var(${token.cssVar});`;
    })
    .filter((line): line is string => line !== null)
    .join('\n');
}

/**
 * Emits one CSS layer from the resolved entries, in resolutionOrder:
 * - sets before the first scoped modifier are declared on `:root`;
 * - a scoped modifier emits one `[attribute="context"]` block per context;
 * - a colorScheme modifier also gets a `system` context: each context's tokens
 *   again under its own `prefers-color-scheme` media query;
 * - later sets and every context of the alias modifier are re-declared on the
 *   root element and on each scoped modifier's attribute, so their var() chains
 *   re-resolve wherever a context changes, along with the default context's
 *   consume aliases; each reads its `--_todae-*` override input first;
 * - the alias modifier emits one block per context that only swaps aliases.
 */
export type EmitCssOptions = {
  /** Cascade layer the blocks are emitted into. */
  layer?: string;
  /** Statements emitted before the layer block. */
  preamble?: string;
  /** Alias groups, when `entries` hold only part of the graph. */
  aliases?: readonly AliasGroup[];
  /**
   * Token paths whose consume aliases another stylesheet already declares. A
   * later layer must not re-declare those, or it would beat that stylesheet's
   * own variant blocks.
   */
  inherited?: ReadonlySet<string>;
  /**
   * A selector (see `parseScope`) whose elements get the whole graph instead of
   * `:root`. `entries` must then be the whole graph, so a scope holds every
   * token and an outer scope's values never leak into it.
   */
  scope?: string;
};

export function emitCss(entries: ResolvedEntry[], options: EmitCssOptions = {}): string {
  const aliases = options.aliases ?? aliasGroups(entries);
  const inherited = options.inherited ?? new Set<string>();
  const scope = options.scope === undefined ? undefined : parseScope(options.scope);
  // In a later layer, a bare :root default would beat an earlier layer's
  // other contexts on the root element itself.
  const layered = options.inherited !== undefined;
  // Inside `@scope (S)` a bare selector matches only below S, so each one is
  // also written on `:scope`. Scope proximity then lets a nested scope win.
  const at = (selector: string) => (scope ? `:scope${selector},\n${selector}` : selector);
  const fallbacks: string[] = [];
  const root: FlatToken[] = [];
  const rootAliases: FlatToken[] = [];
  const scopedBlocks: string[] = [];
  const attributes: string[] = [];
  const rescoped: FlatToken[] = [];
  const defaults: FlatToken[] = [];
  const aliasBlocks: string[] = [];
  for (const entry of entries) {
    if (entry.kind === 'set') {
      const own = entry.tokens.filter((token) => !inherited.has(token.path));
      if (attributes.length === 0) {
        root.push(...entry.tokens);
        rootAliases.push(...own);
      } else {
        rescoped.push(...entry.tokens);
        defaults.push(...own);
      }
      continue;
    }
    const { attribute, alias, colorScheme } = entry.extension;
    if (!attribute) fail(`modifier "${entry.name}" is missing an attribute`);
    for (const [context, tokens] of entry.contexts) {
      const selector = `[${attribute}="${context}"]`;
      if (alias) {
        rescoped.push(...tokens);
        const own = tokens.filter((token) => !inherited.has(token.path));
        if (context === entry.defaultContext) defaults.push(...own);
        aliasBlocks.push(...block(at(selector), [aliasDecls(own, aliases)]));
        continue;
      }
      const rootDefault = entry.extension.root === true && context === entry.defaultContext;
      if (tokens.length === 0) continue;
      // Only a root without the attribute: a bare :root would tie with an
      // earlier context's selector on the root element and win by source order.
      const rootSelector = `:root:not([${attribute}])`;
      const lines = [decls(tokens), colorScheme ? `  color-scheme: ${context};` : ''];
      scopedBlocks.push(...block(rootDefault && !scope ? `${rootSelector},\n${selector}` : at(selector), lines));
      // A color-scheme modifier also takes "system", which follows the
      // user's prefers-color-scheme in CSS, so no script picks it first.
      // Each context's system rule has its own media condition, so it never
      // competes with the other context's, whatever their order or layer.
      const media = context === 'dark' ? '(prefers-color-scheme: dark)' : 'not (prefers-color-scheme: dark)';
      if (colorScheme) scopedBlocks.push(...block(`@media ${media}`, indent(block(at(`[${attribute}="system"]`), lines))));
      if (scope) fallbacks.push(...scopeFallbacks(scope, attribute, context, lines, { rootDefault, media: colorScheme ? media : null }));
    }
    if (!alias) attributes.push(`[${attribute}]`);
  }
  // The root element gets the re-declared sets too, so components work with no provider above them.
  // A scope's root selector carries the same :not()s as :root's, so on the
  // root element it matches an unscoped build's specificity and wins by proximity.
  const unset = attributes.map((attribute) => `:not(${attribute})`).join('');
  const rescopedRoot = scope ? [`:scope${unset}`, ...attributes.map(at)] : [layered ? `:root${unset}` : ':root', ...attributes];
  const blocks = [
    // A scope also clears the override inputs an outer ThemeProvider set, so
    // they don't reach its tokens; a provider on or inside it sets them again.
    ...block(scope ? ':scope' : ':root', [decls(root), aliasDecls(rootAliases, aliases), scope ? clearedInputs(rescoped) : '']),
    ...scopedBlocks,
    // Alias defaults keep a bare :scope's or :root's lower specificity, so an
    // alias attribute on that element itself still wins over them.
    ...(scope || layered
      ? [
          ...block(rescopedRoot.join(',\n'), [overridableDecls(rescoped)]),
          ...block([scope ? ':scope' : ':root', ...attributes.map(at)].join(',\n'), [aliasDecls(defaults, aliases)]),
        ]
      : block(rescopedRoot.join(',\n'), [overridableDecls(rescoped), aliasDecls(defaults, aliases)])),
    ...aliasBlocks,
  ];
  const body = scope ? [`@scope (${scope}) {\n${indent(blocks).join('\n\n')}\n}`, ...fallbacks] : blocks;
  return `${options.preamble ?? ''}@layer ${options.layer ?? 'todae.base'} {\n${body.join('\n\n')}\n}\n`;
}

/**
 * Gives every row of a path one description: the first found in `sources`,
 * in order, so a modifier token described once, in one context's file,
 * carries it in every context. A company build passes its own tokens before
 * Todae's, so its description wins in any context and Todae's is the fallback.
 */
export function settleDescriptions<T extends FlatToken>(tokens: T[], sources: FlatToken[][] = [tokens]): T[] {
  const described = new Map<string, string>();
  for (const source of sources) {
    for (const token of source) if (token.description && !described.has(token.path)) described.set(token.path, token.description);
  }
  return tokens.map((token) => {
    const description = described.get(token.path);
    if (description === token.description) return token;
    const settled = { ...token };
    if (description === undefined) delete settled.description;
    else settled.description = description;
    return settled;
  });
}

export function emitCatalog(tokens: EntryToken[]): string {
  const described = new Map(settleDescriptions(tokens).map((token) => [token.path, token.description]));
  const rows = tokens.map(({ path, type, cssVar, cssValue, ref, layer, context, entry }) => ({
    path,
    type,
    cssVar,
    cssValue,
    ref,
    layer,
    context: context ?? null,
    entry,
    description: described.get(path) ?? null,
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
  overrideKeys: string;
  tokens: EntryToken[];
};

const OVERRIDE_GROUPS = [
  ['RAW_OVERRIDE_KEYS', ['core']],
  ['SEMANTIC_OVERRIDE_KEYS', ['appearance', 'density']],
  ['COMPONENT_OVERRIDE_KEYS', ['contract']],
] as const;

/**
 * Emits the ThemeProvider override keys and their types, grouped by layer,
 * and the contrast pairs it measures in development when overrides change.
 */
export function emitOverrideKeys(tokens: FlatToken[], pairs: readonly ContrastPair[] = []): string {
  const types = new Map<string, string>();
  for (const token of tokens) {
    const seen = types.get(token.path);
    if (seen && seen !== token.type) fail(`token "${token.path}" has $type ${seen} and ${token.type} across contexts`);
    types.set(token.path, token.type);
  }
  const lines = ['// Generated by scripts/build-tokens.ts from tokens/resolver.json. Do not edit.', ''];
  for (const [name, layers] of OVERRIDE_GROUPS) {
    const paths = [...new Set(tokens.filter((t) => (layers as readonly string[]).includes(t.layer)).map((t) => t.path))];
    lines.push(`export const ${name} = [`, ...paths.map((path) => `  '${path}',`), '] as const;', '');
  }
  lines.push('export const THEME_OVERRIDE_TYPES = {', ...[...types].map(([path, type]) => `  '${path}': '${type}',`), '} as const;');
  lines.push(
    '',
    'export const CONTRAST_PAIRS: readonly { fg: string; bg: string; min: number; over?: readonly string[] }[] = [',
    ...pairs.map(({ fg, bg, min, over }) => {
      const surfaces = over ? `, over: [${over.map((path) => `'${path}'`).join(', ')}]` : '';
      return `  { fg: '${fg}', bg: '${bg}', min: ${min}${surfaces} },`;
    }),
    '];',
  );
  return `${lines.join('\n')}\n`;
}

export const TODAE_EXTENSION = 'dev.todae';

const ATTRIBUTE_RE = /^data-[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const CONTEXT_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function aliasGroups(entries: ResolvedEntry[]): AliasGroup[] {
  const groups: AliasGroup[] = [];
  for (const entry of entries) {
    if (entry.kind !== 'modifier' || !entry.extension.alias) continue;
    const first = entry.contexts.get(entry.defaultContext)?.[0];
    if (!first) fail(`alias modifier "${entry.name}" default context "${entry.defaultContext}" is empty`);
    groups.push({ root: first.path.slice(0, first.path.indexOf('.')), contexts: [...entry.contexts.keys()] });
  }
  return groups;
}

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
  if (!isRecord(slots)) fail(`${loc} slots must map token groups to leaf names`);
  for (const [group, leaves] of Object.entries(slots)) {
    if (!SLOT_GROUP_RE.test(group)) fail(`${loc} slot group "${group}" must be lowercase dot segments or *`);
    if (
      !Array.isArray(leaves) ||
      leaves.length === 0 ||
      leaves.some((leaf) => typeof leaf !== 'string' || !SLOT_LEAF_RE.test(leaf)) ||
      new Set(leaves).size !== leaves.length
    ) {
      fail(`${loc} slot group "${group}" must list distinct lowercase leaf names`);
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
  paints: readonly string[];
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
  paints,
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
  return layerTokens(merged, layer, context, { rules, slots, paints, inherited: tokenMapOf(inherited) }).map((token) => ({
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

function tokenMapOf(tokens: FlatToken[]): Map<string, TokenNode> {
  return new Map(tokens.map((t) => [t.path, { $type: t.type, $value: t.value }]));
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

  // The button rule checks paint packs against every button alias context.
  const paints = new Set<string>();
  for (const entry of upstream) {
    if (entry.kind === 'modifier' && entry.extension.alias && entry.extension.rules?.includes('button')) {
      for (const context of entry.contexts.keys()) paints.add(context);
    }
  }
  for (const { kind, def, extension } of order) {
    if (kind === 'modifier' && extension.alias && extension.rules?.includes('button') && isRecord(def.contexts)) {
      for (const context of Object.keys(def.contexts)) paints.add(context);
    }
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
          paints: [...paints],
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
          paints: [...paints],
          inherited: base?.kind === 'modifier' ? (base.contexts.get(context) ?? []) : [],
          todaeOwners,
        }),
      );
    }
    entries.push({ kind, name, extension, defaultContext, contexts });
  }
  return entries;
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
      if (extension.rules?.includes('button')) {
        validatePaintPacks(
          Object.fromEntries([...contexts].map(([context, tokens]) => [context, tokenMapOf(tokens)])),
          defaultContext,
        );
      }
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

function entryTokens(entry: ResolvedEntry): EntryToken[] {
  return entry.kind === 'set' ? entry.tokens : [...entry.contexts.values()].flat();
}

/** Graph-level checks: one owner per token, refs, layer and resolution order. Returns every token. */
export function checkGraph(entries: ResolvedEntry[]): EntryToken[] {
  const known = new Map<string, Layer>();
  const owner = new Map<string, string>();
  const position = new Map<string, number>();
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
  // A later entry may read an earlier one of its layer, e.g. a button variant reads focus.ring.color.
  validateRefs(all, known, (from, to) => {
    const [at, target] = [position.get(from)!, position.get(to)!];
    return at === target || (target < at && known.get(from) === known.get(to));
  });
  // Sets before the first scoped modifier are declared on :root alone, so an
  // alias there resolves once: an override of its target below :root, on a
  // provider or a [data-*] element, would never reach it.
  const rootAlias = rootOnly.find((token) => token.refs.length > 0);
  if (rootAlias) {
    fail(
      `token "${rootAlias.path}" is declared only on :root, so it can't reference "${rootAlias.refs[0]!.path}";` +
        ' give it a literal value, or move it to a set listed after the first modifier in resolutionOrder',
    );
  }
  const byPath = new Map<string, FlatToken[]>();
  for (const token of all) {
    const list = byPath.get(token.path);
    if (list) list.push(token);
    else byPath.set(token.path, [token]);
  }
  // An alpha must land in [0, 1] in every context its number token takes.
  // Each alpha target is walked once, with its own `seen` set, so a loop
  // across contexts (light reads b, dark reads a) ends the walk. The walk
  // keeps its own stack, so a long alias chain cannot overflow the call
  // stack, and visits literals in the order a depth-first walk reaches them.
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
  // CSS places each entry by its resolutionOrder position, so an alias to a
  // later entry would resolve before that entry's context is applied. Scoped
  // modifier blocks are not re-declared when another modifier's context
  // changes, so they may not alias each other either.
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
  // A token path reached through `ref` (at any depth) that another scoped modifier declares.
  function scopedDependency(ref: string, from: number): string | null {
    return scopedReach(from).get(ref) ?? null;
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
        const dependency = scoped(entry) ? scopedDependency(ref, index) : null;
        if (dependency) {
          fail(
            `token "${token.path}" in ${entry.kind} "${entry.name}" depends on "${dependency}" from ${owner.get(dependency)}; scoped modifiers may not alias each other,` +
              ' so give it a literal value or a $ref to a token that reads no scoped modifier\'s tokens, such as a core token',
          );
        }
      }
    }
  }
  return all;
}

export async function resolveEntries(tokensRoot: string): Promise<ResolvedEntry[]> {
  const entries = await loadResolver(join(tokensRoot, 'resolver.json'));
  validateEntries(entries);
  return entries;
}

export async function buildTokensGraph(tokensRoot: string): Promise<BuildTokensResult> {
  const entries = await resolveEntries(tokensRoot);
  const all = settleDescriptions(checkGraph(entries));
  validateContrast(entries);
  const pairs = entries.flatMap((entry) => entry.extension.contrast ?? []);
  return { css: emitCss(entries), json: emitCatalog(all), overrideKeys: emitOverrideKeys(all, pairs), tokens: all };
}

/** Walks up from this file to the package that ships Todae's `tokens/resolver.json`. */
export function todaeTokensRoot(from = import.meta.dirname): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (existsSync(join(dir, 'tokens', 'resolver.json')) && existsSync(join(dir, 'package.json'))) {
      return join(dir, 'tokens');
    }
    if (dirname(dir) === dir) fail(`Could not find Todae's tokens/resolver.json above ${from}`);
  }
}

export const COMPANY_LAYER = 'todae.theme';
const COMPANY_PREAMBLE = `@layer todae.reset, todae.base, todae.components, ${COMPANY_LAYER};\n\n`;

export type CompanyTokensResult = {
  /** CSS for the company's tokens only, in a cascade layer after Todae's. */
  css: string;
  /** Catalog of Todae's and the company's tokens together. */
  json: string;
  /** `THEME_OVERRIDE_TYPES` for the company's tokens, for ThemeProvider `overrideTypes`. */
  overrideTypes: string;
  tokens: EntryToken[];
};

/**
 * Builds a company token package layered on Todae's: `resolver` is the
 * company's resolver.json, `base` Todae's tokens directory. Without `scope`
 * the CSS holds the company's tokens for the whole page; with it, Todae's and
 * the company's tokens for the elements `scope` matches, so several themes can
 * share a page.
 */
export async function buildCompanyTokens(options: { resolver: string; base?: string; scope?: string }): Promise<CompanyTokensResult> {
  if (options.scope !== undefined) parseScope(options.scope);
  const upstream = await resolveEntries(options.base ?? todaeTokensRoot());
  const extra = await loadResolver(options.resolver, upstream);
  const { merged, company, inherited } = mergeEntries(upstream, extra);
  validateEntries(merged);
  const own = company.flatMap(entryTokens);
  const all = settleDescriptions(checkGraph(merged), [own, upstream.flatMap(entryTokens)]);
  validateContrast(merged, new Set(upstream.flatMap(entryTokens)));
  const { scope } = options;
  const css = scope !== undefined
    ? emitCss(merged, { layer: COMPANY_LAYER, preamble: COMPANY_PREAMBLE, scope })
    : emitCss(company, { layer: COMPANY_LAYER, preamble: COMPANY_PREAMBLE, aliases: aliasGroups(merged), inherited });
  const types = new Map(own.map((token) => [token.path, token.type]));
  const overrideTypes = [
    '// Generated by todae-tokens. Do not edit.',
    '',
    'export const THEME_OVERRIDE_TYPES = {',
    ...[...types].map(([path, type]) => `  '${path}': '${type}',`),
    '} as const;',
    '',
  ].join('\n');
  return { css, json: emitCatalog(all), overrideTypes, tokens: all };
}

export async function buildTokens(options: { check?: boolean; root?: string } = {}): Promise<BuildTokensResult> {
  const pkgRoot = options.root ?? join(import.meta.dirname, '..');
  const tokensRoot = join(pkgRoot, 'tokens');
  const result = await buildTokensGraph(tokensRoot);
  const cssFile = join(pkgRoot, 'src/styles/tokens.generated.css');
  const jsonFile = join(tokensRoot, 'tokens.generated.json');
  const keysFile = join(pkgRoot, 'src/providers/themeOverrideKeys.generated.ts');
  if (options.check) {
    let css: string;
    let json: string;
    let keys: string;
    try {
      css = await readFile(cssFile, 'utf8');
      json = await readFile(jsonFile, 'utf8');
      keys = await readFile(keysFile, 'utf8');
    } catch {
      fail('tokens:check failed: generated files are missing');
    }
    if (css !== result.css || json !== result.json || keys !== result.overrideKeys) {
      fail('tokens:check failed: generated tokens drifted');
    }
    return result;
  }
  await atomicWrite(cssFile, result.css);
  await atomicWrite(jsonFile, result.json);
  await atomicWrite(keysFile, result.overrideKeys);
  process.stdout.write(
    `Wrote ${relative(pkgRoot, cssFile)}, ${relative(pkgRoot, jsonFile)} and ${relative(pkgRoot, keysFile)} (${result.tokens.length} tokens)\n`,
  );
  return result;
}

async function writeOrCheck(outputs: [file: string, contents: string][], check: boolean, label: string): Promise<void> {
  if (!check) {
    for (const [file, contents] of outputs) await atomicWrite(file, contents);
    return;
  }
  for (const [file, contents] of outputs) {
    let current: string;
    try {
      current = await readFile(file, 'utf8');
    } catch {
      fail(`${label} failed: ${file} is missing`);
    }
    if (current !== contents) fail(`${label} failed: ${file} drifted`);
  }
}

const USAGE = `Usage: todae-tokens build --resolver <file> [options]

Builds a company token package layered on Todae's tokens.

Options:
  --resolver <file>  Company DTCG 2025.10 resolver (required)
  --css <file>       CSS output, layered after Todae's (default: todae-theme.css)
  --catalog <file>   Merged token catalog (default: tokens.catalog.json)
  --types <file>     ThemeProvider overrideTypes module (default: todae-theme.types.ts)
  --base <dir>       Todae tokens directory (default: the installed package's)
  --scope <selector> Apply the theme only inside elements that match the
                     selector, such as ".brand-acme", instead of the whole page
  --check            Fail if the outputs are missing or out of date instead of writing
`;

export async function cli(argv: string[]): Promise<void> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      resolver: { type: 'string' },
      css: { type: 'string', default: 'todae-theme.css' },
      catalog: { type: 'string', default: 'tokens.catalog.json' },
      types: { type: 'string', default: 'todae-theme.types.ts' },
      base: { type: 'string' },
      scope: { type: 'string' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (positionals[0] !== 'build' || positionals.length !== 1 || !values.resolver) fail(USAGE);
  const result = await buildCompanyTokens({
    resolver: values.resolver,
    ...(values.base ? { base: resolve(values.base) } : {}),
    ...(values.scope === undefined ? {} : { scope: values.scope }),
  });
  const outputs: [string, string][] = [
    [resolve(values.css), result.css],
    [resolve(values.catalog), result.json],
    [resolve(values.types), result.overrideTypes],
  ];
  await writeOrCheck(outputs, values.check, 'todae-tokens --check');
  if (!values.check) process.stdout.write(`Wrote ${outputs.map(([file]) => relative(process.cwd(), file)).join(', ')}\n`);
}

function invokedPath(): string | null {
  try {
    return process.argv[1] ? realpathSync(resolve(process.argv[1])) : null;
  } catch {
    return null;
  }
}

const entry = invokedPath();
if (entry && pathToFileURL(entry).href === import.meta.url) {
  const args = process.argv.slice(2);
  try {
    // `self` rebuilds Todae's own generated files; it is for this repo's scripts only.
    if (args[0] === 'self') await buildTokens({ check: args.includes('--check') });
    else await cli(args);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
