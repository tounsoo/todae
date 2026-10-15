import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Description, type DescriptionRootProps } from './Description';
import * as api from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'Description.module.css'), 'utf8');
const docsCss = readFileSync(join(here, '../../../../apps/docs/app/globals.css'), 'utf8');

afterEach(cleanup);

describe('Description exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Description).toBe(Description);
    expectTypeOf<DescriptionRootProps>().toHaveProperty('id');
    expectTypeOf<DescriptionRootProps['id']>().toEqualTypeOf<string>();
  });
});

describe('Description', () => {
  it('renders a span with the required id', () => {
    const { container } = render(<Description.Root id="email-hint">Use your work address.</Description.Root>);
    const hint = container.querySelector('#email-hint');
    expect(hint?.tagName).toBe('SPAN');
    expect(hint?.textContent).toBe('Use your work address.');
    expect(hint).toHaveProperty('id', 'email-hint');
    expect(hint?.getAttribute('data-todae-description')).toBe('');
  });

  it('merges className and forwards extra attributes', () => {
    const { container } = render(
      <Description.Root id="email-hint" className="extra" data-test="hint">
        Use your work address.
      </Description.Root>,
    );
    const hint = container.querySelector('#email-hint');
    expect(hint?.className).toContain('description');
    expect(hint?.className).toContain('extra');
    expect(hint?.getAttribute('data-test')).toBe('hint');
  });

  it('owns control-to-message spacing', () => {
    expect(css).toMatch(/margin-block-start:\s*var\(--todae-field-label-gap\)/);
    expect(css).toMatch(/margin-block-end:\s*0/);
    expect(css).toMatch(/line-height:\s*var\(--todae-field-description-leading\)/);
  });

  it('does not use a docs .messages stack', () => {
    expect(docsCss).not.toMatch(/\.messages/);
    // Field.Group spaces label, control and messages, so the docs keep no stack class of their own.
    expect(docsCss).not.toMatch(/\.labelled-field/);
    const demos = join(here, '../../../../apps/docs/components/demos');
    for (const name of [
      'DescriptionDemo.tsx',
      'ErrorMessageDemo.tsx',
      'CheckboxDemo.tsx',
      'RadioDemo.tsx',
      'SwitchDemo.tsx',
      'FieldDemo.tsx',
    ]) {
      expect(readFileSync(join(demos, name), 'utf8')).not.toMatch(/className=["']messages["']/);
    }
  });
});
