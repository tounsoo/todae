import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Description, type DescriptionProps } from './Description';
import { Field } from './Field';
import * as api from '../index';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, 'Description.module.css'), 'utf8');
const docsCss = readFileSync(join(here, '../../../../apps/docs/app/globals.css'), 'utf8');

afterEach(cleanup);

describe('Description exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Description).toBe(Description);
    expectTypeOf<DescriptionProps>().toHaveProperty('id');
    expectTypeOf<DescriptionProps['id']>().toEqualTypeOf<string>();
  });
});

describe('Description', () => {
  it('renders a span with the required id', () => {
    const { container } = render(<Description id="email-hint">Use your work address.</Description>);
    const hint = container.querySelector('#email-hint');
    expect(hint?.tagName).toBe('SPAN');
    expect(hint?.textContent).toBe('Use your work address.');
    expect(hint).toHaveProperty('id', 'email-hint');
  });

  it('does not write aria-describedby', () => {
    render(
      <>
        <input aria-label="Email" />
        <Description id="email-hint">Use your work address.</Description>
      </>,
    );
    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBeNull();
  });

  it('is named when the author wires Field.Root', () => {
    render(
      <div className="labelled-field">
        <Field.Root id="mail" aria-describedby="email-hint">
          <Field.TextInput value="" onChange={() => undefined} />
        </Field.Root>
        <Description id="email-hint">Use your work address.</Description>
      </div>,
    );
    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe('email-hint');
    expect(document.getElementById('email-hint')?.textContent).toBe('Use your work address.');
  });

  it('is the next sibling of the Field shell', () => {
    const { container } = render(
      <div className="labelled-field">
        <Field.Root id="mail">
          <Field.TextInput value="" onChange={() => undefined} />
        </Field.Root>
        <Description id="email-hint">Use your work address.</Description>
      </div>,
    );
    const textbox = screen.getByRole('textbox');
    const hint = container.querySelector('#email-hint');
    expect(textbox.parentElement?.nextElementSibling).toBe(hint);
    expect(hint?.getAttribute('data-todae-description')).toBe('');
  });

  it('merges className and forwards extra attributes', () => {
    const { container } = render(
      <Description id="email-hint" className="extra" data-test="hint">
        Use your work address.
      </Description>,
    );
    const hint = container.querySelector('#email-hint');
    expect(hint?.className).toContain('description');
    expect(hint?.className).toContain('extra');
    expect(hint?.getAttribute('data-test')).toBe('hint');
  });

  it('owns control-to-message spacing', () => {
    expect(css).toMatch(/margin-block-start:\s*var\(--todae-field-label-gap\)/);
    expect(css).toMatch(/margin-block-end:\s*0/);
    expect(css).toMatch(/line-height:\s*1\.4/);
  });

  it('does not use a docs .messages stack', () => {
    expect(docsCss).not.toMatch(/\.messages/);
    expect(docsCss).toMatch(
      /\.labelled-field\s*>\s*:not\(\[data-todae-description\],\s*\[data-todae-error\]\)/,
    );
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

  it('SSR keeps the id', () => {
    const html = renderToString(<Description id="email-hint">Use your work address.</Description>);
    expect(html).toContain('id="email-hint"');
    expect(html).toContain('Use your work address.');
  });
});
