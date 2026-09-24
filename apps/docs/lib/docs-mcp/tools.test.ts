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
    const line = (prefix: string) => body?.split('\n').find((item) => item.startsWith(prefix))?.slice(prefix.length).trim();
    const result = whenToUse('OptionList');
    expect(result).toEqual({
      status: 'present',
      whenToUse: line('**When:**'),
      whenNotToUse: line('**When not:**'),
      docsUrl: 'https://todae-rho.vercel.app/optionlist',
      section: 'When to use',
      source: 'todae-docs',
    });
    const part = whenToUse('OptionList.Option');
    expect(part).toMatchObject({ status: 'present', whenToUse: line('**When:**'), scope: 'page' });
  });

  it('reports own copy separately from inherited page copy', () => {
    const listed = Object.fromEntries(listComponents().components.map((row) => [row.name, row]));
    expect(listed.BottomSheet).toMatchObject({ hasWhenToUse: true });
    expect(listed.BottomSheet).not.toHaveProperty('scope');
    expect(listed['BottomSheet.Title']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed['BottomSheet.Close']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed['BottomSheet.Grabber']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed.useSheetPresentation).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed.useTooltip).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed.usePopover).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed.Option).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed['OptionList.Option']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed['Field.Root']).toMatchObject({ hasWhenToUse: true });
    expect(listed['Field.Root']).not.toHaveProperty('scope');

    const sheet = whenToUse('BottomSheet');
    const part = whenToUse('BottomSheet.Title');
    expect(part).toMatchObject({ status: 'present', scope: 'page', whenToUse: sheet.whenToUse });
  });

  it('prefers a name subsection over page-level copy', () => {
    const mdx = `
## When to use

**When:** Page copy for the combobox.

**When not:** Not this hook.

### useSheetPresentation

**When:** Own sheet hook copy.
**When not:** Not the page sentence.

## Props
`;
    expect(parseWhen(mdx, 'useSheetPresentation')).toEqual({
      whenToUse: 'Own sheet hook copy.',
      whenNotToUse: 'Not the page sentence.',
      shared: false,
    });
    expect(parseWhen(mdx, 'Combobox')).toMatchObject({ whenToUse: 'Page copy for the combobox.', shared: true });
  });

  it('resolves providers from the tokens page subsections', () => {
    const missing = {
      status: 'missing' as const,
      whenToUse: null,
      whenNotToUse: null,
      docsUrl: 'https://todae-rho.vercel.app/tokens',
      note: "No 'When to use' section on /tokens. Not inferred.",
      source: 'todae-docs',
    };
    expect(whenToUse('ThemeProvider')).toEqual(missing);
    expect(whenToUse('DensityProvider')).toEqual(missing);
    const listed = Object.fromEntries(listComponents().components.map((row) => [row.name, row]));
    expect(listed.ThemeProvider).toMatchObject({ hasWhenToUse: false, docsUrl: missing.docsUrl });
    expect(listed.ThemeProvider).not.toHaveProperty('scope');

    const tokens = `
# Tokens

## When to use

**When:** Page-level token copy that providers must not inherit.

### ThemeProvider

**When:** Wrap the app once so contract vars exist.
**When not:** Per-control color props.

### DensityProvider

**When:** Set compact or comfortable for a subtree.
`;
    expect(parseWhen(tokens, 'ThemeProvider')).toEqual({
      whenToUse: 'Wrap the app once so contract vars exist.',
      whenNotToUse: 'Per-control color props.',
      shared: false,
    });
    expect(parseWhen(tokens, 'DensityProvider')).toMatchObject({
      whenToUse: 'Set compact or comfortable for a subtree.',
      shared: false,
    });
    expect(parseWhen('## When to use\n\n**When:** Page-level only.\n', 'ThemeProvider')).toBeNull();
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
    expect(whenToUse('Field')).toMatchObject({
      status: 'missing',
      docsUrl: 'https://todae-rho.vercel.app/field',
      note: "'When to use' on /field has no page-level copy; see its parts",
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
