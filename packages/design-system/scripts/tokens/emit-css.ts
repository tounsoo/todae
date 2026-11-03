import { clearedInputs, parseScope, scopeFallbacks } from './scope.ts';
import { aliasGroups, consumeCssVar, type AliasGroup } from './serialize.ts';
import { block, fail, indent, type FlatToken, type ResolvedEntry } from './shared.ts';

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
