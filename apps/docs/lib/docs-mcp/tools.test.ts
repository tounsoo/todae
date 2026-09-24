import schema from '@tounsoo/todae/schema/components.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseWhen } from './mdx';
import { getComponent, listComponents, whenToUse } from './tools';

const jsonNames = schema.components.map((row) => row.name);

describe('docs mcp tools', () => {
  it('lists every components.json name', () => {
    const listed = listComponents();
    expect(listed.components.map((row) => row.name)).toEqual(jsonNames);
    expect(listed.count).toBe(jsonNames.length);
    expect(listed.source).toBe('todae-docs');
  });

  it('returns Dialog props equal to the schema', () => {
    const dialog = schema.components.find((row) => row.name === 'Dialog');
    const result = getComponent('dialog');
    expect(result.props).toEqual(dialog?.props);
    expect(result.docsUrl).toBe('https://todae-rho.vercel.app/dialog');
    expect(result.source).toBe('todae-docs');
  });

  it('returns Field.* for the Field namespace', () => {
    const result = getComponent('Field');
    expect(result).toMatchObject({
      name: 'Field',
      namespace: true,
      description: null,
      props: [],
      docsUrl: 'https://todae-rho.vercel.app/field',
    });
    expect(result.parts.map((part) => part.name)).toEqual(jsonNames.filter((name) => name.startsWith('Field.')));
  });

  it('returns the OptionList when-to-use section from MDX', () => {
    const mdx = readFileSync(join(process.cwd(), 'app/optionlist/page.mdx'), 'utf8');
    const body = mdx.split('## When to use\n')[1]?.split('\n## ')[0]?.trim().replaceAll('](/', '](https://todae-rho.vercel.app/');
    const result = whenToUse('OptionList');
    expect(result).toEqual({
      status: 'present',
      whenToUse: body,
      whenNotToUse: null,
      docsUrl: 'https://todae-rho.vercel.app/optionlist',
      section: 'When to use',
      source: 'todae-docs',
    });
    const part = whenToUse('OptionList.Option');
    expect(part).toMatchObject({ status: 'present', whenToUse: body, scope: 'page' });
  });

  it('reports Dialog when-to-use as missing', () => {
    expect(whenToUse('Dialog')).toEqual({
      status: 'missing',
      whenToUse: null,
      whenNotToUse: null,
      docsUrl: 'https://todae-rho.vercel.app/dialog',
      note: "No 'When to use' section on /dialog. Not inferred.",
      source: 'todae-docs',
    });
  });

  it('reads #24-style when lines and Field subsections', () => {
    const field = `
## When to use

### Field.Root

**When:** Shared field chrome for one text or chip input — focus ring, disabled/invalid, density. Value lives on the input part.
**When not:** Selection controls (Checkbox / Radio / Switch). Overlay triggers that are buttons. Nesting another compound root inside.

### Field.TextInput

**When:** Single-line typed value inside \`Field.Root\` (text / search / email / url / tel / password).

**When not:** Multi-value tokens → \`Field.ChipInput\`. Multi-line → Textarea (not shipped). Standalone without Root.

## Props
`;
    expect(parseWhen(field, 'Field.TextInput')).toEqual({
      whenToUse: 'Single-line typed value inside `Field.Root` (text / search / email / url / tel / password).',
      whenNotToUse: 'Multi-value tokens → `Field.ChipInput`. Multi-line → Textarea (not shipped). Standalone without Root.',
      shared: false,
    });
    expect(parseWhen(field, 'Field.Root')).toMatchObject({
      whenToUse: 'Shared field chrome for one text or chip input — focus ring, disabled/invalid, density. Value lives on the input part.',
      whenNotToUse: 'Selection controls (Checkbox / Radio / Switch). Overlay triggers that are buttons. Nesting another compound root inside.',
    });
    expect(parseWhen(field, 'Field.Label')).toBeNull();

    const tooltip = `
## When to use

**When:** Short hint for a control (icon-only name, truncated label). Use \`useTooltip\` + surface-only \`Tooltip\`. Default tip is text-only (\`role="tooltip"\`). Button sugar tips icon-only / overflow labels.

**When not:** Links inside the tip → \`useTooltip({ interactive: true })\` (non-modal tip dialog; links only). Menus or other actions → Popover. Long help → Description. Modal tasks → Dialog.

## Props
`;
    expect(parseWhen(tooltip, 'Tooltip')).toEqual({
      whenToUse:
        'Short hint for a control (icon-only name, truncated label). Use `useTooltip` + surface-only `Tooltip`. Default tip is text-only (`role="tooltip"`). Button sugar tips icon-only / overflow labels.',
      whenNotToUse:
        'Links inside the tip → `useTooltip({ interactive: true })` (non-modal tip dialog; links only). Menus or other actions → Popover. Long help → Description. Modal tasks → Dialog.',
      shared: true,
    });
    expect(parseWhen('# Tooltip\n\n## Props\n', 'Tooltip')).toBeNull();
    expect(parseWhen('## When to use\n\nStay.\n\n## When not to use\n\nLeave.\n', 'Tooltip')).toMatchObject({
      whenToUse: 'Stay.',
      whenNotToUse: 'Leave.',
    });
  });

  it('errors on an unknown name', () => {
    expect(() => getComponent('Nope')).toThrow('Unknown component "Nope". Call list_components.');
    expect(() => whenToUse('Nope')).toThrow('Unknown component "Nope". Call list_components.');
  });
});
