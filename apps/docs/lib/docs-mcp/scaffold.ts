import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOCS_ORIGIN } from '../origin';
import { resolveEntries } from '@tounsoo/todae/tokens-builder';
import { buildTokenFiles, todaeTokensDir, type BuildResult } from './build';
import { catalogTokens } from './tokens';

const SOURCE = 'todae-docs' as const;
const NAME_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
/** The context an aliased modifier writes its shared names to, such as `button.bg.default`. */
const RESERVED_CONTEXTS = ['base'];

export type Oklch = [l: number, c: number, h: number];

export type ScaffoldOptions = {
  /** The design system's name, written into its resolver. */
  name: string;
  /** Appearance color tokens to replace, by path, as OKLCH channels for light and dark. */
  colors?: { light: Record<string, Oklch>; dark: Record<string, Oklch> };
  /** New button variants, each starting as a copy of Todae's `secondary`. */
  buttonVariants?: string[];
  /** New densities, each starting as a copy of Todae's `comfortable`. */
  densities?: string[];
};

export type ScaffoldFile = { path: string; contents: string };

function checkName(kind: string, name: string, taken: readonly string[] = []): void {
  if (!NAME_RE.test(name)) throw new Error(`Invalid ${kind} "${name}": use lowercase words joined by hyphens, such as "outline"`);
  if (taken.includes(name)) throw new Error(`Todae already has the ${kind} "${name}"`);
}

/** The context names of each modifier in Todae's resolver. */
async function todaeContexts(base: string): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  for (const entry of await resolveEntries(base)) {
    if (entry.kind === 'modifier') out.set(entry.name, [...entry.contexts.keys()]);
  }
  return out;
}

function unique(kind: string, names: readonly string[]): void {
  const seen = new Set<string>();
  for (const name of names) {
    if (seen.has(name)) throw new Error(`The ${kind} "${name}" is listed twice`);
    seen.add(name);
  }
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Nests `{ 'color.accent.default': node }` into DTCG groups. */
function tree(entries: [path: string, node: unknown][]): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, node] of entries) {
    const segments = path.split('.');
    let group = root;
    for (const segment of segments.slice(0, -1)) {
      group[segment] ??= {};
      group = group[segment] as Record<string, unknown>;
    }
    group[segments[segments.length - 1] as string] = node;
  }
  return root;
}

function appearanceColorPaths(): Set<string> {
  return new Set(catalogTokens().filter((row) => row.layer === 'appearance' && row.type === 'color').map((row) => row.path));
}

function colorFile(colors: Record<string, Oklch>): string {
  return json(
    tree(
      Object.entries(colors)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, components]) => [path, { $type: 'color', $value: { colorSpace: 'oklch', components } }]),
    ),
  );
}

function quoteKey(name: string): string {
  return /^[a-z][a-z0-9]*$/.test(name) ? name : `'${name}'`;
}

function declarations(variants: readonly string[], densities: readonly string[]): string {
  const lines = ["// Lets TypeScript accept this design system's button variants and densities.", 'export {};', '', "declare module '@tounsoo/todae' {"];
  if (variants.length > 0) {
    lines.push('  interface ButtonVariants {', ...variants.map((name) => `    ${quoteKey(name)}: true;`), '  }');
  }
  if (densities.length > 0) {
    lines.push('  interface Densities {', ...densities.map((name) => `    ${quoteKey(name)}: true;`), '  }');
  }
  lines.push('}', '');
  return lines.join('\n');
}

/**
 * Starter files for a design system on Todae: a company resolver, its token
 * files and TypeScript declarations, checked with the same build
 * `todae-tokens build` runs. `tokenFiles` are by path inside `tokensFolder`,
 * the shape `build_tokens` takes; `otherFiles` are by path from the project
 * root. Nothing is written to the caller's machine; the caller saves the files.
 */
export async function scaffoldDesignSystem(options: ScaffoldOptions, base = todaeTokensDir()) {
  const { name, colors, buttonVariants = [], densities = [] } = options;
  checkName('name', name);
  unique('button variant', buttonVariants);
  unique('density', densities);
  const taken = await todaeContexts(base);
  for (const variant of buttonVariants) {
    checkName('button variant', variant, taken.get('buttonVariant'));
    if (RESERVED_CONTEXTS.includes(variant)) throw new Error(`The button variant "${variant}" is reserved`);
  }
  for (const density of densities) checkName('density', density, taken.get('density'));
  if (colors) {
    const known = appearanceColorPaths();
    const light = Object.keys(colors.light);
    const dark = new Set(Object.keys(colors.dark));
    if (light.length === 0) throw new Error('colors.light and colors.dark need at least one token');
    if (light.length !== dark.size || light.some((path) => !dark.has(path))) {
      throw new Error('colors.light and colors.dark must set the same tokens');
    }
    for (const path of light) {
      if (!known.has(path)) throw new Error(`"${path}" is not an appearance color token. Call list_tokens with layer "appearance".`);
    }
  }

  const drafted: ScaffoldFile[] = [];
  const modifiers: Record<string, unknown> = {};
  const order: { $ref: string }[] = [];

  if (colors) {
    drafted.push({ path: 'appearance/light.json', contents: colorFile(colors.light) });
    drafted.push({ path: 'appearance/dark.json', contents: colorFile(colors.dark) });
    modifiers.appearance = {
      contexts: { light: [{ $ref: './appearance/light.json' }], dark: [{ $ref: './appearance/dark.json' }] },
      $extensions: { 'dev.todae': { layer: 'appearance', attribute: 'data-appearance', root: true, colorScheme: true } },
    };
    order.push({ $ref: '#/modifiers/appearance' });
  }
  if (densities.length > 0) {
    const comfortable = await readFile(join(base, 'density', 'comfortable.json'), 'utf8');
    for (const density of densities) drafted.push({ path: `density/${density}.json`, contents: comfortable });
    modifiers.density = {
      contexts: Object.fromEntries(densities.map((density) => [density, [{ $ref: `./density/${density}.json` }]])),
      $extensions: { 'dev.todae': { layer: 'density', rules: ['density-space'], attribute: 'data-density', root: true } },
    };
    order.push({ $ref: '#/modifiers/density' });
  }
  if (buttonVariants.length > 0) {
    const secondary = JSON.parse(await readFile(join(base, 'components', 'button.secondary.json'), 'utf8')) as {
      button: { secondary: unknown };
    };
    for (const variant of buttonVariants) {
      drafted.push({ path: `button.${variant}.json`, contents: json({ button: { [variant]: secondary.button.secondary } }) });
    }
    modifiers.buttonVariant = {
      contexts: Object.fromEntries(buttonVariants.map((variant) => [variant, [{ $ref: `./button.${variant}.json` }]])),
      $extensions: { 'dev.todae': { layer: 'contract', rules: ['button'], attribute: 'data-button-variant', alias: true } },
    };
    order.push({ $ref: '#/modifiers/buttonVariant' });
  }

  const resolver = {
    $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
    name,
    version: '2025.10',
    sets: {},
    modifiers,
    resolutionOrder: order,
  };
  drafted.unshift({ path: 'resolver.json', contents: json(resolver) });

  const tokens = Object.fromEntries(drafted.map((file) => [file.path, file.contents]));
  const build: BuildResult = await buildTokenFiles(tokens, { base });

  const otherFiles: ScaffoldFile[] = [];
  if (buttonVariants.length > 0 || densities.length > 0) {
    otherFiles.push({ path: 'src/todae.d.ts', contents: declarations(buttonVariants, densities) });
  }

  return {
    tokensFolder: 'tokens',
    tokenFiles: tokens,
    otherFiles,
    build: build.ok ? { ok: true as const } : { ok: false as const, error: build.error },
    command: 'npx --no todae-tokens build --resolver ./tokens/resolver.json',
    docsUrl: `${DOCS_ORIGIN}/guides/build-on-todae`,
    source: SOURCE,
  };
}
