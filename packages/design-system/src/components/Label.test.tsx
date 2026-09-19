import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Field } from './Field';
import { Label, type LabelProps } from './Label';
import * as api from '../index';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Label.module.css'), 'utf8');

afterEach(cleanup);

describe('Label exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Label).toBe(Label);
    expectTypeOf<LabelProps>().toHaveProperty('htmlFor');
    expectTypeOf<LabelProps['htmlFor']>().toEqualTypeOf<string>();
  });
});

describe('Label', () => {
  it('associates a native input through htmlFor', () => {
    const { container } = render(
      <>
        <Label htmlFor="mail">Email</Label>
        <input id="mail" />
      </>,
    );
    const input = screen.getByLabelText('Email');
    const label = container.querySelector('label');
    expect(input).toHaveProperty('id', 'mail');
    expect(label?.htmlFor).toBe('mail');
    expect(label?.control).toBe(input);
    expect(label?.tagName).toBe('LABEL');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('associates a Field.TextInput when Root shares the id', () => {
    const { container } = render(
      <>
        <Label htmlFor="mail">Email</Label>
        <Field.Root id="mail">
          <Field.TextInput value="" onChange={() => undefined} />
        </Field.Root>
      </>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toBe(screen.getByRole('textbox'));
    expect(input).toHaveProperty('id', 'mail');
    expect(container.querySelector('label')?.htmlFor).toBe('mail');
    expect(container.querySelector('label')?.control).toBe(input);
  });

  it('associates a ChipInput and keeps one textbox', () => {
    render(
      <>
        <Label htmlFor="tags">Tags</Label>
        <Field.Root id="tags">
          <Field.ChipInput
            chips={['alpha']}
            inputValue=""
            onInputValueChange={() => undefined}
            onCommit={() => undefined}
            onChipRemove={() => undefined}
          />
        </Field.Root>
      </>,
    );
    expect(screen.getByLabelText('Tags')).toBe(screen.getByRole('textbox'));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('merges className and forwards extra attributes', () => {
    const { container } = render(
      <Label htmlFor="mail" className="extra" data-test="caption">
        Email
      </Label>,
    );
    const label = container.querySelector('label');
    expect(label?.className).toContain('label');
    expect(label?.className).toContain('extra');
    expect(label?.getAttribute('data-test')).toBe('caption');
  });

  it('carries no margin', () => {
    expect(css).not.toMatch(/margin/);
  });

  it('is the previous sibling of the Field shell', () => {
    const { container } = render(
      <div className="labelled-field">
        <Label htmlFor="mail">Email</Label>
        <Field.Root id="mail">
          <Field.TextInput value="" onChange={() => undefined} />
        </Field.Root>
      </div>,
    );
    const textbox = screen.getByRole('textbox');
    expect(container.querySelector('label')?.nextElementSibling?.contains(textbox)).toBe(true);
  });

  it('SSR matches for and id', () => {
    const html = renderToString(
      <>
        <Label htmlFor="mail">Email</Label>
        <input id="mail" />
      </>,
    );
    expect(html).toContain('for="mail"');
    expect(html).toContain('id="mail"');
  });
});
