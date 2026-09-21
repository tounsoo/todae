import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as todae from '../index.ts';
import catalogJson from '../../catalog/catalog.json';
import { catalog } from './index.ts';

const ALLOW_EXPORTS = new Set([
  'CHIP_COMMIT_KEYS',
  'COMPONENT_OVERRIDE_KEYS',
  'RAW_OVERRIDE_KEYS',
  'SEMANTIC_OVERRIDE_KEYS',
  'THEME_OVERRIDE_KEYS',
  'cssVarName',
  'parseThemeColor',
  'parseThemeValue',
  'themeColorCss',
  'themeOverrideStyle',
  'themeOverrideType',
  'themeValueCss',
  'useAppearance',
  'useDensity',
  'resolveSheetPresentation',
  'SHEET_NARROW_WIDTH',
  'ChipOverflow',
]);

function resolveExport(name: string): unknown {
  let current: unknown = todae;
  for (const part of name.split('.')) {
    if (typeof current !== 'object' || current === null || !(part in current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

describe('catalog invariants', () => {
  it('uses the committed catalog.json', () => {
    expect(catalog).toEqual(catalogJson);
  });

  it('has unique ids and no Combobox.* names', () => {
    const ids = [
      ...catalog.components.map((entry) => entry.name),
      ...catalog.patterns.map((entry) => entry.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.some((id) => id.startsWith('Combobox.'))).toBe(false);
  });

  it('resolves every component name on the package index', () => {
    for (const entry of catalog.components) {
      expect(resolveExport(entry.name), entry.name).toBeDefined();
    }
  });

  it('covers every public component, hook, and provider export', () => {
    const catalogNames = new Set(catalog.components.map((entry) => entry.name.split('.')[0]));
    for (const [name, value] of Object.entries(todae)) {
      if (ALLOW_EXPORTS.has(name)) continue;
      if (typeof value !== 'function' && (typeof value !== 'object' || value === null)) continue;
      expect(catalogNames.has(name) || catalog.components.some((entry) => entry.name === name), name).toBe(true);
    }
  });

  it('resolves related, uses, hooks, and tree components', () => {
    const componentIds = new Set(catalog.components.map((entry) => entry.name));
    for (const entry of catalog.components) {
      for (const rel of entry.related ?? []) {
        expect(componentIds.has(rel.id), `${entry.name} → ${rel.id}`).toBe(true);
      }
    }
    for (const pattern of catalog.patterns) {
      for (const id of pattern.uses) expect(componentIds.has(id), `${pattern.id} uses ${id}`).toBe(true);
      for (const hook of pattern.hooks ?? []) {
        expect(componentIds.has(hook.id), `${pattern.id} hook ${hook.id}`).toBe(true);
      }
      const visit = (node: { component: string; children?: readonly unknown[] }): void => {
        expect(componentIds.has(node.component), `${pattern.id} tree ${node.component}`).toBe(true);
        for (const child of node.children ?? []) {
          if (typeof child === 'object' && child !== null && 'component' in child) {
            visit(child as { component: string; children?: readonly unknown[] });
          }
        }
      };
      for (const node of pattern.tree) visit(node);
    }
  });

  it('matches the committed catalog file', async () => {
    const disk = await readFile(join(import.meta.dirname, '../../catalog/catalog.json'), 'utf8');
    expect(JSON.parse(disk)).toEqual(catalogJson);
  });
});
