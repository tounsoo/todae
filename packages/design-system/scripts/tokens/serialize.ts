import {
  PATH_RE,
  fail,
  isFiniteNumber,
  isRecord,
  isRef,
  parseComponentPointer,
  pathToPointer,
  pointerToPath,
  type ContrastPair,
  type EntryToken,
  type FlatToken,
  type ResolvedEntry,
  type TokenNode,
  type TokenRef,
} from './shared.ts';

export function cssVarName(path: string): string {
  return `--todae-${path.replaceAll('.', '-')}`;
}

/** An alias modifier's token root (`button`) and its contexts (`primary`, …). */
export type AliasGroup = { root: string; contexts: readonly string[] };

/**
 * The consume var a pack token aliases: `<root>.<context>.x` and the shared
 * `<root>.base.x` both feed `--todae-<root>-x`.
 */
export function consumeCssVar(path: string, aliases: readonly AliasGroup[]): string | null {
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
