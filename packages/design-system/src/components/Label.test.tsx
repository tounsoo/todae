import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { Label, type LabelRootProps } from './Label';
import * as api from '../index';

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'Label.module.css'), 'utf8');

afterEach(cleanup);

describe('Label exports', () => {
  it('is a top-level primitive', () => {
    expect(api.Label).toBe(Label);
    expectTypeOf<LabelRootProps>().toHaveProperty('htmlFor');
    expectTypeOf<LabelRootProps['htmlFor']>().toEqualTypeOf<string>();
  });
});

describe('Label', () => {
  it('associates a native input through htmlFor', () => {
    const { container } = render(
      <>
        <Label.Root htmlFor="mail">Email</Label.Root>
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

  it('merges className and forwards extra attributes', () => {
    const { container } = render(
      <Label.Root htmlFor="mail" className="extra" data-test="caption">
        Email
      </Label.Root>,
    );
    const label = container.querySelector('label');
    expect(label?.className).toContain('label');
    expect(label?.className).toContain('extra');
    expect(label?.getAttribute('data-test')).toBe('caption');
  });

  it('carries no margin', () => {
    expect(css).not.toMatch(/margin/);
  });
});
