import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const NAME = 'StableBuild';
// Orders [key, value] pairs by key, by code unit, so the order doesn't depend on the locale.
const byKey = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Puts each module's outgoing connections in source order: by the block that holds the import, then by the
 * import's place in that block.
 *
 * Webpack adds a module's connections as their imports finish resolving, so their order changes from build
 * to build. Next walks them to collect the client components and CSS each route uses, and orders them only by
 * an import's place inside its own block. Every `import()` is a block of its own at place 0, so the Korean
 * fallback page's hundred-odd `import()`s of English pages tie, and keep the order they resolved in. That
 * order names the route's client entry modules, which webpack hashes into module and chunk ids that most
 * built files mention, and it orders the components in one of the site's stylesheets.
 */
export function sortConnections(compilation) {
  const { moduleGraph } = compilation;
  for (const module of compilation.modules) {
    const connections = moduleGraph.getOutgoingConnections(module);
    if (connections.size < 2) continue;
    const blocks = new Map();
    const visit = (block) => {
      blocks.set(block, blocks.size);
      for (const child of block.blocks ?? []) visit(child);
    };
    visit(module);
    const key = (connection) => {
      const { dependency } = connection;
      if (!dependency) return [Infinity, Infinity];
      return [blocks.get(moduleGraph.getParentBlock(dependency)) ?? Infinity, moduleGraph.getParentBlockIndex(dependency)];
    };
    const sorted = [...connections].map((connection) => [key(connection), connection]);
    sorted.sort(([a], [b]) => a[0] - b[0] || a[1] - b[1]);
    connections.clear();
    for (const [, connection] of sorted) connections.add(connection);
  }
}

/**
 * Puts the compilation's entries in name order. Next adds the client entries as the server build finds them,
 * so their order changes from build to build. Webpack makes each entry's chunk in that order, and Next's CSS
 * chunking reads the chunks in that order to decide where each component's CSS goes in the stylesheets it
 * writes.
 */
export function sortEntries(compilation) {
  const sorted = [...compilation.entries].sort(byKey);
  compilation.entries.clear();
  for (const [name, entry] of sorted) compilation.entries.set(name, entry);
}

/**
 * Lightning CSS returns a CSS Module's class names as a hash map, so their order changes from one process to
 * the next, and Next writes them into the module's JavaScript in that order. Sorting them by name keeps the
 * JavaScript the same while every class keeps its value.
 */
export function sortCssModuleExports(result) {
  if (!result.exports) return result;
  const exports = Object.fromEntries(Object.entries(result.exports).sort(byKey));
  return { ...result, exports };
}

/**
 * Next lists the prerendered routes in .next/prerender-manifest.json in the order its workers finish them, and
 * Vercel numbers each route's prerender group in that order, so every route's prerender-config.json in the
 * deployed output changes from build to build. The lists are maps, so sorting them changes nothing else.
 */
export function sortPrerenderManifest(manifest) {
  const sorted = { ...manifest };
  for (const key of ['routes', 'dynamicRoutes']) {
    if (manifest[key]) sorted[key] = Object.fromEntries(Object.entries(manifest[key]).sort(byKey));
  }
  if (Array.isArray(manifest.notFoundRoutes)) sorted.notFoundRoutes = [...manifest.notFoundRoutes].sort();
  return sorted;
}

let lightning = null;

/** The Lightning CSS transform Next ships, with the class names it returns sorted. */
const sortedLightningCss = {
  transformCss(options) {
    if (!lightning) throw new Error(`${NAME}: Next's SWC bindings weren't loaded before the first CSS file.`);
    return sortCssModuleExports(lightning.transform(options));
  },
};

/**
 * Makes two builds of the same code write the same files: it fixes the order Next walks imports and entries
 * in, and points Next's Lightning CSS loader at a transform that sorts the class names.
 */
export function stableBuild(config) {
  // Next loads its SWC bindings before it builds the webpack config, so this resolves before any loader runs.
  require('next/dist/build/swc')
    .loadBindings()
    .then((bindings) => {
      lightning = bindings.css.lightning;
    });
  let loaders = 0;
  for (const loader of lightningCssLoaders(config.module.rules)) {
    loader.options = { ...loader.options, implementation: sortedLightningCss };
    loaders += 1;
  }
  // A Next upgrade that moves the loader would otherwise bring the churn back without a word.
  if (!loaders) throw new Error(`${NAME}: Next's Lightning CSS loader wasn't found in the webpack rules.`);
  config.plugins.push({
    apply(compiler) {
      // Before Next's own finishMake step, which walks the connections.
      compiler.hooks.finishMake.tap({ name: NAME, stage: -100 }, sortConnections);
      // Webpack makes the chunks right after this hook.
      compiler.hooks.compilation.tap(NAME, (compilation) => {
        compilation.hooks.beforeChunks.tap(NAME, () => sortEntries(compilation));
      });
    },
  });
  return config;
}

/** Every use of Next's Lightning CSS loader in a webpack rule list, however deeply nested. */
export function* lightningCssLoaders(rules) {
  for (const rule of rules ?? []) {
    if (!rule || typeof rule !== 'object') continue;
    yield* lightningCssLoaders(rule.oneOf);
    yield* lightningCssLoaders(rule.rules);
    for (const use of [rule.use].flat()) {
      if (use && typeof use === 'object' && /[\\/]lightningcss-loader[\\/]/.test(use.loader ?? '')) yield use;
    }
  }
}
