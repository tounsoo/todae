import schema from '@tounsoo/todae/schema/components.json';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
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

  it('errors on an unknown name', () => {
    expect(() => getComponent('Nope')).toThrow('Unknown component "Nope". Call list_components.');
    expect(() => whenToUse('Nope')).toThrow('Unknown component "Nope". Call list_components.');
  });
});
