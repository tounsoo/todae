import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ORIGIN } from '../origin';
import { exportsIn, getRecipe, listRecipes } from './recipes';

const recipeDirs = readdirSync(join(process.cwd(), 'app', '(en)', 'recipes'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('docs mcp recipes', () => {
  it('lists every recipe page with a summary and the exports it uses', () => {
    const listed = listRecipes();
    expect(listed.recipes.map((row) => row.name)).toEqual(recipeDirs);
    expect(listed.count).toBe(recipeDirs.length);
    for (const row of listed.recipes) {
      // Every recipe page opens its intro paragraph by saying it is one.
      expect(row.description, row.name).toMatch(/^A recipe, not a package namespace\. \S/);
      expect(row.description, row.name).not.toMatch(/…$/);
      expect(row.uses.length, row.name).toBeGreaterThan(0);
      expect(row.docsUrl).toBe(`${DOCS_ORIGIN}/recipes/${row.name}`);
    }
  });

  it('reads a recipe by name or title', () => {
    const recipe = getRecipe('Reasoning');
    expect(recipe.name).toBe('reasoning');
    expect(recipe.markdown).toContain('<Disclosure.Root open={thinking}>');
    expect(recipe.markdown).toContain(`](${DOCS_ORIGIN}/disclosure)`);
    expect(recipe.whenToUse).toBeTruthy();
    expect(getRecipe('data-table').title).toBe('Data table');
    expect(getRecipe(' DATA TABLE ').name).toBe('data-table');
    expect(Object.keys(recipe).sort()).toEqual(['docsUrl', 'markdown', 'name', 'source', 'title', 'whenNotToUse', 'whenToUse']);
    expect(() => getRecipe('dialog')).toThrow('Call list_recipes');
  });

  it('gives every recipe When and When not copy', () => {
    for (const row of listRecipes().recipes) {
      expect(row.hasWhenToUse, row.name).toBe(true);
      const recipe = getRecipe(row.name);
      expect(recipe.whenToUse, row.name).toBeTruthy();
      expect(recipe.whenNotToUse, row.name).toBeTruthy();
    }
  });

  it('finds the exports code names', () => {
    const code = [
      "import { Button } from '@tounsoo/todae';",
      'const cb = useCombobox({});',
      '<Field.TextInput {...cb.getInputProps()} /><Button.Root />',
    ].join('\n');
    expect(exportsIn(code)).toEqual(['Button.Root', 'Field.TextInput', 'useCombobox']);
  });
});
