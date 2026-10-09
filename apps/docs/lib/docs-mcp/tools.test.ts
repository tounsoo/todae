import schema from '@tounsoo/todae/schema/components.json';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPages, missingWhenNote, parseWhen } from './mdx';
import { getComponent, listComponents, whenToUse } from './tools';

const jsonNames = schema.components.map((row) => row.name);

describe('docs mcp tools', () => {
  it('lists every components.json name', () => {
    const listed = listComponents();
    expect(listed.components.map((row) => row.name)).toEqual(jsonNames);
    expect(listed.count).toBe(jsonNames.length);
    expect(listed.source).toBe('todae-docs');
  });

  it('shows Popover role and keeps the one-line when-to-use rule', () => {
    const popover = getComponent('Popover.Root');
    expect(popover.props).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'role', type: '"dialog"', required: false })]),
    );
    expect(whenToUse('Popover').whenToUse).toContain('No focus trap');
  });

  it('returns Dialog props equal to the schema', () => {
    const dialog = schema.components.find((row) => row.name === 'Dialog.Root');
    const result = getComponent('dialog.root');
    expect(result.props).toEqual(dialog?.props);
    expect(result.docsUrl).toBe('https://todae-rho.vercel.app/dialog');
    expect(result.source).toBe('todae-docs');
  });

  it('resolves every compound as a namespace with a Root part', () => {
    for (const [name, slug] of [
      ['Dialog', 'dialog'],
      ['BottomSheet', 'bottomsheet'],
      ['OptionList', 'optionlist'],
      ['Popover', 'popover'],
      ['Tooltip', 'tooltip'],
      ['Chip', 'chip'],
      ['ChipList', 'chip-list'],
      ['RadioGroup', 'radio'],
      ['Menu', 'menu'],
      ['Tabs', 'tabs'],
    ] as const) {
      const result = getComponent(name);
      expect(result).toMatchObject({ name, namespace: true, docsUrl: `https://todae-rho.vercel.app/${slug}` });
      expect(result.parts.map((part) => part.name)).toContain(`${name}.Root`);
      expect(whenToUse(`${name}.Root`)).toMatchObject({ status: 'present' });
      expect(whenToUse(`${name}.Root`)).not.toHaveProperty('scope');
    }
    expect(getComponent('Button').parts.map((part) => part.name)).toContain('Button.Group');
    for (const old of ['Option', 'Radio', 'ButtonGroup', 'ChipOverflow']) {
      expect(jsonNames).not.toContain(old);
    }
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
    const mdx = readFileSync(join(process.cwd(), 'app/(en)/optionlist/page.mdx'), 'utf8');
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
    expect(listed['BottomSheet.Root']).toMatchObject({ hasWhenToUse: true });
    expect(listed['BottomSheet.Root']).not.toHaveProperty('scope');
    expect(listed['BottomSheet.Title']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed['BottomSheet.Close']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed['BottomSheet.Grabber']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed.useSheetPresentation).toMatchObject({ hasWhenToUse: true });
    expect(listed.useSheetPresentation).not.toHaveProperty('scope');
    expect(listed.useTooltip).toMatchObject({ hasWhenToUse: true });
    expect(listed.useTooltip).not.toHaveProperty('scope');
    expect(listed.usePopover).toMatchObject({ hasWhenToUse: true });
    expect(listed.usePopover).not.toHaveProperty('scope');
    expect(listed['OptionList.Option']).toMatchObject({ hasWhenToUse: false, scope: 'page' });
    expect(listed['Field.Root']).toMatchObject({ hasWhenToUse: true });
    expect(listed['Field.Root']).not.toHaveProperty('scope');
    expect(listed.useCombobox).toMatchObject({ hasWhenToUse: true });
    expect(listed.useCombobox).not.toHaveProperty('scope');
    expect(listed['RadioGroup.Root']).toMatchObject({ hasWhenToUse: true });
    expect(listed['RadioGroup.Root']).not.toHaveProperty('scope');
    expect(listed['RadioGroup.Item']).toMatchObject({ hasWhenToUse: true });
    expect(listed['RadioGroup.Item']).not.toHaveProperty('scope');

    const sheet = whenToUse('BottomSheet');
    const part = whenToUse('BottomSheet.Title');
    expect(part).toMatchObject({ status: 'present', scope: 'page', whenToUse: sheet.whenToUse });
    expect(whenToUse('BottomSheet.Footer')).toMatchObject({
      status: 'present',
      scope: 'page',
      whenToUse: sheet.whenToUse,
      docsUrl: 'https://todae-rho.vercel.app/bottomsheet',
    });
    const dialog = whenToUse('Dialog');
    expect(whenToUse('Dialog.Body')).toMatchObject({
      status: 'present',
      scope: 'page',
      whenToUse: dialog.whenToUse,
      docsUrl: 'https://todae-rho.vercel.app/dialog',
    });
    const hook = whenToUse('useSheetPresentation');
    const combobox = whenToUse('useCombobox');
    expect(hook).toMatchObject({
      status: 'present',
      whenToUse: 'Choose popover or sheet at runtime: coarse pointer or width under 640px (by default) → sheet. SSR and first paint are popover. `forced` overrides.',
      whenNotToUse: 'Always a centered modal → Dialog. Always a sheet → BottomSheet alone. Desktop-only anchored overlay → [usePopover](https://todae-rho.vercel.app/utilities/use-popover) alone.',
    });
    expect(hook).not.toHaveProperty('scope');
    expect(combobox).toMatchObject({ status: 'present' });
    expect(combobox).not.toHaveProperty('scope');
    // Every hook in the schema has its own page under Utilities, slugged from its name.
    const hooks = listComponents().components.filter((row) => /^use[A-Z]/.test(row.name));
    expect(hooks.map((row) => row.name)).toEqual(expect.arrayContaining(['useAnnouncer', 'useChipField', 'useChipList', 'useCombobox', 'useControlledState', 'useControlledValue', 'usePopover', 'useSheetPresentation', 'useTooltip']));
    for (const { name } of hooks) {
      const slug = name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
      expect(getComponent(name).docsUrl, name).toBe(`https://todae-rho.vercel.app/utilities/${slug}`);
      const copy = whenToUse(name);
      expect(copy, name).toMatchObject({ status: 'present' });
      expect(copy, name).not.toHaveProperty('scope');
    }
    const popoverNot = whenToUse('usePopover').whenNotToUse;
    expect(popoverNot).toContain('[Menu](https://todae-rho.vercel.app/menu)');
    expect(popoverNot).toContain('BottomSheet');
    expect(whenToUse('useCombobox').whenNotToUse).toContain('Exporting `Combobox.*` chrome (forbidden)');
    expect(getComponent('useField').docsUrl).toBe('https://todae-rho.vercel.app/utilities/use-field');
    expect(getComponent('useRovingFocus').docsUrl).toBe('https://todae-rho.vercel.app/utilities/use-roving-focus');
    expect(whenToUse('useField')).toMatchObject({ status: 'present' });
    expect(whenToUse('RadioGroup')).toMatchObject({ status: 'present' });
    expect(whenToUse('RadioGroup')).not.toHaveProperty('scope');
    expect(hook.whenToUse).not.toBe(combobox.whenToUse);
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
    expect(whenToUse('ThemeProvider')).toEqual({
      status: 'present',
      whenToUse:
        'Set appearance (system / light / dark) for a subtree via `data-appearance`; nested providers override. `overrides` for allowlisted token paths only.',
      whenNotToUse:
        'Spacing density → DensityProvider. Raw CSS or unknown token keys (rejected).',
      docsUrl: 'https://todae-rho.vercel.app/tokens',
      section: 'When to use',
      source: 'todae-docs',
    });
    expect(whenToUse('DensityProvider')).toMatchObject({
      status: 'present',
      whenToUse: 'Set spacing density (compact / comfortable / spacious) for a subtree via `data-density`. Spacing only.',
      whenNotToUse: 'Color or light / dark → ThemeProvider. Type size → Text `size`.',
      docsUrl: 'https://todae-rho.vercel.app/tokens',
    });
    const listed = Object.fromEntries(listComponents().components.map((row) => [row.name, row]));
    expect(listed.ThemeProvider).toMatchObject({ hasWhenToUse: true, docsUrl: 'https://todae-rho.vercel.app/tokens' });
    expect(listed.DensityProvider).toMatchObject({ hasWhenToUse: true });
    expect(listed.ThemeProvider).not.toHaveProperty('scope');
    const tokensMdx = readFileSync(join(process.cwd(), 'app/(en)/tokens/page.mdx'), 'utf8');
    const whenBody = tokensMdx.split('## When to use\n')[1]?.split('\n## ')[0] ?? '';
    expect(whenBody).not.toContain('TokensCatalog');

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

  it('reports Dialog own copy and Field page-level gap', () => {
    expect(whenToUse('Dialog')).toMatchObject({
      status: 'present',
      whenToUse:
        'Centered modal task or confirm (native `<dialog>`, controlled `open` or uncontrolled `defaultOpen`). Name via `Dialog.Title` or `aria-label`. Escape + scrim dismiss by default.',
      whenNotToUse:
        'Mobile picker from the bottom → BottomSheet. Full-height side panel → Drawer. Non-modal anchored panel → Popover. Short hint → Tooltip. Needs to become a sheet on mobile (Dialog never morphs).',
    });
    expect(whenToUse('Dialog')).not.toHaveProperty('scope');
    expect(whenToUse('Field.Textarea')).toMatchObject({
      status: 'present',
      docsUrl: 'https://todae-rho.vercel.app/field',
      section: 'When to use',
      whenToUse:
        'Multi-line free text such as notes, messages or descriptions. `rows` sets the starting height, and `autoGrow` grows it up to `maxRows` with CSS only.',
      whenNotToUse:
        'Single-line values, use `Field.TextInput`. Separate tags or tokens, use `Field.ChipInput`. Rich text or formatting, not shipped.',
    });
    expect(whenToUse('Field.Textarea')).not.toHaveProperty('scope');
    expect(whenToUse('Field.Counter')).toMatchObject({
      status: 'present',
      whenToUse:
        'Show a live character count for a `Field.TextInput` or `Field.Textarea`, as `n / max` when `maxLength` is set and `n` otherwise.',
      whenNotToUse:
        'For a hard limit with no visible count, set `maxLength` alone, and skip it on short fixed-length values like codes or PINs.',
    });
    expect(JSON.stringify(whenToUse('Field.Counter'))).not.toContain('Footer');
    expect(whenToUse('Field')).toMatchObject({
      status: 'missing',
      docsUrl: 'https://todae-rho.vercel.app/field',
      note: "'When to use' on /field has no page-level copy; see its parts",
    });
    expect(missingWhenNote('# Dialog\n\n## Props\n', 'dialog')).toBe("No 'When to use' section on /dialog. Not inferred.");
  });

  it('gives every listed name own copy or a parent page to inherit', () => {
    const gaps = listComponents().components.filter((row) => !row.hasWhenToUse && row.scope !== 'page');
    expect(gaps.map((row) => row.name)).toEqual([]);
    const own = [
      'BottomSheet.Root',
      'Checkbox',
      'Field.Affix',
      'Field.ChipInput',
      'Field.Counter',
      'Field.Icon',
      'Field.Root',
      'Field.Row',
      'Field.TextInput',
      'Field.Textarea',
      'OptionList.Root',
      'Popover.Root',
      'RadioGroup.Item',
      'RadioGroup.Root',
      'Switch',
      'Tooltip.Root',
      'useCombobox',
      'Button.Icon',
      'Button.Root',
      'Button.Group',
      'Chip.Root',
      'DensityProvider',
      'Description',
      'Dialog.Root',
      'ErrorMessage',
      'Label',
      'Stack',
      'Text',
      'ThemeProvider',
      'useChipField',
      'useChipList',
      'useSheetPresentation',
    ];
    const listed = Object.fromEntries(listComponents().components.map((row) => [row.name, row]));
    for (const name of own) {
      expect(listed[name]).toMatchObject({ hasWhenToUse: true });
      expect(listed[name]).not.toHaveProperty('scope');
    }
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

  it('does not inherit a parent page for unknown dotted names', () => {
    for (const name of ['Dialog.Nope', 'Foo.Bar']) {
      const message = `Unknown component "${name}". Call list_components.`;
      expect(() => whenToUse(name)).toThrow(message);
      expect(() => getComponent(name)).toThrow(message);
    }
  });

  it('rejects path-like names before any page lookup', () => {
    for (const name of [
      '../field',
      '../x',
      'recipes/../x',
      'Dialog/../../etc',
      '/',
      '/etc/passwd',
      '/recipes/chip-list',
      'recipes/chip-list',
      '../package',
      'Dialog.Body%2F..',
      '',
      'Dialog.Body\n',
      'a/b',
    ]) {
      const message = `Unknown component "${name}". Call list_components.`;
      expect(() => whenToUse(name)).toThrow(message);
      expect(() => getComponent(name)).toThrow(message);
    }
  });

  it('reads nested recipe pages and skips symlinks that leave app/', () => {
    const root = mkdtempSync(join(tmpdir(), 'todae-pages-'));
    const app = join(root, 'app');
    const outside = join(root, 'outside');
    try {
      mkdirSync(join(app, 'recipes', 'chip-list'), { recursive: true });
      mkdirSync(join(app, 'field'), { recursive: true });
      mkdirSync(join(outside, 'secret'), { recursive: true });
      writeFileSync(join(app, 'field', 'page.mdx'), '# Field\n');
      writeFileSync(
        join(app, 'recipes', 'chip-list', 'page.mdx'),
        '# Chip list with overflow\n\n<PropsTable name="useChipList" />\n',
      );
      writeFileSync(join(outside, 'secret', 'page.mdx'), '# Secret\n');
      symlinkSync(outside, join(app, 'linked'));
      symlinkSync(join(root, 'outside'), join(app, 'recipes', 'escape'));
      symlinkSync(join(outside, 'secret', 'page.mdx'), join(app, 'recipes', 'page.mdx'));
      const pages = loadPages(app);
      expect(pages.map((page) => page.slug).sort()).toEqual(['field', 'recipes/chip-list']);
      expect(pages.some((page) => page.markdown.includes('Secret'))).toBe(false);
      expect(pages.find((page) => page.slug === 'recipes/chip-list')?.props).toEqual(['useChipList']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('gives each props table one page, so a name has one docs URL', () => {
    const owners = new Map<string, string[]>();
    for (const page of loadPages(join(process.cwd(), 'app', '(en)'))) {
      for (const name of page.props) owners.set(name, [...(owners.get(name) ?? []), page.slug]);
    }
    expect([...owners].filter(([, slugs]) => slugs.length > 1)).toEqual([]);
  });

  it('gives useChipList its own utility page and ChipList its component page', () => {
    const names = listComponents().components.map((row) => row.name);
    expect(names).toContain('useChipList');
    expect(whenToUse('ChipList.Root')).toMatchObject({
      status: 'present',
      docsUrl: 'https://todae-rho.vercel.app/chip-list',
    });
    const result = whenToUse('useChipList');
    expect(result).toMatchObject({
      status: 'present',
      docsUrl: 'https://todae-rho.vercel.app/utilities/use-chip-list',
    });
    expect(result).not.toHaveProperty('scope');
    expect(result.whenToUse).toContain('maxRows');
    expect(result.whenNotToUse).not.toMatch(/not reachable/);
    expect(result.whenNotToUse).not.toMatch(/non-modal popover/);
    expect(result.whenNotToUse).toBeTruthy();
    expect(result.whenNotToUse).toContain('Checkbox / Button.Root');
    expect(result.whenNotToUse).toContain('/recipes/combobox');
  });
});
