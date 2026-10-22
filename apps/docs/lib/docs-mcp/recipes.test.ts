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
      expect(row.description, row.name).toMatch(/^A recipe, not a package namespace\. \S/);
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

  it('says when a recipe has no When to use copy', () => {
    expect(listRecipes().recipes.find((row) => row.name === 'combobox')?.hasWhenToUse).toBe(false);
    expect(getRecipe('combobox').whenToUse).toBeNull();
    expect(listRecipes().recipes.find((row) => row.name === 'reasoning')?.hasWhenToUse).toBe(true);
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
