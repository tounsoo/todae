import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DOCS_ORIGIN } from '../origin';
import { resolveEntries } from '@tounsoo/todae/tokens-builder';
import { buildTokenFiles, todaeTokensDir, type BuildResult } from './build';
import { envelope, MAX_RESPONSE_CHARS, type NextCall } from './budget';
import { BUILD_COMMAND, TOKENS_FOLDER, rowEntry, tokenPackage, type PackageSeed, type PackageToken, type TokenEntry } from '../token-package/package';
import { catalogTokens, type CatalogToken } from './tokens';

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
  /**
   * Core token values to replace, by path, such as `radius.md`, `font.family.sans` or
   * `motion.duration.fast`. Each is a DTCG `$value`. Core is declared on `:root`, so it takes no `$ref` alias.
   */
  core?: Record<string, unknown>;
  /**
   * Contract token values to replace, by path, such as `button.base.radius`, `card.shadow` or
   * `motion.popup.duration.enter`. Each is a DTCG `$value` or an alias such as `{ "$ref": "#/radius/full/$value" }`. A path under `button.<variant>.` for a
   * name in `buttonVariants` changes that new variant's copy of `secondary`.
   */
  contract?: Record<string, unknown>;
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

function appearanceColorPaths(): Set<string> {
  return new Set(catalogTokens().filter((row) => row.layer === 'appearance' && row.type === 'color').map((row) => row.path));
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
 * `core` or `contract` values as package tokens, each in the file of the set or
 * modifier context that declares it in Todae's catalog. A contract path of a
 * new button variant takes its type from the same path under `secondary`.
 */
function layerTokens(layer: 'core' | 'contract', values: Record<string, unknown>, variants: readonly string[]): PackageToken[] {
  const rows = new Map<string, CatalogToken>();
  for (const row of catalogTokens()) if (row.layer === layer && !rows.has(row.path)) rows.set(row.path, row);
  const tokens: PackageToken[] = [];
  for (const [path, value] of Object.entries(values)) {
    const variant = layer === 'contract' ? variants.find((name) => path.startsWith(`button.${name}.`)) : undefined;
    const row = rows.get(variant ? `button.secondary.${path.slice(`button.${variant}.`.length)}` : path);
    if (!row) throw new Error(`"${path}" is not a ${layer} token. Call list_tokens with layer "${layer}".`);
    const entry: TokenEntry = variant ? { kind: 'modifier', name: 'buttonVariant', context: variant } : rowEntry(row);
    // Core and contract tokens are declared once, or once per button variant, so this is a guard.
    if (entry.kind === 'modifier' && entry.context === '') throw new Error(`"${path}" is set per ${row.entry.name} context`);
    tokens.push({ path, type: row.type, value, entry });
  }
  return tokens;
}

/**
 * Starter files for a design system on Todae: a company resolver, its token
 * files and TypeScript declarations, checked with the same build
 * `todae-tokens build` runs. The files follow the layout of
 * `examples/fernway/tokens`. `tokenFiles` are by path inside `tokensFolder`,
 * the shape `build_tokens` takes; `otherFiles` are by path from the project
 * root. Nothing is written to the caller's machine; the caller saves the files.
 */
export async function scaffoldDesignSystem(options: ScaffoldOptions, base = todaeTokensDir()) {
  const { name, colors, buttonVariants = [], densities = [], core = {}, contract = {} } = options;
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

  const tokens: PackageToken[] = [];
  const seeds: PackageSeed[] = [];
  if (colors) {
    for (const context of ['light', 'dark'] as const) {
      for (const [path, components] of Object.entries(colors[context])) {
        tokens.push({ path, type: 'color', value: { colorSpace: 'oklch', components }, entry: { kind: 'modifier', name: 'appearance', context } });
      }
    }
  }
  if (densities.length > 0) {
    const text = await readFile(join(base, 'density', 'comfortable.json'), 'utf8');
    const comfortable = JSON.parse(text) as Record<string, unknown>;
    for (const density of densities) seeds.push({ entry: { kind: 'modifier', name: 'density', context: density }, tree: comfortable, text });
  }
  if (buttonVariants.length > 0) {
    const secondary = JSON.parse(await readFile(join(base, 'components', 'button.secondary.json'), 'utf8')) as {
      button: { secondary: unknown };
    };
    for (const variant of buttonVariants) {
      seeds.push({ entry: { kind: 'modifier', name: 'buttonVariant', context: variant }, tree: { button: { [variant]: secondary.button.secondary } } });
    }
  }
  tokens.push(...layerTokens('core', core, []), ...layerTokens('contract', contract, buttonVariants));

  const files = tokenPackage({ name, tokens, seeds });
  const build: BuildResult = await buildTokenFiles(files, { base });

  const otherFiles: ScaffoldFile[] = [];
  if (buttonVariants.length > 0 || densities.length > 0) {
    otherFiles.push({ path: 'src/todae.d.ts', contents: declarations(buttonVariants, densities) });
  }

  return {
    tokensFolder: TOKENS_FOLDER,
    tokenFiles: files,
    otherFiles,
    build: build.ok ? { ok: true as const } : { ok: false as const, error: build.error },
    command: BUILD_COMMAND,
    docsUrl: `${DOCS_ORIGIN}/guides/build-on-todae`,
    source: SOURCE,
  };
}

export type ScaffoldDraft = Awaited<ReturnType<typeof scaffoldDesignSystem>>;

const SCAFFOLD_SLICE = 24_000;

/** The same call again, with the cursor filled in, so the next page needs no rebuilt arguments. */
function scaffoldNext(options: ScaffoldOptions, cursor: { offset: number; char?: number }): NextCall {
  const args: NextCall['arguments'] = { name: options.name, offset: cursor.offset, char: cursor.char ?? 0 };
  if (options.colors) args.colors = options.colors;
  if (options.buttonVariants) args.buttonVariants = options.buttonVariants;
  if (options.densities) args.densities = options.densities;
  if (options.core) args.core = options.core;
  if (options.contract) args.contract = options.contract;
  return {
    tool: 'scaffold_design_system',
    arguments: args,
    why: 'The next file of this draft. Pass these arguments unchanged.',
  };
}

/**
 * The draft itself when it fits the response budget, which is the shape `build_tokens` takes.
 * A draft over the budget comes back one file at a time. A file that is still too long continues at `cursor.char`.
 * The first next call repeats the original arguments with that cursor.
 */
export function presentScaffold(result: ScaffoldDraft, offset = 0, char = 0, options?: ScaffoldOptions) {
  if (offset === 0 && char === 0 && JSON.stringify(result).length <= MAX_RESPONSE_CHARS - 800) return result;
  const files = [
    ...Object.entries(result.tokenFiles).map(([path, contents]) => ({ group: 'tokenFiles' as const, path, contents })),
    ...result.otherFiles.map((file) => ({ group: 'otherFiles' as const, path: file.path, contents: file.contents })),
    ...(!result.build.ok ? [{ group: 'build' as const, path: 'build-error', contents: result.build.error }] : []),
  ];
  const index = Math.max(0, Math.trunc(offset));
  const current = files[index];
  const start = Math.max(0, Math.trunc(char));
  const rest = current ? current.contents.slice(start) : '';
  // The next call carries the original arguments, so the file slice shrinks until the whole JSON fits.
  const room = MAX_RESPONSE_CHARS;
  const pageAt = (size: number) => {
    const nextChar = start + size;
    const fileDone = !current || nextChar >= current.contents.length;
    const cursor = !current
      ? undefined
      : fileDone
        ? index + 1 < files.length
          ? { offset: index + 1 }
          : undefined
        : { offset: index, char: nextChar };
    const body = {
      tokensFolder: result.tokensFolder,
      index,
      total: files.length,
      ...(current ? { file: { group: current.group, path: current.path, contents: rest.slice(0, size) } } : {}),
      ...(index === 0 && start === 0 ? { build: { ok: result.build.ok }, command: result.command } : {}),
      ...(cursor ? { cursor } : {}),
      docsUrl: result.docsUrl,
      source: result.source,
    };
    return cursor && options ? envelope(body, 'scaffold', [scaffoldNext(options, cursor)]) : body;
  };
  let take = rest.length;
  if (take > SCAFFOLD_SLICE) {
    const cut = rest.slice(0, SCAFFOLD_SLICE);
    const newline = cut.lastIndexOf('\n');
    take = newline > 0 ? newline : SCAFFOLD_SLICE;
  }
  if (JSON.stringify(pageAt(take)).length > room && take > 1) {
    let lo = 1;
    let hi = take - 1;
    let best = 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const cut = rest.slice(0, mid);
      const newline = cut.lastIndexOf('\n');
      const size = newline > 0 ? newline : mid;
      if (JSON.stringify(pageAt(size)).length <= room) {
        best = size;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    take = best;
  }
  return pageAt(take);
}
