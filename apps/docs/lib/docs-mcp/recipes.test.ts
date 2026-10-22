import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOCS_ORIGIN } from '../origin';
import { getRecipe, exportsIn, listRecipes, summaryOf } from './recipes';

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
      expect(row.description, row.name).toBeTruthy();
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
    expect(() => getRecipe('dialog')).toThrow('Call list_recipes');
  });

  it('takes the first paragraph after the title as the summary', () => {
    const markdown = "import { X } from './x';\n\n# Title\n\nFirst line\nsecond line.\n\nMore.";
    expect(summaryOf(markdown)).toBe('First line second line.');
  });

  it('finds exports named in code blocks only', () => {
    const markdown = [
      'Uses a [Disclosure.Root](/disclosure) and Field.Root in prose.',
      '```tsx',
      "import { Button } from '@tounsoo/todae';",
      'const cb = useCombobox({});',
      '<Field.TextInput {...cb.getInputProps()} /><Button.Root />',
      '```',
    ].join('\n');
    expect(exportsIn(markdown)).toEqual(['Button.Root', 'Field.TextInput', 'useCombobox']);
  });
});
