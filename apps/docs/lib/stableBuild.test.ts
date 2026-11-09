import { describe, expect, it } from 'vitest';
import { lightningCssLoaders, sortConnections, sortCssModuleExports, sortEntries, sortPrerenderManifest } from './stableBuild.mjs';

describe('sortConnections', () => {
  it("orders a module's connections by block, then by place in the block", () => {
    // A module with two imports in its body and two import() blocks, resolved in a scrambled order.
    const lazyA = { blocks: [] };
    const lazyB = { blocks: [] };
    const module = { blocks: [lazyA, lazyB] };
    const deps = {
      first: { block: module, index: 0 },
      second: { block: module, index: 1 },
      a: { block: lazyA, index: 0 },
      b: { block: lazyB, index: 0 },
    };
    const connection = (name: keyof typeof deps) => ({ name, dependency: deps[name] });
    const connections = new Set([connection('b'), connection('second'), connection('a'), connection('first')]);
    const moduleGraph = {
      getOutgoingConnections: () => connections,
      getParentBlock: (dependency: { block: object }) => dependency.block,
      getParentBlockIndex: (dependency: { index: number }) => dependency.index,
    };
    sortConnections({ modules: [module], moduleGraph } as never);
    expect([...connections].map((item) => item.name)).toEqual(['first', 'second', 'a', 'b']);
  });
});

describe('sortEntries', () => {
  it('puts the entries in name order', () => {
    const entries = new Map([
      ['app/ko/page', 1],
      ['app/(en)/badge/page', 2],
      ['app/(en)/alert/page', 3],
    ]);
    sortEntries({ entries } as never);
    expect([...entries]).toEqual([
      ['app/(en)/alert/page', 3],
      ['app/(en)/badge/page', 2],
      ['app/ko/page', 1],
    ]);
  });
});

describe('sortCssModuleExports', () => {
  it('sorts the class names and keeps each value', () => {
    const icon = { name: 'Button__icon', composes: [], isReferenced: false };
    const root = { name: 'Button__root', composes: [], isReferenced: false };
    const result = sortCssModuleExports({ code: 'css', exports: { root, icon } });
    expect(Object.keys(result.exports!)).toEqual(['icon', 'root']);
    expect(result).toEqual({ code: 'css', exports: { icon, root } });
  });

  it('passes a result without exports through', () => {
    const result = { code: 'css' };
    expect(sortCssModuleExports(result)).toBe(result);
  });
});

describe('sortPrerenderManifest', () => {
  it('sorts the route maps and keeps everything else', () => {
    const manifest = {
      version: 4,
      routes: { '/tabs': { a: 1 }, '/alert': { a: 2 } },
      dynamicRoutes: { '/og/[locale]': { b: 1 }, '/ko/[...slug]': { b: 2 } },
      notFoundRoutes: ['/z', '/a'],
      preview: { previewModeId: 'id' },
    };
    const sorted = sortPrerenderManifest(manifest);
    expect(Object.keys(sorted.routes)).toEqual(['/alert', '/tabs']);
    expect(Object.keys(sorted.dynamicRoutes)).toEqual(['/ko/[...slug]', '/og/[locale]']);
    expect(sorted.notFoundRoutes).toEqual(['/a', '/z']);
    expect(sorted).toEqual({ ...manifest, notFoundRoutes: ['/a', '/z'] });
  });
});

describe('lightningCssLoaders', () => {
  it('finds the loader inside oneOf and nested rules', () => {
    const loader = { loader: '/next/dist/build/webpack/loaders/lightningcss-loader/src/index.js', options: {} };
    const rules = [{ test: /x/ }, { oneOf: [{ rules: [{ use: ['style', loader, { loader: '/postcss-loader/index.js' }] }] }] }, null];
    expect([...lightningCssLoaders(rules)]).toEqual([loader]);
  });
});
